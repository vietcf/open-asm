import DeviceType from '../../models/DeviceType.js';

const apiDeviceTypeController = {};

// GET /api/v1/device-types - Get all device types
apiDeviceTypeController.getAllDeviceTypes = async (req, res) => {
  try {
    const deviceTypes = await DeviceType.findAll();
    res.json({
      success: true,
      data: deviceTypes,
      count: deviceTypes.length
    });
  } catch (error) {
    console.error('Error fetching device types:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// GET /api/v1/device-types/:id - Get device type by ID
apiDeviceTypeController.getDeviceTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid device type ID is required'
      });
    }

    const deviceType = await DeviceType.findById(parseInt(id));
    
    if (!deviceType) {
      return res.status(404).json({
        success: false,
        message: 'Device type not found'
      });
    }

    res.json({
      success: true,
      data: deviceType
    });
  } catch (error) {
    console.error('Error fetching device type:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// POST /api/v1/device-types - Create new device type
apiDeviceTypeController.createDeviceType = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Device type name is required and must be a non-empty string'
      });
    }

    const trimmedName = name.trim();

    // Check if name already exists
    const nameExists = await DeviceType.checkNameExists(trimmedName);
    if (nameExists) {
      return res.status(409).json({
        success: false,
        message: 'A device type with this name already exists'
      });
    }

    const deviceType = await DeviceType.create({
      name: trimmedName,
      description: description || null
    });

    res.status(201).json({
      success: true,
      message: 'Device type created successfully',
      data: deviceType
    });
  } catch (error) {
    console.error('Error creating device type:', error);
    
    // Handle database constraint errors
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        message: 'A device type with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// PUT /api/v1/device-types/:id - Update device type (supports both full and partial updates)
apiDeviceTypeController.updateDeviceType = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid device type ID is required'
      });
    }

    // Check if device type exists
    const existingDeviceType = await DeviceType.findById(parseInt(id));
    if (!existingDeviceType) {
      return res.status(404).json({
        success: false,
        message: 'Device type not found'
      });
    }

    // Validate updates
    const allowedFields = ['name', 'description'];
    const invalidFields = Object.keys(updates).filter(key => !allowedFields.includes(key));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one field must be provided for update'
      });
    }

    // Validate name if provided
    if (updates.name !== undefined) {
      if (!updates.name || typeof updates.name !== 'string' || updates.name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Device type name must be a non-empty string'
        });
      }

      const trimmedName = updates.name.trim();
      
      // Check if name already exists (excluding current record)
      const nameExists = await DeviceType.checkNameExists(trimmedName, parseInt(id));
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: 'A device type with this name already exists'
        });
      }
      
      updates.name = trimmedName;
    }

    const updatedDeviceType = await DeviceType.update(parseInt(id), updates);

    res.json({
      success: true,
      message: 'Device type updated successfully',
      data: updatedDeviceType
    });
  } catch (error) {
    console.error('Error updating device type:', error);
    
    // Handle database constraint errors
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        message: 'A device type with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// DELETE /api/v1/device-types/:id - Delete device type
apiDeviceTypeController.deleteDeviceType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid device type ID is required'
      });
    }

    // Check if device type exists
    const existingDeviceType = await DeviceType.findById(parseInt(id));
    if (!existingDeviceType) {
      return res.status(404).json({
        success: false,
        message: 'Device type not found'
      });
    }

    await DeviceType.remove(parseInt(id));

    res.json({
      success: true,
      message: 'Device type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting device type:', error);
    
    // Handle foreign key constraint errors
    if (error.code === '23503') {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete device type as it is being used by existing devices'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// GET /api/v1/device-types/find - Find device types by exact name match
apiDeviceTypeController.findDeviceTypes = async (req, res) => {
  try {
    const { name } = req.query;

    // Require search term
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search term "name" is required'
      });
    }

    // Use exact name matching
    const deviceTypes = await DeviceType.findByNameExact(name.trim());

    res.json({
      success: true,
      data: deviceTypes,
      count: deviceTypes.length
    });
  } catch (error) {
    console.error('Error finding device types:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export default apiDeviceTypeController;
