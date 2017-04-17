var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var TokensSchema = new Schema({
    code: String,
    type: String,
    service: String,
    credentials: {},
    since: Date,
    until: Date
});

mongoose.model('Tokens', TokensSchema);
