import express from 'express';
import { apiPlatformController } from '../controllers/apiPlatformController.js';
import { authorizePermissionJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

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
router.get('/', authorizePermissionJWT('platform.read'), apiPlatformController.getAllPlatforms);

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
router.get('/find', authorizePermissionJWT('platform.read'), apiPlatformController.findPlatforms);

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
router.get('/:id', authorizePermissionJWT('platform.read'), apiPlatformController.getPlatform);

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
router.post('/', authorizePermissionJWT('platform.create'), apiPlatformController.createPlatform);

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
router.put('/:id', authorizePermissionJWT('platform.update'), apiPlatformController.updatePlatform);

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
router.delete('/:id', authorizePermissionJWT('platform.delete'), apiPlatformController.deletePlatform);

export default router;
