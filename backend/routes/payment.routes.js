const router = require('express').Router();
const { createOrder, verify } = require('../controllers/payment.controller');
const auth = require('../middleware/authMiddleware');

router.use(auth);
router.post('/create-order', createOrder);
router.post('/verify', verify);

module.exports = router;