// REST routes of the System module, mounted at /api/v1.
import express from 'express';
import systemApi from './system.api.js';
import componentApi from './component.api.js';
import { authenticateJWT, authorizePermissionJWT } from '../../middlewares/jwtAuth.middleware.js';

const router = express.Router();
router.use(['/systems', '/components'], authenticateJWT);

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
router.get('/systems', authorizePermissionJWT('system.read'), systemApi.getAll);

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
router.get('/systems/find', authorizePermissionJWT('system.read'), systemApi.find);

// Get system by id
router.get('/systems/:id', authorizePermissionJWT('system.read'), systemApi.getById);
// Create system
router.post('/systems', authorizePermissionJWT('system.create'), systemApi.create);
// Update system
router.put('/systems/:id', authorizePermissionJWT('system.update'), systemApi.update);
// Delete system
router.delete('/systems/:id', authorizePermissionJWT('system.delete'), systemApi.remove);

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
 *               - system_id
 *             properties:
 *               system_id:
 *                 type: integer
 *                 description: Parent system ID (required — a component must always belong to a system)
 *               name:
 *                 type: string
 *                 description: Component name (required, must be unique within the parent system)
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
 *       409:
 *         description: A component with this name already exists in the parent system
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
 *                 description: Parent system ID. Not required in the request (has-key partial update), but the component must always end up with a system — clearing it to empty is rejected.
 *               name:
 *                 type: string
 *                 description: Component name. If provided, must not be empty and must be unique within the parent system.
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
 *       409:
 *         description: A component with this name already exists in the parent system
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

router.get('/components', authorizePermissionJWT('system.read'), componentApi.getAll);

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
router.get('/components/find', authorizePermissionJWT('system.read'), componentApi.find);
router.get('/components/:id', authorizePermissionJWT('system.read'), componentApi.getById);
router.post('/components', authorizePermissionJWT('system.create'), componentApi.create);
router.put('/components/:id', authorizePermissionJWT('system.update'), componentApi.update);
router.delete('/components/:id', authorizePermissionJWT('system.delete'), componentApi.remove);

export default router;
