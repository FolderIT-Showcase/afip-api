var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var ClientsSchema = new Schema({
    code: String,
    name: String,
    razonSocial: String,
    email: String,
    cuit: String,
    signer: String,
    key: String,
    csr: String,
    type: String
});

mongoose.model('Clients', ClientsSchema);
