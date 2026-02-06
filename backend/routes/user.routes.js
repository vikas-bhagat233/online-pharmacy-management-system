const router = require('express').Router();
const { getProfile, updateProfile } = require('../controllers/user.controller');
const auth = require('../middleware/authMiddleware');

router.use(auth);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

module.exports = router;