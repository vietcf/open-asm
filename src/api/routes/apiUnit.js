// Organization Unit API routes
import express from 'express';
import apiUnitController from '../controllers/apiUnitController.js';
import { authorizePermissionJWT } from '../middlewares/auth.middleware.js';
const apiUnitRouter = express.Router();

/**
 * @swagger
 * /api/v1/units:
 *   get:
 *     summary: List organization units (with filter, pagination)
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
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
 * /api/v1/units/find:
 *   get:
 *     summary: Find units by exact name match
 *     description: Search units by exact name matching. Requires a search term.
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit name to search for (exact match, case-insensitive)
 *     responses:
 *       200:
 *         description: Units retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationUnit'
 *                 count:
 *                   type: integer
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
 *                   example: "Search term 'name' is required"
 *       500:
 *         description: Internal server error
 */
apiUnitRouter.get('/find', authorizePermissionJWT('unit.read'), apiUnitController.findUnits);

/**
 * @swagger
 * /api/v1/units/{id}:
 *   get:
 *     summary: Get a single organization unit by ID
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
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
apiUnitRouter.get('/:id', authorizePermissionJWT('unit.read'), apiUnitController.getUnit);

/**
 * @swagger
 * /api/v1/units:
 *   post:
 *     summary: Create a new organization unit
 *     tags: [OrganizationUnit]
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
apiUnitRouter.post('/', authorizePermissionJWT('unit.create'), apiUnitController.createUnit);

/**
 * @swagger
 * /api/v1/units/{id}:
 *   put:
 *     summary: Update an organization unit
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
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
apiUnitRouter.put('/:id', authorizePermissionJWT('unit.update'), apiUnitController.updateUnit);

/**
 * @swagger
 * /api/v1/units/{id}:
 *   delete:
 *     summary: Delete an organization unit
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
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
apiUnitRouter.delete('/:id', authorizePermissionJWT('unit.delete'), apiUnitController.deleteUnit);

/**
 * @swagger
 * tags:
 *   - name: OrganizationUnit
 *     description: API for managing organization units
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
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

export default apiUnitRouter;
