var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var UserPermissionsSchema = new Schema({
    username: String,
    code: String,
    active: {
        type: Boolean,
        default: false
    }
});

mongoose.model('UserPermissions', UserPermissionsSchema);
