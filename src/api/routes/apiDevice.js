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
 *                 totalCount:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pageSize:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 devices:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Device'
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
 *             required: []
 *             properties:
 *               name:
 *                 type: string
 *                 description: >
 *                   Device name (optional, lowercase). If provided, must not be empty.
 *               device_type_id:
 *                 type: integer
 *                 description: >
 *                   Device type ID (optional). If provided, must not be empty.
 *               ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: >
 *                   List of IP address IDs (optional, at least one if provided). If provided, must not be empty.
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
 *               $ref: '#/components/schemas/Device'
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
 *               $ref: '#/components/schemas/Device'
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
 *                   Device name (lowercase). Not required, but if provided, must not be empty.
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
 *               $ref: '#/components/schemas/Device'
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
 *     responses:
 *       204:
 *         description: Deleted
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

const apiDeviceRouter = express.Router();

// List devices
apiDeviceRouter.get('/', apiDeviceController.listDevices);
// Find devices
apiDeviceRouter.get('/find', apiDeviceController.findDevices);
// Get device by ID
apiDeviceRouter.get('/:id', apiDeviceController.getDevice);
// Create device
apiDeviceRouter.post('/', apiDeviceController.createDevice);
// Update device
apiDeviceRouter.put('/:id', apiDeviceController.updateDevice);
// Delete device
apiDeviceRouter.delete('/:id', apiDeviceController.deleteDevice);

export default apiDeviceRouter;
