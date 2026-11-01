import {
  listUnits as listUnitsService,
  getUnit as getUnitService,
  findUnitsByName,
  createUnit as createUnitService,
  updateUnit as updateUnitService,
  deleteUnit as deleteUnitService
} from './unit.service.js';
import { handleServiceErrorPlain } from '../../shared/api.js';

// Controller for Organization Unit (OU) API
const apiUnitController = {};

apiUnitController.listUnits = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const { items: units, totalCount } = await listUnitsService({ search, page, pageSize });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    res.json({ totalCount, page, pageSize, totalPages, units });
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiUnitController.getUnit = async (req, res) => {
  try {
    const unit = await getUnitService(req.params.id);
    res.json(unit);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiUnitController.createUnit = async (req, res) => {
  try {
    const unit = await createUnitService(req.body || {});
    res.status(201).json(unit);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiUnitController.updateUnit = async (req, res) => {
  try {
    const updated = await updateUnitService(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiUnitController.deleteUnit = async (req, res) => {
  try {
    await deleteUnitService(req.params.id);
    res.status(204).send();
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiUnitController.findUnits = async (req, res) => {
  try {
    const { name } = req.query;

    // Validate required parameter
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Search term 'name' is required"
      });
    }

    // Validate empty name
    if (name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Search term 'name' cannot be empty"
      });
    }

    const units = await findUnitsByName(name.trim());

    res.status(200).json({
      success: true,
      data: units,
      count: units.length
    });

  } catch (error) {
    console.error('Error finding units:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export default apiUnitController;
