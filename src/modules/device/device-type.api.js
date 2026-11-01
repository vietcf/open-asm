import DeviceType from './device-type.model.js';
import {
  getDeviceType as getDeviceTypeService,
  findDeviceTypesByName,
  createDeviceType as createDeviceTypeService,
  updateDeviceType as updateDeviceTypeService,
  deleteDeviceType as deleteDeviceTypeService
} from './device-type.service.js';
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

const apiDeviceTypeController = {};

// GET /api/v1/device-types - Get all device types
apiDeviceTypeController.getAllDeviceTypes = async (req, res) => {
  try {
    // Unbounded — no pagination in the original contract, so this stays a
    // direct model call rather than routing through the paginated service.
    const deviceTypes = await DeviceType.findAll();
    res.json({
      success: true,
      data: deviceTypes,
      count: deviceTypes.length
    });
  } catch (error) {
    console.error('Error fetching device types:', error);
    respondServiceError(error, res);
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

    const deviceType = await getDeviceTypeService(parseInt(id));

    res.json({
      success: true,
      data: deviceType
    });
  } catch (error) {
    console.error('Error fetching device type:', error);
    respondServiceError(error, res);
  }
};

// POST /api/v1/device-types - Create new device type
apiDeviceTypeController.createDeviceType = async (req, res) => {
  try {
    const deviceType = await createDeviceTypeService(req.body || {});
    res.status(201).json({
      success: true,
      message: 'Device type created successfully',
      data: deviceType
    });
  } catch (error) {
    console.error('Error creating device type:', error);
    respondServiceError(error, res);
  }
};

// PUT /api/v1/device-types/:id - Update device type (supports both full and partial updates)
apiDeviceTypeController.updateDeviceType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid device type ID is required'
      });
    }

    const updatedDeviceType = await updateDeviceTypeService(parseInt(id), req.body || {});

    res.json({
      success: true,
      message: 'Device type updated successfully',
      data: updatedDeviceType
    });
  } catch (error) {
    console.error('Error updating device type:', error);
    respondServiceError(error, res);
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

    await deleteDeviceTypeService(parseInt(id));

    res.json({
      success: true,
      message: 'Device type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting device type:', error);
    respondServiceError(error, res);
  }
};

// GET /api/v1/device-types/find - Find device types by exact name match
apiDeviceTypeController.findDeviceTypes = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search term "name" is required'
      });
    }

    const deviceTypes = await findDeviceTypesByName(name.trim());

    res.json({
      success: true,
      data: deviceTypes,
      count: deviceTypes.length
    });
  } catch (error) {
    console.error('Error finding device types:', error);
    respondServiceError(error, res);
  }
};

export default apiDeviceTypeController;
