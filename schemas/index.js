let fs = require('fs'),
    _ = require('lodash');

let services = {};

fs.readdirSync(__dirname).forEach(function (file) {
    if (file !== 'index.js') {
        let serviceName = file.split('.')[0];
        let service = require('./' + serviceName);
        services[serviceName] = service;
    }
});

module.exports = services;
