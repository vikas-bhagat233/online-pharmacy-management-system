const Cart = require('../models/Cart');
const Medicine = require('../models/Medicine');

exports.getCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user.id }).populate('items.medicine');
  if (!cart) cart = await Cart.create({ user: req.user.id, items: [] });
  res.json(cart);
};

exports.addItem = async (req, res) => {
  const medicineId = String(req.body?.medicineId || '').trim();
  const quantity = Number(req.body?.quantity || 1);

  if (!medicineId || !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'medicineId and positive quantity are required' });
  }

  const med = await Medicine.findById(medicineId);
  if (!med) return res.status(404).json({ error: 'Medicine not found' });

  const availableStock = Number(med.stock ?? 0);
  if (Number.isFinite(availableStock) && availableStock <= 0) {
    return res.status(409).json({ error: 'Out of stock' });
  }

  let cart = await Cart.findOne({ user: req.user.id });
  if (!cart) cart = await Cart.create({ user: req.user.id, items: [] });

  const existing = cart.items.find((item) => item.medicine.toString() === medicineId);
  const nextQty = (existing ? Number(existing.quantity || 0) : 0) + quantity;

  if (Number.isFinite(availableStock) && nextQty > availableStock) {
    return res.status(409).json({ error: `Only ${availableStock} left in stock` });
  }

  if (existing) existing.quantity = nextQty;
  else cart.items.push({ medicine: medicineId, quantity: nextQty });

  await cart.save();
  cart = await Cart.findOne({ user: req.user.id }).populate('items.medicine');
  res.json(cart);
};

exports.updateItem = async (req, res) => {
  const medicineId = String(req.body?.medicineId || '').trim();
  const quantity = Number(req.body?.quantity);

  if (!medicineId || !Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'medicineId and non-negative quantity are required' });
  }

  const med = await Medicine.findById(medicineId).select('stock');
  if (!med) return res.status(404).json({ error: 'Medicine not found' });

  const availableStock = Number(med.stock ?? 0);
  if (quantity > 0 && Number.isFinite(availableStock) && availableStock <= 0) {
    return res.status(409).json({ error: 'Out of stock' });
  }
  if (quantity > 0 && Number.isFinite(availableStock) && quantity > availableStock) {
    return res.status(409).json({ error: `Only ${availableStock} left in stock` });
  }

  let cart = await Cart.findOne({ user: req.user.id });
  if (!cart) cart = await Cart.create({ user: req.user.id, items: [] });

  cart.items = cart.items.filter((i) => i.medicine.toString() !== medicineId);
  if (quantity > 0) cart.items.push({ medicine: medicineId, quantity });

  await cart.save();
  cart = await Cart.findOne({ user: req.user.id }).populate('items.medicine');
  res.json(cart);
};

exports.removeItem = async (req, res) => {
  const medicineId = String(req.params?.medicineId || '').trim();
  if (!medicineId) return res.status(400).json({ error: 'medicineId is required' });

  let cart = await Cart.findOne({ user: req.user.id });
  if (!cart) cart = await Cart.create({ user: req.user.id, items: [] });

  cart.items = cart.items.filter((i) => i.medicine.toString() !== medicineId);
  await cart.save();
  cart = await Cart.findOne({ user: req.user.id }).populate('items.medicine');
  res.json(cart);
};

exports.clearCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user.id });
  if (!cart) cart = await Cart.create({ user: req.user.id, items: [] });
  cart.items = [];
  await cart.save();
  res.json(cart);
};