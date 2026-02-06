const Medicine = require('../models/Medicine');

exports.searchMedicines = async (query) => {
  return await Medicine.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ]
  });
};

exports.getLowStock = async (threshold = 10) => {
  return await Medicine.find({ stock: { $lt: threshold } });
};