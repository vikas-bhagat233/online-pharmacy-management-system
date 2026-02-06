exports.generateRandomCode = (length = 6) => {
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
};

exports.formatCurrency = (amount) => {
  return `₹${amount.toFixed(2)}`;
};

exports.truncate = (str, length = 100) => {
  return str.length > length ? str.substring(0, length) + '...' : str;
};