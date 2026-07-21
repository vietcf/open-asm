import express from 'express';
import apiServerController from '../controllers/apiServerController.js';
import { authorizePermissionJWT } from '../middlewares/auth.middleware.js';
const apiServerRouter = express.Router();

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
 *           Filter by status. Values are dynamically loaded from database config table 
 *           with config_name = 'server_status'. Example values: ONLINE, OFFLINE, MAINTENANCE.
 *           Must select from the configured list in the system.
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: |
 *           Filter by type. Values are dynamically loaded from database config table 
 *           with config_name = 'server_type'. Example values: PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE.
 *           Must select from the configured list in the system.
 *       - in: query
 *         name: server_role
 *         schema:
 *           type: string
 *         description: |
 *           Filter by server role (free-text, partial match). Not a fixed enum —
 *           existing values can be discovered via GET /api/v1/servers/config
 *           (server_roles), but any string may also be entered. Example values:
 *           Web Server, Database Server.
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: |
 *           Filter by location. Values are dynamically loaded from database config table
 *           with config_name = 'server_location'. Example values: DC, DR, CMC, BRANCH, CLOUD.
 *           Must select from the configured list in the system.
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
apiServerRouter.get('/', authorizePermissionJWT('server.read'), apiServerController.listServers);

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
apiServerRouter.get('/find', authorizePermissionJWT('server.read'), apiServerController.findServers);

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
 *                     server_roles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *                       description: Distinct server_role values currently in use (free-text, not a fixed enum).
 *                       example: [{"value": "Web Server", "label": "Web Server"}, {"value": "Database Server", "label": "Database Server"}]
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
apiServerRouter.get('/config', authorizePermissionJWT('server.read'), apiServerController.getConfig);

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
 *                   Server status. Values are dynamically loaded from database config table 
 *                   with config_name = 'server_status'. Example values: ONLINE, OFFLINE, MAINTENANCE.
 *                   Must select from the configured list in the system.
 *               location:
 *                 type: string
 *                 description: |
 *                   Server location. Values are dynamically loaded from database config table 
 *                   with config_name = 'server_location'. Example values: DC, DR, CMC, BRANCH, CLOUD.
 *                   Must select from the configured list in the system.
 *               type:
 *                 type: string
 *                 description: |
 *                   Server type. Values are dynamically loaded from database config table
 *                   with config_name = 'server_type'. Example values: PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE.
 *                   Must select from the configured list in the system.
 *               server_role:
 *                 type: string
 *                 description: |
 *                   Server role (free-text, not a fixed enum). Existing values can be
 *                   discovered via GET /api/v1/servers/config (server_roles), but any
 *                   string may be used. Example values: Web Server, Database Server.
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
 *                 description: List of IP address IDs (at least one required)
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
apiServerRouter.post('/', authorizePermissionJWT('server.create'), apiServerController.createServer);

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
apiServerRouter.get('/:id', authorizePermissionJWT('server.read'), apiServerController.getServer);

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
 *                   Server status. Values are dynamically loaded from database config table 
 *                   with config_name = 'server_status'. Example values: ONLINE, OFFLINE, MAINTENANCE.
 *                   Must select from the configured list in the system.
 *               location:
 *                 type: string
 *                 description: |
 *                   Server location. Values are dynamically loaded from database config table 
 *                   with config_name = 'server_location'. Example values: DC, DR, CMC, BRANCH, CLOUD.
 *                   Must select from the configured list in the system.
 *               type:
 *                 type: string
 *                 description: |
 *                   Server type. Values are dynamically loaded from database config table
 *                   with config_name = 'server_type'. Example values: PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE.
 *                   Must select from the configured list in the system.
 *               server_role:
 *                 type: string
 *                 description: |
 *                   Server role (free-text, not a fixed enum). Existing values can be
 *                   discovered via GET /api/v1/servers/config (server_roles), but any
 *                   string may be used. Example values: Web Server, Database Server.
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
 *                 description: List of IP address IDs. If provided, must be non-empty — a server must always have at least one IP address.
 *               description:
 *                 type: string
 *                 description: Server description
 *           example:
 *             name: "Example Server"
 *             os: 1
 *             status: "ONLINE"
 *             location: "DC"
 *             type: "PHYSICAL"
 *             server_role: "Web Server"
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
apiServerRouter.put('/:id', authorizePermissionJWT('server.update'), apiServerController.updateServer);

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
apiServerRouter.delete('/:id', authorizePermissionJWT('server.delete'), apiServerController.deleteServer);


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
 *             Server status. Values are dynamically loaded from database config table 
 *             with config_name = 'server_status'. Example values: ONLINE, OFFLINE, MAINTENANCE.
 *             Must select from the configured list in the system.
 *         location:
 *           type: string
 *           description: |
 *             Server location. Values are dynamically loaded from database config table 
 *             with config_name = 'server_location'. Example values: DC, DR, CMC, BRANCH, CLOUD.
 *             Must select from the configured list in the system.
 *         type:
 *           type: string
 *           description: |
 *             Server type. Values are dynamically loaded from database config table 
 *             with config_name = 'server_type'. Example values: PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE.
 *             Must select from the configured list in the system.
 *         server_role:
 *           type: string
 *           description: Server role (free-text, not a fixed enum). Example values: Web Server, Database Server.
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
 *             Server status. Values are dynamically loaded from database config table 
 *             with config_name = 'server_status'. Example values: ONLINE, OFFLINE, MAINTENANCE.
 *             Must select from the configured list in the system.
 *         location:
 *           type: string
 *           description: |
 *             Server location. Values are dynamically loaded from database config table 
 *             with config_name = 'server_location'. Example values: DC, DR, CMC, BRANCH, CLOUD.
 *             Must select from the configured list in the system.
 *         type:
 *           type: string
 *           description: |
 *             Server type. Values are dynamically loaded from database config table 
 *             with config_name = 'server_type'. Example values: PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE.
 *             Must select from the configured list in the system.
 *         server_role:
 *           type: string
 *           description: Server role (free-text, not a fixed enum). Example values: Web Server, Database Server.
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

export default apiServerRouter;