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

// Debug Email Route (Remove in production later)
router.get('/debug-mail', async (req, res) => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    const status = {
        userConfigured: !!user,
        passConfigured: !!pass,
        userValue: user ? user.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'missing',
        passLength: pass ? pass.length : 0
    };

    try {
        const transporter = require('nodemailer').createTransport(require('../config/mail'));
        await transporter.verify();
        res.json({ ok: true, message: 'Connection to SMTP server is successful!', config: status });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message, config: status });
    }
});

module.exports = router;