// Swagger setup for Express API documentation
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { createRequire } from 'module';

// Read name/version from package.json so the API doc never drifts out of
// sync with the app's actual released version.
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

const apiSwaggerRouter = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Rule:
 *       type: object
 *       description: A firewall rule as returned by the API (table rulefirewall).
 *       properties:
 *         id: { type: integer }
 *         rulename: { type: string }
 *         firewall_name:
 *           type: string
 *           description: Value of the System Configuration list `firewall_name`.
 *         src_zone: { type: string, nullable: true }
 *         src: { type: string }
 *         src_detail: { type: string, nullable: true }
 *         dst_zone: { type: string, nullable: true }
 *         dst: { type: string }
 *         dst_detail: { type: string, nullable: true }
 *         services: { type: string, nullable: true }
 *         application: { type: string, nullable: true }
 *         url: { type: string, nullable: true }
 *         action:
 *           type: string
 *           description: |
 *             Action to take. Value of the System Configuration list `firewall_rule_action` (e.g. ALLOW, DENY, DROP, REJECT).
 *             Only active values can be set; a retired value is refused, except the
 *             record's current one, which an update may send back unchanged.
 *         status:
 *           type: string
 *           nullable: true
 *           description: Value of the System Configuration list `firewall_rule_status`.
 *         violation_type:
 *           type: string
 *           nullable: true
 *           description: Value of the System Configuration list `firewall_rule_violation_type`.
 *         violation_detail: { type: string, nullable: true }
 *         solution_proposal: { type: string, nullable: true }
 *         solution_confirm: { type: string, nullable: true }
 *         description: { type: string, nullable: true }
 *         audit_batch: { type: string, description: 'Audit batch; (rulename, firewall_name, audit_batch) is unique' }
 *         work_order: { type: string, nullable: true }
 *         raw_data: { type: string, nullable: true }
 *         ou_id: { type: integer, nullable: true }
 *         ou_name: { type: string, nullable: true }
 *         tags:
 *           type: array
 *           items: { type: object, properties: { id: { type: integer }, name: { type: string } } }
 *         contacts:
 *           type: array
 *           items: { type: object, properties: { id: { type: integer }, name: { type: string }, email: { type: string } } }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *         updated_by: { type: string, nullable: true }
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * tags:
 *   - name: Auth
 *     description: Sign in and get a JWT (the only endpoint without a token)
 *   - name: System
 *     description: Systems (applications / services of the organization)
 *   - name: Component
 *     description: Components of a system
 *   - name: Server
 *     description: Servers
 *   - name: Services
 *     description: Services running on servers (catalog)
 *   - name: Agents
 *     description: Agents installed on servers (catalog)
 *   - name: Device
 *     description: Network / security devices
 *   - name: Device Types
 *     description: Device types (catalog)
 *   - name: Platforms
 *     description: Operating systems / platforms (catalog)
 *   - name: Cluster
 *     description: Clusters - groups of IP addresses with a role each, linked to systems
 *   - name: IPAddress
 *     description: IP addresses
 *   - name: Subnet
 *     description: Subnets
 *   - name: Domain
 *     description: Domains
 *   - name: Rule
 *     description: Firewall rules
 *   - name: PentestRound
 *     description: Pentest rounds of systems / components
 *   - name: Contact
 *     description: Contacts (owners, managers)
 *   - name: OrganizationUnit
 *     description: Organization units
 *   - name: Tags
 *     description: Tags
 */

// Shown at the top of /api-docs (Markdown). Keep in sync with README "API Documentation".
const GUIDE = `
REST API of Open ASM. Base path: \`/api/v1\`. JSON in, JSON out.

### 1. Get a token
\`POST /api/v1/auth/login\` with \`{"username": "...", "password": "..."}\` returns \`{"token": "<JWT>"}\`.
The account must be a **local** account (LDAP accounts cannot get a token) whose
password has already been changed after the first login. Then click **Authorize**
above and paste the token (without "Bearer").

### 2. Call the API
Every other endpoint needs \`Authorization: Bearer <token>\`. The token lasts
\`JWT_EXPIRES_IN\` (default 8h) and carries the user's permissions **as they were at login**:
after a role change, log in again. A missing / expired token gives 401, a missing
permission 403.

### 3. Conventions
- **Lists**: \`?search=&page=1&pageSize=10\` (pageSize max 100) return
  \`{"data": [...], "pagination": {"page", "pageSize", "totalCount", "totalPages", "hasNext", "hasPrev"}}\`.
- **Updates (PUT)** are partial: fields left out keep their value; a link list that
  is sent (e.g. \`tags\`, \`contacts\`) replaces the current links.
- **Errors**: 400 validation, 401 token, 403 permission, 404 not found, 409 conflict
  (duplicate). Body \`{"success": false, "message": "..."}\` or, for IP addresses /
  subnets / domains / auth, \`{"error": "..."}\`.
- **Configured values** (status, type, location, position...): values of a System
  Configuration list. The \`.../config\` endpoints return the values that can be set.
  A **retired** value is refused, except the record's current value sent back unchanged.
- **Deletes** are refused (409) while a record is still used, e.g. an IP address
  assigned to a server or used by a cluster / service mapping.

### 4. Debugging an integration
System Configuration > Security & Logs > **API debug log** = on: every request is
written to the System Log (level debug) with its JSON body, secrets masked.
Switch it off when done.
`;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Open ASM API',
      version: pkg.version || '1.1.0',
      description: GUIDE,
    },
    servers: [
      {
        url: '/'
      }
    ],
    // every operation needs the JWT unless it says `security: []` (login)
    security: [{ bearerAuth: [] }],
  },
  // swagger.js first: its tags give the order of the sections
  apis: ['./src/api/swagger.js', './src/modules/**/api.routes.js'],
};

const specs = swaggerJsdoc(options);

apiSwaggerRouter.use('/', swaggerUi.serve, swaggerUi.setup(specs, {
  swaggerOptions: { persistAuthorization: true, docExpansion: 'none', filter: true, tryItOutEnabled: false },
}));

export default apiSwaggerRouter;
