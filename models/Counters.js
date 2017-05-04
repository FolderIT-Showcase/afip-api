var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var CountersSchema = new Schema({
    code: String,
    service: String,
    seq: {
        type: Number,
        default: 0
    }
});

mongoose.model('Counters', CountersSchema);
