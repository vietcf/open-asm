
import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// ===========================================
// AUTHENTICATION ROUTES
// ===========================================

// Login flow
router.get('/login', authController.getLoginPage);       // Step 1: Show login form
router.post('/login', authController.postLogin);         // Step 2: Process login

// 2FA flow (requires partial login session)
router.get('/login/2fa', authController.get2fa);         // Step 3: Show 2FA form
router.post('/login/2fa', authController.post2fa);       // Step 4: Process 2FA

// Logout
router.get('/logout', authController.logout);            // Clear session & redirect

export default router;
