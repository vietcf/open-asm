const express = require('express');
const router = express.Router();
const changePasswordController = require('../controllers/changePasswordController');
const requireLogin = require('../middlewares/requireLogin');
const require2fa = require('../middlewares/require2fa');

// Show change password form
router.get('/change-password', requireLogin, require2fa, changePasswordController.getChangePassword);
// Handle change password submission
router.post('/change-password', requireLogin, require2fa, changePasswordController.postChangePassword);

module.exports = router;
