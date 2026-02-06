const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Payment = require('../models/Payment');
const User = require('../models/User');
const razorpay = require('../config/razorpay');
const { decrementStockOrFail } = require('../services/orderService');
const emailService = require('../services/emailService');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function money(n) {
  const v = Number(n || 0);
  return v.toFixed(2);
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function tryReadFile(p) {
  try {
    return fs.readFileSync(p);
  } catch (e) {
    return null;
  }
}

function getLogoBlockHtml() {
  // Use frontend favicon.svg as default brand mark if present.
  const svgPath = path.join(__dirname, '..', '..', 'frontend', 'favicon.svg');
  const buf = tryReadFile(svgPath);
  if (!buf) return '<div style="font-weight:900;font-size:16px;">M</div>';

  const base64 = buf.toString('base64');
  const dataUri = `data:image/svg+xml;base64,${base64}`;
  return `<img src="${dataUri}" alt="Logo" />`;
}

function buildInvoiceData(order, payment) {
  const paymentMethod = String(order.paymentMethod || 'cod').toLowerCase();
  const paymentLabel = paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)';
  const paymentStatus = String(order.paymentStatus || (payment?.status || 'pending'));

  const items = Array.isArray(order.items) ? order.items : [];
  const computedSubtotal = items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const subtotalAmount = Number(order.subtotalAmount ?? computedSubtotal);
  const deliveryCharge = Number(order.deliveryCharge || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const couponCode = order.couponCode || '';
  const codSurchargeAmount = Number(order.codSurchargeAmount || 0);
  // Fallback calculation if db field missing, but should exist
  const totalAmount = Number(order.totalAmount ?? (subtotalAmount + deliveryCharge - discountAmount + codSurchargeAmount));

  const invoiceNumber = `INV-${String(order._id).slice(-8).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleString();

  return {
    paymentMethod,
    paymentLabel,
    paymentStatus,
    items,
    subtotalAmount,
    deliveryCharge,
    discountAmount,
    couponCode,
    codSurchargeAmount,
    totalAmount,
    invoiceNumber,
    invoiceDate,
    razorpayPaymentId: payment?.razorpayPaymentId || ''
  };
}

function writeInvoicePdf(res, order, invoice) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order._id}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);

  const accent = '#2dd4bf';
  const dark = '#0b1020';

  // Header
  doc.rect(40, 40, 515, 60).fill(accent);
  doc.fillColor(dark).fontSize(10).font('Helvetica-Bold').text('MEDICARE', 55, 55);
  doc.fontSize(18).text('Invoice', 55, 70);

  // Meta
  doc.fillColor('#111827');
  doc.font('Helvetica-Bold').fontSize(12).text(`Invoice #: ${invoice.invoiceNumber}`, 40, 120);
  doc.font('Helvetica').fontSize(10).text(`Date: ${invoice.invoiceDate}`, 40, 138);
  doc.text(`Order ID: ${String(order._id)}`, 40, 154);
  doc.text(`Payment: ${invoice.paymentLabel} (${invoice.paymentStatus})`, 40, 170);
  if (invoice.razorpayPaymentId) {
    doc.text(`Payment ID: ${invoice.razorpayPaymentId}`, 40, 186);
  }

  // Customer
  doc.font('Helvetica-Bold').text('Billed To', 320, 120);
  doc.font('Helvetica').text(String(order.user?.name || ''), 320, 138);
  doc.fillColor('#334155').text(String(order.user?.email || ''), 320, 154);
  doc.fillColor('#111827');
  doc.font('Helvetica-Bold').text('Delivery Address', 320, 174);
  doc.font('Helvetica').fillColor('#111827').text(String(order.address || ''), 320, 192, { width: 235 });

  // Table header
  let y = 250;
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#e5e7eb').stroke();
  y += 10;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155');
  doc.text('Item', 40, y);
  doc.text('Qty', 330, y, { width: 60, align: 'right' });
  doc.text('Unit', 400, y, { width: 70, align: 'right' });
  doc.text('Amount', 485, y, { width: 70, align: 'right' });
  y += 18;
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#e5e7eb').stroke();
  y += 8;

  doc.font('Helvetica').fontSize(10).fillColor('#111827');
  for (const it of invoice.items) {
    const name = it.medicine?.name ? String(it.medicine.name) : 'Item';
    const qty = Number(it.quantity || 0);
    const unit = Number(it.price || 0);
    const amount = qty * unit;

    const nameHeight = doc.heightOfString(name, { width: 280 });
    doc.text(name, 40, y, { width: 280 });
    doc.text(String(qty), 330, y, { width: 60, align: 'right' });
    doc.text(`₹${money(unit)}`, 400, y, { width: 70, align: 'right' });
    doc.text(`₹${money(amount)}`, 485, y, { width: 70, align: 'right' });

    y += Math.max(18, nameHeight + 4);
    if (y > 700) {
      doc.addPage();
      y = 60;
    }
  }

  // Totals
  y += 10;
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#e5e7eb').stroke();
  y += 12;

  const rightX = 485;
  doc.font('Helvetica').fontSize(10).fillColor('#334155');
  doc.text('Subtotal', 360, y, { width: 120, align: 'right' });
  doc.fillColor('#111827').text(`₹${money(invoice.subtotalAmount)}`, rightX, y, { width: 70, align: 'right' });
  y += 16;

  if (invoice.deliveryCharge > 0) {
    doc.fillColor('#334155').text('Delivery Charge', 360, y, { width: 120, align: 'right' });
    doc.fillColor('#111827').text(`₹${money(invoice.deliveryCharge)}`, rightX, y, { width: 70, align: 'right' });
    y += 16;
  }

  if (invoice.discountAmount > 0) {
    doc.fillColor('#16a34a').text(`Discount (${invoice.couponCode})`, 360, y, { width: 120, align: 'right' });
    doc.fillColor('#16a34a').text(`-₹${money(invoice.discountAmount)}`, rightX, y, { width: 70, align: 'right' });
    y += 16;
  }

  if (invoice.paymentMethod === 'cod' && invoice.codSurchargeAmount > 0) {
    doc.fillColor('#334155').text('COD surcharge', 360, y, { width: 120, align: 'right' });
    doc.fillColor('#111827').text(`₹${money(invoice.codSurchargeAmount)}`, rightX, y, { width: 70, align: 'right' });
    y += 16;
  }

  doc.font('Helvetica-Bold').fillColor('#111827');
  doc.text('Total', 360, y, { width: 120, align: 'right' });
  doc.text(`₹${money(invoice.totalAmount)}`, rightX, y, { width: 70, align: 'right' });
  y += 24;

  doc.font('Helvetica').fontSize(9).fillColor('#475569');
  const note = invoice.paymentMethod === 'cod'
    ? 'This is a Cash on Delivery invoice. Please pay the total amount at delivery.'
    : 'This is a paid invoice for your online payment. Thank you!';
  doc.text(note, 40, y, { width: 515 });

  doc.end();
}

async function writeInvoicePdfFromHtml(res, order, html) {
  // Lazy import so the server still starts if Puppeteer isn't available.
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    throw new Error('puppeteer_not_available');
  }

  const executablePath = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim() || undefined;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order._id}.pdf"`);
    res.send(pdf);
  } finally {
    await browser.close();
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

exports.create = async (req, res) => {
  const order = await Order.create({ ...req.body, user: req.user.id });
  res.json(order);
};

exports.checkout = async (req, res) => {
  const address = String(req.body?.address || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const paymentMethod = String(req.body?.paymentMethod || 'cod').toLowerCase();

  if (!address) return res.status(400).json({ error: 'Address is required' });
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  if (!['cod', 'razorpay'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Invalid paymentMethod' });
  }

  const cart = await Cart.findOne({ user: req.user.id }).populate('items.medicine');
  if (!cart || !cart.items?.length) return res.status(400).json({ error: 'Cart is empty' });

  // Build frozen items snapshot with price at checkout time
  const items = cart.items.map((it) => {
    let price = Number(it.medicine?.price || 0);
    const discount = Number(it.medicine?.discount || 0);
    if (discount > 0) {
      price = price - (price * discount / 100);
    }
    return {
      medicine: it.medicine?._id,
      quantity: Number(it.quantity || 0),
      price: Number(price.toFixed(2))
    };
  });

  if (items.some((i) => !i.medicine || !Number.isFinite(i.quantity) || i.quantity <= 0)) {
    return res.status(400).json({ error: 'Cart has invalid items' });
  }

  const subtotalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Delivery Charge
  const orderCount = await Order.countDocuments({ user: req.user.id, status: { $ne: 'cancelled' } });

  // First 3 orders are free. Otherwise: Free if subtotal > 500, else 40.
  let deliveryCharge = 0;
  if (orderCount < 3) {
    deliveryCharge = 0;
  } else {
    deliveryCharge = subtotalAmount > 500 ? 0 : 40;
  }

  // Discount
  const couponCode = String(req.body?.couponCode || '').trim().toUpperCase();
  let discountAmount = 0;
  // Coupon logic removed as requested by user


  const codSurchargeAmount = paymentMethod === 'cod'
    ? Number(process.env.COD_SURCHARGE_INR || 0)
    : 0;

  // Ensure total doesn't go negative
  const totalAmount = Math.max(0, subtotalAmount + deliveryCharge - discountAmount + codSurchargeAmount);

  const status = paymentMethod === 'cod' ? 'placed' : 'payment_pending';
  const paymentStatus = paymentMethod === 'cod' ? 'cod_pending' : 'pending';

  const order = await Order.create({
    user: req.user.id,
    items,
    address,
    phone,
    subtotalAmount,
    deliveryCharge,
    discountAmount,
    couponCode: discountAmount > 0 ? couponCode : null,
    codSurchargeAmount,
    totalAmount,
    status,
    statusHistory: [{ status, at: new Date() }],
    paymentMethod,
    paymentStatus
  });

  // COD: decrement stock immediately and clear cart
  if (paymentMethod === 'cod') {
    try {
      await decrementStockOrFail(items);
    } catch (e) {
      await Order.findByIdAndUpdate(order._id, { status: 'failed', paymentStatus: 'failed' });
      return res.status(409).json({ error: 'Insufficient stock for one or more items' });
    }

    await Cart.updateOne({ user: req.user.id }, { $set: { items: [] } });

    // Email customer + admin
    const user = await User.findById(req.user.id).select('email name');
    if (user?.email) {
      const html = renderTemplate(readTemplate('order-confirmation.html'), {
        orderId: order._id,
        totalAmount: totalAmount.toFixed(2)
      });
      await emailService.sendEmail(user.email, 'Order Confirmed', html);
    }
    const adminTo = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
    if (adminTo) {
      const html = renderTemplate(readTemplate('admin-order-notification.html'), {
        orderId: order._id,
        paymentMethod: 'COD',
        paymentStatus: order.paymentStatus,
        totalAmount: totalAmount.toFixed(2),
        customerName: user?.name || '',
        customerEmail: user?.email || '',
        customerPhone: phone,
        address
      });
      await emailService.sendEmail(adminTo, 'New Order Received (COD)', html);
    }

    return res.json({
      order,
      next: { type: 'redirect', url: '/pages/orders.html' }
    });
  }

  // Razorpay: create razorpay order, store Payment record, return details to frontend
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100),
    currency: 'INR',
    receipt: `order_${order._id}`
  });

  await Payment.create({
    order: order._id,
    razorpayId: razorpayOrder.id,
    amount: totalAmount,
    currency: 'INR',
    status: 'created'
  });

  res.json({
    order,
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    }
  });
};

exports.getUserOrders = async (req, res) => {
  console.log('GET /my-orders hit for user:', req.user.id);
  const orders = await Order.find({ user: req.user.id }).populate('items.medicine');
  res.json(orders);
};

exports.checkoutMeta = async (req, res) => {
  const orderCount = await Order.countDocuments({ user: req.user.id, status: { $ne: 'cancelled' } });
  res.json({
    codSurchargeInr: Number(process.env.COD_SURCHARGE_INR || 0),
    deliveryChargeInr: Number(process.env.DELIVERY_CHARGE_INR || 40),
    orderCount
  });
};

exports.downloadInvoice = async (req, res) => {
  const { orderId } = req.params;
  const format = String(req.query?.format || 'pdf').toLowerCase();

  // Access control:
  // - If Authorization header exists, optionalAuthMiddleware will set req.user.
  // - Otherwise, allow via signed invoice token in query (?token=...)
  let accessUserId = req.user?.id;
  let accessRole = req.user?.role;

  if (!accessUserId) {
    const token = String(req.query?.token || '').trim();
    if (!token) return res.status(401).send('Unauthorized');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.typ !== 'invoice') return res.status(401).send('Unauthorized');
      if (String(decoded?.orderId) !== String(orderId)) return res.status(401).send('Unauthorized');
      accessUserId = decoded?.userId;
      accessRole = decoded?.role;
    } catch (e) {
      return res.status(401).send('Unauthorized');
    }
  }

  const order = await Order.findById(orderId)
    .populate('user', 'name email')
    .populate('items.medicine');

  if (!order) return res.status(404).send('Not found');

  const isAdmin = String(accessRole || '').toLowerCase() === 'admin';
  const isOwner = String(order.user?._id || order.user) === String(accessUserId);
  if (!isAdmin && !isOwner) return res.status(403).send('Forbidden');

  const payment = await Payment.findOne({ order: order._id }).lean();

  const invoice = buildInvoiceData(order, payment);

  const logoBlock = getLogoBlockHtml();

  const paymentMethod = invoice.paymentMethod;
  const paymentLabel = invoice.paymentLabel;
  const paymentStatus = invoice.paymentStatus;
  const items = invoice.items;
  const subtotalAmount = invoice.subtotalAmount;
  const codSurchargeAmount = invoice.codSurchargeAmount;
  const totalAmount = invoice.totalAmount;

  const itemsRows = items.map((it) => {
    const name = it.medicine?.name ? String(it.medicine.name) : 'Item';
    const qty = Number(it.quantity || 0);
    const unit = Number(it.price || 0);
    const line = unit * qty;
    return `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td class="right">${qty}</td>
        <td class="right">₹${money(unit)}</td>
        <td class="right">₹${money(line)}</td>
      </tr>
    `;
  }).join('');

  const codRow = (paymentMethod === 'cod' && codSurchargeAmount > 0)
    ? `
      <tr>
        <td colspan="3" class="right muted">COD surcharge</td>
        <td class="right">₹${money(codSurchargeAmount)}</td>
      </tr>
    `
    : '';

  const deliveryRow = (invoice.deliveryCharge > 0)
    ? `
      <tr>
        <td colspan="3" class="right muted">Delivery Charge</td>
        <td class="right">₹${money(invoice.deliveryCharge)}</td>
      </tr>
    `
    : '';

  const discountRow = (invoice.discountAmount > 0)
    ? `
      <tr>
        <td colspan="3" class="right muted" style="color:#22c55e">Discount (${escapeHtml(invoice.couponCode || 'PROMO')})</td>
        <td class="right" style="color:#22c55e">-₹${money(invoice.discountAmount)}</td>
      </tr>
    `
    : '';

  const paymentRefLine = invoice.razorpayPaymentId
    ? `<div class="muted" style="margin-top:6px;">Payment ID: ${escapeHtml(invoice.razorpayPaymentId)}</div>`
    : '';

  const note = paymentMethod === 'cod'
    ? 'This is a Cash on Delivery invoice. Please pay the total amount at delivery.'
    : 'This is a paid invoice for your online payment. Thank you!';

  const html = renderTemplate(readTemplate('invoice.html'), {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    orderId: order._id,
    customerName: order.user?.name || '',
    customerEmail: order.user?.email || '',
    address: order.address || '',
    paymentLabel,
    paymentStatus,
    paymentRefLine,
    itemsRows,
    subtotalAmount: money(subtotalAmount),
    deliveryRow,
    discountRow,
    codRow,
    totalAmount: money(totalAmount),
    note,
    logoBlock
  });

  if (format === 'pdf') {
    const renderer = String(process.env.INVOICE_PDF_RENDERER || 'pdfkit').trim().toLowerCase();

    // Most reliable default (especially on Windows/dev environments): pdfkit.
    if (renderer === 'pdfkit') {
      return writeInvoicePdf(res, order, invoice);
    }

    // Optional: better-looking HTML->PDF rendering (requires working Puppeteer/Chromium).
    if (renderer === 'puppeteer') {
      try {
        return await writeInvoicePdfFromHtml(res, order, html);
      } catch (e) {
        return writeInvoicePdf(res, order, invoice);
      }
    }

    // auto: try puppeteer first, then fallback
    try {
      return await writeInvoicePdfFromHtml(res, order, html);
    } catch (e) {
      return writeInvoicePdf(res, order, invoice);
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order._id}.html"`);
  res.send(html);
};

exports.cancel = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user');
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Permissions
  const isAdmin = req.user.role === 'admin';
  const orderUserId = String(order.user?._id || order.user);
  const requestUserId = req.user.id;

  if (orderUserId !== requestUserId && !isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Check status
  const cancellable = ['pending', 'payment_pending', 'placed', 'confirmed'];
  if (!cancellable.includes(order.status)) {
    return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
  }

  // Update status
  order.status = 'cancelled';
  order.statusHistory.push({ status: 'cancelled', at: new Date() });
  await order.save();

  // Restock items
  const Medicine = require('../models/Medicine');
  for (const item of order.items) {
    if (item.medicine && item.quantity) {
      await Medicine.findByIdAndUpdate(item.medicine, { $inc: { stock: item.quantity } });
    }
  }

  // Send Emails
  try {
    const userEmail = order.user?.email;
    const userName = order.user?.name || 'Customer';

    if (userEmail) {
      await emailService.sendEmail(
        userEmail,
        'Order Cancelled',
        `<p>Hi ${userName},</p><p>Your order #${order._id} has been cancelled.</p><p>If you have paid online, the refund will be processed within 5-7 days.</p>`
      );
    }

    const adminTo = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
    if (adminTo) {
      await emailService.sendEmail(
        adminTo,
        'Order Cancelled - Admin Alert',
        `<p>Order #${order._id} was cancelled by ${isAdmin ? 'Admin' : 'Customer'}.</p><p>Stock has been restored automatically.</p>`
      );
    }
  } catch (e) {
    console.error('Email send failed during cancellation', e);
  }

  if (req.io) {
    req.io.emit('order-cancelled', { orderId: order._id });
  }

  res.json({ message: 'Order cancelled', order });
};