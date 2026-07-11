// API Controller for System (ES6 style, refactored to use systemService)

import System from '../../models/System.js';
import {
  listSystems as listSystemsService,
  getSystem as getSystemService,
  createSystem as createSystemService,
  updateSystem as updateSystemService,
  deleteSystem as deleteSystemService
} from '../../services/systemService.js';
import { handleServiceErrorPlain } from '../utils/handleServiceError.js';

const apiSystemController = {};

// List all systems (with optional search and pagination)
apiSystemController.getAll = async (req, res) => {
  try {
    const { search = '', page = 1, pageSize = 10 } = req.query;
    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeInt = Math.max(1, Math.min(parseInt(pageSize, 10) || 10, 100));

    const { items: systems, totalCount } = await listSystemsService({ search: search.trim(), page: pageInt, pageSize: pageSizeInt });
    const totalPages = Math.ceil(totalCount / pageSizeInt);

    res.json({
      data: systems,
      pagination: {
        page: pageInt,
        pageSize: pageSizeInt,
        totalCount,
        totalPages,
        hasNext: pageInt < totalPages,
        hasPrev: pageInt > 1
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get system by id
apiSystemController.getById = async (req, res) => {
  try {
    const system = await getSystemService(req.params.id);
    res.json(system);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Create a new system
apiSystemController.create = async (req, res) => {
  try {
    const system = await createSystemService({ ...req.body, updated_by: req.user?.username || 'api-user' });
    res.status(201).json(system);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Update a system
apiSystemController.update = async (req, res) => {
  try {
    const system = await updateSystemService(req.params.id, { ...req.body, updated_by: req.user?.username || 'api-user' });
    res.json(system);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Delete a system
apiSystemController.remove = async (req, res) => {
  try {
    await deleteSystemService(req.params.id);
    res.status(204).end();
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Find systems by exact name match
apiSystemController.findSystems = async (req, res) => {
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
    const systems = await System.findByNameExact(name.trim());

    res.json({
      success: true,
      data: systems,
      count: systems.length
    });
  } catch (error) {
    console.error('Error finding systems:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export default apiSystemController;
