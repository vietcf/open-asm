// REST routes of the organize module, mounted at /api/v1.
import express from 'express';
import contactApi from './contact.api.js';
import unitApi from './unit.api.js';
import tagApi from './tag.api.js';
import { authenticateJWT, authorizePermissionJWT } from '../../middlewares/jwtAuth.middleware.js';

const router = express.Router();
router.use(['/contacts', '/units', '/tags'], authenticateJWT);
/**
 * @swagger
 * tags:
 *   - name: Contact
 *     description: Contact management
 */

// ============================
// GET Routes
// ============================

/**
 * @swagger
 * /api/v1/contacts/search:
 *   get:
 *     summary: List/search contacts with pagination
 *     description: Search contacts by name, email, phone, position, or unit_name (case-insensitive partial matching). There is no separate "list all contacts" endpoint — omit `query` to get all contacts, paginated.
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: false
 *         description: Search keyword (searches in name, email, phone, position, unit_name fields). Omit to list all contacts.
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
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Contact'
 *       500:
 *         description: Server error
 */
router.get('/contacts/search', authorizePermissionJWT('contact.read'), contactApi.searchContacts);

/**
 * @swagger
 * /api/v1/contacts/find:
 *   get:
 *     summary: Find contacts by email or email prefix
 *     description: Search contacts by full email address or email prefix (part before @). Supports both exact email matching and prefix matching.
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Full email address or email prefix (part before @)
 *         example: "john.doe@company.com or john.doe"
 *     responses:
 *       200:
 *         description: Contacts retrieved successfully
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
 *                       description:
 *                         type: string
 *                 count:
 *                   type: integer
 *                   description: Number of contacts returned
 *       400:
 *         description: Search term "email" is required
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
router.get('/contacts/find', authorizePermissionJWT('contact.read'), contactApi.findContacts);

/**
 * @swagger
 * /api/v1/contacts/{id}:
 *   get:
 *     summary: Get a contact by ID
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Contact ID
 *     responses:
 *       200:
 *         description: Contact detail
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
 *                 unit_id:
 *                   type: integer
 *                 unit_name:
 *                   type: string
 *                 position:
 *                   type: string
 *                 description:
 *                   type: string
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/v1/contacts/config:
 *   get:
 *     summary: Get contact configuration options
 *     description: Retrieve dynamic enum values for contact fields from database configuration
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration options retrieved successfully
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
 *                     position:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Available position options loaded from database configuration (config_name contact_position)
 *       500:
 *         description: Server error
 */
router.get('/contacts/config', authorizePermissionJWT('contact.read'), contactApi.getConfig);

router.get('/contacts/:id', authorizePermissionJWT('contact.read'), contactApi.getContactById);

// ============================
// POST Routes
// ============================

/**
 * @swagger
 * /api/v1/contacts:
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
 *             $ref: '#/components/schemas/ContactInput'
 *     responses:
 *       201:
 *         description: Contact created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Contact already exists with this email
 *       500:
 *         description: Server error
 */
router.post('/contacts', authorizePermissionJWT('contact.create'), contactApi.createContact);

// ============================
// PUT Routes
// ============================

/**
 * @swagger
 * /api/v1/contacts/{id}:
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
 *         description: Contact ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactUpdateInput'
 *     responses:
 *       200:
 *         description: Contact updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Contact not found
 *       409:
 *         description: Contact already exists with this email
 *       500:
 *         description: Server error
 */
router.put('/contacts/:id', authorizePermissionJWT('contact.update'), contactApi.updateContact);

// ============================
// DELETE Routes
// ============================

/**
 * @swagger
 * /api/v1/contacts/{id}:
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
 *         description: Contact ID
 *     responses:
 *       204:
 *         description: Contact deleted
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Server error
 */
router.delete('/contacts/:id', authorizePermissionJWT('contact.delete'), contactApi.deleteContact);

/**
 * @swagger
 * components:
 *   schemas:
 *     Contact:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Contact ID
 *         name:
 *           type: string
 *           description: Contact name
 *         email:
 *           type: string
 *           format: email
 *           description: Contact email address
 *         phone:
 *           type: string
 *           description: Contact phone number
 *         position:
 *           type: string
 *           description: Contact position (values loaded dynamically from database configuration, config_name contact_position)
 *         unit_id:
 *           type: integer
 *           nullable: true
 *           description: Organization unit ID
 *         unit_name:
 *           type: string
 *           nullable: true
 *           description: Organization unit name. Only present on GET /contacts/{id} and the search/find endpoints — create and update responses do not include it.
 *         description:
 *           type: string
 *           nullable: true
 *           description: Additional description for the contact
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *       required:
 *         - id
 *         - name
 *         - email
 *         - position
 *     ContactInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Contact name
 *         email:
 *           type: string
 *           format: email
 *           description: Contact email address
 *         phone:
 *           type: string
 *           description: Contact phone number
 *         position:
 *           type: string
 *           description: Contact position (values loaded dynamically from database configuration, config_name contact_position)
 *         unit_id:
 *           type: integer
 *           nullable: true
 *           description: Organization unit ID
 *         description:
 *           type: string
 *           nullable: true
 *           description: Additional description for the contact
 *       required:
 *         - name
 *         - email
 *     ContactUpdateInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Contact name
 *         email:
 *           type: string
 *           format: email
 *           description: Contact email address
 *         phone:
 *           type: string
 *           description: Contact phone number
 *         position:
 *           type: string
 *           description: Contact position (values loaded dynamically from database configuration, config_name contact_position)
 *         unit_id:
 *           type: integer
 *           nullable: true
 *           description: Organization unit ID
 *         description:
 *           type: string
 *           nullable: true
 *           description: Additional description for the contact
 *       description: All fields are optional for partial updates
 */

/**
 * @swagger
 * /api/v1/units:
 *   get:
 *     summary: List organization units (with filter, pagination)
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by unit name, code, or description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "Page number (default: 1)"
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: "Page size (default: 20)"
 *     responses:
 *       200:
 *         description: List of organization units
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
 *                 units:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationUnit'
 */
router.get('/units', authorizePermissionJWT('unit.read'), unitApi.listUnits);

/**
 * @swagger
 * /api/v1/units/find:
 *   get:
 *     summary: Find units by exact name match
 *     description: Search units by exact name matching. Requires a search term.
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit name to search for (exact match, case-insensitive)
 *     responses:
 *       200:
 *         description: Units retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationUnit'
 *                 count:
 *                   type: integer
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
 *                   example: "Search term 'name' is required"
 *       500:
 *         description: Internal server error
 */
router.get('/units/find', authorizePermissionJWT('unit.read'), unitApi.findUnits);

/**
 * @swagger
 * /api/v1/units/{id}:
 *   get:
 *     summary: Get a single organization unit by ID
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization unit ID
 *     responses:
 *       200:
 *         description: Organization unit object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrganizationUnit'
 *       404:
 *         description: Not found
 */
router.get('/units/:id', authorizePermissionJWT('unit.read'), unitApi.getUnit);

/**
 * @swagger
 * /api/v1/units:
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
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Unit name (required, unique, case-insensitive)
 *               code:
 *                 type: string
 *                 description: Unit code (optional)
 *               description:
 *                 type: string
 *                 description: Description (optional)
 *     responses:
 *       201:
 *         description: Created organization unit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrganizationUnit'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate unit name
 */
router.post('/units', authorizePermissionJWT('unit.create'), unitApi.createUnit);

/**
 * @swagger
 * /api/v1/units/{id}:
 *   put:
 *     summary: Update an organization unit
 *     description: Partial update — only fields present in the request body are changed; name is not required unless you intend to change it.
 *     tags: [OrganizationUnit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization unit ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Unit name (unique, case-insensitive) — omit to leave unchanged
 *               code:
 *                 type: string
 *                 description: Unit code (optional)
 *               description:
 *                 type: string
 *                 description: Description (optional)
 *     responses:
 *       200:
 *         description: Updated organization unit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrganizationUnit'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       409:
 *         description: Duplicate unit name
 */
router.put('/units/:id', authorizePermissionJWT('unit.update'), unitApi.updateUnit);

/**
 * @swagger
 * /api/v1/units/{id}:
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
 *         description: Organization unit ID
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
router.delete('/units/:id', authorizePermissionJWT('unit.delete'), unitApi.deleteUnit);

/**
 * @swagger
 * tags:
 *   - name: OrganizationUnit
 *     description: API for managing organization units
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     OrganizationUnit:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         code:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           readOnly: true
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Tag:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           readOnly: true
 *           description: Unique identifier for the tag
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 128
 *           description: Name of the tag (must be unique)
 *         description:
 *           type: string
 *           nullable: true
 *           description: Optional description of the tag
 *         created_at:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *           description: Last update timestamp
 *       example:
 *         id: 1
 *         name: "Production"
 *         description: "Production environment tag"
 *         created_at: "2024-01-15T10:30:00Z"
 *         updated_at: "2024-01-15T10:30:00Z"
 *     
 *     TagInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 128
 *           description: Name of the tag (must be unique)
 *         description:
 *           type: string
 *           nullable: true
 *           description: Optional description of the tag
 *       example:
 *         name: "Production"
 *         description: "Production environment tag"
 *     
 *     TagUpdateInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 128
 *           description: Name of the tag (must be unique)
 *         description:
 *           type: string
 *           nullable: true
 *           description: Optional description of the tag
 *       example:
 *         name: "Production"
 *         description: "Production environment tag"
 *     
 *     TagResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the request was successful
 *         message:
 *           type: string
 *           description: Response message
 *         data:
 *           $ref: '#/components/schemas/Tag'
 *     
 *     TagListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the request was successful
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Tag'
 *         count:
 *           type: integer
 *           description: Number of tags returned
 *     
 *     TagSearchResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the request was successful
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Tag'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               description: Current page number
 *             pageSize:
 *               type: integer
 *               description: Number of items per page
 *             totalItems:
 *               type: integer
 *               description: Total number of items
 *             totalPages:
 *               type: integer
 *               description: Total number of pages
 *             hasNext:
 *               type: boolean
 *               description: Whether there is a next page
 *             hasPrev:
 *               type: boolean
 *               description: Whether there is a previous page
 *         search:
 *           type: object
 *           properties:
 *             query:
 *               type: string
 *               description: Search query used
 *             sortBy:
 *               type: string
 *               description: Field used for sorting
 *             sortOrder:
 *               type: string
 *               description: Sort order (asc/desc)
 *     
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           description: Error message
 *         error:
 *           type: string
 *           description: Detailed error information
 *   
 *   tags:
 *     - name: Tags
 *       description: Tag management operations
 */

// ============================
// GET Routes
// ============================

/**
 * @swagger
 * /api/v1/tags:
 *   get:
 *     summary: Get all tags
 *     description: Retrieve a list of all tags in the system
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagListResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/tags', authorizePermissionJWT('tag.read'), tagApi.getAllTags);

/**
 * @swagger
 * /api/v1/tags/search:
 *   get:
 *     summary: Search tags with pagination
 *     description: Search tags by name or description with pagination support
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search keyword (searches in name and description fields)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagSearchResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/tags/search', authorizePermissionJWT('tag.read'), tagApi.searchTags);

/**
 * @swagger
 * /api/v1/tags/find:
 *   get:
 *     summary: Find tags by exact name match
 *     description: Search tags by exact name matching. Requires a search term.
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Tag name to search for (exact match)
 *     responses:
 *       200:
 *         description: Tags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagListResponse'
 *       400:
 *         description: Search term "name" is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/tags/find', authorizePermissionJWT('tag.read'), tagApi.findTags);

/**
 * @swagger
 * /api/v1/tags/{id}:
 *   get:
 *     summary: Get tag by ID
 *     description: Retrieve a specific tag by its unique identifier
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Tag ID
 *     responses:
 *       200:
 *         description: Tag retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagResponse'
 *       400:
 *         description: Invalid tag ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Tag not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/tags/:id', authorizePermissionJWT('tag.read'), tagApi.getTagById);

// ============================
// POST Routes
// ============================

/**
 * @swagger
 * /api/v1/tags:
 *   post:
 *     summary: Create new tag
 *     description: Create a new tag with name and optional description
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TagInput'
 *     responses:
 *       201:
 *         description: Tag created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagResponse'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Tag with this name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/tags', authorizePermissionJWT('tag.create'), tagApi.createTag);

// ============================
// PUT Routes
// ============================

/**
 * @swagger
 * /api/v1/tags/{id}:
 *   put:
 *     summary: Update tag
 *     description: Update a tag with new data. Supports both full and partial updates - only provided fields will be updated.
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Tag ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TagUpdateInput'
 *           examples:
 *             updateName:
 *               summary: Update only name
 *               value:
 *                 name: "Updated Production"
 *             updateDescription:
 *               summary: Update only description
 *               value:
 *                 description: "Updated production environment tag"
 *             updateBoth:
 *               summary: Update both fields
 *               value:
 *                 name: "Updated Production"
 *                 description: "Updated production environment tag"
 *     responses:
 *       200:
 *         description: Tag updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagResponse'
 *       400:
 *         description: Invalid input data, tag ID, or no fields provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Tag not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Tag with this name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/tags/:id', authorizePermissionJWT('tag.update'), tagApi.updateTag);

// ============================
// DELETE Routes
// ============================

/**
 * @swagger
 * /api/v1/tags/{id}:
 *   delete:
 *     summary: Delete tag
 *     description: Delete a tag by its ID. This also removes the tag from every object it's currently attached to (device, system, component, rule, etc.) — there is no "in use" protection.
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Tag ID
 *     responses:
 *       200:
 *         description: Tag deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Tag deleted successfully"
 *       400:
 *         description: Invalid tag ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Tag not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/tags/:id', authorizePermissionJWT('tag.delete'), tagApi.deleteTag);

export default router;
