var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var TokensSchema = new Schema({
    code: String,
    type: String,
    service: String,
    credentials: {},
    since: Date,
    until: Date
});

mongoose.model('Tokens', TokensSchema);
