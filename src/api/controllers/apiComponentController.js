// API Controller for System Component (ES6 style, refactored to use systemComponentService)

import {
  listComponents as listComponentsService,
  getComponent as getComponentService,
  createComponent as createComponentService,
  updateComponent as updateComponentService,
  deleteComponent as deleteComponentService
} from '../../services/systemComponentService.js';
import SystemComponent from '../../models/SystemComponent.js';
import { handleServiceErrorPlain } from '../utils/handleServiceError.js';

const apiComponentController = {};

// List all components (with optional search and pagination)
apiComponentController.getAll = async (req, res) => {
  try {
    const { search = '', page = 1, pageSize = 10, system_id } = req.query;
    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeInt = Math.max(1, Math.min(parseInt(pageSize, 10) || 10, 100));
    let filter = { search: search.trim(), page: pageInt, pageSize: pageSizeInt };
    if (system_id) filter.system_id = system_id;
    const { items: components, totalCount } = await listComponentsService(filter);
    const totalPages = Math.ceil(totalCount / pageSizeInt);
    res.json({
      data: components,
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

// Get component by id
apiComponentController.getById = async (req, res) => {
  try {
    const component = await getComponentService(req.params.id);
    res.json(component);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Create a new component
apiComponentController.create = async (req, res) => {
  try {
    const component = await createComponentService({ ...req.body, updated_by: req.user?.username || 'api-user' });
    res.status(201).json(component);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Update a component
apiComponentController.update = async (req, res) => {
  try {
    const component = await updateComponentService(req.params.id, { ...req.body, updated_by: req.user?.username || 'api-user' });
    res.json(component);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Delete a component
apiComponentController.remove = async (req, res) => {
  try {
    await deleteComponentService(req.params.id);
    res.status(204).end();
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Find components by exact name match
apiComponentController.findComponents = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search term "name" is required'
      });
    }
    // Use findFilteredList with exact name search
    const components = await SystemComponent.findFilteredList({
      search: name.trim(),
      page: 1,
      pageSize: 1000 // Large page size to get all matches
    });
    res.json({
      success: true,
      data: components,
      count: components.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export default apiComponentController;
