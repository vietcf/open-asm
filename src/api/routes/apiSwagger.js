// Swagger setup for Express API documentation
const express = require('express');
const apiSwaggerRouter = express.Router();
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

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
 *           enum: [ALLOW, DENY]
 *         description:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *     Contact:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         phone:
 *           type: string
 *         position:
 *           type: string
 *         unit_id:
 *           type: integer
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
 *   - name: Auth
 *     description: Authentication management
 */

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ASG Project API',
      version: '1.0.0',
      description: 'API documentation for ASG Project',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
  },
  apis: ['./src/api/routes/**/*.js'],
};

const specs = swaggerJsdoc(options);

apiSwaggerRouter.use('/', swaggerUi.serve, swaggerUi.setup(specs));

module.exports = apiSwaggerRouter;
