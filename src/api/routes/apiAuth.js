/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication management
 */

// Auth API routes
const express = require('express');
const apiAuthRouter = express.Router();
const apiAuthController = require('../controllers/apiAuthController');

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

module.exports = apiAuthRouter;
