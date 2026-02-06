const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
  name: { type: String, index: true },
  description: String,
  price: Number,
  discount: { type: Number, default: 0 },
  stock: { type: Number, index: true },
  category: { type: String, index: true },
  image: String,
  prescriptionRequired: Boolean
});

module.exports = mongoose.model('Medicine', MedicineSchema);