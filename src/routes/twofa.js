import express from 'express';
import twofaController from '../controllers/twofaController.js';

const router = express.Router();

router.get('/setup', twofaController.setup);      // Lấy QR code và secret
router.post('/verify', twofaController.verify);   // Xác thực mã OTP
router.post('/disable', twofaController.disable); // Tắt 2FA

export default router;
