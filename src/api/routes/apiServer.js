import express from 'express';
import apiServerController from '../controllers/apiServerController.js';
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
 *           enum: [ONLINE, OFFLINE, MAINTENANCE]
 *         description: Filter by status (ONLINE, OFFLINE, MAINTENANCE)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE]
 *         description: Filter by type (PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE)
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *           enum: [DC, DR, CMC, BRANCH, CLOUD]
 *         description: Filter by location (DC, DR, CMC, BRANCH, CLOUD)
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
apiServerRouter.get('/', apiServerController.listServers);

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
apiServerRouter.get('/find', apiServerController.findServers);

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
 *             properties:
 *               name:
 *                 type: string
 *               os:
 *                 type: integer
 *                 description: Platform (OS) ID
 *               status:
 *                 type: string
 *                 enum: [ONLINE, OFFLINE, MAINTENANCE]
 *                 description: Server status (ONLINE, OFFLINE, MAINTENANCE)
 *               location:
 *                 type: string
 *                 enum: [DC, DR, CMC, BRANCH, CLOUD]
 *                 description: Server location (DC, DR, CMC, BRANCH, CLOUD)
 *               type:
 *                 type: string
 *                 enum: [PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE]
 *                 description: Server type (PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE)
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
 *         description: Created server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *       400:
 *         description: Validation error
 */
apiServerRouter.post('/', apiServerController.createServer);

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
apiServerRouter.get('/:id', apiServerController.getServer);

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
 *                 enum: [ONLINE, OFFLINE, MAINTENANCE]
 *                 description: Server status
 *               location:
 *                 type: string
 *                 enum: [DC, DR, CMC, BRANCH, CLOUD]
 *                 description: Server location
 *               type:
 *                 type: string
 *                 enum: [PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE]
 *                 description: Server type
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
 *                 description: List of IP address IDs
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
 */
apiServerRouter.put('/:id', apiServerController.updateServer);

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
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
apiServerRouter.delete('/:id', apiServerController.deleteServer);


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
 *           enum: [ONLINE, OFFLINE, MAINTENANCE]
 *         location:
 *           type: string
 *           enum: [DC, DR, CMC, BRANCH, CLOUD]
 *         type:
 *           type: string
 *           enum: [PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE]
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
 *           enum: [ONLINE, OFFLINE, MAINTENANCE]
 *         location:
 *           type: string
 *           enum: [DC, DR, CMC, BRANCH, CLOUD]
 *         type:
 *           type: string
 *           enum: [PHYSICAL, VIRTUAL-MACHINE, CLOUD-INSTANCE]
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