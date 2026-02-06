const Order = require('../models/Order');

exports.updateStock = async (orderItems) => {
  const Medicine = require('../models/Medicine');
  for (const item of orderItems) {
    await Medicine.findByIdAndUpdate(item.medicine, { $inc: { stock: -item.quantity } });
  }
};

exports.decrementStockOrFail = async (orderItems) => {
  const Medicine = require('../models/Medicine');
  const emailService = require('./emailService');
  const LOW_STOCK_THRESHOLD = 10; // Fixed count threshold as requested

  // Best-effort atomic checks using conditional updates, with rollback if any fails.
  const applied = [];
  try {
    for (const item of orderItems) {
      const medicineId = String(item.medicine);
      const qty = Number(item.quantity);
      if (!medicineId || !Number.isFinite(qty) || qty <= 0) {
        throw new Error('Invalid order item quantity');
      }

      const updatedMedicine = await Medicine.findOneAndUpdate(
        { _id: medicineId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );

      if (!updatedMedicine) {
        throw new Error('Insufficient stock');
      }
      applied.push({ medicineId, qty });

      // Low Stock Alert
      if (updatedMedicine.stock <= LOW_STOCK_THRESHOLD) {
        const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
        if (adminEmail) {
          const subject = `Low Stock Alert: ${updatedMedicine.name}`;
          const html = `
             <h3>Low Stock Alert</h3>
             <p>The stock for medicine <strong>${updatedMedicine.name}</strong> has dropped to <strong style="color:red;">${updatedMedicine.stock}</strong>.</p>
             <p>Threshold: ${LOW_STOCK_THRESHOLD}</p>
             <p>Please restock soon.</p>
           `;
          // Send asynchronously, don't block order
          emailService.sendEmail(adminEmail, subject, html).catch(e => console.error('Low stock alert failed:', e.message));
        }
      }
    }
  } catch (err) {
    // rollback
    for (const a of applied) {
      await Medicine.updateOne({ _id: a.medicineId }, { $inc: { stock: a.qty } });
    }
    throw err;
  }
};

exports.getOrderStats = async () => {
  const totalOrders = await Order.countDocuments();
  const totalRevenue = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]);
  return { totalOrders, totalRevenue: totalRevenue[0]?.total || 0 };
};