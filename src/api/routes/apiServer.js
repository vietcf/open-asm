// Server API routes
const express = require('express');
const apiServerRouter = express.Router();
const apiServerController = require('../controllers/apiServerController');

/**
 * @swagger
 * tags:
 *   name: Server
 *   description: API for managing servers
 */

/**
 * @swagger
 * /api/servers:
 *   get:
 *     summary: List servers (with filter, pagination)
 *     tags: [Server]
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
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Page size
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
 * /api/servers:
 *   post:
 *     summary: Create a new server
 *     tags: [Server]
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
 * /api/servers/{id}:
 *   get:
 *     summary: Get a single server by ID
 *     tags: [Server]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Server ID
 *     responses:
 *       200:
 *         description: Server object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Server'
 *       404:
 *         description: Not found
 */
apiServerRouter.get('/:id', apiServerController.getServer);

/**
 * @swagger
 * /api/servers/{id}:
 *   put:
 *     summary: Update a server
 *     tags: [Server]
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
 *             required:
 *               - name
 *               - ip_addresses
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
 *       200:
 *         description: Updated server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
apiServerRouter.put('/:id', apiServerController.updateServer);

/**
 * @swagger
 * /api/servers/{id}:
 *   delete:
 *     summary: Delete a server
 *     tags: [Server]
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

module.exports = apiServerRouter;