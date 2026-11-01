// REST routes of the device module, mounted at /api/v1.
import express from 'express';
import deviceApi from './device.api.js';
import deviceTypeApi from './device-type.api.js';
import platformApi from './platform.api.js';
import { authenticateJWT, authorizePermissionJWT } from '../../middlewares/jwtAuth.middleware.js';

const router = express.Router();
router.use(['/devices', '/device-types', '/platforms'], authenticateJWT);
/**
 * @swagger
 * /api/v1/devices:
 *   get:
 *     summary: List devices (with filter, pagination)
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by device name, manufacturer, platform, IP, etc.
 *       - in: query
 *         name: device_type_id
 *         schema:
 *           type: integer
 *         description: Filter by device type
 *       - in: query
 *         name: platform_id
 *         schema:
 *           type: integer
 *         description: Filter by platform (OS)
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: manufacturer
 *         schema:
 *           type: string
 *         description: Filter by manufacturer
 *       - in: query
 *         name: device_role
 *         schema:
 *           type: string
 *         description: Filter by device role
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
 *         description: List of devices
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
 *                     $ref: '#/components/schemas/Device'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *   post:
 *     summary: Create a new device
 *     tags: [Device]
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
 *               - device_type_id
 *               - ip_addresses
 *             properties:
 *               name:
 *                 type: string
 *                 description: Device name (required, case preserved as submitted — not lowercased). Must be unique.
 *               device_type_id:
 *                 type: integer
 *                 description: Device type ID (required, must reference an existing device type).
 *               ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of IP address IDs (required, at least one). Each ID must exist and not already be the 'normal' (exclusive) IP of another device. VIP (shared) IP links can only be added afterwards, via PUT.
 *               platform_id:
 *                 type: integer
 *                 description: Platform (OS) ID (optional)
 *               location:
 *                 type: string
 *                 description: Location (optional)
 *               serial:
 *                 type: string
 *                 description: Serial (optional)
 *               management:
 *                 type: string
 *                 description: Management address (optional)
 *               manufacturer:
 *                 type: string
 *                 description: Manufacturer (optional)
 *               device_role:
 *                 type: string
 *                 description: Device role (optional)
 *               description:
 *                 type: string
 *                 description: Description (optional)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional)
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of contact IDs (optional)
 *     responses:
 *       201:
 *         description: Created device
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Device created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Device'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate device name
 *
 * /api/v1/devices/find:
 *   get:
 *     summary: Find devices by specific field values (exact match)
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Find device by name (exact match)
 *       - in: query
 *         name: ip_address
 *         schema:
 *           type: string
 *         description: Find devices by IP address (exact match, e.g. 192.168.1.1)
 *     responses:
 *       200:
 *         description: List of matching devices
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
 *                     $ref: '#/components/schemas/Device'
 *                 total:
 *                   type: integer
 *                 criteria:
 *                   type: object
 *                   description: Search criteria used
 *       400:
 *         description: No search criteria provided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "At least one search criteria must be provided (name or ip_address)"
 *       404:
 *         description: No devices found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No devices found matching the specified criteria"
 *                 criteria:
 *                   type: object
 *
 * /api/v1/devices/{id}:
 *   get:
 *     summary: Get a single device by ID
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Device ID
 *     responses:
 *       200:
 *         description: Device object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Device'
 *       404:
 *         description: Not found
 *   put:
 *     summary: Update a device
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Device ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: |
 *                   Device name (case preserved as submitted — not lowercased). Not required, but if provided, must not be empty. Must remain unique.
 *               device_type_id:
 *                 type: integer
 *                 description: |
 *                   Device type ID. Not required, but if provided, must not be empty.
 *               ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: |
 *                   List of IP address IDs. Not required, but if provided, must not be empty. Fully replaces the device's 'normal' (exclusive) IPs; its VIP links are untouched.
 *               vip_ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: |
 *                   Optional list of IP address IDs to link as VIP (shared) IPs — MAY already belong to another device/server. If provided (even as []), fully replaces the device's VIP links. An ID cannot appear in both ip_addresses and vip_ip_addresses.
 *               platform_id:
 *                 type: integer
 *                 description: Platform (OS) ID (optional)
 *               location:
 *                 type: string
 *                 description: Location (optional)
 *               serial:
 *                 type: string
 *                 description: Serial (optional)
 *               management:
 *                 type: string
 *                 description: Management address (optional)
 *               manufacturer:
 *                 type: string
 *                 description: Manufacturer (optional)
 *               device_role:
 *                 type: string
 *                 description: Device role (optional)
 *               description:
 *                 type: string
 *                 description: Description (optional)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional)
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of contact IDs (optional)
 *     responses:
 *       200:
 *         description: Updated device
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Device updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Device'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       409:
 *         description: Duplicate device name
 *   delete:
 *     summary: Delete a device
 *     tags: [Device]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Device ID
 *       - in: query
 *         name: delete_ip
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, permanently delete the device's IP addresses. Default false releases them (status set to 'reserved').
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Device deleted successfully"
 *       404:
 *         description: Not found
 * components:
 *   schemas:
 *     Device:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         device_type_id:
 *           type: integer
 *         device_type_name:
 *           type: string
 *         platform_id:
 *           type: integer
 *         platform_name:
 *           type: string
 *         location:
 *           type: string
 *         serial_number:
 *           type: string
 *         management_address:
 *           type: string
 *         manufacturer:
 *           type: string
 *         device_role:
 *           type: string
 *         description:
 *           type: string
 *         ip_addresses:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               ip_address:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [normal, vip]
 *                 description: normal = this device's own (exclusive) IP; vip = an IP shared with another device/server.
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
 */

// List devices
router.get('/devices', authorizePermissionJWT('device.read'), deviceApi.listDevices);
// Find devices
router.get('/devices/find', authorizePermissionJWT('device.read'), deviceApi.findDevices);
/**
 * @swagger
 * /api/v1/devices/config:
 *   get:
 *     summary: Get device configuration options
 *     description: Retrieve all device configuration options including location, manufacturers, and device roles
 *     tags: [Device]
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
 *                     location:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: "DC"
 *                           label:
 *                             type: string
 *                             example: "Data Center"
 *                       description: Location options from database configuration
 *                     manufacturers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: "Cisco"
 *                           label:
 *                             type: string
 *                             example: "Cisco"
 *                       description: Unique manufacturers from devices table
 *                     device_roles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: "Router"
 *                           label:
 *                             type: string
 *                             example: "Router"
 *                       description: Unique device roles from devices table
 *       500:
 *         description: Server error
 */
router.get('/devices/config', authorizePermissionJWT('device.read'), deviceApi.getConfig);

// Get device by ID
router.get('/devices/:id', authorizePermissionJWT('device.read'), deviceApi.getDevice);
// Create device
router.post('/devices', authorizePermissionJWT('device.create'), deviceApi.createDevice);
// Update device
router.put('/devices/:id', authorizePermissionJWT('device.update'), deviceApi.updateDevice);
// Delete device
router.delete('/devices/:id', authorizePermissionJWT('device.delete'), deviceApi.deleteDevice);

/**
 * @swagger
 * components:
 *   schemas:
 *     DeviceType:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           readOnly: true
 *           description: Unique identifier for the device type
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: Name of the device type (must be unique)
 *         description:
 *           type: string
 *           nullable: true
 *           maxLength: 500
 *           description: Optional description of the device type
 *         created_at:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *           description: Last update timestamp
 *       example:
 *         id: 1
 *         name: "Server"
 *         description: "Physical or virtual server devices"
 *         created_at: "2024-01-15T10:30:00Z"
 *         updated_at: "2024-01-15T10:30:00Z"
 *     
 *     DeviceTypeInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: Name of the device type (must be unique)
 *         description:
 *           type: string
 *           nullable: true
 *           maxLength: 500
 *           description: Optional description of the device type
 *       example:
 *         name: "Server"
 *         description: "Physical or virtual server devices"
 *     
 *     DeviceTypeUpdateInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: Name of the device type (must be unique)
 *         description:
 *           type: string
 *           nullable: true
 *           maxLength: 500
 *           description: Optional description of the device type
 *       example:
 *         name: "Server"
 *         description: "Physical or virtual server devices"
 *     
 *     DeviceTypeResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the request was successful
 *         message:
 *           type: string
 *           description: Response message
 *         data:
 *           $ref: '#/components/schemas/DeviceType'
 *     
 *     DeviceTypeListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the request was successful
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DeviceType'
 *         count:
 *           type: integer
 *           description: Number of device types returned
 *     
 *     DeviceTypeSearchResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the request was successful
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DeviceType'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               description: Current page number
 *             pageSize:
 *               type: integer
 *               description: Number of items per page
 *             totalItems:
 *               type: integer
 *               description: Total number of items
 *             totalPages:
 *               type: integer
 *               description: Total number of pages
 *             hasNext:
 *               type: boolean
 *               description: Whether there is a next page
 *             hasPrev:
 *               type: boolean
 *               description: Whether there is a previous page
 *         search:
 *           type: object
 *           properties:
 *             query:
 *               type: string
 *               description: Search query used
 *             sortBy:
 *               type: string
 *               description: Field used for sorting
 *             sortOrder:
 *               type: string
 *               description: Sort order (asc/desc)
 *     
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           description: Error message
 *         error:
 *           type: string
 *           description: Detailed error information
 *   
 *   tags:
 *     - name: Device Types
 *       description: Device type management operations
 */

/**
 * @swagger
 * /api/v1/device-types:
 *   get:
 *     summary: Get all device types
 *     description: Retrieve a list of all device types in the system
 *     tags: [Device Types]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of device types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceTypeListResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/device-types', authorizePermissionJWT('device_type.read'), deviceTypeApi.list);

/**
 * @swagger
 * /api/v1/device-types/find:
 *   get:
 *     summary: Find device types by exact name match
 *     description: Search device types by exact name matching. Requires a search term.
 *     tags: [Device Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Device type name to search for (exact match)
 *     responses:
 *       200:
 *         description: Device types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceTypeListResponse'
 *       400:
 *         description: Search term "name" is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/device-types/find', authorizePermissionJWT('device_type.read'), deviceTypeApi.find);

/**
 * @swagger
 * /api/v1/device-types/{id}:
 *   get:
 *     summary: Get device type by ID
 *     description: Retrieve a specific device type by its unique identifier
 *     tags: [Device Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Device type ID
 *     responses:
 *       200:
 *         description: Device type retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceTypeResponse'
 *       400:
 *         description: Invalid device type ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Device type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/device-types/:id', authorizePermissionJWT('device_type.read'), deviceTypeApi.get);

/**
 * @swagger
 * /api/v1/device-types:
 *   post:
 *     summary: Create new device type
 *     description: Create a new device type with name and optional description
 *     tags: [Device Types]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceTypeInput'
 *     responses:
 *       201:
 *         description: Device type created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceTypeResponse'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Device type with this name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/device-types', authorizePermissionJWT('device_type.create'), deviceTypeApi.create);

/**
 * @swagger
 * /api/v1/device-types/{id}:
 *   put:
 *     summary: Update device type
 *     description: Update a device type with new data. Supports both full and partial updates - only provided fields will be updated.
 *     tags: [Device Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Device type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceTypeUpdateInput'
 *           examples:
 *             updateName:
 *               summary: Update only name
 *               value:
 *                 name: "Updated Server Type"
 *             updateDescription:
 *               summary: Update only description
 *               value:
 *                 description: "Updated description for server devices"
 *             updateBoth:
 *               summary: Update both fields
 *               value:
 *                 name: "Updated Server Type"
 *                 description: "Updated description for server devices"
 *     responses:
 *       200:
 *         description: Device type updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceTypeResponse'
 *       400:
 *         description: Invalid input data, device type ID, or no fields provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Device type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Device type with this name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/device-types/:id', authorizePermissionJWT('device_type.update'), deviceTypeApi.update);

/**
 * @swagger
 * /api/v1/device-types/{id}:
 *   delete:
 *     summary: Delete device type
 *     description: Delete a device type by its ID. Cannot delete if it's being used by existing devices.
 *     tags: [Device Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Device type ID
 *     responses:
 *       200:
 *         description: Device type deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Device type deleted successfully"
 *       400:
 *         description: Invalid device type ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Device type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Cannot delete device type as it is being used by existing devices
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/device-types/:id', authorizePermissionJWT('device_type.delete'), deviceTypeApi.remove);

/**
 * @swagger
 * components:
 *   schemas:
 *     Platform:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the platform
 *         name:
 *           type: string
 *           description: The name of the platform
 *         description:
 *           type: string
 *           description: The description of the platform
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the platform was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the platform was last updated (may be null if not updated)
 *       example:
 *         id: 1
 *         name: "Windows Server 2019"
 *         description: "Microsoft Windows Server 2019 operating system"
 *         created_at: "2023-01-01T00:00:00.000Z"
 *         updated_at: "2023-01-01T00:00:00.000Z"
 *     
 *     PlatformInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the platform
 *         description:
 *           type: string
 *           description: The description of the platform
 *       example:
 *         name: "Ubuntu 22.04 LTS"
 *         description: "Ubuntu Linux Server 22.04 LTS"
 *     
 *     PlatformUpdate:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the platform
 *         description:
 *           type: string
 *           description: The description of the platform
 *       example:
 *         description: "Updated Ubuntu Linux Server 22.04 LTS with latest patches"
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *       example:
 *         error: "Platform not found"
 */

/**
 * @swagger
 * /api/v1/platforms:
 *   get:
 *     summary: Retrieve all platforms
 *     tags: [Platforms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of platforms
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Platform'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/platforms', authorizePermissionJWT('platform.read'), platformApi.list);

/**
 * @swagger
 * /api/v1/platforms/find:
 *   get:
 *     summary: Find platforms by exact name match
 *     tags: [Platforms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform name to search for (exact match)
 *     responses:
 *       200:
 *         description: A list of platforms matching the exact name
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Platform'
 *       400:
 *         description: Search term "name" is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/platforms/find', authorizePermissionJWT('platform.read'), platformApi.find);

/**
 * @swagger
 * /api/v1/platforms/{id}:
 *   get:
 *     summary: Get a platform by ID
 *     tags: [Platforms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the platform to get
 *     responses:
 *       200:
 *         description: The platform data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Platform'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Platform not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/platforms/:id', authorizePermissionJWT('platform.read'), platformApi.get);

/**
 * @swagger
 * /api/v1/platforms:
 *   post:
 *     summary: Create a new platform
 *     tags: [Platforms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlatformInput'
 *     responses:
 *       201:
 *         description: The platform was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Platform'
 *       400:
 *         description: Bad request (validation error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Platform name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/platforms', authorizePermissionJWT('platform.create'), platformApi.create);

/**
 * @swagger
 * /api/v1/platforms/{id}:
 *   put:
 *     summary: Update a platform (partial update supported)
 *     tags: [Platforms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the platform to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlatformUpdate'
 *     responses:
 *       200:
 *         description: The platform was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Platform'
 *       400:
 *         description: Bad request (validation error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Platform not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Platform name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/platforms/:id', authorizePermissionJWT('platform.update'), platformApi.update);

/**
 * @swagger
 * /api/v1/platforms/{id}:
 *   delete:
 *     summary: Delete a platform
 *     description: Delete a platform by its ID. Cannot delete if it's being used by existing devices.
 *     tags: [Platforms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the platform to delete
 *     responses:
 *       200:
 *         description: Platform deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Platform deleted successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Platform not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Cannot delete platform as it is being used by existing devices
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/platforms/:id', authorizePermissionJWT('platform.delete'), platformApi.remove);

export default router;
