const router = require('express').Router();
const {
	getAllUsers,
	getAllOrders,
	updateOrderStatus,
	getDashboardStats,
	getLowStockMedicines,
	exportOrdersCsv,
	exportMedicinesCsv
} = require('../controllers/admin.controller');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

router.use(auth, admin);
router.get('/stats', getDashboardStats);
router.get('/low-stock', getLowStockMedicines);
router.get('/reports/orders.csv', exportOrdersCsv);
router.get('/reports/medicines.csv', exportMedicinesCsv);
router.get('/users', getAllUsers);
router.get('/orders', getAllOrders);
router.put('/orders/:orderId/status', updateOrderStatus);

module.exports = router;