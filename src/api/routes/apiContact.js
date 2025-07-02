// Contact API routes
const express = require('express');
const apiContactRouter = express.Router();
const apiContactController = require('../controllers/apiContactController');
const { authorizePermissionJWT } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   - name: Contact
 *     description: Contact management
 */

/**
 * @swagger
 * /api/v1/contacts/search:
 *   get:
 *     summary: Search contacts with pagination
 *     description: Search contacts by name, email, phone, position, or unit_name (case-insensitive partial matching)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: true
 *         description: Search keyword (searches in name, email, phone, position, unit_name fields)
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
// Search contacts by: name, email, phone, position, unit_name (case-insensitive)
apiContactRouter.get('/search', authorizePermissionJWT('contact.read'), apiContactController.searchContacts);

/**
 * @swagger
 * /api/v1/contacts/{id}:
 *   get:
 *     summary: Get a contact by ID
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Contact ID
 *     responses:
 *       200:
 *         description: Contact detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 unit_id:
 *                   type: integer
 *                 unit_name:
 *                   type: string
 *                 position:
 *                   type: string
 *                 description:
 *                   type: string
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Server error
 */
apiContactRouter.get('/:id', authorizePermissionJWT('contact.read'), apiContactController.getContactById);

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
 *               description:
 *                 type: string
 *                 description: Additional description for the contact
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
apiContactRouter.post('/', authorizePermissionJWT('contact.create'), apiContactController.createContact);

/**
 * @swagger
 * /api/v1/contacts/{id}:
 *   put:
 *     summary: Update a contact
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Contact ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *               description:
 *                 type: string
 *                 description: Additional description for the contact
 *     responses:
 *       200:
 *         description: Contact updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Contact not found
 *       409:
 *         description: Contact already exists with this email
 *       500:
 *         description: Server error
 */
apiContactRouter.put('/:id', authorizePermissionJWT('contact.update'), apiContactController.updateContact);

/**
 * @swagger
 * /api/v1/contacts/{id}:
 *   delete:
 *     summary: Delete a contact
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Contact ID
 *     responses:
 *       204:
 *         description: Contact deleted
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Server error
 */
apiContactRouter.delete('/:id', authorizePermissionJWT('contact.delete'), apiContactController.deleteContact);

module.exports = apiContactRouter;
