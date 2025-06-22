// Rule API routes
const express = require('express');
const apiRuleRouter = express.Router();
const apiRuleController = require('../controllers/apiRuleController');

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
 *             properties:
 *               rulename:
 *                 type: string
 *               src_zone:
 *                 type: string
 *               src:
 *                 type: string
 *               src_detail:
 *                 type: string
 *               dst_zone:
 *                 type: string
 *               dst:
 *                 type: string
 *               dst_detail:
 *                 type: string
 *               services:
 *                 type: string
 *               application:
 *                 type: string
 *               url:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [ALLOW, DENY]
 *                 description: Action to take (must select from list)
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, BLOCKED]
 *                 description: Status of the rule (must select from list)
 *               violation_type:
 *                 type: string
 *                 enum: [MALWARE, POLICY, OTHER]
 *                 description: Violation type (must select from list)
 *               ou_id:
 *                 type: integer
 *                 description: Organization Unit ID (must select from list of units)
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of contact IDs (must select from list)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of tag IDs (must select from list)
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
apiRuleRouter.post('/', require('../middlewares/auth').authorizePermission ? require('../middlewares/auth').authorizePermission('rule.create') : (req, res, next) => next(),
  require('../controllers/apiRuleController').createRule);

module.exports = apiRuleRouter;
