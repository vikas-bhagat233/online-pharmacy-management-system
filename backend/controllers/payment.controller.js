const razorpay = require('../config/razorpay');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart');
const User = require('../models/User');
const { verifyPayment } = require('../services/paymentService');
const { decrementStockOrFail } = require('../services/orderService');
const emailService = require('../services/emailService');
const fs = require('fs');
const path = require('path');

function readTemplate(name) {
  const p = path.join(__dirname, '..', 'templates', name);
  return fs.readFileSync(p, 'utf8');
}

function renderTemplate(template, vars) {
  const withDefaults = {
    year: new Date().getFullYear(),
    ...vars
  };
  let out = template;
  for (const [k, v] of Object.entries(withDefaults)) {
    out = out.replaceAll(`{{${k}}}`, String(v));
  }
  return out;
}

exports.createOrder = async (req, res) => {
  const { amount } = req.body;
  const options = { amount: amount * 100, currency: 'INR' };
  const razorpayOrder = await razorpay.orders.create(options);
  res.json(razorpayOrder);
};

exports.verify = async (req, res) => {
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields' });
  }

  const ok = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!ok) return res.status(400).json({ error: 'Invalid payment signature' });

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (String(order.user) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Mark payment
  await Payment.findOneAndUpdate(
    { order: order._id, razorpayId: razorpay_order_id },
    {
      $set: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'paid'
      }
    },
    { upsert: true, new: true }
  );

  // Decrement stock exactly once
  if (order.paymentStatus !== 'paid') {
    try {
      await decrementStockOrFail(order.items);
    } catch (e) {
      await Order.findByIdAndUpdate(order._id, { status: 'failed', paymentStatus: 'failed' });
      return res.status(409).json({ error: 'Insufficient stock for one or more items' });
    }
  }

  await Order.findByIdAndUpdate(order._id, {
    status: 'confirmed',
    paymentStatus: 'paid',
    $push: { statusHistory: { status: 'confirmed', at: new Date() } }
  });
  await Cart.updateOne({ user: req.user.id }, { $set: { items: [] } });

  // Email customer + admin
  const user = await User.findById(req.user.id).select('email name');
  if (user?.email) {
    const html = renderTemplate(readTemplate('payment-success.html'), {
      paymentId: razorpay_payment_id,
      amount: Number(order.totalAmount || 0).toFixed(2)
    });
    await emailService.sendEmail(user.email, 'Payment Successful', html);
  }
  const adminTo = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (adminTo) {
    const html = renderTemplate(readTemplate('payment-success.html'), {
      paymentId: razorpay_payment_id,
      amount: Number(order.totalAmount || 0).toFixed(2)
    });
    await emailService.sendEmail(adminTo, 'Payment Received', html);

    // Also notify admin that the order is confirmed/received
    const html2 = renderTemplate(readTemplate('admin-order-notification.html'), {
      orderId: order._id,
      paymentMethod: 'Razorpay',
      paymentStatus: 'paid',
      totalAmount: Number(order.totalAmount || 0).toFixed(2),
      customerName: user?.name || '',
      customerEmail: user?.email || '',
      customerPhone: order.phone || '',
      address: order.address || ''
    });
    await emailService.sendEmail(adminTo, 'New Order Confirmed (Paid)', html2);
  }

  res.json({ ok: true });
};