const express = require('express');
const router = express.Router();
const controller = require('../controllers/apiSystemController');

/**
 * @swagger
 * tags:
 *   - name: System
 *     description: API for managing systems
 */

/**
 * @swagger
 * /api/systems:
 *   get:
 *     summary: Get all systems
 *     tags: [System]
 *     responses:
 *       200:
 *         description: List of systems
 *   post:
 *     summary: Create a new system
 *     tags: [System]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - system_id
 *               - name
 *             properties:
 *               system_id:
 *                 type: string
 *               name:
 *                 type: string
 *               alias:
 *                 type: string
 *               description:
 *                 type: string
 *               level:
 *                 type: integer
 *               department_id:
 *                 type: integer
 *               domains:
 *                 type: array
 *                 items: { type: string }
 *               managers:
 *                 type: array
 *                 items: { type: integer }
 *               ip_addresses:
 *                 type: array
 *                 items: { type: integer }
 *               tags:
 *                 type: array
 *                 items: { type: integer }
 *               docs:
 *                 type: array
 *                 items: { type: object }
 *     responses:
 *       201:
 *         description: System created
 *       400:
 *         description: Validation error
 *
 * /api/systems/{id}:
 *   get:
 *     summary: Get a system by ID
 *     tags: [System]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: System ID
 *     responses:
 *       200:
 *         description: System object
 *       404:
 *         description: System not found
 *   put:
 *     summary: Update a system
 *     tags: [System]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: System ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               system_id:
 *                 type: string
 *               name:
 *                 type: string
 *               alias:
 *                 type: string
 *               description:
 *                 type: string
 *               level:
 *                 type: integer
 *               department_id:
 *                 type: integer
 *               domains:
 *                 type: array
 *                 items: { type: string }
 *               managers:
 *                 type: array
 *                 items: { type: integer }
 *               ip_addresses:
 *                 type: array
 *                 items: { type: integer }
 *               tags:
 *                 type: array
 *                 items: { type: integer }
 *               docs:
 *                 type: array
 *                 items: { type: object }
 *     responses:
 *       200:
 *         description: System updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: System not found
 *   delete:
 *     summary: Delete a system
 *     tags: [System]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: System ID
 *     responses:
 *       204:
 *         description: System deleted
 *       404:
 *         description: System not found
 */

// List all systems
router.get('/', controller.getAll);
// Get system by id
router.get('/:id', controller.getById);
// Create system
router.post('/', controller.create);
// Update system
router.put('/:id', controller.update);
// Delete system
router.delete('/:id', controller.remove);

module.exports = router;
