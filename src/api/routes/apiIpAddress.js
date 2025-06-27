// IP Address API routes
const express = require('express');
const apiIpAddressRouter = express.Router();
const apiIpAddressController = require('../controllers/apiIpAddressController');

/**
 * @swagger
 * tags:
 *   name: IPAddress
 *   description: API for managing IP addresses
 */

/**
 * @swagger
 * /api/ip-address:
 *   get:
 *     summary: List IP addresses (with filter, pagination)
 *     tags: [IPAddress]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by IP or description
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
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
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
 *         name: contacts
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         style: form
 *         explode: true
 *         description: Filter by contact IDs
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
 *         description: List of IP addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/IpAddress'
 *                 total:
 *                   type: integer
 */
apiIpAddressRouter.get('/', apiIpAddressController.listIpAddresses);

/**
 * @swagger
 * /api/ip-address/{id}:
 *   get:
 *     summary: Get a single IP address by ID
 *     tags: [IPAddress]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: IP address ID
 *     responses:
 *       200:
 *         description: IP address object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IpAddress'
 *       404:
 *         description: Not found
 */
apiIpAddressRouter.get('/:id', apiIpAddressController.getIpAddress);

/**
 * @swagger
 * /api/ip-address:
 *   post:
 *     summary: Create a new IP address
 *     tags: [IPAddress]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *             properties:
 *               address:
 *                 type: string
 *                 example: 192.168.1.10
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 description: Status value. Must be one of the allowed options from config/ipAddressOptions.js
 *                 enum:
 *                   - reserved
 *                   - assigned
 *                   - inactved
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (must select from list, all IDs must exist)
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of contact IDs (must select from list, all IDs must exist)
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of system IDs (must select from list, all IDs must exist)
 *     responses:
 *       201:
 *         description: Created IP address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IpAddress'
 *       400:
 *         description: Validation error
 */
apiIpAddressRouter.post('/', apiIpAddressController.createIpAddress);

/**
 * @swagger
 * /api/ip-address/{id}:
 *   put:
 *     summary: Update an IP address
 *     tags: [IPAddress]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: IP address ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 description: Status value. Must be one of the allowed options from config/ipAddressOptions.js
 *                 enum:
 *                   - reserved
 *                   - assigned
 *                   - inactved
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (must select from list, all IDs must exist)
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of contact IDs (must select from list, all IDs must exist)
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of system IDs (must select from list, all IDs must exist)
 *     responses:
 *       200:
 *         description: Updated IP address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IpAddress'
 *       404:
 *         description: Not found
 */
apiIpAddressRouter.put('/:id', apiIpAddressController.updateIpAddress);

/**
 * @swagger
 * /api/ip-address/{id}:
 *   delete:
 *     summary: Delete an IP address
 *     tags: [IPAddress]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: IP address ID
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
apiIpAddressRouter.delete('/:id', apiIpAddressController.deleteIpAddress);

// Swagger schema for IP address
/**
 * @swagger
 * components:
 *   schemas:
 *     IpAddress:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         ip_address:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *         updated_by:
 *           type: string
 *           readOnly: true
 *         updated_at:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *         tags:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *         contacts:
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
 */

module.exports = apiIpAddressRouter;
