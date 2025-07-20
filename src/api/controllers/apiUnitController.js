import Unit from '../../models/Unit.js';

// Controller for Organization Unit (OU) API
const apiUnitController = {};

apiUnitController.listUnits = async (req, res) => {
  console.log('Listing units with pagination and search');
  try {
    // Pagination and search support
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    let totalCount, totalPages, units;
    if (search) {
      totalCount = await Unit.countSearch(search);
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      units = await Unit.findSearchPage(search, page, pageSize);
    } else {
      totalCount = await Unit.countAll();
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      units = await Unit.findPage(page, pageSize);
    }
    res.json({ totalCount, page, pageSize, totalPages, units });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiUnitController.getUnit = async (req, res) => {
  try {
    const id = req.params.id;
    const unit = await Unit.findById(id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiUnitController.createUnit = async (req, res) => {
  try {
    let { name, code, description } = req.body;
    name = typeof name === 'string' ? name.trim() : '';
    code = typeof code === 'string' ? code.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    if (!name) {
      return res.status(400).json({ error: 'Unit name is required' });
    }
    // Check for duplicate name (case-insensitive, trim)
    const existing = await Unit.findByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Unit already exists with this name' });
    }
    const unit = await Unit.create({ name, code, description });
    res.status(201).json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiUnitController.updateUnit = async (req, res) => {
  try {
    const id = req.params.id;
    // Lấy dữ liệu hiện tại
    const current = await Unit.findById(id);
    if (!current) return res.status(404).json({ error: 'Unit not found' });
    // Chỉ cập nhật trường nào truyền lên, còn lại giữ nguyên
    let name = ('name' in req.body) ? (typeof req.body.name === 'string' ? req.body.name.trim() : current.name) : current.name;
    let code = ('code' in req.body) ? (typeof req.body.code === 'string' ? req.body.code.trim() : current.code) : current.code;
    let description = ('description' in req.body) ? (typeof req.body.description === 'string' ? req.body.description.trim() : current.description) : current.description;
    if (!name) {
      return res.status(400).json({ error: 'Unit name is required' });
    }
    // Check for duplicate name (case-insensitive, trim, except for this id)
    const existing = await Unit.findByName(name);
    if (existing && String(existing.id) !== String(id)) {
      return res.status(409).json({ error: 'Unit already exists with this name' });
    }
    const updated = await Unit.update(id, { name, code, description });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiUnitController.deleteUnit = async (req, res) => {
  try {
    const id = req.params.id;
    const unit = await Unit.findById(id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    await Unit.delete(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default apiUnitController;
