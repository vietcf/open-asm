// Subnet API routes (ES6)
import express from 'express';
import apiSubnetController from '../controllers/apiSubnetController.js';
const apiSubnetRouter = express.Router();

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
apiSubnetRouter.get('/', apiSubnetController.listSubnets);

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
apiSubnetRouter.get('/:id', apiSubnetController.getSubnet);

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
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional)
 *     responses:
 *       201:
 *         description: Created subnet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subnet'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate subnet address
 */
apiSubnetRouter.post('/', apiSubnetController.createSubnet);

/**
 * @swagger
 * /api/v1/subnets/{id}:
 *   put:
 *     summary: Update a subnet (chỉ cho phép cập nhật description và tags)
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
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional)
 *     responses:
 *       200:
 *         description: Updated subnet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subnet'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
apiSubnetRouter.put('/:id', apiSubnetController.updateSubnet);

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
apiSubnetRouter.delete('/:id', apiSubnetController.deleteSubnet);

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

export default apiSubnetRouter;
