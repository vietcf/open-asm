import express from 'express';
import apiDomainController from '../controllers/apiDomainController.js';
import { authorizePermissionJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Domain
 *     description: API for managing domains
 *
 * components:
 *   schemas:
 *     Domain:
 *       type: object
 *       required:
 *         - domain
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique ID (auto-increment)
 *         domain:
 *           type: string
 *           description: Domain name (unique)
 *         description:
 *           type: string
 *           description: Domain description
 *         ip_id:
 *           type: integer
 *           nullable: true
 *           description: Associated IP address ID
 *         record_type:
 *           type: string
 *           description: DNS record type (A, AAAA, CNAME, etc.)
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         updated_by:
 *           type: string
 *           description: User who last updated
 *       example:
 *         id: 1
 *         domain: "example.com"
 *         description: "Main company domain"
 *         ip_id: 101
 *         record_type: "A"
 *         created_at: "2024-01-15T10:30:00Z"
 *         updated_at: "2024-01-15T10:30:00Z"
 *         updated_by: "admin"
 */

/**
 * @swagger
 * /api/v1/domains:
 *   get:
 *     summary: Get all domains (with optional search, pagination)
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search keyword
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
 *         description: List of domains
 *   post:
 *     summary: Create a new domain
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - domain
 *             properties:
 *               domain:
 *                 type: string
 *               description:
 *                 type: string
 *               ip_id:
 *                 type: integer
 *               record_type:
 *                 type: string
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional, all IDs must exist)
 *     responses:
 *       201:
 *         description: Domain created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Domain already exists
 *
 * /api/v1/domains/{id}:
 *   get:
 *     summary: Get a domain by ID
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Domain ID
 *     responses:
 *       200:
 *         description: Domain object
 *       404:
 *         description: Domain not found
 *   put:
 *     summary: Update a domain (domain name is immutable — the `domain` field, if sent, is silently ignored)
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Domain ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               ip_id:
 *                 type: integer
 *               record_type:
 *                 type: string
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (optional, all IDs must exist)
 *     responses:
 *       200:
 *         description: Domain updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Domain not found
 *   delete:
 *     summary: Delete a domain
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Domain ID
 *     responses:
 *       204:
 *         description: Domain deleted
 *       404:
 *         description: Domain not found
 *       409:
 *         description: Cannot delete domain — it is referenced by other records
 *
 * /api/v1/domains/find:
 *   get:
 *     summary: Find domains by exact name match
 *     description: Search domains by exact name matching. Requires a search term.
 *     tags: [Domain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Domain name to search for (exact match)
 *     responses:
 *       200:
 *         description: Domains retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates if the request was successful
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Domain'
 *                 count:
 *                   type: integer
 *                   description: Number of domains returned
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
 *                   description: Error message
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
 *                   description: Error message
 *                 error:
 *                   type: string
 *                   description: Detailed error information
 */

// List all domains
router.get('/', authorizePermissionJWT('domain.read'), apiDomainController.getAll);

// Find domains by exact name match
router.get('/find', authorizePermissionJWT('domain.read'), apiDomainController.findDomains);

// Get domain by id
router.get('/:id', authorizePermissionJWT('domain.read'), apiDomainController.getById);

// Create domain
router.post('/', authorizePermissionJWT('domain.create'), apiDomainController.create);

// Update domain
router.put('/:id', authorizePermissionJWT('domain.update'), apiDomainController.update);

// Delete domain
router.delete('/:id', authorizePermissionJWT('domain.delete'), apiDomainController.remove);

export default router;
