const Cart = require('../models/Cart');

exports.calculateTotal = (cartItems) => {
  return cartItems.reduce((total, item) => total + (item.medicine.price * item.quantity), 0);
};

exports.clearCart = async (userId) => {
  await Cart.findOneAndUpdate({ user: userId }, { items: [] });
};