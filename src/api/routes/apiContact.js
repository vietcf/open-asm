// Contact API routes
const express = require('express');
const apiContactRouter = express.Router();
const apiContactController = require('../controllers/apiContactController');
const { authorizePermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   - name: Contact
 *     description: Contact management
 */

/**
 * @swagger
 * /api/v1/contacts:
 *   post:
 *     summary: Create a new contact
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               position:
 *                 type: string
 *                 enum: [MANAGER, STAFF]
 *               unit_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Contact created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Contact already exists with this email
 *       500:
 *         description: Server error
 */
apiContactRouter.post('/', authorizePermission('contact.create'), apiContactController.createContact);

/**
 * @swagger
 * /api/v1/contacts/search:
 *   get:
 *     summary: Search contacts with pagination
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: true
 *         description: Search keyword
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         required: false
 *         description: Page size (default 20, max 100)
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCount:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pageSize:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Contact'
 *       500:
 *         description: Server error
 */
apiContactRouter.get('/search', authorizePermission('contact.read'), apiContactController.searchContacts);

module.exports = apiContactRouter;
