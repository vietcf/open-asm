const express = require('express');
const router = express.Router();
const twofaController = require('../controllers/twofaController');
const requireLogin = require('../middlewares/requireLogin');

router.get('/setup', requireLogin, twofaController.setup);      // Lấy QR code và secret
router.post('/verify', requireLogin, twofaController.verify);   // Xác thực mã OTP
router.post('/disable', requireLogin, twofaController.disable); // Tắt 2FA

module.exports = router;
