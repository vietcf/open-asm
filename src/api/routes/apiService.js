import express from 'express';
import { 
    listServices,
    createService, 
    getService, 
    updateService, 
    deleteService,
    findServices
} from '../controllers/apiServiceController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *           description: Service ID
 *         name:
 *           type: string
 *           example: "Web Server"
 *           description: Service name (unique)
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Main web server service"
 *           description: Service description
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Service creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Service last update timestamp
 */

/**
 * @swagger
 * /api/v1/services:
 *   get:
 *     tags:
 *       - Services
 *     summary: List all services
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Service'
 *                 total:
 *                   type: integer
 */
router.get('/', listServices);

/**
 * @swagger
 * /api/v1/services/find:
 *   get:
 *     tags:
 *       - Services
 *     summary: Find services by exact name match
 *     description: Search services by exact name matching. Requires a search term.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Service name to search for (exact match)
 *     responses:
 *       200:
 *         description: Services found successfully
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
 *                     $ref: '#/components/schemas/Service'
 *                 count:
 *                   type: integer
 *                   description: Number of services found
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
 *                   example: "Search term \"name\" is required"
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
 *                   example: "Internal server error"
 */
router.get('/find', findServices);

/**
 * @swagger
 * /api/v1/services:
 *   post:
 *     tags:
 *       - Services
 *     summary: Create a new service
 *     description: Creates a new service with the provided information. Service name must be unique.
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: Service name (required, must be unique)
 *                 example: "Web Server"
 *               description:
 *                 type: string
 *                 description: Service description (optional)
 *                 example: "Main web server service"
 *     responses:
 *       201:
 *         description: Service created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Validation error (missing name or name already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service name is required"
 *       500:
 *         description: Internal server error
 */
router.post('/', createService);

/**
 * @swagger
 * /api/v1/services/{id}:
 *   get:
 *     tags:
 *       - Services
 *     summary: Get service by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Service details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Service not found
 */
router.get('/:id', getService);

/**
 * @swagger
 * /api/v1/services/{id}:
 *   put:
 *     tags:
 *       - Services
 *     summary: Update service by ID (partial update)
 *     description: Updates a service by its ID. Only provided fields will be updated, others remain unchanged. Name must be unique if provided.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Service name (optional for update, must be unique if provided)
 *                 example: "Updated Web Server"
 *               description:
 *                 type: string
 *                 description: Service description (optional for update)
 *                 example: "Updated description"
 *             example:
 *               name: "Updated Service Name"
 *               description: "Updated service description"
 *     responses:
 *       200:
 *         description: Service updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Validation error (empty name or name already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service name already exists"
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service not found"
 *       500:
 *         description: Internal server error
 */
router.put('/:id', updateService);

/**
 * @swagger
 * /api/v1/services/{id}:
 *   delete:
 *     tags:
 *       - Services
 *     summary: Delete service by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Service deleted successfully
 *       404:
 *         description: Service not found
 */
router.delete('/:id', deleteService);

export default router;
