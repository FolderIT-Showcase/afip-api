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

	getToken(code, type, service) {
		return new Promise((resolve, reject) => {
			var Tokens = mongoose.model('Tokens');

			Tokens.findOne({
				code: code,
				type: type,
				service: service,
				since: { $lte: moment().format() },
				until: { $gte: moment().format() }
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
			this.getCurrentTime().then((date) => {
				var tomorrow = new Date();

				tomorrow.setDate(date.getDate() + 1);

				tomorrow.setMinutes(date.getMinutes());

				var data = [{
					loginTicketRequest: [
						{ _attr: { version: '1.0' } }, {
							header: [
								{ uniqueId: moment().format('X') },
								{ generationTime: this.formatDate(date) },
								{ expirationTime: this.formatDate(tomorrow) }
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

				this.encryptXML(code, xml).then(resolve).catch(reject);
			}).catch(reject);
		});
	}

	generateToken(code, type, service, refresh = false) {
		// Parse some of the Services
		if (service == 'wsfev1') {
			service = 'wsfe';
		}

		return new Promise((resolve, reject) => {
			this.getToken(code, type, service).then((token) => {
				if (token) {
					resolve(token.credentials);
				} else {
					logger.info("Generando token...", code);

					this.createClient(type).then((client) => {
						this.generateCMS(code, service).then((data) => {
							client.loginCms({
								in0: data
							}, (err, result, raw, soapHeader) => {
								this.parseXML(raw).then((res) => {
									var body = res.envelope.body;

									var xml_response = body.logincmsresponse ? res.envelope.body.logincmsresponse.logincmsreturn : undefined;

									if (xml_response) {
										this.parseXML(xml_response).then((res) => {
											var credentials = res.loginticketresponse.credentials;

											var Tokens = mongoose.model('Tokens');

											var token = new Tokens({
												code: code,
												type: type,
												service: service,
												credentials: credentials,
												since: moment().format(),
												until: moment().add(12, "hours").format()
											});

											token.save().then((token) => {
												resolve(token.credentials)
											}, (err) => {
												reject(err);
											});
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
					});
				}
			}).catch(reject);
		});
	}
}

module.exports = new Tokens();
