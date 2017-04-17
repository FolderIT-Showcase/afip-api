var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var TransactionsSchema = new Schema({
    username: String,
    code: String,
    type: String,
    service: String,
    endpoint: String,
    date: { type: Date, default: Date.now },
    request: String,
    response: String
});

mongoose.model('Transactions', TransactionsSchema);
