var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var UsersSchema = new Schema({
  name: String,
  username: String,
  password: String,
  admin: {
    type: Boolean,
    default: false
  }
});

mongoose.model('Users', UsersSchema);
