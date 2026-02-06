const Medicine = require('../models/Medicine');

function normalizeMedicinePayload(req) {
  const body = req.body || {};

  const payload = {
    name: body.name,
    description: body.description,
    category: body.category,
    image: body.image,
  };

  if (body.price !== undefined) payload.price = Number(body.price);
  if (body.discount !== undefined) payload.discount = Number(body.discount);
  if (body.stock !== undefined) payload.stock = Number(body.stock);

  if (body.prescriptionRequired !== undefined) {
    const value = String(body.prescriptionRequired).toLowerCase();
    payload.prescriptionRequired = value === 'true' || value === '1' || value === 'yes';
  }

  // Handle image upload if a new file is provided
  if (req.file) {
    payload.image = req.file.path || `/uploads/${req.file.filename}`;
  }

  // Remove undefined keys so we don't overwrite fields unintentionally
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  return payload;
}

exports.getAll = async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 50)));
  const search = String(req.query?.search || '').trim();
  const category = String(req.query?.category || '').trim();

  const filter = {};
  if (search) {
    // Case-insensitive search on name/category.
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } }
    ];
  }
  if (category) {
    filter.category = category;
  }

  const [items, total] = await Promise.all([
    Medicine.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Medicine.countDocuments(filter)
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    hasMore: page * limit < total
  });
};

exports.getCategories = async (req, res) => {
  const categories = await Medicine.distinct('category');
  res.json(categories.filter(Boolean).sort());
};

exports.getById = async (req, res) => {
  const medicine = await Medicine.findById(req.params.id);
  res.json(medicine);
};

exports.create = async (req, res) => {
  const payload = normalizeMedicinePayload(req);
  const medicine = await Medicine.create(payload);
  res.json(medicine);
};

exports.update = async (req, res) => {
  const payload = normalizeMedicinePayload(req);
  const updated = await Medicine.findByIdAndUpdate(req.params.id, payload, { new: true });
  res.json(updated);
};

exports.delete = async (req, res) => {
  await Medicine.findByIdAndDelete(req.params.id);
  res.json({ message: 'Medicine deleted' });
};