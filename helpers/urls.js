'use strict';

const afip_urls = {
	HOMO: {
		wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl',
		v1: {
			service: 'https://wswhomo.afip.gov.ar/{service}/service.asmx?wsdl'
		},
		v2: {
			service: 'https://awshomo.afip.gov.ar/{service}/webservices/{endpoint}?WSDL'
		}
	},
	PROD: {
		wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl',
		v1: {
			service: 'https://servicios1.afip.gov.ar/{service}/service.asmx?WSDL'
		},
		v2: {
			service: 'https://aws.afip.gov.ar/{service}/webservices/{endpoint}?WSDL'
		}
	}
};

class AfipUrls {
	constructor() {

	}

	getWSAA(type) {
		return afip_urls[type].wsaa;
	}

	getService(type, version = 'v1', service, endpoint) {
		return afip_urls[type][version].service.replace('{service}', service).replace('{endpoint}', endpoint);
	}
}

module.exports = new AfipUrls();
