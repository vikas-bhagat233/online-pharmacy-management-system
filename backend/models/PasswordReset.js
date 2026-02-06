const mongoose = require('mongoose');

const PasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  // Stores SHA-256 hash of the raw token
  token: { type: String, required: true, index: true },
  // TTL index: document expires automatically at this date
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
});

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);