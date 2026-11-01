import {
  listTags as listTagsService,
  getAllTags as getAllTagsService,
  getTag as getTagService,
  findTagsByName,
  createTag as createTagService,
  updateTag as updateTagService,
  deleteTag as deleteTagService
} from '../../services/tagService.js';
import { ServiceError, HTTP_STATUS_BY_CODE } from '../../shared/errors.js';

function respondServiceError(err, res) {
  if (err instanceof ServiceError) {
    return res.status(HTTP_STATUS_BY_CODE[err.code] || 400).json({
      success: false,
      message: err.message
    });
  }
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
}

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
      const tags = await getAllTagsService();

      res.status(200).json({
        success: true,
        data: tags,
        count: tags.length
      });
    } catch (error) {
      console.error('Error fetching all tags:', error);
      respondServiceError(error, res);
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

      const tags = await findTagsByName(name);

      res.status(200).json({
        success: true,
        data: tags,
        count: tags.length
      });
    } catch (error) {
      console.error('Error finding tags:', error);
      respondServiceError(error, res);
    }
  }

  /**
   * Get tag by ID
   * @route GET /api/v1/tags/:id
   */
  static async getTagById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tag ID'
        });
      }

      const tag = await getTagService(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Tag retrieved successfully',
        data: tag
      });
    } catch (error) {
      console.error('Error fetching tag by ID:', error);
      respondServiceError(error, res);
    }
  }

  /**
   * Create new tag
   * @route POST /api/v1/tags
   */
  static async createTag(req, res) {
    try {
      const newTag = await createTagService(req.body || {});

      res.status(201).json({
        success: true,
        message: 'Tag created successfully',
        data: newTag
      });
    } catch (error) {
      console.error('Error creating tag:', error);
      respondServiceError(error, res);
    }
  }

  /**
   * Update tag (supports partial updates)
   * @route PUT /api/v1/tags/:id
   */
  static async updateTag(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tag ID'
        });
      }

      const updatedTag = await updateTagService(parseInt(id), req.body || {});

      res.status(200).json({
        success: true,
        message: 'Tag updated successfully',
        data: updatedTag
      });
    } catch (error) {
      console.error('Error updating tag:', error);
      respondServiceError(error, res);
    }
  }

  /**
   * Delete tag
   * @route DELETE /api/v1/tags/:id
   */
  static async deleteTag(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tag ID'
        });
      }

      await deleteTagService(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Tag deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting tag:', error);
      respondServiceError(error, res);
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

      const pageNum = Math.max(1, parseInt(page) || 1);
      const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20));

      const { items: tags, totalCount } = await listTagsService({ search, page: pageNum, pageSize: pageSizeNum });
      const totalPages = Math.ceil(totalCount / pageSizeNum);

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
      respondServiceError(error, res);
    }
  }
}

export default ApiTagController;
