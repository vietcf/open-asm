/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication management
 */

// Auth API routes
import express from 'express';
import apiAuthController from './auth.api.js';

const apiAuthRouter = express.Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login (JWT)
 *     description: Public endpoint (no token). Local accounts only; returns a JWT valid for JWT_EXPIRES_IN (default 8h).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               otp:
 *                 type: string
 *                 description: Current 6-digit two-factor code, required when the account has 2FA enabled
 *     responses:
 *       200:
 *         description: JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       400:
 *         description: Username and password required
 *       401:
 *         description: Invalid credentials, inactive account, or missing / wrong two-factor code
 *       403:
 *         description: Password change or 2FA enrolment required — the user must first do it in the web UI
 *       429:
 *         description: Too many failed attempts (same lock-out as the web login)
 *       500:
 *         description: Server error
 */
apiAuthRouter.post('/login', apiAuthController.login);

export default apiAuthRouter;
