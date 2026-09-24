const fs = require('fs');
const path = require('path');
const paypal = require('../config/paypal');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { decrementStockOrFail } = require('../services/orderService');

function readTemplate(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'templates', name), 'utf8');
}

function renderTemplate(template, vars) {
  return Object.entries({ year: new Date().getFullYear(), ...vars })
    .reduce((output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value)), template);
}

function getApprovalUrl(result) {
  return result.links?.find((link) => link.rel === 'approve')?.href || null;
}

function getFrontendCheckoutUrl(req, orderId) {
  const configured = process.env.FRONTEND_URL;
  const base = configured || `${req.protocol}://${req.get('host')}/frontend`;
  return `${base.replace(/\/$/, '')}/pages/checkout.html?orderId=${encodeURIComponent(orderId)}`;
}

async function createPaypalOrder({ order, req }) {
  const response = await paypal.getOrdersController().createOrder({
    body: {
      intent: 'CAPTURE',
      purchaseUnits: [{
        referenceId: String(order._id),
        invoiceId: `order_${order._id}`,
        amount: {
          currencyCode: paypal.currency(),
          value: paypal.getOrderAmountInPaypalCurrency(order.totalAmount)
        }
      }],
      applicationContext: {
        userAction: 'PAY_NOW',
        returnUrl: getFrontendCheckoutUrl(req, order._id),
        cancelUrl: `${getFrontendCheckoutUrl(req, order._id)}&cancelled=true`
      }
    },
    prefer: 'return=representation'
  });

  const result = response.result;
  const approvalUrl = getApprovalUrl(result);
  if (!result?.id || !approvalUrl) throw new Error('PayPal did not return an approval URL');

  await Payment.create({
    order: order._id,
    provider: 'paypal',
    providerOrderId: result.id,
    amount: order.totalAmount,
    currency: 'INR',
    providerAmount: Number(paypal.getOrderAmountInPaypalCurrency(order.totalAmount)),
    providerCurrency: paypal.currency(),
    status: 'created'
  });

  return { id: result.id, approvalUrl };
}

async function completeCapturedOrder(order, captureResult) {
  const capture = captureResult.purchaseUnits?.[0]?.payments?.captures?.[0];
  if (capture?.status !== 'COMPLETED') throw new Error('PayPal payment was not completed');

  const payment = await Payment.findOneAndUpdate(
    { order: order._id, provider: 'paypal', providerOrderId: captureResult.id },
    {
      $set: {
        providerPaymentId: capture?.id,
        providerOrderId: captureResult.id,
        status: 'paid'
      }
    },
    { new: true }
  );
  if (!payment) throw new Error('PayPal payment record not found');

  if (order.paymentStatus !== 'paid') {
    try {
      await decrementStockOrFail(order.items);
    } catch (error) {
      await Order.findByIdAndUpdate(order._id, { status: 'failed', paymentStatus: 'failed' });
      throw new Error('Insufficient stock for one or more items');
    }
  }

  await Order.findByIdAndUpdate(order._id, {
    status: 'confirmed',
    paymentStatus: 'paid',
    $push: { statusHistory: { status: 'confirmed', at: new Date() } }
  });
  await Cart.updateOne({ user: order.user }, { $set: { items: [] } });

  const user = await User.findById(order.user).select('email name');
  const adminTo = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  try {
    if (user?.email) {
      await emailService.sendEmail(user.email, 'Payment Successful', renderTemplate(readTemplate('payment-success.html'), {
        paymentId: capture.id,
        amount: Number(order.totalAmount).toFixed(2)
      }));
    }
    if (adminTo) {
      await emailService.sendEmail(adminTo, 'New Order Confirmed (Paid)', renderTemplate(readTemplate('admin-order-notification.html'), {
        orderId: order._id,
        paymentMethod: 'PayPal',
        paymentStatus: 'paid',
        totalAmount: Number(order.totalAmount).toFixed(2),
        customerName: user?.name || '',
        customerEmail: user?.email || '',
        customerPhone: order.phone || '',
        address: order.address || ''
      }));
    }
  } catch (emailError) {
    console.error('Failed to send PayPal confirmation emails:', emailError);
  }
}

exports.createOrder = async (req, res) => {
  if (!paypal.isConfigured()) {
    return res.status(503).json({ error: 'PayPal is not configured' });
  }

  try {
    const order = await Order.findOne({ _id: req.body?.orderId, user: req.user.id, paymentMethod: 'paypal' });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ paypal: await createPaypalOrder({ order, req }) });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Unable to create PayPal order' });
  }
};

exports.captureOrder = async (req, res) => {
  if (!paypal.isConfigured()) return res.status(503).json({ error: 'PayPal is not configured' });

  try {
    const { orderId, paypalOrderId } = req.body || {};
    const order = await Order.findOne({ _id: orderId, user: req.user.id, paymentMethod: 'paypal' });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const payment = await Payment.findOne({ order: order._id, provider: 'paypal', providerOrderId: paypalOrderId });
    if (!payment) return res.status(400).json({ error: 'PayPal payment was not initialized' });

    const response = await paypal.getOrdersController().captureOrder({
      id: paypalOrderId,
      prefer: 'return=representation'
    });
    await completeCapturedOrder(order, response.result);
    res.json({ ok: true });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Unable to capture PayPal payment' });
  }
};

exports.connection = async (req, res) => {
  const config = {
    configured: paypal.isConfigured(),
    mode: paypal.mode(),
    clientIdConfigured: Boolean(process.env.PAYPAL_CLIENT_ID),
    clientSecretConfigured: Boolean(process.env.PAYPAL_CLIENT_SECRET)
  };
  if (!config.configured) return res.status(503).json({ ok: false, config });

  try {
    await paypal.getOrdersController().createOrder({
      body: {
        intent: 'CAPTURE',
        purchaseUnits: [{ amount: { currencyCode: paypal.currency(), value: '0.01' } }]
      }
    });
    res.json({ ok: true, message: 'PayPal connection is successful', config });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message, config });
  }
};

exports.createPaypalOrder = createPaypalOrder;