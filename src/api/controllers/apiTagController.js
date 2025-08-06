import Tag from '../../models/Tag.js';

/**
 * Tag API Controller
 * Handles all tag-related API operations with comprehensive error handling
 */
class ApiTagController {
  /**
   * Get all tags
   * @route GET /api/v1/tags
   */
  static async getAllTags(req, res) {
    try {
      const tags = await Tag.findAll();
      
      res.status(200).json({
        success: true,
        data: tags,
        count: tags.length
      });
    } catch (error) {
      console.error('Error fetching all tags:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Find tags by exact name match
   * @route GET /api/v1/tags/find
   */
  static async findTags(req, res) {
    try {
      const { name } = req.query;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Search term "name" is required'
        });
      }

      // Use exact name matching
      const tags = await Tag.findByNameExact(name);

      res.status(200).json({
        success: true,
        data: tags,
        count: tags.length
      });
    } catch (error) {
      console.error('Error finding tags:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get tag by ID
   * @route GET /api/v1/tags/:id
   */
  static async getTagById(req, res) {
    try {
      const { id } = req.params;
      
      // Validate ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tag ID'
        });
      }

      const tag = await Tag.findById(parseInt(id));
      
      if (!tag) {
        return res.status(404).json({
          success: false,
          message: 'Tag not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Tag retrieved successfully',
        data: tag
      });
    } catch (error) {
      console.error('Error fetching tag by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Create new tag
   * @route POST /api/v1/tags
   */
  static async createTag(req, res) {
    try {
      const { name, description } = req.body;

      // Validate required fields
      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Tag name is required'
        });
      }

      // Check for existing tag with same name (case-insensitive)
      const existingTags = await Tag.findByNameExact(name);

      if (existingTags.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Tag with this name already exists'
        });
      }

      const newTag = await Tag.create({
        name: name.trim(),
        description: description?.trim() || null
      });

      res.status(201).json({
        success: true,
        message: 'Tag created successfully',
        data: newTag
      });
    } catch (error) {
      console.error('Error creating tag:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Tag with this name already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Update tag (supports partial updates)
   * @route PUT /api/v1/tags/:id
   */
  static async updateTag(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      // Validate ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tag ID'
        });
      }

      // Check if tag exists
      const existingTag = await Tag.findById(parseInt(id));
      if (!existingTag) {
        return res.status(404).json({
          success: false,
          message: 'Tag not found'
        });
      }

      // Validate that at least one field is provided
      if (!name && description === undefined) {
        return res.status(400).json({
          success: false,
          message: 'At least one field (name or description) must be provided'
        });
      }

      // Prepare update data with existing values as defaults
      const updateData = {
        name: name ? name.trim() : existingTag.name,
        description: description !== undefined ? (description?.trim() || null) : existingTag.description
      };

      // Check for name conflicts if name is being changed
      if (name && name.toLowerCase() !== existingTag.name.toLowerCase()) {
        const existingTags = await Tag.findByNameExact(name);
        const nameExists = existingTags.some(tag => tag.id !== parseInt(id));

        if (nameExists) {
          return res.status(409).json({
            success: false,
            message: 'Tag with this name already exists'
          });
        }
      }

      const updatedTag = await Tag.update(parseInt(id), updateData);

      res.status(200).json({
        success: true,
        message: 'Tag updated successfully',
        data: updatedTag
      });
    } catch (error) {
      console.error('Error updating tag:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Tag with this name already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Delete tag
   * @route DELETE /api/v1/tags/:id
   */
  static async deleteTag(req, res) {
    try {
      const { id } = req.params;

      // Validate ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tag ID'
        });
      }

      // Check if tag exists
      const existingTag = await Tag.findById(parseInt(id));
      if (!existingTag) {
        return res.status(404).json({
          success: false,
          message: 'Tag not found'
        });
      }

      await Tag.delete(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Tag deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting tag:', error);

      // Handle foreign key constraint violations
      if (error.code === '23503') {
        return res.status(409).json({
          success: false,
          message: 'Cannot delete tag as it is being used by other objects'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Search tags with pagination
   * @route GET /api/v1/tags/search
   */
  static async searchTags(req, res) {
    try {
      const { 
        search = '', 
        page = 1, 
        pageSize = 20 
      } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page) || 1);
      const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20));

      // Get total count for pagination
      const totalCount = await Tag.countAll(search);
      const totalPages = Math.ceil(totalCount / pageSizeNum);

      // Get tags for current page
      const tags = await Tag.findPage(pageNum, pageSizeNum, search);

      res.status(200).json({
        success: true,
        data: tags,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          totalItems: totalCount,
          totalPages: totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        },
        search: {
          query: search,
          sortBy: 'id',
          sortOrder: 'asc'
        }
      });
    } catch (error) {
      console.error('Error searching tags:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

export default ApiTagController;
