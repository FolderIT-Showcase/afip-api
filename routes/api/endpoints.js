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
	request = require('request'),
	config = require('./../../config'),
	logger = require('tracer').colorConsole(global.loggerFormat);

class Endpoints {
	constructor(app) {
		//Autenticacion
		app.post('/api/login', this.login.bind(this));

		app.get('/api/consultarCuit/:cuit', this.consultar_cuit.bind(this));

		//Verificacion de token o username+password
		app.use(this.authenticate.bind(this));

		app.post('/api/:service/describe', this.describe.bind(this));

		app.post('/api/lastCbte', this.lastCbte.bind(this));

		app.post('/api/:service/:code/refresh/token', this.recreate_token.bind(this));

		app.post('/api/:service/:endpoint', this.endpoint.bind(this));

		app.post('/api/generarCae', this.generar_cae.bind(this));

		app.post('/api/generarCaex', this.generar_caex.bind(this));

		app.get('/api/cbteTipo/:code', this.getCbteTipo.bind(this));

		//Verificación de permisos administrativos
		app.use(this.administrative.bind(this));

		app.get('/api/getClients', this.getClients.bind(this));

		app.get('/api/getUsers', this.getUsers.bind(this));

		app.get('/api/transactions/:code', this.getTransactions.bind(this));

		app.get('/api/permissions/:username', this.getUserPermissions.bind(this));

		app.post('/api/newUser', this.newUser.bind(this));

		app.post('/api/newPermit', this.newPermit.bind(this));

		app.post('/api/newClient', this.newClient.bind(this));

		app.post('/api/editClient', this.editClient.bind(this));

		app.post('/api/editUser', this.editUser.bind(this));

		app.post('/api/editPermit', this.editPermit.bind(this));

		app.post('/api/resetPassword', this.resetPassword.bind(this));

		app.post('/api/removeClient', this.removeClient.bind(this));

		app.post('/api/removePermit', this.removePermit.bind(this));

		app.post('/api/removeUser', this.removeUser.bind(this));

		this.clients = {};
	}

	/*
	 * Endpoints funcionales de AFIP
	 */

	generar_caex(req, res) {
		var username = req.decoded ? req.decoded._doc.username : "";
		var code = req.body.code;
		var version = "v1";
		var service = "wsfexv1";
		var endpoint = "FEXAuthorize";

		var impTotal = parseFloat(req.body.ImpTotal.replace(' ', '').replace(',', ''));
		var monedaCotizacion = parseFloat(req.body.MonedaCotizacion.replace(' ', '').replace(',', ''));

		var items = [];

		_.forEach(req.body.Items, (e) => {
			var itemImpTotal = parseFloat(e.ImpTotal.replace(' ', '').replace(',', ''));

			items.push({
				"Item": {
					"Pro_ds": e.Descripcion || "",
					"Pro_umed": e.UnidadMedida,
					"Pro_total_item": itemImpTotal
				}
			});
		});

		var params = {
			"Cmp": {
				"Cbte_Tipo": Number(req.body.CbteTipo),
				"Fecha_cbte": req.body.CbteFch,
				"Punto_vta": Number(req.body.PtoVta),
				"Cbte_nro": Number(req.body.CbteNro),
				"Tipo_expo": req.body.TipoExportacion || 2,
				"Permiso_existente": req.body.PermisoExportacion || "",
				"Dst_cmp": req.body.Pais,
				"Cliente": req.body.Cliente,
				"Cuit_pais_cliente": req.body.DocNro,
				"Domicilio_cliente": req.body.CliDomicilio,
				"Moneda_Id": req.body.Moneda,
				"Moneda_ctz": monedaCotizacion,
				"Imp_total": impTotal,
				"Forma_pago": req.body.FormaPago,
				"Incoterms": req.body.Incoterms,
				"Idioma_cbte": "1", // Español
				"Items": items
			}
		};

		this.get_counter(code, service).then((counter) => {
			params["Cmp"]["Id"] = counter;

			return this.afip({
				username: username,
				code: code,
				version: version,
				service: service,
				endpoint: endpoint,
				params: params
			});
		}).then((result) => {
			var response = _.merge({}, result.FEXResultAuth);

			var resObj = {
				result: true,
				data: {
					CAE: response.Cae,
					CAEFchVto: response.Fch_venc_Cae,
					CbteFch: response.Fch_cbte
				}
			};

			if (!resObj.data.CAE || !resObj.data.CAEFchVto || !resObj.data.CbteFch) {
				logger.debug(result);

				var errs = '';
				var obs = [result.FEXErr];

				_.forEach(obs, (e) => {
					var b = new Buffer(e.ErrMsg, 'binary').toString('utf8');

					errs += e.ErrCode + " - " + b + (e === obs[obs.length] ? "" : "\\r\\n\\r\\n");
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

	generar_cae(req, res) {
		var username = req.decoded ? req.decoded._doc.username : "";
		var code = req.body.code;
		var version = "v1";
		var service = "wsfev1";
		var endpoint = "FECAESolicitar";

		var impNeto = parseFloat(req.body.ImpNeto.replace(' ', '').replace(',', ''));
		var impConc = parseFloat(req.body.ImpConc.replace(' ', '').replace(',', ''));
		var impExento = parseFloat(req.body.ImpOpEx.replace(' ', '').replace(',', ''));
		var impTrib = parseFloat(req.body.ImpTrib.replace(' ', '').replace(',', ''));
		var impIVA = parseFloat(req.body.ImpIva.replace(' ', '').replace(',', ''));
		var impTotal = parseFloat((impNeto + impConc + impExento + impTrib + impIVA).toFixed(2));

		var idIVA = req.body.IdIVA || null;
		var porcIVA = parseFloat((impIVA / impNeto * 100).toFixed(2));

		if (!idIVA) {
			// Tolerancia de 0.1 decimales
			if (porcIVA == 0) idIVA = 3;
			if (porcIVA >= 2.4 && porcIVA <= 2.6) idIVA = 9;
			if (porcIVA >= 4.9 && porcIVA <= 5.1) idIVA = 8;
			if (porcIVA >= 10.4 && porcIVA <= 10.6) idIVA = 4;
			if (porcIVA >= 20.9 && porcIVA <= 21.1) idIVA = 5;
			if (porcIVA >= 26.9 && porcIVA <= 27.1) idIVA = 6;
		}

		if (!idIVA) {
			res.json({
				result: false,
				err: "El importe de IVA no se corresponde a ningún porcentaje de IVA ofrecido por AFIP: " + porcIVA
			});
			return;
		}

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
		}

		this.afip({
			username: username,
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
					CbteFch: response.CbteFch
				}
			};

			if (!resObj.data.CAE || !resObj.data.CAEFchVto || !resObj.data.CbteFch) {
				logger.debug(result);

				var errs = '';
				var obs = [];
				if (response.Observaciones && response.Observaciones.Obs) {
					obs = obs.concat(response.Observaciones.Obs);
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
				if (JSON.parse(body).data) {
					res.json({
						result: true,
						data: JSON.parse(body).data
					});
				} else {
					res.json({
						result: false,
						err: "CUIT no encontrado"
					});
				}
			} else {
				res.json({
					result: false,
					err: err
				});
			}
		});
	}

	lastCbte(req, res) {
		var username = req.decoded ? req.decoded._doc.username : "";
		var code = req.body.code;
		var version = "v1";
		var service = "wsfev1";
		var endpoint = "FECompUltimoAutorizado";

		var params = {
			"PtoVta": req.body.PtoVta,
			"CbteTipo": req.body.CbteTipo
		};

		this.afip({
			username: username,
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

	getCbteTipo(req, res) {
		var username = req.decoded ? req.decoded._doc.username : "";
		var code = req.params.code;
		var version = "v1";
		var service = "wsfev1";
		var endpoint = "FEParamGetTiposCbte";

		this.afip({
			username: username,
			code: code,
			version: version,
			service: service,
			endpoint: endpoint,
			saveTransaction: false
		}).then((result) => {
			var resObj = {
				result: true
			};

			if (result.Errors) {
				var errs = result.Errors.Err;

				resObj.result = false;
				resObj.err = errs.length ? errs : [errs];
			} else {
				resObj.data = result.ResultGet.CbteTipo;
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

	get_counter(code, service) {
		return new Promise((resolve, reject) => {
			var Counters = mongoose.model('Counters');

			Counters.findOneAndUpdate({
				code: code,
				service: service,
			}, {
					$inc: {
						seq: 1
					}
				}, {
					upsert: true
				}).exec((err, counter) => {
					if (err) {
						reject(err);
					} else {
						resolve(counter ? counter.seq : 0);
					}
				});
		});
	}

	validate_client(code) {
		return new Promise((resolve, reject) => {
			var Clients = mongoose.model('Clients');

			Clients.findOne({
				code: code
			}).then((client) => {
				if (!client) {
					reject({
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

	validate_username(username, code) {
		return new Promise((resolve, reject) => {
			var Users = mongoose.model('Users');
			var UserPermissions = mongoose.model('UserPermissions');

			UserPermissions.findOne({
				username: username,
				code: code,
				active: true
			}).then((permit) => {
				if (!permit) {
					//Si el usuario no tiene permisos, verificar si es administrador
					Users.findOne({
						username: username,
						admin: true
					}).then((user) => {
						if (!user) {
							reject({
								message: "El usuario no tiene permisos para interactuar con el cliente solicitado. Contáctese con el Administrador del servicio de Facturación Electrónica."
							});
						} else {
							resolve(user);
						}
					}, (err) => {
						reject(err);
					});
				} else {
					resolve(permit);
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
				username: params.username,
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
		var username = req.decoded ? req.decoded._doc.username : "";
		var code = req.body.code;
		var service = req.body.service;

		this.validate_username(username, code).then((permit) => {
			return this.validate_client(code);
		}).then((client) => {
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
		var code = request.code || "";
		var service = request.service || "";
		var endpoint = request.endpoint || "";
		var params = request.params || {};
		var version = request.version || "";
		var username = request.username || "";
		var saveTransaction = true;
		var tokens, type, client;

		if (request.saveTransaction === false) {
			saveTransaction = false;
		}

		return new Promise((resolve, reject) => {
			this.validate_username(username, code).then((permit) => {
				return this.validate_client(code);
			}).then((validatedClient) => {
				client = validatedClient;
				type = client.type;

				return WSAA.generateToken(code, type, service);
			}).then((newTokens) => {
				tokens = newTokens;
				return this.createClientForService(type, version, service, endpoint);
			}).then((soapClient) => {
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
					if (saveTransaction) {
						this.generateTransaction({
							username: username,
							code: code,
							type: type,
							service: service,
							endpoint: endpoint,
							request: params,
							response: result
						});
					}

					try {
						if (version == 'v1') {
							resolve(result[`${endpoint}Result`]);
						}

						if (version == 'v2') {
							resolve(result.toJSON());
						}
					} catch (err) {
						logger.error(err);
						reject({
							message: "Ocurrió un error al intentar interpretar la respuesta a la solicitud."
						});
					}
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
		var username = req.decoded ? req.decoded._doc.username : "";
		var code = req.body.code;
		var version = req.body.version || "v1";
		var service = req.params.service;
		var endpoint = req.params.endpoint;
		var params = req.body.params;
		var client, type, tokens;

		this.validate_username(username, code).then((permit) => {
			return this.validate_client(code);
		}).then((validatedClient) => {
			client = validatedClient;
			type = client.type;

			return WSAA.generateToken(code, type, service);
		}).then((newTokens) => {
			tokens = newTokens;

			return this.createClientForService(type, version, service, endpoint);
		}).then((soapClient) => {
			var afipRequest = {
				Auth: {
					Token: tokens.token,
					Sign: tokens.sign,
					Cuit: client.cuit
				}
			};

			afipRequest = _.merge(afipRequest, params);

			if (typeof (soapClient[endpoint]) !== 'function') {
				res.json({
					result: false,
					err: "El endpoint solicitado no existe para el servicio: " + endpoint
				});
				return;
			}

			soapClient[endpoint](afipRequest, (err, result) => {
				this.generateTransaction({
					username: req.decoded ? req.decoded._doc.username : "",
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
		}).catch((err) => {
			logger.error(err)
			res.json({
				result: false,
				err: err.message
			});
		});
	}

	describe(req, res) {
		var username = req.decoded ? req.decoded._doc.username : "";
		var code = req.body.code || "";
		var version = req.body.version || "v1";
		var service = req.params.service;
		var endpoint = req.params.endpoint || "";
		var params = req.body.params || {};
		var type, client, tokens;

		this.validate_username(username, code).then((permit) => {
			return this.validate_client(code);
		}).then((validatedClient) => {
			client = validatedClient;
			type = client.type;

			return WSAA.generateToken(code, type, service);
		}).then((newTokens) => {
			tokens = newTokens;

			return this.createClientForService(type, version, service, endpoint);
		}).then((soapClient) => {
			res.json(soapClient.describe());
		}).catch((err) => {
			res.json({
				result: false,
				err: err.message
			});
		});;
	}

	/*
	 * Endpoints de autenticación
	 */

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

				req.decoded = {
					"_doc": user
				};

				next();
			}, function (err) {
				return res.json({ result: false, err: err.message });
			});
		} else {
			return res.status(403).send("Error en autenticación");
		}
	}

	login(req, res) {
		logger.debug(req.body);
		var Users = mongoose.model('Users');

		if (!req.body.rcResponse) {
			return res.json({
				result: false,
				err: "Por favor ingrese la verificación reCAPTCHA."
			});
		}

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

			var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" + config.rcSecret + "&response=" + req.body.rcResponse + "&remoteip=";

			request(verificationUrl, (error, response, body) => {
				if (error) {
					logger.error(err);
					return res.json({
						result: false,
						err: "Ocurrió un error al intentar verificar el reCAPTCHA. Por favor, intente nuevamente."
					});
				}

				body = JSON.parse(body);

				if (body.success === true) {
					res.json({
						result: true,
						token: token
					});
				} else {
					res.json({
						result: false,
						err: "La verificación reCAPTCHA ha expirado o es inválida. Intente nuevamente."
					});
				}
			});
		}, function (err) {
			return res.json({ result: false, err: err.message });
		});
	}

	/*
	 * Endpoints administrativos
	 */

	administrative(req, res, next) {
		var username = req.decoded ? req.decoded._doc.username : "";
		var Users = mongoose.model('Users');

		Users.findOne({
			username: username,
			admin: true
		}).then((user) => {
			if (!user) {
				return res.status(403).send("El usuario no tiene permisos administrativos.");
			} else {
				next();
			}
		}, (err) => {
			return res.json({
				result: false,
				err: err.message
			});
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

	getUserPermissions(req, res) {
		var UserPermissions = mongoose.model('UserPermissions');

		UserPermissions.find({
			username: req.params.username
		}).then((permissions) => {
			res.json({
				result: true,
				data: permissions
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

	newPermit(req, res) {
		var UserPermissions = mongoose.model('UserPermissions');

		UserPermissions.findOne({
			username: req.body.username,
			code: req.body.code
		}).then(function (permit) {
			if (permit)
				return res.json({ result: false, err: "El permiso ya existe" });

			var permit = new UserPermissions(req.body);

			permit.save().then(function (permit) {
				res.json({ result: true, data: permit });
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

	editUser(req, res) {
		var Users = mongoose.model('Users');
		var editedUser = req.body;

		Users.findById(editedUser._id).then((user) => {
			if (!user)
				return res.json({ result: false, err: "El usuario no existe" });

			_.merge(user, editedUser);
			user.save().then((user) => {
				res.json({ result: true, data: user });
			}, (err) => {
				res.json({ result: false, err: err.message });
			});
		}, (err) => {
			res.json({ result: false, err: err.message });
		});
	}

	editPermit(req, res) {
		var UserPermissions = mongoose.model('UserPermissions');
		var editedPermit = req.body;

		UserPermissions.findById(editedPermit._id).then((permit) => {
			if (!permit)
				return res.json({ result: false, err: "El permiso no existe" });

			_.merge(permit, editedPermit);
			permit.save().then((permit) => {
				res.json({ result: true, data: permit });
			}, (err) => {
				res.json({ result: false, err: err.message });
			});
		}, (err) => {
			res.json({ result: false, err: err.message });
		});
	}

	resetPassword(req, res) {
		var Users = mongoose.model('Users');
		var editedUser = req.body;

		Users.findById(editedUser._id).then((user) => {
			if (!user)
				return res.json({ result: false, err: "El usuario no existe" });

			user.password = md5(editedUser.newPassword);

			user.save().then((user) => {
				res.json({ result: true, data: user });
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

	removePermit(req, res) {
		var UserPermissions = mongoose.model('UserPermissions');
		var permit = req.body;

		UserPermissions.findByIdAndRemove(permit._id).exec().then((permit) => {
			res.json({ result: true, data: permit });
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
