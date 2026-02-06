
const router = require('express').Router();
const { getCart, addItem, updateItem, removeItem, clearCart } = require('../controllers/cart.controller');
const auth = require('../middleware/authMiddleware');

router.use(auth);
router.get('/', getCart);
router.post('/add', addItem);
router.put('/update', updateItem);
router.delete('/remove/:medicineId', removeItem);
router.post('/clear', clearCart);

module.exports = router;