const mongoose = require('mongoose');

const PrescriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  image: String,
  status: { type: String, default: 'pending' }
});

module.exports = mongoose.model('Prescription', PrescriptionSchema);