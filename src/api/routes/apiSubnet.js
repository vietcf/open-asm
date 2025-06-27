// Subnet API routes
const express = require('express');
const apiSubnetRouter = express.Router();
const apiSubnetController = require('../controllers/apiSubnetController');

/**
 * @swagger
 * tags:
 *   - name: Subnet
 *     description: API for managing subnets
 */

/**
 * @swagger
 * /api/subnets:
 *   get:
 *     summary: List subnets (with filter, pagination)
 *     tags: [Subnet]
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
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Page size
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
 * /api/subnets/{id}:
 *   get:
 *     summary: Get a single subnet by ID
 *     tags: [Subnet]
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
 * /api/subnets:
 *   post:
 *     summary: Create a new subnet
 *     tags: [Subnet]
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
 * /api/subnets/{id}:
 *   put:
 *     summary: Update a subnet
 *     tags: [Subnet]
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
 *       409:
 *         description: Duplicate subnet address
 */
apiSubnetRouter.put('/:id', apiSubnetController.updateSubnet);

/**
 * @swagger
 * /api/subnets/{id}:
 *   delete:
 *     summary: Delete a subnet
 *     tags: [Subnet]
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

module.exports = apiSubnetRouter;
