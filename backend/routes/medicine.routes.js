const router = require('express').Router();
const { getAll, getById, create, update, delete: deleteMedicine, getCategories } = require('../controllers/medicine.controller');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', getAll);
router.get('/categories', getCategories);
router.get('/:id', getById);

// Admin-only mutations
router.post('/', auth, admin, upload.single('image'), create);
router.put('/:id', auth, admin, upload.single('image'), update);
router.delete('/:id', auth, admin, deleteMedicine);

module.exports = router;