const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function ensureAdmin() {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Admin';
  const forcePasswordReset = String(process.env.ADMIN_PASSWORD_FORCE || '').toLowerCase() === 'true';
  const syncPasswordIfMismatch = String(process.env.ADMIN_PASSWORD_SYNC || '').toLowerCase() === 'true';

  if (!adminEmail || !adminPassword) {
    console.log('[ensureAdmin] ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin bootstrap');
    return;
  }

  const existing = await User.findOne({ email: adminEmail });

  if (!existing) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await User.create({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'admin'
    });

    console.log(`[ensureAdmin] Created admin user: ${adminEmail}`);
    return;
  }

  const updates = {};
  if (existing.role !== 'admin') updates.role = 'admin';

  if (forcePasswordReset) {
    updates.password = await bcrypt.hash(adminPassword, 10);
  } else if (syncPasswordIfMismatch) {
    const matches = await bcrypt.compare(adminPassword, existing.password);
    if (!matches) {
      updates.password = await bcrypt.hash(adminPassword, 10);
    }
  }

  if (Object.keys(updates).length > 0) {
    await User.updateOne({ _id: existing._id }, { $set: updates });
    console.log(`[ensureAdmin] Updated admin user: ${adminEmail}`);
  } else {
    console.log(`[ensureAdmin] Admin user exists: ${adminEmail}`);
  }
}

module.exports = ensureAdmin;
