exports.isEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

exports.isStrongPassword = (password) => {
  return password.length >= 6;
};