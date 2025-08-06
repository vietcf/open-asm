import express from 'express';
import { 
    listAgents,
    createAgent, 
    getAgent, 
    updateAgent, 
    deleteAgent,
    findAgents
} from '../controllers/apiAgentController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Agent:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *           description: Agent ID
 *         name:
 *           type: string
 *           example: "Apache HTTP Server"
 *           description: Agent name (unique)
 *         version:
 *           type: string
 *           nullable: true
 *           example: "2.4.51"
 *           description: Agent version
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Web server software"
 *           description: Agent description
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Agent creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Agent last update timestamp
 */

/**
 * @swagger
 * /api/v1/agents:
 *   get:
 *     tags:
 *       - Agents
 *     summary: List all agents
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *                 total:
 *                   type: integer
 */
router.get('/', listAgents);

/**
 * @swagger
 * /api/v1/agents:
 *   post:
 *     tags:
 *       - Agents
 *     summary: Create a new agent
 *     description: Creates a new agent with the provided information. Agent name must be unique.
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
 *                 description: Agent name (required, must be unique)
 *                 example: "Apache HTTP Server"
 *               version:
 *                 type: string
 *                 description: Agent version (optional)
 *                 example: "2.4.51"
 *               description:
 *                 type: string
 *                 description: Agent description (optional)
 *                 example: "Web server software"
 *     responses:
 *       201:
 *         description: Agent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Validation error (missing name or name already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Agent name is required"
 *       500:
 *         description: Internal server error
 */
router.post('/', createAgent);

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   get:
 *     tags:
 *       - Agents
 *     summary: Get agent by ID
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
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       404:
 *         description: Agent not found
 */
router.get('/:id', getAgent);

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   put:
 *     tags:
 *       - Agents
 *     summary: Update agent by ID (partial update)
 *     description: Updates an agent by its ID. Only provided fields will be updated, others remain unchanged. Name must be unique if provided.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agent ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Agent name (optional for update, must be unique if provided)
 *                 example: "Updated Apache HTTP Server"
 *               version:
 *                 type: string
 *                 description: Agent version (optional for update)
 *                 example: "2.4.52"
 *               description:
 *                 type: string
 *                 description: Agent description (optional for update)
 *                 example: "Updated web server software"
 *             example:
 *               name: "Updated Agent Name"
 *               version: "1.2.0"
 *               description: "Updated agent description"
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Validation error (empty name or name already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Agent name already exists"
 *       404:
 *         description: Agent not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Agent not found"
 *       500:
 *         description: Internal server error
 */
router.put('/:id', updateAgent);

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   delete:
 *     tags:
 *       - Agents
 *     summary: Delete agent by ID
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
 *         description: Agent deleted successfully
 *       404:
 *         description: Agent not found
 *       400:
 *         description: Cannot delete agent (in use)
 */
router.delete('/:id', deleteAgent);

/**
 * @swagger
 * /api/v1/agents/find:
 *   get:
 *     summary: Find agents by exact name match
 *     description: Search agents by exact name matching. Requires a search term.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent name to search for (exact match)
 *     responses:
 *       200:
 *         description: Agents retrieved successfully
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
 *                     $ref: '#/components/schemas/Agent'
 *                 count:
 *                   type: integer
 *                   description: Number of agents returned
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
router.get('/find', findAgents);

export default router;
