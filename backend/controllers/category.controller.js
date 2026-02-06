const Category = require('../models/Category');

exports.getAll = async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
};

exports.create = async (req, res) => {
  const category = await Category.create(req.body);
  res.json(category);
};