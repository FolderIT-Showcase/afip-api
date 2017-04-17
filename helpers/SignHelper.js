var openssl = require('openssl-wrapper').exec,
    logger = require('tracer').colorConsole(global.loggerFormat);

// Expose methods.
exports.sign = sign;

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
            reject('Invalid content.');

        if (!options.key)
            reject('Invalid key.');

        if (!options.cert)
            reject('Invalid certificate.');

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

        openssl('smime.sign', content, ssl, function (err, buffer) {
            if (err) {
                logger.error(err);
                reject({ message: "No se pudo validar el certificado del cliente. Contáctese con el Administrador del sistema de Facturación Electrónica." });
            } else {
                var enc = buffer.toString('base64');

                resolve(enc);
            }
        });
    });
}
