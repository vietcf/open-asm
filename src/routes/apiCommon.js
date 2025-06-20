/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */

// API routes for Contact, Organization Unit (OU), Rule, Server, and IP Address
const express = require('express');
const router = express.Router();
const apiContactController = require('../controllers/apiContactController');
const apiUnitController = require('../controllers/apiUnitController');
const apiRuleController = require('../controllers/apiRuleController');
const apiAuthController = require('../controllers/apiAuthController');
const { authenticate, authorizeRole, authorizePermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   - name: Contact
 *     description: Contact management
 *   - name: OrganizationUnit
 *     description: Organization Unit (OU) management
 *   - name: Rule
 *     description: Firewall Rule management
 *   - name: Server
 *     description: Server management
 *   - name: IpAddress
 *     description: IP Address management
 *   - name: Auth
 *     description: Authentication management
 */

// --- CONTACT API ---
/*
 * @swagger
 * /api/contacts:
 *   get:
 *     summary: Get all contacts
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of contacts
 *       401:
 *         description: Unauthorized - JWT missing or invalid
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
// router.get('/contacts', apiContactController.listContacts);

/*
 * @swagger
 * /api/contacts/search:
 *   get:
 *     summary: Search contacts
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: true
 *         description: Search keyword for contact name, email, phone, position, or org unit
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         required: false
 *         description: Page size (default 20, max 100)
 *     responses:
 *       200:
 *         description: Paginated list of matching contacts
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
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       position:
 *                         type: string
 *                       unit_id:
 *                         type: integer
 *                       unit_name:
 *                         type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized - JWT missing or invalid
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: No contacts found
 *       500:
 *         description: Internal server error
 */
router.get('/contacts/search', authorizePermission('contact.read'), apiContactController.searchContacts);

/*
 * @swagger
 * /api/contacts/{id}:
 *   get:
 *     summary: Get contact by ID
 *     tags: [Contact]
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
 *         description: Contact detail
 *       401:
 *         description: Unauthorized - JWT missing or invalid
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 */
// router.get('/contacts/:id', apiContactController.getContact);

/**
 * @swagger
 * /api/contacts:
 *   post:
 *     summary: Create a new contact
 *     tags: [Contact]
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
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Must be a valid email address
 *               phone:
 *                 type: string
 *               position:
 *                 type: string
 *                 enum: [MANAGER, STAFF]
 *                 default: STAFF
 *                 description: If not provided, defaults to STAFF
 *               unit_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Contact created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 position:
 *                   type: string
 *                 unit_id:
 *                   type: integer
 *       400:
 *         description: Name, email, and position are required, invalid email format, or invalid position value
 *       401:
 *         description: Unauthorized - JWT missing or invalid
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       409:
 *         description: Contact already exists with this email
 *       500:
 *         description: Internal server error
 */
router.post('/contacts', authorizePermission('contact.create'), apiContactController.createContact);

/*
 * @swagger
 * /api/contacts/{id}:
 *   put:
 *     summary: Update a contact
 *     tags: [Contact]
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
 *     responses:
 *       200:
 *         description: Contact updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized - JWT missing or invalid
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 */
// router.put('/contacts/:id', apiContactController.updateContact);

/*
 * @swagger
 * /api/contacts/{id}:
 *   delete:
 *     summary: Delete a contact
 *     tags: [Contact]
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
 *         description: Contact deleted
 *       401:
 *         description: Unauthorized - JWT missing or invalid
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 */
// router.delete('/contacts/:id', apiContactController.deleteContact);

/**
 * @swagger
 * /api/contacts/search:
 *   get:
 *     summary: Search contacts
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: true
 *         description: Search keyword for contact name, email, phone, position, or org unit
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         required: false
 *         description: Page size (default 20, max 100)
 *     responses:
 *       200:
 *         description: Paginated list of matching contacts
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
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       position:
 *                         type: string
 *                       unit_id:
 *                         type: integer
 *                       unit_name:
 *                         type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized - JWT missing or invalid
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: No contacts found
 *       500:
 *         description: Internal server error
 */
router.get('/contacts/search', authorizePermission('contact.read'), apiContactController.searchContacts);

// --- OU API ---
/**
 * @swagger
 * /api/units:
 *   get:
 *     summary: Get all organization units
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of OUs
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/units', apiUnitController.listUnits);

/**
 * @swagger
 * /api/units/{id}:
 *   get:
 *     summary: Get organization unit by ID
 *     tags: [OrganizationUnit]
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
 *         description: OU detail
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/units/:id', apiUnitController.getUnit);

/**
 * @swagger
 * /api/units:
 *   post:
 *     summary: Create a new organization unit
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: OU created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Conflict
 *       500:
 *         description: Internal server error
 */
router.post('/units', apiUnitController.createUnit);

/**
 * @swagger
 * /api/units/{id}:
 *   put:
 *     summary: Update an organization unit
 *     tags: [OrganizationUnit]
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
 *     responses:
 *       200:
 *         description: OU updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       409:
 *         description: Conflict
 *       500:
 *         description: Internal server error
 */
router.put('/units/:id', apiUnitController.updateUnit);

/**
 * @swagger
 * /api/units/{id}:
 *   delete:
 *     summary: Delete an organization unit
 *     tags: [OrganizationUnit]
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
 *         description: OU deleted
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.delete('/units/:id', apiUnitController.deleteUnit);

// --- RULE API ---
/**
 * @swagger
 * /api/rules:
 *   get:
 *     summary: Get all firewall rules
 *     tags: [Rule]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of rules
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/rules', apiRuleController.listRules);

/**
 * @swagger
 * /api/rules/{id}:
 *   get:
 *     summary: Get firewall rule by ID
 *     tags: [Rule]
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
 *         description: Rule detail
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/rules/:id', apiRuleController.getRule);

/**
 * @swagger
 * /api/rules:
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
 *     responses:
 *       201:
 *         description: Rule created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Conflict
 *       500:
 *         description: Internal server error
 */
router.post('/rules', apiRuleController.createRule);

/**
 * @swagger
 * /api/rules/{id}:
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Rule updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       409:
 *         description: Conflict
 *       500:
 *         description: Internal server error
 */
router.put('/rules/:id', apiRuleController.updateRule);

/**
 * @swagger
 * /api/rules/{id}:
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
 *     responses:
 *       204:
 *         description: Rule deleted
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.delete('/rules/:id', apiRuleController.deleteRule);

// --- SERVER API ---
/**
 * @swagger
 * /api/servers:
 *   get:
 *     summary: Get all servers
 *     tags: [Server]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of servers
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/servers', (req, res) => res.json([])); // TODO: Replace with real controller

/**
 * @swagger
 * /api/servers:
 *   post:
 *     summary: Create a new server
 *     tags: [Server]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Server created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Conflict
 *       500:
 *         description: Internal server error
 */
router.post('/servers', (req, res) => res.status(201).json({ message: 'Server created' }));

/**
 * @swagger
 * /api/servers/{id}:
 *   get:
 *     summary: Get server by ID
 *     tags: [Server]
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
 *         description: Server detail
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/servers/:id', (req, res) => res.json({ id: req.params.id })); // TODO: Replace with real controller

/**
 * @swagger
 * /api/servers/{id}:
 *   put:
 *     summary: Update a server
 *     tags: [Server]
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
 *     responses:
 *       200:
 *         description: Server updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       409:
 *         description: Conflict
 *       500:
 *         description: Internal server error
 */
router.put('/servers/:id', (req, res) => res.json({ message: 'Server updated', id: req.params.id }));

/**
 * @swagger
 * /api/servers/{id}:
 *   delete:
 *     summary: Delete a server
 *     tags: [Server]
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
 *         description: Server deleted
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.delete('/servers/:id', (req, res) => res.status(204).send());

// --- IP ADDRESS API ---
/**
 * @swagger
 * /api/ip-addresses:
 *   get:
 *     summary: Get all IP addresses
 *     tags: [IpAddress]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of IP addresses
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/ip-addresses', (req, res) => res.json([])); // TODO: Replace with real controller

/**
 * @swagger
 * /api/ip-addresses:
 *   post:
 *     summary: Create a new IP address
 *     tags: [IpAddress]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: IP address created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Conflict
 *       500:
 *         description: Internal server error
 */
router.post('/ip-addresses', (req, res) => res.status(201).json({ message: 'IP address created' }));

/**
 * @swagger
 * /api/ip-addresses/{id}:
 *   get:
 *     summary: Get IP address by ID
 *     tags: [IpAddress]
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
 *         description: IP address detail
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/ip-addresses/:id', (req, res) => res.json({ id: req.params.id })); // TODO: Replace with real controller

/**
 * @swagger
 * /api/ip-addresses/{id}:
 *   put:
 *     summary: Update an IP address
 *     tags: [IpAddress]
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
 *     responses:
 *       200:
 *         description: IP address updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       409:
 *         description: Conflict
 *       500:
 *         description: Internal server error
 */
router.put('/ip-addresses/:id', (req, res) => res.json({ message: 'IP address updated', id: req.params.id }));

/**
 * @swagger
 * /api/ip-addresses/{id}:
 *   delete:
 *     summary: Delete an IP address
 *     tags: [IpAddress]
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
 *         description: IP address deleted
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.delete('/ip-addresses/:id', (req, res) => res.status(204).send());

// --- AUTH API ---
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login to get JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       400:
 *         description: Username and password required
 *       401:
 *         description: Invalid credentials
 */
router.post('/auth/login', apiAuthController.login);

// Ví dụ: bảo vệ toàn bộ API (hoặc từng route)
// router.use(authenticate); // Bảo vệ tất cả route bên dưới
// router.post('/servers', authenticate, authorizeRole('admin'), ...);

module.exports = router;
