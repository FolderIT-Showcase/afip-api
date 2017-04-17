'use strict';

const afip_urls = {
	HOMO: {
		wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl',
		service: 'https://wswhomo.afip.gov.ar/{service}/service.asmx?wsdl' //wsfev1
	},
	PROD: {
		wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl',
		service: 'https://servicios1.afip.gov.ar/{service}/service.asmx?WSDL' //wsfev1
	}
};

class AfipUrls {
	constructor() {

	}

	getWSAA(type) {
		return afip_urls[type].wsaa;
	}

	getService(type, service) {
		return afip_urls[type].service.replace('{service}', service);
	}
}

module.exports = new AfipUrls();
