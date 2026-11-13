// REST routes of the network module, mounted at /api/v1.
import express from 'express';
import ipAddressApi from './ip-address.api.js';
import subnetApi from './subnet.api.js';
import domainApi from './domain.api.js';
import serviceMappingApi from './service-mapping.api.js';
import { authenticateJWT, authorizePermissionJWT } from '../../middlewares/jwtAuth.middleware.js';

const router = express.Router();
router.use(['/ip-addresses', '/subnets', '/domains', '/service-mappings'], authenticateJWT);
// IP Address API routes (ES6)

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
 *             IP address status. Value of the System Configuration list `ip_address_status` (e.g. reserved, assigned, inactive).
 *             Only active values can be set; a retired value is refused, except the
 *             record's current one, which an update may send back unchanged.
 *         description: "Filter by status (reserved, assigned, inactive)"
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
router.get('/ip-addresses', authorizePermissionJWT('ip_address.read'), ipAddressApi.listIpAddresses);

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
router.get('/ip-addresses/find', authorizePermissionJWT('ip_address.read'), ipAddressApi.findIpAddressByAddress);

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
router.get('/ip-addresses/config', authorizePermissionJWT('ip_address.read'), ipAddressApi.getConfig);

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

router.get('/ip-addresses/:id', authorizePermissionJWT('ip_address.read'), ipAddressApi.getById);

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
 *                   IP address status. Value of the System Configuration list `ip_address_status` (e.g. reserved, assigned, inactive).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
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
router.post('/ip-addresses', authorizePermissionJWT('ip_address.create'), ipAddressApi.create);

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
 *                   IP address status. Value of the System Configuration list `ip_address_status` (e.g. reserved, assigned, inactive).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
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
router.put('/ip-addresses/:id', authorizePermissionJWT('ip_address.update'), ipAddressApi.update);

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
router.delete('/ip-addresses/:id', authorizePermissionJWT('ip_address.delete'), ipAddressApi.remove);

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

// Subnet API routes (ES6)

/**
 * @swagger
 * tags:
 *   - name: Subnet
 *     description: API for managing subnets
 */

/**
 * @swagger
 * /api/v1/subnets:
 *   get:
 *     summary: List subnets (with filter, pagination)
 *     tags: [Subnet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by subnet address or description
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
 *           default: 20
 *         description: "Page size (default: 20)"
 *     responses:
 *       200:
 *         description: List of subnets
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
 *                 subnets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Subnet'
 */
router.get('/subnets', authorizePermissionJWT('subnet.read'), subnetApi.listSubnets);

/**
 * @swagger
 * /api/v1/subnets/find:
 *   get:
 *     summary: Find subnet by exact address
 *     tags: [Subnet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Exact subnet address (e.g. 192.168.1.0/24)
 *     responses:
 *       200:
 *         description: Subnet object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subnet'
 *       400:
 *         description: Missing address parameter
 *       404:
 *         description: Subnet not found
 */
router.get('/subnets/find', authorizePermissionJWT('subnet.read'), subnetApi.findSubnet);

/**
 * @swagger
 * /api/v1/subnets/config:
 *   get:
 *     summary: Get subnet configuration options
 *     description: Retrieve all subnet configuration options including zones and environments
 *     tags: [Subnet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration options retrieved successfully
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
 *                     zones:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: "DMZ"
 *                           label:
 *                             type: string
 *                             example: "DMZ"
 *                       description: Distinct zones from subnets table
 *                     environments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: "PROD"
 *                           label:
 *                             type: string
 *                             example: "PROD"
 *                       description: Distinct environments from subnets table
 *       500:
 *         description: Server error
 */
router.get('/subnets/config', authorizePermissionJWT('subnet.read'), subnetApi.getConfig);

/**
 * @swagger
 * /api/v1/subnets/{id}:
 *   get:
 *     summary: Get a single subnet by ID
 *     tags: [Subnet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subnet ID
 *     responses:
 *       200:
 *         description: Subnet object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subnet'
 *       404:
 *         description: Not found
 */
router.get('/subnets/:id', authorizePermissionJWT('subnet.read'), subnetApi.getById);

/**
 * @swagger
 * /api/v1/subnets:
 *   post:
 *     summary: Create a new subnet
 *     tags: [Subnet]
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
 *                 description: Subnet address (required, e.g. 192.168.1.0/24)
 *               description:
 *                 type: string
 *                 description: Description (optional)
 *               zone:
 *                 type: string
 *                 description: Zone (optional, e.g. DMZ, SERVER FARM, USER, BACKBOND, CLOUD)
 *               environment:
 *                 type: string
 *                 description: Environment (optional, e.g. TEST, DEV, UAT, PROD)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional)
 *               gateway_ip_id:
 *                 type: integer
 *                 nullable: true
 *                 description: Gateway IP address ID (optional) — the IP address (usually a VIP) acting as this subnet's gateway. Must belong to this subnet's own address range.
 *     responses:
 *       201:
 *         description: Created subnet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subnet'
 *       400:
 *         description: Validation error (including referencing an IP address that doesn't exist, or one outside this subnet's range)
 *       409:
 *         description: Duplicate subnet address
 */
router.post('/subnets', authorizePermissionJWT('subnet.create'), subnetApi.create);

/**
 * @swagger
 * /api/v1/subnets/{id}:
 *   put:
 *     summary: Update a subnet (partial update — description, zone, environment, tags, gateway; address is immutable)
 *     tags: [Subnet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subnet ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: Description (optional)
 *               zone:
 *                 type: string
 *                 description: Zone (optional, e.g. DMZ, SERVER FARM, USER, BACKBOND, CLOUD)
 *               environment:
 *                 type: string
 *                 description: Environment (optional, e.g. TEST, DEV, UAT, PROD)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional)
 *               gateway_ip_id:
 *                 type: integer
 *                 nullable: true
 *                 description: Gateway IP address ID (optional). Must belong to this subnet's own address range. Send an empty value to clear it.
 *     responses:
 *       200:
 *         description: Updated subnet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subnet'
 *       400:
 *         description: Validation error (including referencing an IP address that doesn't exist, or one outside this subnet's range)
 *       404:
 *         description: Not found
 */
router.put('/subnets/:id', authorizePermissionJWT('subnet.update'), subnetApi.update);

/**
 * @swagger
 * /api/v1/subnets/{id}:
 *   delete:
 *     summary: Delete a subnet
 *     tags: [Subnet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subnet ID
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
router.delete('/subnets/:id', authorizePermissionJWT('subnet.delete'), subnetApi.remove);

/**
 * @swagger
 * components:
 *   schemas:
 *     Subnet:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         address:
 *           type: string
 *         description:
 *           type: string
 *         zone:
 *           type: string
 *         environment:
 *           type: string
 *         gateway_ip_id:
 *           type: integer
 *           nullable: true
 *           description: IP address (usually a VIP) acting as this subnet's gateway.
 *         gateway_ip_address:
 *           type: string
 *           nullable: true
 *           description: Read-only, joined from the referenced IP address.
 *         tags:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 */

/**
 * @swagger
 * tags:
 *   - name: Domain
 *     description: API for managing domains
 *
 * components:
 *   schemas:
 *     Domain:
 *       type: object
 *       required:
 *         - domain
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique ID (auto-increment)
 *         domain:
 *           type: string
 *           description: Domain name (unique)
 *         description:
 *           type: string
 *           description: Domain description
 *         ip_id:
 *           type: integer
 *           nullable: true
 *           description: Associated IP address ID
 *         record_type:
 *           type: string
 *           description: DNS record type (A, AAAA, CNAME, etc.)
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         updated_by:
 *           type: string
 *           description: User who last updated
 *       example:
 *         id: 1
 *         domain: "example.com"
 *         description: "Main company domain"
 *         ip_id: 101
 *         record_type: "A"
 *         created_at: "2024-01-15T10:30:00Z"
 *         updated_at: "2024-01-15T10:30:00Z"
 *         updated_by: "admin"
 */

/**
 * @swagger
 * /api/v1/domains:
 *   get:
 *     summary: Get all domains (with optional search, pagination)
 *     tags: [Domain]
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
 *         description: List of domains
 *   post:
 *     summary: Create a new domain
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - domain
 *             properties:
 *               domain:
 *                 type: string
 *               description:
 *                 type: string
 *               ip_id:
 *                 type: integer
 *               record_type:
 *                 type: string
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional, all IDs must exist)
 *     responses:
 *       201:
 *         description: Domain created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Domain already exists
 *
 * /api/v1/domains/{id}:
 *   get:
 *     summary: Get a domain by ID
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Domain ID
 *     responses:
 *       200:
 *         description: Domain object
 *       404:
 *         description: Domain not found
 *   put:
 *     summary: Update a domain (domain name is immutable — the `domain` field, if sent, is silently ignored)
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Domain ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               ip_id:
 *                 type: integer
 *               record_type:
 *                 type: string
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional, all IDs must exist)
 *     responses:
 *       200:
 *         description: Domain updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Domain not found
 *   delete:
 *     summary: Delete a domain
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Domain ID
 *     responses:
 *       204:
 *         description: Domain deleted
 *       404:
 *         description: Domain not found
 *       409:
 *         description: Cannot delete domain — it is referenced by other records
 *
 * /api/v1/domains/find:
 *   get:
 *     summary: Find domains by exact name match
 *     description: Search domains by exact name matching. Requires a search term.
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Domain name to search for (exact match)
 *     responses:
 *       200:
 *         description: Domains retrieved successfully
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
 *                     $ref: '#/components/schemas/Domain'
 *                 count:
 *                   type: integer
 *                   description: Number of domains returned
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

// List all domains
router.get('/domains', authorizePermissionJWT('domain.read'), domainApi.getAll);

// Find domains by exact name match
router.get('/domains/find', authorizePermissionJWT('domain.read'), domainApi.findDomains);

// Get domain by id
router.get('/domains/:id', authorizePermissionJWT('domain.read'), domainApi.getById);

// Create domain
router.post('/domains', authorizePermissionJWT('domain.create'), domainApi.create);

// Update domain
router.put('/domains/:id', authorizePermissionJWT('domain.update'), domainApi.update);

// Delete domain
router.delete('/domains/:id', authorizePermissionJWT('domain.delete'), domainApi.remove);

// Service Mapping API routes

/**
 * @swagger
 * tags:
 *   - name: Service Mapping
 *     description: |
 *       Published services (virtual servers / VIPs): frontend IP:port, domain, provider and backends.
 *       Built for integrations (F5, Citrix ADC...): create the IP addresses (`POST /api/v1/ip-addresses`),
 *       domains (`POST /api/v1/domains`) and systems first, then send their **ids** here. Nothing is
 *       created on the fly; an unknown id is a 400. To re-sync, look the mapping up with
 *       `GET /service-mappings/find?name=` and `PUT` it, else `POST` it.
 *
 * components:
 *   schemas:
 *     ServiceMappingMember:
 *       type: object
 *       required: [ip_address_id]
 *       properties:
 *         ip_address_id: { type: integer, description: Backend IP address id }
 *         port: { type: integer, nullable: true, minimum: 1, maximum: 65535, description: Backend port (inbound); outbound sources have none }
 *         protocol: { type: string, nullable: true, enum: [HTTP, HTTPS, TCP, UDP], description: 'Backend protocol (inbound), e.g. HTTP behind an HTTPS VIP' }
 *         status: { type: string, enum: [active, inactive], default: active }
 *     ServiceMappingInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Unique (case-insensitive). Default "<domain or IP>:<port>".
 *         ip_address_id: { type: integer, description: 'Our IP of the flow (required): public IP on its FW / LB (inbound public), NAT service IP (inbound private), NAT IP (outbound private), egress public IP (outbound public)' }
 *         port: { type: integer, nullable: true, minimum: 1, maximum: 65535, description: 'Port of our IP: required for inbound; empty for outbound (each partner IP has its own)' }
 *         nat_ip_address_id: { type: integer, nullable: true, description: 'Public exposure only: the private IP the public IP is NATed to (e.g. a VIP on the LB), optional' }
 *         nat_port: { type: integer, nullable: true, minimum: 1, maximum: 65535, description: 'Port of the NAT private IP (empty = the public port)' }
 *         partner_ips:
 *           type: array
 *           description: 'Partner IPs, each a customer (module Customers) and one of the IPs / networks registered for it there (never created here): the allowed sources of inbound (access_mode limited for public), the destinations of outbound with their own port / protocol (required) and, for internet connectivity, domain (optional). Replaces every row.'
 *           items:
 *             type: object
 *             properties:
 *               customer_id: { type: integer, example: 3, description: 'The customer (or `customer`: its exact name or code)' }
 *               network_id: { type: integer, example: 12, description: 'One of its registered IPs / networks (or `address`: that IP / CIDR as registered)' }
 *               address: { type: string, example: 198.51.100.10, description: 'IP or CIDR registered for the customer, instead of network_id' }
 *               port: { type: integer, nullable: true, example: 443, description: Outbound destinations only (required there) }
 *               protocol: { type: string, nullable: true, enum: [HTTP, HTTPS, TCP, UDP], description: Outbound destinations only (required there) }
 *               domain: { type: string, nullable: true, example: api.bank.example, description: Internet connectivity destinations only (optional) }
 *         protocol: { type: string, enum: [HTTP, HTTPS, TCP, UDP], default: HTTPS }
 *         domain_id: { type: integer, nullable: true }
 *         direction: { type: string, enum: [inbound, outbound], default: inbound, description: 'Flow = direction + scope: inbound public = public exposure, inbound internal = internal exposure, inbound private = private connectivity, outbound private = partner connectivity, outbound public = internet connectivity' }
 *         scope: { type: string, enum: [public, private, internal], default: public, description: 'internal: inbound only (internal exposure)' }
 *         access_mode: { type: string, enum: [full, limited], default: full }
 *         allowed_ips:
 *           type: array
 *           items: { type: string }
 *           description: 'Older form of partner_ips: "IP[Customer]", "IP:port/protocol[Customer]" or "IP:port/protocol@domain[Customer]" strings (customer: exact name or code; IP / CIDR registered for it)'
 *         provider: { type: string, nullable: true, description: 'CDN / WAF / private channel in front (e.g. Akamai, MPLS): a value of the System Configuration list `service_mapping_provider` (case-insensitive); retired values are refused' }
 *         provider_port: { type: integer, nullable: true }
 *         provider_protocol: { type: string, enum: [HTTP, HTTPS, TCP, UDP], nullable: true }
 *         system_id: { type: integer, nullable: true }
 *         description: { type: string, nullable: true }
 *         members:
 *           type: array
 *           description: Backends (inbound) or sources (outbound). On PUT it replaces every member.
 *           items: { $ref: '#/components/schemas/ServiceMappingMember' }
 *       example:
 *         name: myapp.com:443
 *         direction: inbound
 *         scope: public
 *         access_mode: limited
 *         provider: Akamai
 *         provider_port: 443
 *         provider_protocol: HTTPS
 *         ip_address_id: 12
 *         port: 443
 *         protocol: HTTPS
 *         nat_ip_address_id: 15
 *         nat_port: 443
 *         domain_id: 7
 *         system_id: 3
 *         partner_ips:
 *           - { address: 198.51.100.10, customer: Bank A }
 *         members:
 *           - { ip_address_id: 21, port: 8443, protocol: HTTP, status: active }
 *           - { ip_address_id: 22, port: 8443, protocol: HTTP, status: inactive }
 *         description: Public web of My App, through Akamai, open to Bank A only
 *     ServiceMapping:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         name: { type: string }
 *         ip_address_id: { type: integer }
 *         ip_address: { type: string }
 *         port: { type: integer }
 *         protocol: { type: string }
 *         domain_id: { type: integer, nullable: true }
 *         domain: { type: string, nullable: true }
 *         direction: { type: string, enum: [inbound, outbound] }
 *         scope: { type: string, enum: [public, private, internal] }
 *         access_mode: { type: string, enum: [full, limited] }
 *         nat_ip_address_id: { type: integer, nullable: true }
 *         nat_ip: { type: string, nullable: true }
 *         nat_port: { type: integer, nullable: true }
 *         nat_owner_name: { type: string, nullable: true, description: Device, else server, holding the NAT private IP }
 *         nat_owner_type: { type: string, enum: [device, server], nullable: true }
 *         partner_ips:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer }
 *               address: { type: string, description: 'The registered IP / network (CIDR)' }
 *               customer_id: { type: integer, nullable: true }
 *               network_id: { type: integer, nullable: true, description: 'null: a row from before 1.11.0 that had no valid IP' }
 *               partner: { type: string, nullable: true, description: The customer name }
 *               customer_code: { type: string, nullable: true }
 *               network_description: { type: string, nullable: true }
 *               port: { type: integer, nullable: true }
 *               protocol: { type: string, nullable: true }
 *               domain: { type: string, nullable: true }
 *               owner_name: { type: string, nullable: true, description: Device, else server, holding the IP in the inventory }
 *               owner_type: { type: string, enum: [device, server], nullable: true }
 *         provider: { type: string, nullable: true }
 *         provider_port: { type: integer, nullable: true }
 *         provider_protocol: { type: string, nullable: true }
 *         system_id: { type: integer, nullable: true }
 *         system_name: { type: string, nullable: true }
 *         ip_owner_name: { type: string, nullable: true, description: Device, else server, holding the frontend IP }
 *         ip_owner_type: { type: string, enum: [device, server], nullable: true }
 *         description: { type: string, nullable: true }
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer }
 *               ip_address_id: { type: integer }
 *               ip: { type: string }
 *               port: { type: integer, nullable: true }
 *               protocol: { type: string, nullable: true }
 *               status: { type: string }
 *               owner_name: { type: string, nullable: true, description: Device, else server, holding the backend IP }
 *               owner_type: { type: string, enum: [device, server], nullable: true }
 *         updated_at: { type: string, format: date-time }
 *         updated_by: { type: string }
 *
 * /api/v1/service-mappings:
 *   get:
 *     summary: List service mappings (search, filters, pagination)
 *     tags: [Service Mapping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: 'Name, domain, provider, frontend / backend IP or server name' }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, default: 10, maximum: 100 } }
 *       - { in: query, name: protocol, schema: { type: string } }
 *       - { in: query, name: provider, schema: { type: string } }
 *       - { in: query, name: direction, schema: { type: string, enum: [inbound, outbound] } }
 *       - { in: query, name: scope, schema: { type: string, enum: [public, private, internal] } }
 *       - { in: query, name: access_mode, schema: { type: string, enum: [full, limited] } }
 *       - { in: query, name: system_id, schema: { type: integer } }
 *       - { in: query, name: device_id, schema: { type: integer }, description: 'Mappings whose IP (public / flow IP) is held by this device' }
 *       - { in: query, name: customer_id, schema: { type: integer }, description: 'Mappings with a partner IP of this customer' }
 *     responses:
 *       200:
 *         description: '{ data: ServiceMapping[], pagination }'
 *       400:
 *         description: system_id / device_id is not an integer
 *   post:
 *     summary: Create a service mapping
 *     tags: [Service Mapping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ServiceMappingInput' }
 *           examples:
 *             public_exposure:
 *               summary: Inbound public - Public exposure (CDN in front, NAT to a VIP on the LB)
 *               value:
 *                 name: myapp.com:443
 *                 direction: inbound
 *                 scope: public
 *                 access_mode: full
 *                 provider: Akamai
 *                 provider_port: 443
 *                 provider_protocol: HTTPS
 *                 ip_address_id: 12
 *                 port: 443
 *                 protocol: HTTPS
 *                 nat_ip_address_id: 15
 *                 nat_port: 443
 *                 domain_id: 7
 *                 system_id: 3
 *                 members:
 *                   - { ip_address_id: 21, port: 8443, protocol: HTTP, status: active }
 *                   - { ip_address_id: 22, port: 8443, protocol: HTTP, status: active }
 *             public_exposure_limited:
 *               summary: Inbound public - Public exposure open to some partner IPs only
 *               value:
 *                 name: api.myapp.com:443
 *                 direction: inbound
 *                 scope: public
 *                 access_mode: limited
 *                 ip_address_id: 12
 *                 port: 443
 *                 protocol: HTTPS
 *                 partner_ips:
 *                   - { address: 198.51.100.10, customer: Bank A }
 *                   - { address: 198.51.100.11, customer: Bank A }
 *                 members:
 *                   - { ip_address_id: 21, port: 8443, protocol: HTTP }
 *             internal_exposure:
 *               summary: Inbound internal - Internal exposure (VIP on the internal LB)
 *               value:
 *                 name: intranet.local:443
 *                 direction: inbound
 *                 scope: internal
 *                 ip_address_id: 30
 *                 port: 443
 *                 protocol: HTTPS
 *                 system_id: 3
 *                 members:
 *                   - { ip_address_id: 31, port: 8080, protocol: HTTP }
 *             private_connectivity:
 *               summary: Inbound private - Private connectivity (partner reaches our NAT service IP over MPLS)
 *               value:
 *                 name: partner-in:9443
 *                 direction: inbound
 *                 scope: private
 *                 provider: MPLS
 *                 ip_address_id: 40
 *                 port: 9443
 *                 protocol: TCP
 *                 partner_ips:
 *                   - { address: 192.0.2.10, customer: Bank A }
 *                 members:
 *                   - { ip_address_id: 41, port: 9443, protocol: TCP }
 *             partner_connectivity:
 *               summary: Outbound private - Partner connectivity (our NAT IP to partner IP:port)
 *               value:
 *                 name: to-bank-a
 *                 direction: outbound
 *                 scope: private
 *                 provider: MPLS
 *                 ip_address_id: 50
 *                 partner_ips:
 *                   - { address: 192.0.2.20, customer: Bank A, port: 8443, protocol: HTTPS }
 *                 members:
 *                   - { ip_address_id: 51 }
 *                   - { ip_address_id: 52 }
 *             internet_connectivity:
 *               summary: Outbound public - Internet connectivity (egress public IP to an internet API)
 *               value:
 *                 name: to-payment-gateway
 *                 direction: outbound
 *                 scope: public
 *                 ip_address_id: 60
 *                 partner_ips:
 *                   - { address: 203.0.113.80, customer: Payment Gateway, port: 443, protocol: HTTPS, domain: api.pay.example }
 *                 members:
 *                   - { ip_address_id: 51 }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ServiceMapping' }
 *       400:
 *         description: Validation error (missing ip_address_id / port, unknown field, unknown id...)
 *       409:
 *         description: Name already exists
 *
 * /api/v1/service-mappings/find:
 *   get:
 *     summary: Find service mappings by exact name (case-insensitive)
 *     tags: [Service Mapping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: name, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: '{ data: ServiceMapping[], count }'
 *       400:
 *         description: name is required
 *
 * /api/v1/service-mappings/{id}:
 *   get:
 *     summary: Get a service mapping
 *     tags: [Service Mapping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: The service mapping
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ServiceMapping' }
 *       404:
 *         description: Not found
 *   put:
 *     summary: Update a service mapping (partial)
 *     description: Only the fields sent change. `members` replaces every backend; send `[]` to clear them.
 *     tags: [Service Mapping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ServiceMappingInput' }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ServiceMapping' }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       409:
 *         description: Name already exists
 *   delete:
 *     summary: Delete a service mapping
 *     tags: [Service Mapping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 */

router.get('/service-mappings', authorizePermissionJWT('service_mapping.read'), serviceMappingApi.getAll);
router.get('/service-mappings/find', authorizePermissionJWT('service_mapping.read'), serviceMappingApi.find);
router.get('/service-mappings/:id', authorizePermissionJWT('service_mapping.read'), serviceMappingApi.getById);
router.post('/service-mappings', authorizePermissionJWT('service_mapping.create'), serviceMappingApi.create);
router.put('/service-mappings/:id', authorizePermissionJWT('service_mapping.update'), serviceMappingApi.update);
router.delete('/service-mappings/:id', authorizePermissionJWT('service_mapping.delete'), serviceMappingApi.remove);

export default router;
