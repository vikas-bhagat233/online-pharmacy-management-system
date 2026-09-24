const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const paypalController = require('../controllers/paypalController');

router.get('/connection', paypalController.connection);
router.use(auth);
router.post('/create-order', paypalController.createOrder);
router.post('/capture-order', paypalController.captureOrder);

module.exports = router;