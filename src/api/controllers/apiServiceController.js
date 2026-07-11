import Service from '../../models/Service.js';
import {
  getService as getServiceService,
  findServicesByName,
  createService as createServiceService,
  updateService as updateServiceService,
  deleteService as deleteServiceService
} from '../../services/serviceService.js';
import { handleServiceError } from '../utils/handleServiceError.js';

const apiServiceController = {};

// List all services
apiServiceController.listServices = async (req, res) => {
  try {
    // Unbounded — no pagination in the original contract, so this stays a
    // direct model call rather than routing through the paginated service.
    const services = await Service.findAll();
    res.json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Get a single service by id
apiServiceController.getService = async (req, res) => {
  try {
    const service = await getServiceService(req.params.id);
    res.json({
      success: true,
      data: service
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Create a new service
apiServiceController.createService = async (req, res) => {
  try {
    const service = await createServiceService(req.body || {});
    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Update a service
apiServiceController.updateService = async (req, res) => {
  try {
    const service = await updateServiceService(req.params.id, req.body || {});
    res.json({
      success: true,
      message: 'Service updated successfully',
      data: service
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Delete a service
apiServiceController.deleteService = async (req, res) => {
  try {
    await deleteServiceService(req.params.id);
    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Find services by exact name match
apiServiceController.findServices = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search term "name" is required'
      });
    }

    const services = await findServicesByName(name.trim());

    res.json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (error) {
    console.error('Error finding services:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const listServices = apiServiceController.listServices;
export const getService = apiServiceController.getService;
export const createService = apiServiceController.createService;
export const updateService = apiServiceController.updateService;
export const deleteService = apiServiceController.deleteService;
export const findServices = apiServiceController.findServices;

export default apiServiceController;
