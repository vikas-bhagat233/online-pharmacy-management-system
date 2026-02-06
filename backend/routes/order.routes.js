const router = require('express').Router();
const { create, checkout, checkoutMeta, getUserOrders, downloadInvoice, cancel } = require('../controllers/order.controller');
const auth = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/optionalAuthMiddleware');

// Public (token-based) invoice download. If Authorization header exists, it is honored.
router.get('/:orderId/invoice', optionalAuth, downloadInvoice);

router.use(auth);
router.post('/', create);
router.get('/checkout-meta', checkoutMeta);
router.post('/checkout', checkout);
router.get('/my-orders', getUserOrders);
router.put('/:id/cancel', cancel);

module.exports = router;