// Rule API routes
const express = require('express');
const apiRuleRouter = express.Router();
const apiRuleController = require('../controllers/apiRuleController');
const { authenticateJWT, authorizePermissionJWT } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   - name: Rule
 *     description: Firewall Rule management
 */

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
 *       500:
 *         description: Server error
 */
apiRuleRouter.post('/', authenticateJWT, authorizePermissionJWT('rule.create'), apiRuleController.createRule);

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
 *       500:
 *         description: Server error
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
apiRuleRouter.put('/:id', authenticateJWT, authorizePermissionJWT('rule.update'), apiRuleController.updateRule);
apiRuleRouter.delete('/:id', authenticateJWT, authorizePermissionJWT('rule.delete'), apiRuleController.deleteRule);

module.exports = apiRuleRouter;
