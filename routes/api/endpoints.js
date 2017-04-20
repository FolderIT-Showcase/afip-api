'use strict';

var _ = require('lodash'),
	soap = require('strong-soap').soap,
	request = require('request'),
	WSAA = require('../../helpers/wsaa'),
	AfipURLs = require('../../helpers/urls'),
	mongoose = require('mongoose'),
	md5 = require('md5'),
	jwt = require('jsonwebtoken'),
	moment = require('moment'),
	_ = require('lodash'),
	fs = require('fs'),
	path = require('path'),
	logger = require('tracer').colorConsole(global.loggerFormat);

class Endpoints {
	constructor(app) {
		//Autenticacion
		app.post('/api/login', this.login.bind(this));

		app.get('/api/consultarCuit/:cuit', this.consultar_cuit.bind(this));

		//Verificacion de token o username+password
		app.use(this.authenticate.bind(this));

		app.post('/api/:service/describe', this.describe.bind(this));

		app.get('/api/getClients', this.getClients.bind(this));

		app.get('/api/getUsers', this.getUsers.bind(this));

		app.get('/api/transactions/:code', this.getTransactions.bind(this));

		app.post('/api/lastCbte', this.lastCbte.bind(this));

		app.post('/api/:service/:code/refresh/token', this.recreate_token.bind(this));

		app.post('/api/:service/:endpoint', this.endpoint.bind(this));

		app.post('/api/newUser', this.newUser.bind(this));

		app.post('/api/newClient', this.newClient.bind(this));

		app.post('/api/editClient', this.editClient.bind(this));

		app.post('/api/removeClient', this.removeClient.bind(this));

		app.post('/api/removeUser', this.removeUser.bind(this));

		app.post('/api/generarCae', this.generar_cae.bind(this));


		this.clients = {};
	}

	generar_cae(req, res) {
		var code = req.body.code;
		var version = "v1";
		var service = "wsfev1";
		var endpoint = "FECAESolicitar";

		var impNeto = parseFloat(req.body.ImpNeto.replace(' ', '').replace('.', '').replace(',', '.'));
		var impConc = parseFloat(req.body.ImpConc.replace(' ', '').replace('.', '').replace(',', '.'));
		var impExento = parseFloat(req.body.ImpOpEx.replace(' ', '').replace('.', '').replace(',', '.'));
		var impTrib = parseFloat(req.body.ImpTrib.replace(' ', '').replace('.', '').replace(',', '.'));
		var impIVA = parseFloat(req.body.ImpIva.replace(' ', '').replace('.', '').replace(',', '.'));
		var impTotal = parseFloat((impNeto + impConc + impExento + impTrib + impIVA).toFixed(2));

		var idIVA = 3; //0%
		var porcIVA = parseFloat((impIVA / impNeto * 100).toFixed(2));

		//Tolerancia de 0.1 decimales
		if (porcIVA == 0) idIVA = 3;
		if (porcIVA >= 2.4 && porcIVA <= 2.6) idIVA = 9;
		if (porcIVA >= 4.9 && porcIVA <= 5.1) idIVA = 8;
		if (porcIVA >= 10.4 && porcIVA <= 10.6) idIVA = 4;
		if (porcIVA >= 20.9 && porcIVA <= 21.1) idIVA = 5;
		if (porcIVA >= 26.9 && porcIVA <= 27.1) idIVA = 6;

		var params = {
			"FeCAEReq": {
				"FeCabReq": {
					"CantReg": req.body.CantReg || 1,
					"CbteTipo": Number(req.body.CbteTipo),
					"PtoVta": Number(req.body.PtoVta)
				},
				"FeDetReq": {
					"FECAEDetRequest": [{
						"Concepto": req.body.Concepto || 2,
						"DocTipo": req.body.DocTipo || 80,
						"DocNro": req.body.DocNro,
						"CbteDesde": Number(req.body.CbteNro),
						"CbteHasta": Number(req.body.CbteNro),
						"CbteFch": req.body.CbteFch,
						"ImpTotal": impTotal,
						"ImpTotConc": impConc,
						"ImpNeto": impNeto,
						"ImpOpEx": impExento,
						"ImpTrib": impTrib,
						"ImpIVA": impIVA,
						"FchServDesde": req.body.CbteFch,
						"FchServHasta": req.body.CbteFch,
						"FchVtoPago": req.body.CbteFch,
						"MonId": req.body.MonId || "PES",
						"MonCotiz": req.body.MonCotiz || 1,
						"Iva": [{
							"AlicIva": [{
								"Id": idIVA,
								"BaseImp": impNeto,
								"Importe": impIVA
							}]
						}]
					}]
				}
			}
		};

		this.afip({
			code: code,
			version: version,
			service: service,
			endpoint: endpoint,
			params: params
		}).then((result) => {
			var response = result.FeDetResp.FECAEDetResponse;

			var resObj = {
				result: true,
				data: {
					CAE: response.CAE,
					CAEFchVto: response.CAEFchVto,
					CbteFch: response.CbteFch//moment().format("YYYYMMDD")
				}
			};

			if (!resObj.data.CAE || !resObj.data.CAEFchVto || !resObj.data.CbteFch) {
				logger.debug(result);

				var errs = '';
				var obs = [];
				if (response.Observaciones && response.Observaciones.obs) {
					obs.concat(response.Observaciones.Obs);
				} else if (result.Errors) {
					obs.push(result.Errors.Err);
				}

				_.forEach(obs, (e) => {
					var b = new Buffer(e.Msg, 'binary').toString('utf8');

					errs += e.Code + " - " + b + (e === obs[obs.length] ? "" : "\\r\\n\\r\\n");
				});

				resObj.result = false;
				resObj.err = (obs.length > 1 ? "Ocurrieron " + obs.length + " errores" : "Ocurrió 1 error") + " al intentar procesar la solicitud. Revise los detalles o póngase en contacto con el Administrador.";
				resObj.errDetails = errs;
			}

			res.json(resObj);
		}).catch((err) => {
			logger.error(err);
			res.json({
				result: false,
				err: err.message
			});
		});
	}

	consultar_cuit(req, res) {
		var cuit = req.params.cuit;

		request('https://soa.afip.gob.ar/sr-padron/v2/persona/' + String(cuit), function (err, response, body) {
			if (!err && response.statusCode == 200) {
				res.json({
					result: true,
					data: JSON.parse(body).data
				});
			} else {
				res.json({
					result: false,
					err: err
				});
			}
		});

		// var code = req.body.code;
		// var cuit = req.body.cuit;
		// var version = "v2";
		// var service = "ws_sr_padron_a10";
		// var endpoint = "getPersona";

		// var params = {
		// 	idPersona: cuit
		// };

		// this.afip({
		// 	code: code,
		// 	version: version,
		// 	service: service,
		// 	endpoint: endpoint,
		// 	params: params
		// }).then((result) => {
		// 	res.json(result);
		// }).catch((err) => {
		// 	logger.error(err);
		// 	res.json({
		// 		result: false,
		// 		err: err.message
		// 	});
		// });
	}

	lastCbte(req, res) {
		var code = req.body.code;
		var version = "v1";
		var service = "wsfev1";
		var endpoint = "FECompUltimoAutorizado";

		var params = {
			"PtoVta": req.body.PtoVta,
			"CbteTipo": req.body.CbteTipo.Id
		};

		this.afip({
			code: code,
			version: version,
			service: service,
			endpoint: endpoint,
			params: params
		}).then((result) => {
			var resObj = {
				result: true
			};

			if (result.Errors) {
				var errs = result.Errors.Err;

				resObj.result = false;
				resObj.err = errs.length ? errs : [errs];
			} else {
				resObj.data = result.CbteNro;
			}

			res.json(resObj);
		}).catch((err) => {
			logger.error(err);
			res.json({
				result: false,
				err: err.message
			});
		});
	}

	validate_client(code) {
		return new Promise((resolve, reject) => {
			var Clients = mongoose.model('Clients');

			Clients.findOne({
				code: code
			}).then(function (client) {
				if (!client) {
					reject({
						result: false,
						message: "El cliente no existe o no está habilitado. Contáctese con el Administrador del servicio de Facturación Electrónica."
					});
				} else {
					resolve(client);
				}
			}, (err) => {
				reject(err);
			});
		});
	}

	createClientForService(type, version, service, endpoint) {
		// Parsear servicios
		if (service == 'ws_sr_padron_a10') service = 'sr-padron';
		if (service == 'ws_sr_padron_a5') service = 'sr-padron';
		if (service == 'ws_sr_padron_a3') service = 'sr-padron';

		return new Promise((resolve, reject) => {
			if (this.clients[type] && this.clients[type][version] && this.clients[type][version][service]) {
				resolve(this.clients[type][version][service]);
			} else {
				var wsdl = path.join(global.appRoot, 'wsdl', service + '.xml');

				if (!fs.existsSync(wsdl)) {
					wsdl = AfipURLs.getService(type, version, service, endpoint);
				}

				soap.createClient(wsdl, (err, client) => {
					if (err && !client) {
						logger.error(err);
						reject(err);
					} else {
						if (!this.clients[type]) this.clients[type] = {};
						if (!this.clients[type][version]) this.clients[type][version] = {};

						this.clients[type][version][service] = client;

						resolve(client);
					}
				});
			}
		});
	}

	generateTransaction(params) {
		return new Promise((resolve, reject) => {
			var Transactions = mongoose.model('Transactions');

			var transaction = new Transactions({
				code: params.code,
				type: params.type,
				service: params.service,
				endpoint: params.endpoint,
				request: JSON.stringify(params.request),
				response: JSON.stringify(params.response)
			});

			transaction.save().then((transaction) => {
				resolve(transaction);
			}, (err) => {
				logger.error(err);
				reject(err);
			});
		});
	}

	recreate_token(req, res) {
		var code = req.body.code;
		var service = req.body.service;

		this.validate_client(code).then((client) => {
			var type = client.type;

			WSAA.generateToken(code, type, service)
				.then((tokens) => res.json({
					result: true,
					data: tokens
				}))
				.catch((err) => {
					res.json({
						result: false,
						err: err.message
					});
				});
		}).catch((err) => {
			res.json({
				result: false,
				err: err.message
			});
		});
	}

	afip(request) {
		return new Promise((resolve, reject) => {
			var code = request.code;
			var service = request.service;
			var endpoint = request.endpoint;
			var params = request.params;
			var version = request.version;

			this.validate_client(code).then((client) => {
				var type = client.type;

				WSAA.generateToken(code, type, service).then((tokens) => {
					this.createClientForService(type, version, service, endpoint).then((soapClient) => {
						var afipRequest = {}

						// Parsear versión de WSFE
						if (version == 'v1') {
							afipRequest.Auth = {
								Token: tokens.token,
								Sign: tokens.sign,
								Cuit: client.cuit
							};
						}

						if (version == 'v2') {
							afipRequest.token = tokens.token;
							afipRequest.sign = tokens.sign;
							afipRequest.cuitRepresentada = client.cuit;
						}

						afipRequest = _.merge(afipRequest, params);

						soapClient[endpoint](afipRequest, (err, result) => {
							this.generateTransaction({
								code: code,
								type: type,
								service: service,
								endpoint: endpoint,
								request: params,
								response: result
							});

							try {
								logger.debug(result);

								if (version == 'v1') {
									resolve(result[`${endpoint}Result`]);
								}

								if (version == 'v2') {
									resolve(result.toJSON());
								}
							} catch (err) {
								logger.error(err);
								reject({
									message: "Ocurrió un error al intentar interpretar la respuesta a la solicitud"
								});
							}
						});
					}).catch((err) => {
						logger.error(err);
						reject({
							message: "Ocurrió un error al intentar conectarse a los servicios web de AFIP."
						});
					});
				}).catch((err) => {
					logger.error(err);
					reject({
						message: err.message
					});
				});
			}).catch((err) => {
				logger.error(err);
				reject({
					message: err.message
				});
			});
		});
	}

	endpoint(req, res) {
		var code = req.body.code;
		var version = req.body.version || "v1";
		var service = req.params.service;
		var endpoint = req.params.endpoint;
		var params = req.body.params;

		this.validate_client(code).then((client) => {
			var type = client.type;

			WSAA.generateToken(code, type, service).then((tokens) => {
				this.createClientForService(type, version, service, endpoint).then((soapClient) => {
					var afipRequest = {
						Auth: {
							Token: tokens.token,
							Sign: tokens.sign,
							Cuit: client.cuit
						}
					};

					afipRequest = _.merge(afipRequest, params);

					soapClient[endpoint](afipRequest, (err, result) => {
						this.generateTransaction({
							code: code,
							type: type,
							service: service,
							endpoint: endpoint,
							request: params,
							response: result
						});

						try {
							res.json(result[`${endpoint}Result`]);
						} catch (e) {
							res.json(result);
						}
					});
				}).catch(err => {
					logger.error(err);
					res.json({ result: false, err: "Ocurrió un error al intentar conectarse a los servicios web de AFIP." });
				});
			}).catch((err) => {
				logger.error(err)
				res.json({
					result: false,
					err: err.message
				});
			});
		}).catch((err) => {
			logger.error(err)
			res.json({
				result: false,
				err: err.message
			});
		});
	}

	describe(req, res) {
		var code = req.body.code || "";
		var version = req.body.version || "v1";
		var service = req.params.service;
		var endpoint = req.params.endpoint || "";
		var params = req.body.params || {};

		this.validate_client(code).then((client) => {
			var type = client.type;

			WSAA.generateToken(code, type, service).then((tokens) => {
				this.createClientForService(type, version, service, endpoint).then((client) => {
					res.json(client.describe());
				});

			}).catch((err) => {
				res.json({
					result: false,
					err: err.message
				});
			});
		});
	}

	authenticate(req, res, next) {
		var token = req.body.token || req.query.token || req.headers['x-access-token'] || req.headers['authorization'];
		var username = req.body.username || req.query.username || req.headers['username'];
		var password = req.body.password || req.query.password || req.headers['password'];

		if (token) {
			jwt.verify(token, global.tokenSecret, function (err, decoded) {
				if (err) {
					return res.json({ result: false, err: "No se pudo autenticar el token." });
				} else {
					req.decoded = decoded;
					next();
				}
			});

		} else if (username && password) {
			//Verificar username+password
			var Users = mongoose.model('Users');

			Users.findOne({
				username: req.body.username
			}).then(function (user) {
				if (!user)
					return res.json({ result: false, err: "Combinación de usuario y contraseña incorrecta, o el usuario no existe" });

				if (user.password != md5(req.body.password))
					return res.json({ result: false, err: "Combinación de usuario y contraseña incorrecta, o el usuario no existe" });


				next();
			}, function (err) {
				return res.json({ result: false, err: err.message });
			});

		} else {
			return res.status(403).json({ result: false, err: "Error en autenticación" });
		}
	}

	login(req, res) {
		var Users = mongoose.model('Users');

		Users.findOne({
			username: req.body.username
		}).then(function (user) {
			if (!user)
				return res.json({ result: false, err: "Combinación de usuario y contraseña incorrecta, o el usuario no existe" });

			if (user.password != md5(req.body.password))
				return res.json({ result: false, err: "Combinación de usuario y contraseña incorrecta, o el usuario no existe" });

			var token = jwt.sign(user, global.tokenSecret, {
				expiresIn: 60 * 60 * 24 // Expirar el token en 24 horas
			});

			res.json({
				result: true,
				token: token
			});
		}, function (err) {
			return res.json({ result: false, err: err.message });
		});
	}

	getClients(req, res) {
		var Clients = mongoose.model('Clients');

		Clients.find({}).then((clients) => {
			res.json({
				result: true,
				data: clients
			});
		}, (err) => {
			res.json({
				result: false,
				err: err.message
			});
		});
	}

	getUsers(req, res) {
		var Users = mongoose.model('Users');

		Users.find({}).then((users) => {
			res.json({
				result: true,
				data: users
			});
		}, (err) => {
			res.json({
				result: false,
				err: err.message
			});
		});
	}

	getTransactions(req, res) {
		var Transactions = mongoose.model('Transactions');

		Transactions.find({
			code: req.params.code
		}).then((transactions) => {
			res.json({
				result: true,
				data: transactions
			});
		}, (err) => {
			res.json({
				result: false,
				err: err.message
			});
		});
	}

	newUser(req, res) {
		var Users = mongoose.model('Users');

		Users.findOne({
			username: req.body.username
		}).then(function (user) {
			if (user)
				return res.json({ result: false, err: "El usuario ya existe" });

			var newUser = req.body;
			newUser.password = md5(req.body.password);

			var user = new Users(newUser);

			user.save().then(function (user) {
				res.json({ result: true, data: user });
			}, function (err) {
				return res.json({ result: false, err: err.message });
			});
		}, function (err) {
			return res.json({ result: false, err: err.message });
		});
	}

	newClient(req, res) {
		var Clients = mongoose.model('Clients');

		Clients.findOne({
			code: req.body.code
		}).then(function (client) {
			if (client)
				return res.json({ result: false, err: "El cliente ya existe" });

			var newClient = req.body;

			var client = new Clients(newClient);

			client.save().then(function (client) {
				res.json({ result: true, data: client });
			}, function (err) {
				return res.json({ result: false, err: err.message });
			});
		}, function (err) {
			return res.json({ result: false, err: err.message });
		});
	}

	editClient(req, res) {
		var Clients = mongoose.model('Clients');
		var editedClient = req.body;

		Clients.findById(editedClient._id).then((client) => {
			if (!client)
				return res.json({ result: false, err: "El cliente no existe" });

			_.merge(client, editedClient);
			client.save().then((client) => {
				res.json({ result: true, data: client });
			}, (err) => {
				res.json({ result: false, err: err.message });
			});
		}, (err) => {
			res.json({ result: false, err: err.message });
		});
	}

	removeClient(req, res) {
		var Clients = mongoose.model('Clients');
		var client = req.body;

		Clients.findByIdAndRemove(client._id).exec().then((client) => {
			res.json({ result: true, data: client });
		}, (err) => {
			res.json({ result: false, err: err.message });
		});
	}

	removeUser(req, res) {
		var Users = mongoose.model('Users');
		var user = req.body;

		Users.findByIdAndRemove(user._id).exec().then((user) => {
			res.json({ result: true, data: user });
		}, (err) => {
			res.json({ result: false, err: err.message });
		});
	}
}

module.exports = Endpoints;
