const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const emailService = require('../services/emailService');

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

function getPublicBaseUrl(req) {
  const publicBase = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (publicBase) return publicBase.replace(/\/+$/, '');

  const frontendUrl = String(process.env.FRONTEND_URL || '').trim();
  if (frontendUrl) return frontendUrl.replace(/\/+$/, '');

  // Derive from request; prefer reverse-proxy headers if present.
  const getHeader = (name) => (req?.get ? req.get(name) : undefined);
  const xfProto = String(getHeader('x-forwarded-proto') || '').split(',')[0].trim();
  const xfHost = String(getHeader('x-forwarded-host') || '').split(',')[0].trim();
  const host = String(xfHost || getHeader('host') || '').trim();
  const proto = xfProto || req?.protocol || 'http';

  if (host) return `${proto}://${host}`.replace(/\/+$/, '');

  // Last resort: only used in local dev when no request host is available.
  return `http://localhost:${process.env.PORT || 5000}`;
}

function buildResetLink(req, token) {
  const base = getPublicBaseUrl(req);
  return `${base}/frontend/pages/reset-password.html?token=${encodeURIComponent(token)}`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

exports.register = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered. Please login.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role: 'user' });
    res.json({ message: 'User registered', userId: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'Account not found. Please create an account first.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email }).select('_id email name');

    // Always return a generic response to avoid account enumeration.
    if (!user) {
      return res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await PasswordReset.findOneAndUpdate(
      { email },
      { $set: { email, token: tokenHash, expiresAt } },
      { upsert: true, new: true }
    );

    const resetLink = buildResetLink(req, rawToken);
    const html = renderTemplate(readTemplate('reset-password.html'), { resetLink });

    const sent = await emailService.sendEmail(email, 'Reset your password', html);
    if (!sent?.ok && !sent?.skipped) {
      return res.status(500).json({ error: 'Failed to send reset email. Please try again later.' });
    }

    const exposeResetLink = String(process.env.EXPOSE_RESET_LINK || '').trim().toLowerCase() === 'true';

    // In dev, email may be skipped; optionally return the link to proceed without email.
    if (sent?.skipped || exposeResetLink) {
      return res.json({
        message: sent?.skipped
          ? 'Email is not configured; use the reset link returned by the API.'
          : 'Reset link generated.',
        resetLink
      });
    }

    return res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
  } catch (err) {
    return res.status(500).json({ error: 'Forgot password failed' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const tokenHash = sha256Hex(token);
    const record = await PasswordReset.findOne({ token: tokenHash });
    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      await PasswordReset.deleteOne({ _id: record._id });
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = await User.findOne({ email: String(record.email || '').toLowerCase() });
    if (!user) {
      await PasswordReset.deleteOne({ _id: record._id });
      return res.status(404).json({ error: 'Account not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    await PasswordReset.deleteOne({ _id: record._id });

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Reset password failed' });
  }
};