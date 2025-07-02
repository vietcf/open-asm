// Organization Unit API routes
const express = require('express');
const apiUnitRouter = express.Router();
const apiUnitController = require('../controllers/apiUnitController');

/**
 * @swagger
 * /api/units:
 *   get:
 *     summary: List organization units (with filter, pagination)
 *     tags: [OrganizationUnit]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by unit name, code, or description
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
 *         description: List of organization units
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
 *                 units:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationUnit'
 */
apiUnitRouter.get('/', apiUnitController.listUnits);

/**
 * @swagger
 * /api/units/{id}:
 *   get:
 *     summary: Get a single organization unit by ID
 *     tags: [OrganizationUnit]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization unit ID
 *     responses:
 *       200:
 *         description: Organization unit object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrganizationUnit'
 *       404:
 *         description: Not found
 */
apiUnitRouter.get('/:id', apiUnitController.getUnit);

/**
 * @swagger
 * /api/units:
 *   post:
 *     summary: Create a new organization unit
 *     tags: [OrganizationUnit]
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
 *                 description: Unit name (required, unique, case-insensitive)
 *               code:
 *                 type: string
 *                 description: Unit code (optional)
 *               description:
 *                 type: string
 *                 description: Description (optional)
 *     responses:
 *       201:
 *         description: Created organization unit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrganizationUnit'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate unit name
 */
apiUnitRouter.post('/', apiUnitController.createUnit);

/**
 * @swagger
 * /api/units/{id}:
 *   put:
 *     summary: Update an organization unit
 *     tags: [OrganizationUnit]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization unit ID
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
 *                 description: Unit name (required, unique, case-insensitive)
 *               code:
 *                 type: string
 *                 description: Unit code (optional)
 *               description:
 *                 type: string
 *                 description: Description (optional)
 *     responses:
 *       200:
 *         description: Updated organization unit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrganizationUnit'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       409:
 *         description: Duplicate unit name
 */
apiUnitRouter.put('/:id', apiUnitController.updateUnit);

/**
 * @swagger
 * /api/units/{id}:
 *   delete:
 *     summary: Delete an organization unit
 *     tags: [OrganizationUnit]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization unit ID
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
apiUnitRouter.delete('/:id', apiUnitController.deleteUnit);

/**
 * @swagger
 * tags:
 *   - name: OrganizationUnit
 *     description: API for managing organization units
 * components:
 *   schemas:
 *     OrganizationUnit:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         description:
 *           type: string
 */

module.exports = apiUnitRouter;
