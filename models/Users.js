var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var UsersSchema = new Schema({
  name: String,
  username: String,
  password: String,
  admin: {
    type: Boolean,
    default: false
  },
  refreshToken: String
});

mongoose.model('Users', UsersSchema);
