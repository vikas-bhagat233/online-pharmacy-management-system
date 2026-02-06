const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  items: [{
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    quantity: Number,
    price: Number
  }],
  subtotalAmount: Number,
  deliveryCharge: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  couponCode: String,
  codSurchargeAmount: { type: Number, default: 0 },
  totalAmount: Number,
  status: { type: String, default: 'pending', index: true },
  statusHistory: [{
    status: { type: String, required: true },
    at: { type: Date, default: Date.now }
  }],
  deliveredAt: { type: Date, default: null, index: true },
  paymentMethod: { type: String, enum: ['razorpay', 'cod'], default: 'cod' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'cod_pending'], default: 'pending', index: true },
  address: String,
  phone: String,
  deliveryAgent: {
    name: String,
    phone: String
  },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Compound index for dashboard stats if needed, or searching orders
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);