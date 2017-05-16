var pify = require("pify"),
    logger = require('tracer').colorConsole(global.loggerFormat),
    os = require('os'),
    openssl = pify(require('openssl-wrapper').exec),
    csrgen = pify(require('csr-gen'));

/**
 * Sign a file.
 *
 * @param {object} options Options
 * @param {string} options.key Key path
 * @param {string} options.cert Cert path
 * @param {string} [options.password] Key password
 * @returns {Promise} result Result
 */

function sign(options) {
    return new Promise(function (resolve, reject) {
        options = options || {};

        if (!options.content)
            reject({ message: 'Invalid content.' });

        if (!options.key)
            reject({ message: 'Invalid key.' });

        if (!options.cert)
            reject({ message: 'Invalid certificate.' });

        var content = new Buffer(options.content);

        var ssl = {
            signer: options.cert,
            inkey: options.key,
            outform: 'DER',
            nodetach: true
        };

        if (options.password) {
            ssl.passin = "pass:" + options.password;
        }

        openssl('smime.sign', content, ssl).then((buffer) => {
            var enc = buffer.toString('base64');
            resolve(enc);
        }).catch((err) => {
            logger.error(err);
            reject({
                message: "No se pudo validar el certificado del cliente. Contáctese con el Administrador del sistema de Facturación Electrónica."
            });
        });
    });
}

function gencsr(options) {
    return new Promise((resolve, reject) => {
        options = options || {};

        if (!options.domain)
            reject({ message: 'Falta completar el Alias/Código del cliente.' });

        if (!options.email)
            reject({ message: 'Falta completar el Email del cliente.' });

        if (!options.company)
            reject({ message: 'Falta completar la Razón Social del cliente.' });

        if (!options.cuit)
            reject({ message: 'Falta completar el CUIT del cliente.' });

        var ssl = {
            read: true,
            destroy: true,
            country: 'AR',
            state: '',
            city: '',
            division: '',
            password: '',
            company: options.company,
            email: options.email,
            serialNumber: 'CUIT ' + options.cuit
        };

        csrgen(options.domain, ssl).then((keys) => {
            resolve(keys);
        }).catch((err) => {
            logger.error(err);
            reject({
                message: "Ocurrió un error al intentar generar las llaves del certificado."
            });
        });
    });
}

// Expose methods.
module.exports = {
    sign: sign,
    gencsr: gencsr
}
