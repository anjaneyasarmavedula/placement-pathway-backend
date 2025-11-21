const mongoose = require('mongoose');

const TPOSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'tpo' },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TPOSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('TPO', TPOSchema);
