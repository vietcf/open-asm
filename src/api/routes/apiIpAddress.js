
// IP Address API routes (ES6)
import express from 'express';
import apiIpAddressController from '../controllers/apiIpAddressController.js';
import { authorizePermissionJWT } from '../middlewares/auth.middleware.js';
const apiIpAddressRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: IPAddress
 *   description: API for managing IP addresses
 */

/**
 * @swagger
 * /api/v1/ip-addresses:
 *   get:
 *     summary: List IP addresses (with filter, pagination)
 *     tags: [IPAddress]
 *     security:
 *       - bearerAuth: []
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
 *           description: |
 *             IP address status. Values are dynamically loaded from database config table 
 *             with config_name = 'ip_address_status'. Example values: reserved, assigned, inactived.
 *             Must select from the configured list in the system.
 *         description: "Filter by status (reserved, assigned, inactved)"
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
apiIpAddressRouter.get('/', authorizePermissionJWT('ip_address.read'), apiIpAddressController.listIpAddresses);

/**
 * @swagger
 * /api/v1/ip-addresses/find:
 *   get:
 *     summary: Find IP address by address string (exact match)
 *     tags: [IPAddress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         required: true
 *         description: IP address to search (exact match)
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
apiIpAddressRouter.get('/find', authorizePermissionJWT('ip_address.read'), apiIpAddressController.findIpAddressByAddress);

/**
 * @swagger
 * /api/v1/ip-addresses/config:
 *   get:
 *     summary: Get configuration values for enum fields
 *     description: |
 *       Retrieve current configuration values for enum fields used in IP address management.
 *       This endpoint returns the dynamic enum values loaded from the database configuration table.
 *     tags: [IPAddress]
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
 *                       example: [{"value": "reserved", "label": "Reserved"}, {"value": "assigned", "label": "Assigned"}, {"value": "inactived", "label": "Inactived"}]
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
apiIpAddressRouter.get('/config', authorizePermissionJWT('ip_address.read'), apiIpAddressController.getConfig);

/**
 * @swagger
 * /api/v1/ip-addresses/{id}:
 *   get:
 *     summary: Get a single IP address by ID
 *     tags: [IPAddress]
 *     security:
 *       - bearerAuth: []
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

apiIpAddressRouter.get('/:id', authorizePermissionJWT('ip_address.read'), apiIpAddressController.getIpAddress);

/**
 * @swagger
 * /api/v1/ip-addresses:
 *   post:
 *     summary: Create a new IP address
 *     tags: [IPAddress]
 *     security:
 *       - bearerAuth: []
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
 *                 description: |
 *                   IP address status. Values are dynamically loaded from database config table 
 *                   with config_name = 'ip_address_status'. Example values: reserved, assigned, inactived.
 *                   Must select from the configured list in the system.
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
 *       409:
 *         description: IP address already exists
 */
apiIpAddressRouter.post('/', authorizePermissionJWT('ip_address.create'), apiIpAddressController.createIpAddress);

/**
 * @swagger
 * /api/v1/ip-addresses/{id}:
 *   put:
 *     summary: Update an IP address
 *     tags: [IPAddress]
 *     security:
 *       - bearerAuth: []
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
 *                 description: |
 *                   IP address status. Values are dynamically loaded from database config table 
 *                   with config_name = 'ip_address_status'. Example values: reserved, assigned, inactived.
 *                   Must select from the configured list in the system.
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
apiIpAddressRouter.put('/:id', authorizePermissionJWT('ip_address.update'), apiIpAddressController.updateIpAddress);

/**
 * @swagger
 * /api/v1/ip-addresses/{id}:
 *   delete:
 *     summary: Delete an IP address
 *     tags: [IPAddress]
 *     security:
 *       - bearerAuth: []
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
 *       409:
 *         description: Cannot delete — the IP address is still assigned to a device or server
 */
apiIpAddressRouter.delete('/:id', authorizePermissionJWT('ip_address.delete'), apiIpAddressController.deleteIpAddress);


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
 *         ip_type:
 *           type: string
 *           enum: [physical, vip]
 *           readOnly: true
 *           description: Derived automatically from how many devices/servers are linked to this IP — never set directly. 'vip' means the IP is shared by more than one device/server.
 *         devices:
 *           type: array
 *           readOnly: true
 *           description: Every device linked to this IP. At most one entry has role 'normal' (this IP's own device); any others have role 'vip' (shared).
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [normal, vip]
 *         servers:
 *           type: array
 *           readOnly: true
 *           description: Every server linked to this IP. At most one entry has role 'normal' (this IP's own server); any others have role 'vip' (shared).
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [normal, vip]
 *         device:
 *           type: object
 *           readOnly: true
 *           description: Deprecated convenience alias for the role='normal' entry in `devices` (or the first entry if none is 'normal'). Prefer `devices`.
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *         server:
 *           type: object
 *           readOnly: true
 *           description: Deprecated convenience alias for the role='normal' entry in `servers` (or the first entry if none is 'normal'). Prefer `servers`.
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 */


export default apiIpAddressRouter;
