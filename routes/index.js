var cors = require('cors'),
	bodyParser = require('body-parser'),
	fileUpload = require('express-fileupload');

// Setup Route Bindings
exports = module.exports = function (app) {
	app.use(cors());

	// Add Middlewares
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: true }));
	app.use(fileUpload());

	// Inicialización del Frontend
	app.get('/', (req, res) => {
		res.sendfile('./public/index.html');
	});

	// API
	var Endpoint = require('./api/endpoints');
	new Endpoint(app);
};
