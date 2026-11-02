// REST routes of the firewall module, mounted at /api/v1.
import express from 'express';
import ruleApi from './rule.api.js';
import { authenticateJWT, authorizePermissionJWT } from '../../middlewares/jwtAuth.middleware.js';

const router = express.Router();
router.use(['/rules'], authenticateJWT);
/**
 * @swagger
 * tags:
 *   - name: Rule
 *     description: Firewall Rule management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ConfigSystem:
 *       type: object
 *       description: |
 *         Configuration System for Enum Values
 *         
 *         The API uses a dynamic configuration system where enum values for certain fields 
 *         are loaded from the database configuration table. This allows administrators to 
 *         modify available options without code changes.
 *         
 *         Configuration Table Structure:
 *         - Table: `configuration`
 *         - Key Fields: `config_name`, `value` (JSON array)
 *         
 *         Enum Fields and their Config Names:
 *         - `firewall_name`: config_name = 'firewall_name'
 *         - `action`: config_name = 'firewall_rule_action'  
 *         - `status`: config_name = 'firewall_rule_status'
 *         - `violation_type`: config_name = 'firewall_rule_violation_type'
 *         
 *         Example Config Entry:
 *         ```json
 *         {
 *           "config_name": "firewall_rule_action",
 *           "value": "[{\"value\":\"ALLOW\",\"label\":\"Allow\"},{\"value\":\"DENY\",\"label\":\"Deny\"}]"
 *         }
 *         ```
 *         
 *         To get current enum values, use the configuration API endpoints or check 
 *         the system configuration in the admin panel.
 */

/**
 * @swagger
 * /api/v1/rules/config:
 *   get:
 *     summary: Get configuration values for enum fields
 *     description: |
 *       Retrieve current configuration values for enum fields used in firewall rules.
 *       This endpoint returns the dynamic enum values loaded from the database configuration table.
 *     tags: [Rule]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration values retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     firewall_name:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *                       example: [{"value": "USER", "label": "User Network"}, {"value": "SERVER", "label": "Server Network"}]
 *                     action:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *                       example: [{"value": "ALLOW", "label": "Allow"}, {"value": "DENY", "label": "Deny"}]
 *                     status:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *                       example: [{"value": "ENABLE", "label": "Enable"}, {"value": "DISABLE", "label": "Disable"}]
 *                     violation_type:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *                       example: [{"value": "ANY", "label": "Any"}, {"value": "CDE-TO-OUT-OF-SCOPE", "label": "CDE to Out of Scope"}]
 *       500:
 *         description: Server error
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
 *                   example: "Internal server error"
 *                 error:
 *                   type: string
 *                   example: "Failed to load configuration"
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
 *       - in: query
 *         name: ou_id
 *         schema:
 *           type: integer
 *         required: false
 *         description: Filter by Organization Unit ID
 *       - in: query
 *         name: contacts
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         required: false
 *         description: Filter by Contact IDs (array)
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         required: false
 *         description: Filter by Tag IDs (array)
 *       - in: query
 *         name: violation_type
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by Violation Type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by Status
 *       - in: query
 *         name: firewall_name
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by Firewall Name
 *       - in: query
 *         name: audit_batch
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by Audit Batch
 *       - in: query
 *         name: work_order
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by Work Order
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
router.get('/rules', authorizePermissionJWT('rule.read'), ruleApi.listRules);

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
// Get configuration values for enum fields
router.get('/rules/config', authorizePermissionJWT('rule.read'), ruleApi.getConfig);

// Get rule by ID
router.get('/rules/:id', authorizePermissionJWT('rule.read'), ruleApi.getRule);

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
 *               - audit_batch
 *             properties:
 *               firewall_name:
 *                 type: string
 *                 description: |
 *                   Firewall name (required). Value of the System Configuration list `firewall_name` (e.g. USER, SERVER, INTERNET-IN, etc).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               rulename:
 *                 type: string
 *                 maxLength: 255
 *                 description: Rule name *
 *               src_zone:
 *                 type: string
 *                 description: Source zone
 *               src:
 *                 type: string
 *                 maxLength: 255
 *                 description: Source *
 *               src_detail:
 *                 type: string
 *                 description: Source detail
 *               dst_zone:
 *                 type: string
 *                 description: Destination zone
 *               dst:
 *                 type: string
 *                 maxLength: 255
 *                 description: Destination *
 *               dst_detail:
 *                 type: string
 *                 description: Destination detail
 *               services:
 *                 type: string
 *                 maxLength: 255
 *                 description: Service
 *               application:
 *                 type: string
 *                 maxLength: 255
 *                 description: Application
 *               url:
 *                 type: string
 *                 maxLength: 500
 *                 format: uri
 *                 description: URL
 *               action:
 *                 type: string
 *                 description: |
 *                   Action to take (required). Value of the System Configuration list `firewall_rule_action` (e.g. ALLOW, DENY, DROP, REJECT).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               status:
 *                 type: string
 *                 description: |
 *                   Status of the rule (optional). Value of the System Configuration list `firewall_rule_status` (e.g. ENABLE, DISABLE).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               violation_type:
 *                 type: string
 *                 description: |
 *                   Violation type (optional). Value of the System Configuration list `firewall_rule_violation_type`
 *                   (e.g. CDE-TO-OUT-OF-SCOPE, OUT-OF-SCOPE-TO-CDE, IN-CDE-NONE-SECURE-PORTS, ANY).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
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
 *                 description: Audit batch
 *               work_order:
 *                 type: string
 *                 maxLength: 255
 *                 description: Work order
 *               description:
 *                 type: string
 *                 description: Description
 *               raw_data:
 *                 type: string
 *                 description: Raw data
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
router.post('/rules', authorizePermissionJWT('rule.create'), ruleApi.createRule);

/**
 * @swagger
 * /api/v1/rules/{id}:
 *   put:
 *     summary: Update a firewall rule (partial update supported)
 *     description: |
 *       Update a firewall rule. Only fields provided in the request body will be updated.
 *       Fields not included in the request will retain their current values.
 *       If no changes are detected, the rule will not be updated in the database.
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
 *             description: |
 *               All fields are optional. Only provided fields will be updated.
 *               Fields not included will retain their current values.
 *             properties:
 *               firewall_name:
 *                 type: string
 *                 description: |
 *                   Firewall name (required). Value of the System Configuration list `firewall_name` (e.g. USER, SERVER, INTERNET-IN, etc).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               rulename:
 *                 type: string
 *                 maxLength: 255
 *                 description: Rule name *
 *               src_zone:
 *                 type: string
 *                 description: Source zone
 *               src:
 *                 type: string
 *                 maxLength: 255
 *                 description: Source *
 *               src_detail:
 *                 type: string
 *                 description: Source detail
 *               dst_zone:
 *                 type: string
 *                 description: Destination zone
 *               dst:
 *                 type: string
 *                 maxLength: 255
 *                 description: Destination *
 *               dst_detail:
 *                 type: string
 *                 description: Destination detail
 *               services:
 *                 type: string
 *                 maxLength: 255
 *                 description: Service
 *               application:
 *                 type: string
 *                 maxLength: 255
 *                 description: Application
 *               url:
 *                 type: string
 *                 maxLength: 500
 *                 format: uri
 *                 description: URL
 *               action:
 *                 type: string
 *                 description: |
 *                   Action to take (required). Value of the System Configuration list `firewall_rule_action` (e.g. ALLOW, DENY, DROP, REJECT).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               status:
 *                 type: string
 *                 description: |
 *                   Status of the rule (optional). Value of the System Configuration list `firewall_rule_status` (e.g. ENABLE, DISABLE).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
 *               violation_type:
 *                 type: string
 *                 description: |
 *                   Violation type (optional). Value of the System Configuration list `firewall_rule_violation_type`
 *                   (e.g. CDE-TO-OUT-OF-SCOPE, OUT-OF-SCOPE-TO-CDE, IN-CDE-NONE-SECURE-PORTS, ANY).
 *                   Only active values can be set; a retired value is refused, except the
 *                   record's current one, which an update may send back unchanged.
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
 *                 description: Audit batch
 *               work_order:
 *                 type: string
 *                 maxLength: 255
 *                 description: Work order
 *               description:
 *                 type: string
 *                 description: Description
 *               raw_data:
 *                 type: string
 *                 description: Raw data
 *           examples:
 *             partial_update:
 *               summary: Partial update example
 *               description: Only update specific fields
 *               value:
 *                 rulename: "updated-rule-name"
 *                 status: "DISABLE"
 *                 description: "Updated description"
 *             full_update:
 *               summary: Full update example
 *               description: Update all fields
 *               value:
 *                 rulename: "test-rule-001"
 *                 firewall_name: "USER"
 *                 src: "192.168.1.0/24"
 *                 dst: "10.0.0.0/8"
 *                 action: "ALLOW"
 *                 audit_batch: "2024-01"
 *                 status: "ENABLE"
 *                 description: "Full update example"
 *             no_changes:
 *               summary: No changes example
 *               description: Send same values as current rule
 *               value:
 *                 rulename: "existing-rule-name"
 *                 firewall_name: "USER"
 *                 src: "192.168.1.0/24"
 *                 dst: "10.0.0.0/8"
 *                 action: "ALLOW"
 *                 audit_batch: "2024-01"
 *     responses:
 *       200:
 *         description: Rule updated successfully (or no changes detected)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rule'
 *             examples:
 *               updated:
 *                 summary: Rule with changes
 *                 value:
 *                   id: 1
 *                   rulename: "updated-rule-name"
 *                   firewall_name: "USER"
 *                   src: "192.168.1.0/24"
 *                   dst: "10.0.0.0/8"
 *                   action: "ALLOW"
 *                   audit_batch: "2024-01"
 *                   updated_at: "2024-01-15T10:30:00Z"
 *               no_changes:
 *                 summary: No changes detected
 *                 value:
 *                   id: 1
 *                   rulename: "original-rule-name"
 *                   firewall_name: "USER"
 *                   src: "192.168.1.0/24"
 *                   dst: "10.0.0.0/8"
 *                   action: "ALLOW"
 *                   audit_batch: "2024-01"
 *                   updated_at: "2024-01-15T09:00:00Z"
 *       400:
 *         description: Invalid input (validation errors)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required fields: rulename, src, dst, action, firewall_name"
 *       404:
 *         description: Rule not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Rule not found"
 *       409:
 *         description: Rule already exists with this name (unique constraint violation)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Rule already exists: USER - test-rule in audit batch 2024-01"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
// Update rule
router.put('/rules/:id', authorizePermissionJWT('rule.update'), ruleApi.updateRule);

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
router.delete('/rules/:id', authorizePermissionJWT('rule.delete'), ruleApi.deleteRule);

export default router;
