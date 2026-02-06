const bcrypt = require('bcryptjs');

exports.hash = async (password) => {
  return await bcrypt.hash(password, 10);
};

exports.compare = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};