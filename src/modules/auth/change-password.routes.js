import express from 'express';
import changePasswordController from './change-password.controller.js';

const router = express.Router();

// GET /change-password - Show change password form
router.get('/', changePasswordController.getChangePassword);

// POST /change-password - Process password change
router.post('/', changePasswordController.postChangePassword);

export default router;
