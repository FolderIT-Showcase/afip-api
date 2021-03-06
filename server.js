var express = require('express'),
	app = express(),
	path = require('path'),
	index = require('./routes/index'),
	mongoose = require('mongoose'),
	config = require('./config'),
	favicon = require('serve-favicon'),
	toobusy = require('toobusy-js'),
	logger = require('tracer').colorConsole(config.loggerFormat);

global.environment = config.environment;
global.loggerFormat = config.loggerFormat;
global.tokenSecret = config.tokenSecret;
global.appRoot = require('app-root-path').path;

toobusy.maxLag(200);
toobusy.interval(1000);

logger.info("Entorno:", global.environment);

mongoose.connect(config.databases[global.environment], { server: { auto_reconnect: true } });

var db = mongoose.connection;
db.on('error', (err) => {
	logger.warn(err);
});
db.once('open', () => {
	logger.info("Connection to DB established");

	// Control de sobrecarga
	app.use((req, res, next) => {
		if (toobusy()) res.status(503).json({
			result: false,
			err: "El servicio se encuentra sobrecargado. Por favor, intente nuevamente."
		});
		else next();
	});

	// Contenido estático
	app.use(favicon(path.join(__dirname, 'public', 'assets', 'img', 'favicon.ico')));
	app.use(express.static(path.join(__dirname, 'public')));
	app.use('/bower_components', express.static(path.join(__dirname, '/bower_components')));
	app.use('/api', express.static(path.join(__dirname, 'public/api')));

	// Permitir certificados de cualquier CA
	process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

	app.listen(process.env.PORT || 3000, () => {
		logger.info('AFIP API listening on port', (process.env.PORT || 3000));

		// Inicializacion de modelos de la base de datos
		require('./models');

		// Start Routes
		index(app);

		// Catch all (404)
		app.get('/api/*', (req, res) => {
			res.status(404).json({
				result: false,
				err: "Ruta no encontrada"
			});
		});

		app.use((req, res) => {
			res.sendFile(`${__dirname}/public/index.html`);
		});

		logger.info("All systems GO!");
	});
});
db.on('disconnected', () => {
	logger.error('MongoDB disconnected!');
	mongoose.connect(config.databases[global.environment], { server: { auto_reconnect: true } });
});