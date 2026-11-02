// REST routes of the server module, mounted at /api/v1.
import express from 'express';
import serverApi from './server.api.js';
import serviceApi from './service.api.js';
import agentApi from './agent.api.js';
import { authenticateJWT, authorizePermissionJWT } from '../../middlewares/jwtAuth.middleware.js';

const router = express.Router();
router.use(['/servers', '/services', '/agents'], authenticateJWT);
/**
 * @swagger
 * tags:
 *   name: Server
 *   description: API for managing servers
 */

/**
 * @swagger
 * /api/v1/servers:
 *   get:
 *     summary: List servers (with filter, pagination)
 *     tags: [Server]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by server name, IP, etc.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: |
 *           Filter by status. Values of the System Configuration list `server_status` (e.g. ONLINE, OFFLINE, MAINTENANCE),
 *           retired (inactive) values included.
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: |
 *           Filter by type. Values of the System Configuration list `server_type` (e.g. PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE),
 *           retired (inactive) values included.
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: |
 *           Filter by location. Values of the System Configuration list `server_location` (e.g. DC, DR, CMC, BRANCH, CLOUD),
 *           retired (inactive) values included.
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         style: form
 *         explode: true
 *         description: Filter by tag IDs
 *       - in: query
 *         name: ip
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         style: form
 *         explode: true
 *         description: Filter by IP address IDs
 *       - in: query
 *         name: manager
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         style: form
 *         explode: true
 *         description: Filter by manager (contact) IDs
 *       - in: query
 *         name: systems
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         style: form
 *         explode: true
 *         description: Filter by system IDs
 *       - in: query
 *         name: services
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         style: form
 *         explode: true
 *         description: Filter by service IDs
 *       - in: query
 *         name: os
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         style: form
 *         explode: true
 *         description: Filter by platform (OS) IDs
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "Page number (default: 1)"
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: "Page size (default: 10)"
 *     responses:
 *       200:
 *         description: List of servers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Server'
 *                 total:
 *                   type: integer
 */
router.get('/servers', authorizePermissionJWT('server.read'), serverApi.listServers);

/**
 * @swagger
 * /api/v1/servers/find:
 *   get:
 *     summary: Find servers by specific field values (exact match)
 *     tags: [Server]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Find server by name
 *       - in: query
 *         name: ip_address
 *         schema:
 *           type: string
 *         description: Find servers by IP address (e.g. 192.168.1.1)
 *     responses:
 *       200:
 *         description: List of matching servers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ServerDetails'
 *                 total:
 *                   type: integer
 *       400:
 *         description: No search criteria provided
 *       404:
 *         description: No servers found
 */
router.get('/servers/find', authorizePermissionJWT('server.read'), serverApi.findServers);

/**
 * @swagger
 * /api/v1/servers/config:
 *   get:
 *     summary: Get configuration values for enum fields
 *     description: |
 *       Retrieve current configuration values for enum fields used in server management.
 *       This endpoint returns the dynamic enum values loaded from the database configuration table.
 *     tags: [Server]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration values retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *                       example: [{"value": "ONLINE", "label": "Online"}, {"value": "OFFLINE", "label": "Offline"}]
 *                     type:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *                       example: [{"value": "PHYSICAL", "label": "Physical"}, {"value": "VIRTUAL-MACHINE", "label": "Virtual Machine"}]
 *                     location:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *                       example: [{"value": "DC", "label": "Data Center"}, {"value": "DR", "label": "Disaster Recovery"}]
 *       500:
 *         description: Server error
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
 *                   example: "Internal server error"
 *                 error:
 *                   type: string
 *                   example: "Failed to load configuration"
 */
router.get('/servers/config', authorizePermissionJWT('server.read'), serverApi.getConfig);

/**
 * @swagger
 * /api/v1/servers:
 *   post:
 *     summary: Create a new server
 *     tags: [Server]
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
 *               - ip_addresses
 *             properties:
 *               name:
 *                 type: string
 *                 description: Server name (required, must be unique)
 *               os:
 *                 type: integer
 *                 description: Platform (OS) ID
 *               status:
 *                 type: string
 *                 description: |
 *                   Server status. Value of the System Configuration list `server_status` (e.g. ONLINE, OFFLINE, MAINTENANCE).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               location:
 *                 type: string
 *                 description: |
 *                   Server location. Value of the System Configuration list `server_location` (e.g. DC, DR, CMC, BRANCH, CLOUD).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               type:
 *                 type: string
 *                 description: |
 *                   Server type. Value of the System Configuration list `server_type` (e.g. PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               managers:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of manager (contact) IDs
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of system IDs
 *               agents:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of agent IDs
 *               services:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of service IDs
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs
 *               ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of IP address IDs (at least one required). Each ID must exist and not already be the 'normal' (exclusive) IP of another server. VIP (shared) IP links can only be added afterwards, via PUT.
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created server with full details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerDetails'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     - "Server name is required"
 *                     - "Cannot use already assigned IP addresses: IP 10.1.1.4 (ID: 5)"
 *                     - "At least one IP address is required"
 *                     - "Invalid platform (os) ID: 999"
 *       409:
 *         description: Server name already exists
 */
router.post('/servers', authorizePermissionJWT('server.create'), serverApi.createServer);

/**
 * @swagger
 * /api/v1/servers/{id}:
 *   get:
 *     summary: Get a single server by ID
 *     tags: [Server]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Server ID
 *     responses:
 *       200:
 *         description: Server object with full details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerDetails'
 *       404:
 *         description: Not found
 */
router.get('/servers/:id', authorizePermissionJWT('server.read'), serverApi.getServer);

/**
 * @swagger
 * /api/v1/servers/{id}:
 *   put:
 *     summary: Update a server
 *     tags: [Server]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Server ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Server name
 *               os:
 *                 type: integer
 *                 description: Platform (OS) ID
 *               status:
 *                 type: string
 *                 description: |
 *                   Server status. Value of the System Configuration list `server_status` (e.g. ONLINE, OFFLINE, MAINTENANCE).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               location:
 *                 type: string
 *                 description: |
 *                   Server location. Value of the System Configuration list `server_location` (e.g. DC, DR, CMC, BRANCH, CLOUD).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               type:
 *                 type: string
 *                 description: |
 *                   Server type. Value of the System Configuration list `server_type` (e.g. PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               managers:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of manager (contact) IDs
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of system IDs
 *               agents:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of agent IDs
 *               services:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of service IDs
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs
 *               ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of IP address IDs. If provided, must be non-empty — a server must always have at least one IP address. Fully replaces the server's 'normal' (exclusive) IPs; its VIP links are untouched.
 *               vip_ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Optional list of IP address IDs to link as VIP (shared) IPs — MAY already belong to another device/server. If provided (even as []), fully replaces the server's VIP links. An ID cannot appear in both ip_addresses and vip_ip_addresses.
 *               description:
 *                 type: string
 *                 description: Server description
 *           example:
 *             name: "Example Server"
 *             os: 1
 *             status: "ONLINE"
 *             location: "DC"
 *             type: "PHYSICAL"
 *             managers: [101, 102]
 *             systems: [201]
 *             agents: [301]
 *             services: [401, 402]
 *             tags: [501]
 *             ip_addresses: [601]
 *             description: "This is an example update payload."
 *     responses:
 *       200:
 *         description: Updated server with full details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerDetails'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       409:
 *         description: Server name already exists
 */
router.put('/servers/:id', authorizePermissionJWT('server.update'), serverApi.updateServer);

/**
 * @swagger
 * /api/v1/servers/{id}:
 *   delete:
 *     summary: Delete a server
 *     tags: [Server]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Server ID
 *       - in: query
 *         name: delete_ip
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, permanently delete the server's IP addresses. Default false releases them (status set to 'reserved').
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
router.delete('/servers/:id', authorizePermissionJWT('server.delete'), serverApi.deleteServer);

/**
 * @swagger
 * components:
 *   schemas:
 *     Server:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         os:
 *           type: integer
 *         status:
 *           type: string
 *           description: |
 *             Server status. Value of the System Configuration list `server_status` (e.g. ONLINE, OFFLINE, MAINTENANCE).
 *             Only active values can be set; a retired value is refused, except the
 *             record's current one, which an update may send back unchanged.
 *         location:
 *           type: string
 *           description: |
 *             Server location. Value of the System Configuration list `server_location` (e.g. DC, DR, CMC, BRANCH, CLOUD).
 *             Only active values can be set; a retired value is refused, except the
 *             record's current one, which an update may send back unchanged.
 *         type:
 *           type: string
 *           description: |
 *             Server type. Value of the System Configuration list `server_type` (e.g. PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE).
 *             Only active values can be set; a retired value is refused, except the
 *             record's current one, which an update may send back unchanged.
 *         managers:
 *           type: array
 *           items:
 *             type: integer
 *         systems:
 *           type: array
 *           items:
 *             type: integer
 *         agents:
 *           type: array
 *           items:
 *             type: integer
 *         services:
 *           type: array
 *           items:
 *             type: integer
 *         tags:
 *           type: array
 *           items:
 *             type: integer
 *         ip_addresses:
 *           type: array
 *           items:
 *             type: integer
 *         description:
 *           type: string
 *     ServerDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         status:
 *           type: string
 *           description: |
 *             Server status. Value of the System Configuration list `server_status` (e.g. ONLINE, OFFLINE, MAINTENANCE).
 *             Only active values can be set; a retired value is refused, except the
 *             record's current one, which an update may send back unchanged.
 *         location:
 *           type: string
 *           description: |
 *             Server location. Value of the System Configuration list `server_location` (e.g. DC, DR, CMC, BRANCH, CLOUD).
 *             Only active values can be set; a retired value is refused, except the
 *             record's current one, which an update may send back unchanged.
 *         type:
 *           type: string
 *           description: |
 *             Server type. Value of the System Configuration list `server_type` (e.g. PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE).
 *             Only active values can be set; a retired value is refused, except the
 *             record's current one, which an update may send back unchanged.
 *         description:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         updated_by:
 *           type: string
 *         os:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             description:
 *               type: string
 *         ip_addresses:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               ip_address:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [normal, vip]
 *                 description: normal = this server's own (exclusive) IP; vip = an IP shared with another device/server.
 *         managers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *         systems:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               system_id:
 *                 type: string
 *               description:
 *                 type: string
 *         services:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *         agents:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               version:
 *                 type: string
 *               description:
 *                 type: string
 *         tags:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *           description: Service ID
 *         name:
 *           type: string
 *           example: "Web Server"
 *           description: Service name (unique)
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Main web server service"
 *           description: Service description
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Service creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Service last update timestamp
 */

/**
 * @swagger
 * /api/v1/services:
 *   get:
 *     tags:
 *       - Services
 *     summary: List all services
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Service'
 *                 total:
 *                   type: integer
 */
router.get('/services', authorizePermissionJWT('service.read'), serviceApi.list);

/**
 * @swagger
 * /api/v1/services/find:
 *   get:
 *     tags:
 *       - Services
 *     summary: Find services by exact name match
 *     description: Search services by exact name matching. Requires a search term.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Service name to search for (exact match)
 *     responses:
 *       200:
 *         description: Services found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Service'
 *                 count:
 *                   type: integer
 *                   description: Number of services found
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
 *                   example: "Search term \"name\" is required"
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
 *                   example: "Internal server error"
 */
router.get('/services/find', authorizePermissionJWT('service.read'), serviceApi.find);

/**
 * @swagger
 * /api/v1/services:
 *   post:
 *     tags:
 *       - Services
 *     summary: Create a new service
 *     description: Creates a new service with the provided information. Service name must be unique.
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
 *               name:
 *                 type: string
 *                 description: Service name (required, must be unique)
 *                 example: "Web Server"
 *               description:
 *                 type: string
 *                 description: Service description (optional)
 *                 example: "Main web server service"
 *     responses:
 *       201:
 *         description: Service created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Validation error (missing name or name already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service name is required"
 *       500:
 *         description: Internal server error
 */
router.post('/services', authorizePermissionJWT('service.create'), serviceApi.create);

/**
 * @swagger
 * /api/v1/services/{id}:
 *   get:
 *     tags:
 *       - Services
 *     summary: Get service by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Service details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Service not found
 */
router.get('/services/:id', authorizePermissionJWT('service.read'), serviceApi.get);

/**
 * @swagger
 * /api/v1/services/{id}:
 *   put:
 *     tags:
 *       - Services
 *     summary: Update service by ID (partial update)
 *     description: Updates a service by its ID. Only provided fields will be updated, others remain unchanged. Name must be unique if provided.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Service name (optional for update, must be unique if provided)
 *                 example: "Updated Web Server"
 *               description:
 *                 type: string
 *                 description: Service description (optional for update)
 *                 example: "Updated description"
 *             example:
 *               name: "Updated Service Name"
 *               description: "Updated service description"
 *     responses:
 *       200:
 *         description: Service updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Validation error (empty name or name already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service name already exists"
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service not found"
 *       500:
 *         description: Internal server error
 */
router.put('/services/:id', authorizePermissionJWT('service.update'), serviceApi.update);

/**
 * @swagger
 * /api/v1/services/{id}:
 *   delete:
 *     tags:
 *       - Services
 *     summary: Delete service by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Service deleted successfully
 *       404:
 *         description: Service not found
 *       409:
 *         description: Cannot delete — the service is still assigned to one or more servers
 */
router.delete('/services/:id', authorizePermissionJWT('service.delete'), serviceApi.remove);

/**
 * @swagger
 * components:
 *   schemas:
 *     Agent:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *           description: Agent ID
 *         name:
 *           type: string
 *           example: "Apache HTTP Server"
 *           description: Agent name (unique)
 *         version:
 *           type: string
 *           nullable: true
 *           example: "2.4.51"
 *           description: Agent version
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Web server software"
 *           description: Agent description
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Agent creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Agent last update timestamp
 */

/**
 * @swagger
 * /api/v1/agents:
 *   get:
 *     tags:
 *       - Agents
 *     summary: List all agents
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *                 count:
 *                   type: integer
 *                   example: 5
 */
router.get('/agents', authorizePermissionJWT('agent.read'), agentApi.list);

/**
 * @swagger
 * /api/v1/agents:
 *   post:
 *     tags:
 *       - Agents
 *     summary: Create a new agent
 *     description: Creates a new agent with the provided information. Agent name must be unique.
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
 *               name:
 *                 type: string
 *                 description: Agent name (required, must be unique)
 *                 example: "Apache HTTP Server"
 *               version:
 *                 type: string
 *                 description: Agent version (optional)
 *                 example: "2.4.51"
 *               description:
 *                 type: string
 *                 description: Agent description (optional)
 *                 example: "Web server software"
 *     responses:
 *       201:
 *         description: Agent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Validation error (missing name or name already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Agent name is required"
 *       500:
 *         description: Internal server error
 */
router.post('/agents', authorizePermissionJWT('agent.create'), agentApi.create);

/**
 * @swagger
 * /api/v1/agents/find:
 *   get:
 *     summary: Find agents by exact name match
 *     description: Search agents by exact name matching. Requires a search term.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent name to search for (exact match)
 *     responses:
 *       200:
 *         description: Agents retrieved successfully
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
 *                     $ref: '#/components/schemas/Agent'
 *                 count:
 *                   type: integer
 *                   description: Number of agents returned
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
router.get('/agents/find', authorizePermissionJWT('agent.read'), agentApi.find);

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   get:
 *     tags:
 *       - Agents
 *     summary: Get agent by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       404:
 *         description: Agent not found
 */
router.get('/agents/:id', authorizePermissionJWT('agent.read'), agentApi.get);

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   put:
 *     tags:
 *       - Agents
 *     summary: Update agent by ID (partial update)
 *     description: Updates an agent by its ID. Only provided fields will be updated, others remain unchanged. Name must be unique if provided.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agent ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Agent name (optional for update, must be unique if provided)
 *                 example: "Updated Apache HTTP Server"
 *               version:
 *                 type: string
 *                 description: Agent version (optional for update)
 *                 example: "2.4.52"
 *               description:
 *                 type: string
 *                 description: Agent description (optional for update)
 *                 example: "Updated web server software"
 *             example:
 *               name: "Updated Agent Name"
 *               version: "1.2.0"
 *               description: "Updated agent description"
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Validation error (empty name or name already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Agent name already exists"
 *       404:
 *         description: Agent not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Agent not found"
 *       500:
 *         description: Internal server error
 */
router.put('/agents/:id', authorizePermissionJWT('agent.update'), agentApi.update);

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   delete:
 *     tags:
 *       - Agents
 *     summary: Delete agent by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Agent deleted successfully
 *       404:
 *         description: Agent not found
 *       409:
 *         description: Cannot delete — the agent is still assigned to one or more servers
 */
router.delete('/agents/:id', authorizePermissionJWT('agent.delete'), agentApi.remove);

export default router;
