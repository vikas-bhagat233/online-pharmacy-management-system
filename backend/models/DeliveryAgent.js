const mongoose = require('mongoose');

const DeliveryAgentSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  vehicleNumber: String,
  isAvailable: { type: Boolean, default: true },
  currentLocation: { lat: Number, lng: Number }
});

module.exports = mongoose.model('DeliveryAgent', DeliveryAgentSchema);