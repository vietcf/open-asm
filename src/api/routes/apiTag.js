import express from 'express';
import ApiTagController from '../controllers/apiTagController.js';

const router = express.Router();

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
router.get('/', ApiTagController.getAllTags);

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
router.get('/search', ApiTagController.searchTags);

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
router.get('/find', ApiTagController.findTags);

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
router.get('/:id', ApiTagController.getTagById);

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
router.post('/', ApiTagController.createTag);

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
router.put('/:id', ApiTagController.updateTag);

// ============================
// DELETE Routes
// ============================

/**
 * @swagger
 * /api/v1/tags/{id}:
 *   delete:
 *     summary: Delete tag
 *     description: Delete a tag by its ID. Cannot delete if it's being used by other objects.
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
 *       409:
 *         description: Cannot delete tag as it is being used by other objects
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
router.delete('/:id', ApiTagController.deleteTag);

export default router;
