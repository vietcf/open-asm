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
 *                 description: List of IP address IDs (required, at least one). Each ID must exist and not already be assigned to another device.
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
 *                   List of IP address IDs. Not required, but if provided, must not be empty.
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

import express from 'express';
import apiDeviceController from '../controllers/apiDeviceController.js';
import { authorizePermissionJWT } from '../middlewares/auth.middleware.js';

const apiDeviceRouter = express.Router();

// List devices
apiDeviceRouter.get('/', authorizePermissionJWT('device.read'), apiDeviceController.listDevices);
// Find devices
apiDeviceRouter.get('/find', authorizePermissionJWT('device.read'), apiDeviceController.findDevices);
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
apiDeviceRouter.get('/config', authorizePermissionJWT('device.read'), apiDeviceController.getConfig);

// Get device by ID
apiDeviceRouter.get('/:id', authorizePermissionJWT('device.read'), apiDeviceController.getDevice);
// Create device
apiDeviceRouter.post('/', authorizePermissionJWT('device.create'), apiDeviceController.createDevice);
// Update device
apiDeviceRouter.put('/:id', authorizePermissionJWT('device.update'), apiDeviceController.updateDevice);
// Delete device
apiDeviceRouter.delete('/:id', authorizePermissionJWT('device.delete'), apiDeviceController.deleteDevice);

export default apiDeviceRouter;
