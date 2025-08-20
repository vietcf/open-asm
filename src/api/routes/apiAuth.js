/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication management
 */

// Auth API routes
import express from 'express';
import apiAuthController from '../controllers/apiAuthController.js';

const apiAuthRouter = express.Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login (JWT)
 *     tags: [Auth]
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
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
apiAuthRouter.post('/login', apiAuthController.login);

export default apiAuthRouter;
