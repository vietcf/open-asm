import express from 'express';
import apiClusterController from '../controllers/apiClusterController.js';
import { authorizePermissionJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Cluster
 *     description: API for managing Clusters (e.g. an OpenShift cluster or an Oracle RAC) - a named group of IP-address members, each with a role, optionally linked to one or more Systems
 *
 * components:
 *   schemas:
 *     Cluster:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique ID (auto-increment)
 *         name:
 *           type: string
 *           description: Cluster name
 *         description:
 *           type: string
 *         systems:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *           description: Systems served by this cluster (read-only here; set via the systems field on write)
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               ip_address_id:
 *                 type: integer
 *               ip:
 *                 type: string
 *               role:
 *                 type: string
 *               server_name:
 *                 type: string
 *               device_name:
 *                 type: string
 *           description: Cluster members - each one is an IP address (owned by a server or a device, or neither) with a free-text role
 *         updated_at:
 *           type: string
 *           format: date-time
 *         updated_by:
 *           type: string
 *       example:
 *         id: 1
 *         name: "OpenShift Production"
 *         description: "Production OpenShift cluster"
 *         systems: [{ id: 8, name: "System 001" }]
 *         members: [{ ip_address_id: 6, ip: "10.1.1.1", role: "master", server_name: "Server A", device_name: null }]
 *         updated_at: "2026-01-20T10:30:00Z"
 *         updated_by: "admin"
 */

/**
 * @swagger
 * /api/v1/clusters:
 *   get:
 *     summary: Get all clusters (with optional search, filters, pagination)
 *     tags: [Cluster]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter to clusters having a member with this role (repeatable)
 *       - in: query
 *         name: system_id
 *         schema:
 *           type: integer
 *         description: Filter to clusters linked to this System (repeatable)
 *     responses:
 *       200:
 *         description: List of clusters
 *   post:
 *     summary: Create a new cluster
 *     tags: [Cluster]
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
 *               description:
 *                 type: string
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ip_address_id:
 *                       type: integer
 *                     role:
 *                       type: string
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: System IDs this cluster serves
 *     responses:
 *       201:
 *         description: Cluster created
 *       400:
 *         description: Validation error
 *
 * /api/v1/clusters/{id}:
 *   get:
 *     summary: Get a cluster by ID
 *     tags: [Cluster]
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
 *         description: Cluster object
 *       404:
 *         description: Cluster not found
 *   put:
 *     summary: Update a cluster (partial update, has-key semantics)
 *     tags: [Cluster]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ip_address_id:
 *                       type: integer
 *                     role:
 *                       type: string
 *               systems:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Cluster updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Cluster not found
 *   delete:
 *     summary: Delete a cluster (does not affect its linked Systems or IP/Server/Device members)
 *     tags: [Cluster]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Cluster deleted
 *       404:
 *         description: Cluster not found
 */

router.get('/', authorizePermissionJWT('cluster.read'), apiClusterController.getAll);

/**
 * @swagger
 * /api/v1/clusters/by-system:
 *   get:
 *     summary: Get all clusters serving one System
 *     tags: [Cluster]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: system_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Clusters linked to the given System
 *       400:
 *         description: system_id is required
 */
router.get('/by-system', authorizePermissionJWT('cluster.read'), apiClusterController.getByObject);

/**
 * @swagger
 * /api/v1/clusters/roles:
 *   get:
 *     summary: Get the distinct roles already in use across all cluster members
 *     tags: [Cluster]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of distinct role strings
 */
router.get('/roles', authorizePermissionJWT('cluster.read'), apiClusterController.getRoles);

router.get('/:id', authorizePermissionJWT('cluster.read'), apiClusterController.getById);
router.post('/', authorizePermissionJWT('cluster.create'), apiClusterController.create);
router.put('/:id', authorizePermissionJWT('cluster.update'), apiClusterController.update);
router.delete('/:id', authorizePermissionJWT('cluster.delete'), apiClusterController.remove);

export default router;
