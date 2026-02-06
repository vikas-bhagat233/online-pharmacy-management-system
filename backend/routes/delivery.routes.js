const router = require('express').Router();
const { 
  assignDelivery, 
  updateLocation, 
  trackDelivery 
} = require('../controllers/delivery.controller');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

router.post('/assign', auth, admin, assignDelivery);
router.put('/update-location', auth, updateLocation);
router.get('/track/:trackingNumber', trackDelivery);

module.exports = router;