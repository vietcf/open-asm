/**
 * @swagger
 * /api/devices:
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
 *             required:
 *               - name
 *               - device_type_id
 *               - ip_addresses
 *             properties:
 *               name:
 *                 type: string
 *                 description: Device name (required, lowercase)
 *               device_type_id:
 *                 type: integer
 *                 description: Device type ID (required)
 *               ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of IP address IDs (required, at least one)
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
 * /api/devices/{id}:
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
 *             required:
 *               - name
 *               - device_type_id
 *               - ip_addresses
 *             properties:
 *               name:
 *                 type: string
 *                 description: Device name (required, lowercase)
 *               device_type_id:
 *                 type: integer
 *                 description: Device type ID (required)
 *               ip_addresses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of IP address IDs (required, at least one)
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

// Device API routes
const express = require('express');
const apiDeviceRouter = express.Router();
const apiDeviceController = require('../controllers/apiDeviceController');

// List devices
apiDeviceRouter.get('/', apiDeviceController.listDevices);
// Get device by ID
apiDeviceRouter.get('/:id', apiDeviceController.getDevice);
// Create device
apiDeviceRouter.post('/', apiDeviceController.createDevice);
// Update device
apiDeviceRouter.put('/:id', apiDeviceController.updateDevice);
// Delete device
apiDeviceRouter.delete('/:id', apiDeviceController.deleteDevice);

module.exports = apiDeviceRouter;
