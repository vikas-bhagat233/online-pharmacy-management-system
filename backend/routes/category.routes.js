const router = require('express').Router();
const { getAll, create } = require('../controllers/category.controller');

router.get('/', getAll);
router.post('/', create);

module.exports = router;