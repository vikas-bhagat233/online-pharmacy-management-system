const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  trackingNumber: String,
  deliveryAgent: {
    name: String,
    phone: String,
    vehicleNumber: String
  },
  currentLocation: {
    lat: Number,
    lng: Number,
    address: String
  },
  estimatedDelivery: Date,
  status: { 
    type: String, 
    enum: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'],
    default: 'assigned' 
  },
  updates: [{
    status: String,
    location: { lat: Number, lng: Number },
    timestamp: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('Delivery', DeliverySchema);