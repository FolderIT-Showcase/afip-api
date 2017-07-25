'use strict';

var fs = require('fs'),
	path = require('path'),
	soap = require('strong-soap').soap,
	moment = require('moment'),
	xml2js = require('xml2js'),
	parseString = xml2js.parseString,
	XmlBuild = require('xml'),
	ntpClient = require('ntp-client'),
	SignHelper = require('./SignHelper'),
	AfipURLs = require('./urls'),
	// xsd = require('libxml-xsd'),
	mongoose = require('mongoose'),
	logger = require('tracer').colorConsole(global.loggerFormat);

class Tokens {
	constructor(code) {
		this.client = {
			"PROD": false,
			"HOMO": false
		};
	}

	createClient(type) {
		return new Promise((resolve, reject) => {
			if (this.client[type]) {
				resolve(this.client[type]);
			} else {
				soap.createClient(AfipURLs.getWSAA(type), (err, client) => {
					if (err && !client) {
						reject();
					} else {
						this.client[type] = client;

						resolve(this.client[type]);
					}
				});
			}
		});
	}

	getToken(code, type, service, refresh) {
		return new Promise((resolve, reject) => {
			if (refresh === true) {
				return resolve(undefined);
			}

			var Tokens = mongoose.model('Tokens');

			Tokens.findOne({
				code: code,
				type: type,
				service: service,
				since: { $lte: moment().format() },
				until: { $gte: moment().format() }
			}).sort({
				since: -1
			}).then(function (token) {
				if (!token)
					resolve(undefined)

				resolve(token);
			}, function (err) {
				reject(err);
			});
		});
	}

	getCurrentTime() {
		return new Promise((resolve, reject) => {
			ntpClient.getNetworkTime("time.afip.gov.ar", 123, function (err, date) {
				if (err) {
					reject(err);
				} else {
					resolve(date);
				}
			});
		});
	}

	openssl_pkcs7_sign(code, data, callback) {
		var Clients = mongoose.model('Clients');

		Clients.findOne({
			code: code
		}).then(function (client) {
			if (!client) {
				callback({ message: "Client not found: " + code });
				return false;
			}

			var cert = path.join(global.appRoot, 'keys', client.code + '.pem');
			var key = path.join(global.appRoot, 'keys', client.code + '.key');

			fs.writeFile(cert, client.signer, 'utf8', (err) => {
				if (err)
					logger.error(err);

				fs.writeFile(key, client.key, 'utf8', (err) => {
					if (err)
						logger.error(err);

					SignHelper.sign({
						content: data,
						cert: cert,
						key: key
					}).catch(function (err) {
						callback(err);
					}).then(function (result) {
						callback(null, result);
					});
				});
			});
		}, callback);
	}

	encryptXML(code, xml) {
		return new Promise((resolve, reject) => {
			this.openssl_pkcs7_sign(code, xml, (err, enc) => {
				if (err) {
					reject(err);
				} else {
					resolve(enc);
				}
			});
		});
	}

	parseXML(data) {
		return new Promise((resolve, reject) => {
			parseString(data, {
				normalizeTags: true,
				normalize: true,
				explicitArray: false,
				attrkey: 'header',
				tagNameProcessors: [(key) => { return key.replace('soapenv:', ''); }]
			}, (err, res) => {
				if (err) reject(err);
				else resolve(res);
			});
		});
	}

	formatDate(date) {
		return moment(date).format();
	}

	generateCMS(code, service) {
		return new Promise((resolve, reject) => {
			var dates;
			this.getCurrentTime().then((date) => {
				var tomorrow = new Date();

				tomorrow.setDate(date.getDate() + 1);
				tomorrow.setHours(date.getHours() - 18);

				dates = {
					generationTime: this.formatDate(date),
					expirationTime: this.formatDate(tomorrow)
				};

				var data = [{
					loginTicketRequest: [
						{ _attr: { version: '1.0' } }, {
							header: [
								{ uniqueId: moment().format('X') },
								{ generationTime: dates.generationTime },
								{ expirationTime: dates.expirationTime }
							]
						}, {
							service: service
						}
					]
				}];

				var xml = XmlBuild(data, { declaration: true });

				// var validationErrors = xsd.parse(fs.readFileSync('./schemas/wsaa.xml', 'utf8')).validate(xml);
				// if (validationErrors)
				// 	logger.error(validationErrors)

				return this.encryptXML(code, xml);
			}).then((in0) => {
				resolve({
					in0: in0,
					dates: dates
				});
			}).catch(reject);
		});
	}

	generateToken(code, type, service, refresh = false) {
		// Parsear servicios con códigos específicos
		if (service == 'wsfev1') {
			service = 'wsfe';
		}

		if (service == 'wsfexv1') {
			service = 'wsfex';
		}

		var client;

		return new Promise((resolve, reject) => {
			this.getToken(code, type, service, refresh).then((token) => {
				if (token) {
					resolve(token);
				} else {
					logger.info("Generando token...", code);

					this.createClient(type).then((newClient) => {
						client = newClient;
						return this.generateCMS(code, service);
					}).then((cms) => {
						client.loginCms({
							in0: cms.in0
						}, (err, result, raw, soapHeader) => {
							this.parseXML(raw).then((res) => {
								var body = res.envelope.body;

								var xml_response = body.logincmsresponse ? res.envelope.body.logincmsresponse.logincmsreturn : undefined;

								if (xml_response) {
									this.parseXML(xml_response).then((res) => {
										var credentials = res.loginticketresponse.credentials;

										var Tokens = mongoose.model('Tokens');

										var newToken = new Tokens({
											code: code,
											type: type,
											service: service,
											credentials: credentials,
											since: cms.dates.generationTime,
											until: cms.dates.expirationTime
										});

										return newToken.save();
									}).then((newToken) => {
										resolve(newToken)
									}).catch(reject);
								} else {
									reject({
										fault: body.fault,
										message: body.fault.faultstring
									});
								}
							});
						});
					}).catch(reject);
				}
			}).catch(reject);
		});
	}
}

module.exports = new Tokens();
