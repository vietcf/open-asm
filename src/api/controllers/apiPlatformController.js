import Platform from '../../models/Platform.js';
import {
  getPlatform as getPlatformService,
  findPlatformsByName,
  createPlatform as createPlatformService,
  updatePlatform as updatePlatformService,
  deletePlatform as deletePlatformService
} from '../../services/platformService.js';
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

class ApiPlatformController {

  /**
   * Get all platforms
   */
  static async getAllPlatforms(req, res) {
    try {
      // Unbounded — no pagination in the original contract, so this stays a
      // direct model call rather than routing through the paginated service.
      const platforms = await Platform.findAll();
      res.status(200).json({
        success: true,
        data: platforms,
        count: platforms.length
      });
    } catch (error) {
      console.error('Error fetching platforms:', error);
      respondServiceError(error, res);
    }
  }

  /**
   * Get a single platform by ID
   */
  static async getPlatform(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid platform ID is required'
        });
      }

      const platform = await getPlatformService(parseInt(id));

      res.status(200).json({
        success: true,
        data: platform
      });
    } catch (error) {
      console.error('Error fetching platform:', error);
      respondServiceError(error, res);
    }
  }

  /**
   * Create a new platform
   */
  static async createPlatform(req, res) {
    try {
      const newPlatform = await createPlatformService(req.body || {});
      res.status(201).json({
        success: true,
        message: 'Platform created successfully',
        data: newPlatform
      });
    } catch (error) {
      console.error('Error creating platform:', error);
      respondServiceError(error, res);
    }
  }

  /**
   * Update a platform (supports partial updates)
   */
  static async updatePlatform(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid platform ID is required'
        });
      }

      const updatedPlatform = await updatePlatformService(parseInt(id), req.body || {});
      res.status(200).json({
        success: true,
        message: 'Platform updated successfully',
        data: updatedPlatform
      });
    } catch (error) {
      console.error('Error updating platform:', error);
      respondServiceError(error, res);
    }
  }

  /**
   * Delete a platform
   */
  static async deletePlatform(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid platform ID is required'
        });
      }

      await deletePlatformService(parseInt(id));
      res.status(200).json({
        success: true,
        message: 'Platform deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting platform:', error);
      respondServiceError(error, res);
    }
  }

  /**
   * Find platforms by exact name match
   */
  static async findPlatforms(req, res) {
    try {
      const { name } = req.query;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Search term "name" is required'
        });
      }

      const platforms = await findPlatformsByName(name.trim());
      res.status(200).json({
        success: true,
        data: platforms,
        count: platforms.length
      });
    } catch (error) {
      console.error('Error finding platforms:', error);
      respondServiceError(error, res);
    }
  }
}

export const apiPlatformController = ApiPlatformController;
