import express from 'express';
import apiDeviceTypeController from '../controllers/apiDeviceTypeController.js';

const router = express.Router();

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
router.get('/', apiDeviceTypeController.getAllDeviceTypes);

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
router.get('/find', apiDeviceTypeController.findDeviceTypes);

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
router.get('/:id', apiDeviceTypeController.getDeviceTypeById);

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
router.post('/', apiDeviceTypeController.createDeviceType);

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
router.put('/:id', apiDeviceTypeController.updateDeviceType);

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
router.delete('/:id', apiDeviceTypeController.deleteDeviceType);

export default router;
