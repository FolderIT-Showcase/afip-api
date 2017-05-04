var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var UserPermissionsSchema = new Schema({
    username: String,
    code: String,
    active: Boolean
});

mongoose.model('UserPermissions', UserPermissionsSchema);
