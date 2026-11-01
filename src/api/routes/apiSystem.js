import express from 'express';
import apiSystemController from '../controllers/apiSystemController.js';
import { authorizePermissionJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();


/**
 * @swagger
 * tags:
 *   - name: System
 *     description: API for managing systems
 *
 * components:
 *   schemas:
 *     System:
 *       type: object
 *       required:
 *         - system_id
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique ID (auto-increment)
 *         system_id:
 *           type: string
 *           description: System code (unique)
 *         name:
 *           type: string
 *           description: System name
 *         alias:
 *           type: array
 *           items:
 *             type: string
 *           description: List of aliases
 *         description:
 *           type: string
 *           description: Description
 *         level:
 *           type: integer
 *           description: System level
 *         department_id:
 *           type: integer
 *           description: Development department (L3), unit ID
 *         ops_department_id:
 *           type: integer
 *           description: Operations department (L2), unit ID
 *         domains:
 *           type: array
 *           items:
 *             type: integer
 *           description: List of domain IDs
 *         contacts:
 *           type: array
 *           items:
 *             type: object
 *           description: List of contacts assigned to this system, as {id, name, email}. On POST/PUT, pass an array of contact IDs (or {id,...} objects — GET's shape round-trips directly).
 *         ip_addresses:
 *           type: array
 *           items:
 *             type: integer
 *           description: List of IP address IDs
 *         tags:
 *           type: array
 *           items:
 *             type: integer
 *           description: List of tag IDs
 *         fqdn:
 *           type: array
 *           items:
 *             type: string
 *           description: Access URLs of the system (shown as "Access URLs" in the UI), e.g. "https://app.example.com", "http://10.0.0.5:8080" or a bare host; an optional " [comment]" suffix is shown as a note
 *         scopes:
 *           type: array
 *           items:
 *             type: string
 *           description: Scope user access
 *         architecture:
 *           type: array
 *           items:
 *             type: string
 *           description: System architecture
 *         docs:
 *           type: array
 *           items:
 *             type: object
 *           description: List of attached documents
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last updated timestamp
 *         updated_by:
 *           type: string
 *           description: User who last updated
 *       example:
 *         id: 1
 *         system_id: "SYS001"
 *         name: "Main System"
 *         alias: ["Legacy", "Core"]
 *         description: "Main business system"
 *         level: 2
 *         department_id: 3
 *         ops_department_id: 4
 *         domains: [1, 2]
 *         contacts: [{ id: 5, name: "Jane Doe", email: "jane@example.com" }]
 *         ip_addresses: [101, 102]
 *         tags: [1, 2]
 *         fqdn: ["main.company.com", "api.company.com"]
 *         scopes: ["public-internet", "internal"]
 *         architecture: ["web", "api"]
 *         docs: [{ id: 1, name: "manual.pdf", url: "/uploads/manual.pdf" }]
 *         updated_at: "2024-01-15T10:30:00Z"
 *         updated_by: "admin"
 */

/**
 * @swagger
 * /api/v1/systems:
 *   get:
 *     summary: Get all systems (with optional search, pagination)
 *     tags: [System]
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
 *     responses:
 *       200:
 *         description: List of systems
 *   post:
 *     summary: Create a new system
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - system_id
 *               - name
 *             properties:
 *               system_id:
 *                 type: string
 *               name:
 *                 type: string
 *               alias:
 *                 type: array
 *                 items:
 *                   type: string
 *               description:
 *                 type: string
 *               level:
 *                 type: integer
 *               department_id:
 *                 type: integer
 *                 description: Development department (L3), unit ID
 *               ops_department_id:
 *                 type: integer
 *                 description: Operations department (L2), unit ID
 *               domains:
 *                 type: array
 *                 items:
 *                   type: integer
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of contact IDs (also accepts {id,...} objects, matching the shape GET returns)
 *               ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *               fqdn:
 *                 type: array
 *                 items:
 *                   type: string
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *               architecture:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: System created
 *       400:
 *         description: Validation error
 *       409:
 *         description: System ID or name already exists
 *
 * /api/v1/systems/{id}:
 *   get:
 *     summary: Get a system by ID
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: System ID
 *     responses:
 *       200:
 *         description: System object
 *       404:
 *         description: System not found
 *   put:
 *     summary: Update a system
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: System ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               system_id:
 *                 type: string
 *               name:
 *                 type: string
 *               alias:
 *                 type: array
 *                 items:
 *                   type: string
 *               description:
 *                 type: string
 *               level:
 *                 type: integer
 *               department_id:
 *                 type: integer
 *                 description: Development department (L3), unit ID
 *               ops_department_id:
 *                 type: integer
 *                 description: Operations department (L2), unit ID
 *               domains:
 *                 type: array
 *                 items:
 *                   type: integer
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of contact IDs (also accepts {id,...} objects, matching the shape GET returns)
 *               ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *               fqdn:
 *                 type: array
 *                 items:
 *                   type: string
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *               architecture:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: System updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: System not found
 *       409:
 *         description: System ID or name already exists
 *   delete:
 *     summary: Delete a system
 *     description: Fails if the system still has components — remove them first.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: System ID
 *     responses:
 *       204:
 *         description: System deleted
 *       404:
 *         description: System not found
 *       409:
 *         description: System still has components — remove them before deleting the system
 */

// List all systems
router.get('/', authorizePermissionJWT('system.read'), apiSystemController.getAll);

/**
 * @swagger
 * /api/v1/systems/find:
 *   get:
 *     summary: Find systems by exact name match
 *     description: Search systems by exact name matching. Requires a search term.
 *     tags: [System]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: System name to search for (exact match)
 *     responses:
 *       200:
 *         description: Systems retrieved successfully
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
 *                     $ref: '#/components/schemas/System'
 *                 count:
 *                   type: integer
 *                   description: Number of systems returned
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
router.get('/find', authorizePermissionJWT('system.read'), apiSystemController.findSystems);

// Get system by id
router.get('/:id', authorizePermissionJWT('system.read'), apiSystemController.getById);
// Create system
router.post('/', authorizePermissionJWT('system.create'), apiSystemController.create);
// Update system
router.put('/:id', authorizePermissionJWT('system.update'), apiSystemController.update);
// Delete system
router.delete('/:id', authorizePermissionJWT('system.delete'), apiSystemController.remove);

export default router;
