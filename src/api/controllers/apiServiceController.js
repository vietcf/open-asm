import Service from '../../models/Service.js';

const apiServiceController = {};

// List all services
apiServiceController.listServices = async (req, res) => {
  try {
    const services = await Service.findAll();
    res.json({ data: services, total: services.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single service by id
apiServiceController.getService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new service
apiServiceController.createService = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Service name is required' });
    }
    
    const service = await Service.create({
      name: name.trim(),
      description: description ? description.trim() : null
    });
    
    res.status(201).json(service);
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Service name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

// Update a service
apiServiceController.updateService = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if service exists first
    const existingService = await Service.findById(req.params.id);
    if (!existingService) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Prepare update data - only update fields that are provided
    const updateData = {};
    
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Service name cannot be empty' });
      }
      updateData.name = name.trim();
    }
    
    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }
    
    // If no fields to update, return current service
    if (Object.keys(updateData).length === 0) {
      return res.json(existingService);
    }
    
    const service = await Service.update(req.params.id, updateData);
    res.json(service);
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Service name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

// Delete a service
apiServiceController.deleteService = async (req, res) => {
  try {
    // Check if service exists
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    await Service.delete(req.params.id);
    res.json({ message: 'Service deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Find services by exact name match
apiServiceController.findServices = async (req, res) => {
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
    const services = await Service.findByNameExact(name.trim());

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
