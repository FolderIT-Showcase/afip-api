let fs = require('fs');

let services = {};

fs.readdirSync(__dirname).forEach((file) => {
    if (file !== 'index.js') {
        let serviceName = file.split('.')[0];
        let service = require(`./${serviceName}`);
        services[serviceName] = service;
    }
});

module.exports = services;
