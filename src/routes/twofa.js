import express from 'express';
import twofaController from '../controllers/twofaController.js';

const router = express.Router();

router.get('/setup', twofaController.setup);      // QR code and secret
router.post('/verify', twofaController.verify);   // verify the OTP code
router.post('/disable', twofaController.disable); // disable 2FA

export default router;
