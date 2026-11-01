// Swagger setup for Express API documentation
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { createRequire } from 'module';

// Read name/version from package.json so the API doc never drifts out of
// sync with the app's actual released version.
const require = createRequire(import.meta.url);
const pkg = require('../../../package.json');

const apiSwaggerRouter = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Rule:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         action:
 *           type: string
 *           description: |
 *             Action to take. Values are dynamically loaded from database config table 
 *             with config_name = 'firewall_rule_action'. Example values: ALLOW, DENY, DROP, REJECT.
 *             Must select from the configured list in the system.
 *         description:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 * tags:
 *   - name: Contact
 *     description: Contact management
 *   - name: OrganizationUnit
 *     description: Organization Unit (OU) management
 *   - name: Rule
 *     description: Firewall Rule management
 *   - name: Server
 *     description: Server management
 *   - name: IPAddress
 *     description: API for managing IP addresses
 *   - name: Device
 *     description: Device management
 *   - name: Domain
 *     description: API for managing domains
 *   - name: Auth
 *     description: Authentication management
 */

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Open ASM API',
      version: pkg.version || '1.1.0',
      description: 'API documentation for Open ASM (Asset Security Management)',
    },
    servers: [
      {
        url: '/'
      }
    ],
  },
  apis: ['./src/api/routes/**/*.js', './src/modules/**/api.routes.js'],
};

const specs = swaggerJsdoc(options);

apiSwaggerRouter.use('/', swaggerUi.serve, swaggerUi.setup(specs));

export default apiSwaggerRouter;
