var express = require('express'),
	app = express(),
	path = require('path'),
	index = require('./routes/index'),
	mongoose = require('mongoose'),
	config = require('./config'),
	favicon = require('serve-favicon'),
	logger = require('tracer').colorConsole(config.loggerFormat);

global.environment = config.environment;
global.loggerFormat = config.loggerFormat;
global.tokenSecret = config.tokenSecret;
global.appRoot = require('app-root-path').path;

logger.info("Entorno:", global.environment);

mongoose.connect(config.databases[global.environment], { server: { auto_reconnect: true } });

var db = mongoose.connection;
db.on('error', (err) => {
	logger.warn(err);
});
db.once('open', function () {
	logger.info("Connection to DB established");

	// Contenido estático
	app.use(favicon(path.join(__dirname, 'public', 'assets', 'img', 'favicon.ico')));
	app.use(express.static(path.join(__dirname, 'public')));
	app.use('/bower_components', express.static(path.join(__dirname, '/bower_components')));

	app.listen(process.env.PORT || 3000, function () {
		logger.info('AFIP API listening on port', (process.env.PORT || 3000));

		// Inicializacion de modelos de la base de datos
		require('./models');

		// Start Routes
		index(app);

		logger.info("All systems GO!");
	});
});
db.on('disconnected', function () {
	logger.error('MongoDB disconnected!');
	mongoose.connect(config.databases[global.environment], { server: { auto_reconnect: true } });
});