import Platform from '../../models/Platform.js';

class ApiPlatformController {
  
  /**
   * Get all platforms
   */
  static async getAllPlatforms(req, res) {
    try {
      const platforms = await Platform.findAll();
      res.status(200).json(platforms);
    } catch (error) {
      console.error('Error fetching platforms:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get a single platform by ID
   */
  static async getPlatform(req, res) {
    try {
      const { id } = req.params;
      
      // Validate ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid platform ID' });
      }

      const platform = await Platform.findById(parseInt(id));
      
      if (!platform) {
        return res.status(404).json({ error: 'Platform not found' });
      }

      res.status(200).json(platform);
    } catch (error) {
      console.error('Error fetching platform:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create a new platform
   */
  static async createPlatform(req, res) {
    try {
      const { name, description } = req.body;

      // Validate required fields
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Platform name is required' });
      }

      // Check if platform name already exists
      const nameExists = await Platform.checkNameExists(name.trim());
      if (nameExists) {
        return res.status(409).json({ error: 'Platform name already exists' });
      }

      // Create platform
      const platformData = {
        name: name.trim(),
        description: description?.trim() || null
      };

      const newPlatform = await Platform.create(platformData);
      res.status(201).json(newPlatform);
    } catch (error) {
      console.error('Error creating platform:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update a platform (supports partial updates)
   */
  static async updatePlatform(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid platform ID' });
      }

      const platformId = parseInt(id);

      // Check if platform exists
      const existingPlatform = await Platform.findById(platformId);
      if (!existingPlatform) {
        return res.status(404).json({ error: 'Platform not found' });
      }

      // Validate update data
      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No update data provided' });
      }

      // Trim string values and filter out empty strings
      const cleanedData = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed !== '') {
              cleanedData[key] = trimmed;
            }
          } else {
            cleanedData[key] = value;
          }
        }
      }

      // Validate name if provided
      if (cleanedData.name && !cleanedData.name.trim()) {
        return res.status(400).json({ error: 'Platform name cannot be empty' });
      }

      if (Object.keys(cleanedData).length === 0) {
        return res.status(400).json({ error: 'No valid update data provided' });
      }

      try {
        const updatedPlatform = await Platform.update(platformId, cleanedData);
        res.status(200).json(updatedPlatform);
      } catch (updateError) {
        if (updateError.message === 'Platform name already exists') {
          return res.status(409).json({ error: 'Platform name already exists' });
        }
        throw updateError;
      }
    } catch (error) {
      console.error('Error updating platform:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete a platform
   */
  static async deletePlatform(req, res) {
    try {
      const { id } = req.params;

      // Validate ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid platform ID' });
      }

      const platformId = parseInt(id);

      // Check if platform exists
      const existingPlatform = await Platform.findById(platformId);
      if (!existingPlatform) {
        return res.status(404).json({ error: 'Platform not found' });
      }

      await Platform.remove(platformId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting platform:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Find platforms by exact name match
   */
  static async findPlatforms(req, res) {
    try {
      const { name } = req.query;

      // Require search term
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Search term "name" is required' });
      }

      // Use exact name matching
      const platforms = await Platform.findByNameExact(name.trim());
      res.status(200).json(platforms);
    } catch (error) {
      console.error('Error finding platforms:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const apiPlatformController = ApiPlatformController;
