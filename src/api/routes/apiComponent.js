import express from 'express';
import apiComponentController from '../controllers/apiComponentController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Component
 *     description: API for managing system components
 *
 * components:
 *   schemas:
 *     Component:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique ID (auto-increment)
 *         system_id:
 *           type: integer
 *           description: Parent system ID
 *         name:
 *           type: string
 *           description: Component name
 *         app_type:
 *           type: string
 *           description: App type
 *         description:
 *           type: string
 *           description: Description
 *         fqdn:
 *           type: array
 *           items:
 *             type: string
 *           description: List of FQDNs
 *         contacts:
 *           type: array
 *           items:
 *             type: integer
 *           description: List of contact IDs
 *         ips:
 *           type: array
 *           items:
 *             type: integer
 *           description: List of IP address IDs
 *         tags:
 *           type: array
 *           items:
 *             type: integer
 *           description: List of tag IDs
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last updated timestamp
 *         updated_by:
 *           type: string
 *           description: User who last updated
 *       example:
 *         id: 1
 *         system_id: 2
 *         name: "Web Frontend"
 *         app_type: "web"
 *         description: "Main web UI component"
 *         fqdn: ["frontend.example.com"]
 *         contacts: [5, 7]
 *         ips: [101, 102]
 *         tags: [1, 2]
 *         updated_at: "2024-01-15T10:30:00Z"
 *         updated_by: "admin"
 */

/**
 * @swagger
 * /api/v1/components:
 *   get:
 *     summary: Get all components (with optional search, pagination)
 *     tags: [Component]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search keyword
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Page size
 *       - in: query
 *         name: system_id
 *         schema:
 *           type: integer
 *         description: Filter by parent system ID
 *     responses:
 *       200:
 *         description: List of components
 *   post:
 *     summary: Create a new component
 *     tags: [Component]
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
 *             properties:
 *               system_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               app_type:
 *                 type: string
 *               description:
 *                 type: string
 *               fqdn:
 *                 type: array
 *                 items:
 *                   type: string
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *               ips:
 *                 type: array
 *                 items:
 *                   type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Component created
 *       400:
 *         description: Validation error
 *
 * /api/v1/components/{id}:
 *   get:
 *     summary: Get a component by ID
 *     tags: [Component]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Component ID
 *     responses:
 *       200:
 *         description: Component object
 *       404:
 *         description: Component not found
 *   put:
 *     summary: Update a component
 *     tags: [Component]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Component ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               system_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               app_type:
 *                 type: string
 *               description:
 *                 type: string
 *               fqdn:
 *                 type: array
 *                 items:
 *                   type: string
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *               ips:
 *                 type: array
 *                 items:
 *                   type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Component updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Component not found
 *   delete:
 *     summary: Delete a component
 *     tags: [Component]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Component ID
 *     responses:
 *       204:
 *         description: Component deleted
 *       404:
 *         description: Component not found
 */

router.get('/', apiComponentController.getAll);

/**
 * @swagger
 * /api/v1/components/find:
 *   get:
 *     summary: Find components by exact name match
 *     description: Search components by exact name matching. Requires a search term.
 *     tags: [Component]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Component name to search for (exact match)
 *     responses:
 *       200:
 *         description: Components retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates if the request was successful
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Component'
 *                 count:
 *                   type: integer
 *                   description: Number of components returned
 *       400:
 *         description: Search term "name" is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   description: Error message
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   description: Error message
 *                 error:
 *                   type: string
 *                   description: Detailed error information
 */
router.get('/find', apiComponentController.findComponents);
router.get('/:id', apiComponentController.getById);
router.post('/', apiComponentController.create);
router.put('/:id', apiComponentController.update);
router.delete('/:id', apiComponentController.remove);

export default router;
