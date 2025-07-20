import express from 'express';
import apiRuleController from '../controllers/apiRuleController.js';
import { authorizePermissionJWT, authenticateJWT } from '../middlewares/auth.middleware.js';
const apiRuleRouter = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Rule
 *     description: Firewall Rule management
 */

/**
 * @swagger
 * /api/v1/rules:
 *   get:
 *     summary: Search firewall rules with pagination
 *     description: Search rules by rule name, source, destination, etc. (case-insensitive partial matching)
 *     tags: [Rule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Search keyword (searches in rule name, source, destination, etc.)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         required: false
 *         description: Page size (default 20, max 100)
 *     responses:
 *       200:
 *         description: Search results
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
 *                 rules:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Rule'
 *       500:
 *         description: Server error
 */
// List and search rules (pagination, search)
apiRuleRouter.get('/', authorizePermissionJWT('rule.read'), apiRuleController.listRules);

/**
 * @swagger
 * /api/v1/rules/{id}:
 *   get:
 *     summary: Get a firewall rule by ID
 *     tags: [Rule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Rule ID
 *     responses:
 *       200:
 *         description: Rule detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rule'
 *       404:
 *         description: Rule not found
 *       500:
 *         description: Server error
 */
// Get rule by ID
apiRuleRouter.get('/:id', authorizePermissionJWT('rule.read'), apiRuleController.getRule);

/**
 * @swagger
 * /api/v1/rules:
 *   post:
 *     summary: Create a new firewall rule
 *     tags: [Rule]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rulename
 *               - src
 *               - dst
 *               - action
 *               - firewall_name
 *             properties:
 *               firewall_name:
 *                 type: string
 *                 enum: [USER, SERVER, INTERNET-IN, INTERNET-OUT, BACKBOND, DMZ, PARTNER, DIGI]
 *                 description: Firewall name (must select from list in config) *
 *               rulename:
 *                 type: string
 *                 description: Rule name *
 *               src_zone:
 *                 type: string
 *                 description: Source zone
 *               src:
 *                 type: string
 *                 description: Source *
 *               src_detail:
 *                 type: string
 *                 description: Source detail
 *               dst_zone:
 *                 type: string
 *                 description: Destination zone
 *               dst:
 *                 type: string
 *                 description: Destination *
 *               dst_detail:
 *                 type: string
 *                 description: Destination detail
 *               services:
 *                 type: string
 *                 description: Service/Port
 *               application:
 *                 type: string
 *                 description: Application
 *               url:
 *                 type: string
 *                 description: URL
 *               action:
 *                 type: string
 *                 enum: [ALLOW, DENY, DROP, REJECT]
 *                 description: Action to take (must select from list) *
 *               status:
 *                 type: string
 *                 enum: [ENABLE, DISABLE]
 *                 description: Status of the rule (must select from list)
 *               violation_type:
 *                 type: string
 *                 enum: [CDE-TO-OUT-OF-SCOPE, OUT-OF-SCOPE-TO-CDE, IN-CDE-NONE-SECURE-PORTS, OUT-CDE-NONE-SECURE-PORTS, ANY, TEST/DEV/UAT-PRODUCTION, USER-SERVER-MGMT-PORTS]
 *                 description: Violation type (must select from list)
 *               violation_detail:
 *                 type: string
 *                 description: Violation detail
 *               solution_proposal:
 *                 type: string
 *                 description: Solution proposal
 *               solution_confirm:
 *                 type: string
 *                 description: Solution confirm
 *               ou_id:
 *                 type: integer
 *                 description: Organization Unit ID (must select from list of units)
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of contact IDs (must select from list, all IDs must exist)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (must select from list, all IDs must exist)
 *               audit_batch:
 *                 type: string
 *                 description: Audit batch (comma-separated, each in format yyyy-01 or yyyy-02)
 *               work_order:
 *                 type: string
 *                 description: Work order
 *               description:
 *                 type: string
 *                 description: Description
 *     responses:
 *       201:
 *         description: Rule created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rule'
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Rule already exists with this name
 *       500:
 *         description: Server error
 */
// Create rule
apiRuleRouter.post('/', authorizePermissionJWT('rule.create'), apiRuleController.createRule);

/**
 * @swagger
 * /api/v1/rules/{id}:
 *   put:
 *     summary: Update a firewall rule
 *     tags: [Rule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firewall_name:
 *                 type: string
 *                 enum: [USER, SERVER, INTERNET-IN, INTERNET-OUT, BACKBOND, DMZ, PARTNER, DIGI]
 *                 description: Firewall name (must select from list in config) *
 *               rulename:
 *                 type: string
 *                 description: Rule name *
 *               src_zone:
 *                 type: string
 *                 description: Source zone
 *               src:
 *                 type: string
 *                 description: Source *
 *               src_detail:
 *                 type: string
 *                 description: Source detail
 *               dst_zone:
 *                 type: string
 *                 description: Destination zone
 *               dst:
 *                 type: string
 *                 description: Destination *
 *               dst_detail:
 *                 type: string
 *                 description: Destination detail
 *               services:
 *                 type: string
 *                 description: Service/Port
 *               application:
 *                 type: string
 *                 description: Application
 *               url:
 *                 type: string
 *                 description: URL
 *               action:
 *                 type: string
 *                 enum: [ALLOW, DENY, DROP, REJECT]
 *                 description: Action to take (must select from list) *
 *               status:
 *                 type: string
 *                 enum: [ENABLE, DISABLE]
 *                 description: Status of the rule (must select from list)
 *               violation_type:
 *                 type: string
 *                 enum: [CDE-TO-OUT-OF-SCOPE, OUT-OF-SCOPE-TO-CDE, IN-CDE-NONE-SECURE-PORTS, OUT-CDE-NONE-SECURE-PORTS, ANY, TEST/DEV/UAT-PRODUCTION, USER-SERVER-MGMT-PORTS]
 *                 description: Violation type (must select from list)
 *               violation_detail:
 *                 type: string
 *                 description: Violation detail
 *               solution_proposal:
 *                 type: string
 *                 description: Solution proposal
 *               solution_confirm:
 *                 type: string
 *                 description: Solution confirm
 *               ou_id:
 *                 type: integer
 *                 description: Organization Unit ID (must select from list of units)
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of contact IDs (must select from list, all IDs must exist)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (must select from list, all IDs must exist)
 *               audit_batch:
 *                 type: string
 *                 description: Audit batch (comma-separated, each in format yyyy-01 or yyyy-02)
 *               work_order:
 *                 type: string
 *                 description: Work order
 *               description:
 *                 type: string
 *                 description: Description
 *     responses:
 *       200:
 *         description: Rule updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rule'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Rule not found
 *       409:
 *         description: Rule already exists with this name
 *       500:
 *         description: Server error
 */
// Update rule
apiRuleRouter.put('/:id', authorizePermissionJWT('rule.update'), apiRuleController.updateRule);

/**
 * @swagger
 * /api/v1/rules/{id}:
 *   delete:
 *     summary: Delete a firewall rule
 *     tags: [Rule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Rule ID
 *     responses:
 *       204:
 *         description: Rule deleted
 *       404:
 *         description: Rule not found
 *       500:
 *         description: Server error
 */
// Delete rule
apiRuleRouter.delete('/:id', authorizePermissionJWT('rule.delete'), apiRuleController.deleteRule);

export default apiRuleRouter;
