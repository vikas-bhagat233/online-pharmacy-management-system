const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Delivery = require('../models/delivery');
const Medicine = require('../models/Medicine');
const emailService = require('../services/emailService');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toCsvValue(value) {
  const s = String(value ?? '');
  // Escape double-quotes by doubling them, then wrap.
  return `"${s.replaceAll('"', '""')}"`;
}

function formatDateIso(d) {
  try {
    return new Date(d).toISOString();
  } catch {
    return '';
  }
}

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

exports.getAllUsers = async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
};

exports.getDashboardStats = async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [todaysOrders, pendingDispatch, deliveredToday, codPending, overallDelivered] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
    Order.countDocuments({ status: { $in: ['placed', 'confirmed'] } }),
    Order.countDocuments({ deliveredAt: { $gte: startOfDay, $lte: endOfDay } }),
    Order.countDocuments({ paymentMethod: 'cod', paymentStatus: 'cod_pending', status: { $ne: 'failed' } }),
    Order.countDocuments({ status: 'delivered' })
  ]);

  res.json({
    todaysOrders,
    pendingDispatch,
    deliveredToday,
    codPending,
    overallDelivered
  });
};

exports.getLowStockMedicines = async (req, res) => {
  const threshold = Math.max(0, Number(req.query?.threshold ?? 10));
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit ?? 10)));
  const items = await Medicine.find({ stock: { $lte: threshold } })
    .sort({ stock: 1, name: 1 })
    .limit(limit)
    .lean();
  res.json({ threshold, items });
};

exports.exportOrdersCsv = async (req, res) => {
  const from = String(req.query?.from || '').trim();
  const to = String(req.query?.to || '').trim();
  const status = String(req.query?.status || '').trim();

  const filter = {};
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email')
    .lean();

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="orders-report.csv"');

  const header = [
    'orderId', 'createdAt', 'customerName', 'customerEmail',
    'status', 'paymentMethod', 'paymentStatus',
    'subtotal', 'codSurcharge', 'total',
    'address', 'deliveryAgentName', 'deliveryAgentPhone'
  ].map(toCsvValue).join(',');

  const lines = [header];
  for (const o of orders) {
    lines.push([
      o._id,
      formatDateIso(o.createdAt),
      o.user?.name || '',
      o.user?.email || '',
      o.status || '',
      o.paymentMethod || '',
      o.paymentStatus || '',
      o.subtotalAmount ?? '',
      o.codSurchargeAmount ?? '',
      o.totalAmount ?? '',
      o.address || '',
      o.deliveryAgent?.name || '',
      o.deliveryAgent?.phone || ''
    ].map(toCsvValue).join(','));
  }

  res.send(lines.join('\n'));
};

exports.exportMedicinesCsv = async (req, res) => {
  const threshold = req.query?.threshold === undefined ? null : Number(req.query.threshold);

  const filter = {};
  if (threshold !== null && Number.isFinite(threshold)) {
    filter.stock = { $lte: threshold };
  }

  const meds = await Medicine.find(filter)
    .sort({ name: 1 })
    .lean();

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="medicines-report.csv"');

  const header = ['id', 'name', 'category', 'price', 'stock', 'prescriptionRequired']
    .map(toCsvValue)
    .join(',');
  const lines = [header];
  for (const m of meds) {
    lines.push([
      m._id,
      m.name || '',
      m.category || '',
      m.price ?? '',
      m.stock ?? '',
      m.prescriptionRequired ? 'true' : 'false'
    ].map(toCsvValue).join(','));
  }
  res.send(lines.join('\n'));
};

exports.getAllOrders = async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 50)));

  // Retention policy: Hide delivered orders older than 24 hours
  // They remain in DB, but are hidden from the active admin list.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const retentionFilter = {
    $or: [
      { status: { $ne: 'delivered' } },
      { deliveredAt: { $gt: cutoff } },
      { deliveredAt: null }
    ]
  };

  const search = String(req.query?.search || '').trim();
  const filter = {};

  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    const searchOr = [
      { status: { $regex: re } },
      { paymentStatus: { $regex: re } },
      { paymentMethod: { $regex: re } },
      { address: { $regex: re } },
      { 'deliveryAgent.name': { $regex: re } },
      { 'deliveryAgent.phone': { $regex: re } }
    ];

    if (mongoose.Types.ObjectId.isValid(search)) {
      searchOr.push({ _id: search });
    }

    // Allow searching by user name/email (order stores user as ObjectId).
    const users = await User.find({
      $or: [{ name: { $regex: re } }, { email: { $regex: re } }]
    })
      .select('_id')
      .limit(200)
      .lean();

    if (users.length) {
      searchOr.push({ user: { $in: users.map((u) => u._id) } });
    }

    // Combine criteria: Must match search AND retention policy
    filter.$and = [
      { $or: searchOr },
      retentionFilter
    ];
  } else {
    // No search: just apply retention policy
    Object.assign(filter, retentionFilter);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .populate('items.medicine'),
    Order.countDocuments(filter)
  ]);

  const orderIds = orders.map((o) => o._id);

  const payments = await Payment.find({ order: { $in: orderIds } });
  const paymentsByOrder = new Map(payments.map((p) => [String(p.order), p]));

  const deliveries = await Delivery.find({ order: { $in: orderIds } });
  const deliveriesByOrder = new Map(deliveries.map((d) => [String(d.order), d]));

  const enriched = orders.map((o) => {
    const plain = o.toObject();
    plain.payment = paymentsByOrder.get(String(o._id)) || null;
    plain.delivery = deliveriesByOrder.get(String(o._id)) || null;
    return plain;
  });

  res.json({
    items: enriched,
    page,
    limit,
    total,
    hasMore: page * limit < total
  });
};

exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status, deliveryAgentName, deliveryAgentPhone } = req.body;

  const normalizedStatus = String(status || '').trim();
  const agentName = String(deliveryAgentName || '').trim();
  const agentPhone = String(deliveryAgentPhone || '').trim();

  if (!normalizedStatus && !agentName && !agentPhone) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const patch = {};
  const update = {};
  if (normalizedStatus) update.status = normalizedStatus;
  if (agentName || agentPhone) {
    update.deliveryAgent = {
      name: agentName,
      phone: agentPhone
    };
  }

  if (normalizedStatus === 'delivered') {
    update.deliveredAt = new Date();
  }

  Object.assign(patch, update);

  // If status changed, record it for timeline.
  const prior = await Order.findById(orderId).select('status');
  const statusChanged = Boolean(normalizedStatus) && String(prior?.status || '') !== String(normalizedStatus);

  if (statusChanged) {
    patch.$push = { statusHistory: { status: normalizedStatus, at: new Date() } };
  }

  const updated = await Order.findByIdAndUpdate(orderId, patch, { new: true })
    .populate('user', 'name email')
    .populate('items.medicine');

  if (!updated) return res.status(404).json({ error: 'Order not found' });

  // Business rule: to mark as out_for_delivery, admin must set an agent name first.
  if (normalizedStatus === 'out_for_delivery') {
    const hasName = String(updated.deliveryAgent?.name || '').trim().length > 0;
    if (!hasName) {
      return res.status(400).json({
        error: 'Delivery agent name is required before setting status to out_for_delivery'
      });
    }
  }

  // Upsert Delivery record when delivery agent is provided
  let delivery = null;
  if (agentName || agentPhone) {
    delivery = await Delivery.findOneAndUpdate(
      { order: updated._id },
      {
        $setOnInsert: { trackingNumber: 'TRK' + Date.now(), status: 'assigned' },
        $set: {
          deliveryAgent: {
            name: agentName,
            phone: agentPhone
          }
        }
      },
      { upsert: true, new: true }
    );
  }

  // Keep delivery status in sync with order status (best-effort)
  if (normalizedStatus) {
    const deliveryStatusMap = {
      dispatched: 'picked_up',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered'
    };
    const mapped = deliveryStatusMap[normalizedStatus];
    if (mapped) {
      delivery = await Delivery.findOneAndUpdate(
        { order: updated._id },
        { $set: { status: mapped } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }
  }

  // Emit live update
  try {
    req.io.to(`order-${updated._id}`).emit('orderUpdate', { order: updated, delivery });
  } catch (e) {
    // ignore socket errors
  }

  // Email customer about status changes (best-effort)
  if (normalizedStatus && updated.user?.email) {
    const statusEmail = {
      dispatched: {
        title: 'Your order is dispatched',
        subject: 'Your order is dispatched',
        message: 'Good news! Your order has been dispatched and is on the way.'
      },
      out_for_delivery: {
        title: 'Your order is out for delivery',
        subject: 'Your order is out for delivery',
        message: 'Your order is out for delivery today. Please be available to receive it.'
      },
      delivered: {
        title: 'Your order is delivered',
        subject: 'Your order is delivered',
        message: 'Your order has been delivered. Thank you for shopping with us.'
      }
    };

    const chosen = statusEmail[normalizedStatus] || {
      title: 'Order status updated',
      subject: `Order update: ${normalizedStatus}`,
      message: `Your order status is now: ${normalizedStatus}`
    };

    const agent = {
      name: String(updated.deliveryAgent?.name || '').trim() || '—',
      phone: String(updated.deliveryAgent?.phone || '').trim() || '—'
    };

    let message = chosen.message;
    if (normalizedStatus === 'out_for_delivery' && agent.name !== '—') {
      message = `${message} Delivery agent: ${agent.name}.`;
    }

    let invoiceSection = '';
    if (normalizedStatus === 'delivered') {
      const baseUrl = String(process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_URL || 'http://localhost:5000').replace(/\/$/, '');
      const token = jwt.sign(
        { typ: 'invoice', orderId: String(updated._id), userId: String(updated.user._id), role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      const invoiceUrl = `${baseUrl}/api/orders/${updated._id}/invoice?format=pdf&token=${encodeURIComponent(token)}`;
      invoiceSection = `
        <div style="height:12px;"></div>
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:14px;">
          <div style="font-family:Arial,Helvetica,sans-serif;color:#9ca3af;font-size:12px;">Invoice</div>
          <div style="height:8px;"></div>
          <a href="${invoiceUrl}" style="display:inline-block;background:linear-gradient(135deg,#6d5efc,#2dd4bf);color:#0b1020;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:13px;padding:10px 14px;border-radius:12px;">Download your invoice</a>
          <div style="height:8px;"></div>
          <div style="font-family:Arial,Helvetica,sans-serif;color:#9ca3af;font-size:11px;line-height:1.5;">The invoice link is valid for 30 days.</div>
        </div>
      `;
    }

    const html = renderTemplate(readTemplate('order-status-update.html'), {
      title: chosen.title,
      orderId: updated._id,
      message,
      deliveryAgentName: agent.name,
      deliveryAgentPhone: agent.phone,
      invoiceSection
    });
    await emailService.sendEmail(updated.user.email, chosen.subject, html);
  }

  res.json(updated);
};