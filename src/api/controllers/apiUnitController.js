const Unit = require('../../models/Unit');

// Controller for Organization Unit (OU) API
exports.listUnits = async (req, res) => {
  try {
    // Pagination and search support
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    let totalCount, totalPages, units;
    if (search) {
      totalCount = await Unit.searchCount(search);
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      units = await Unit.searchPage(search, page, pageSize);
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

exports.getUnit = async (req, res) => {
  try {
    const id = req.params.id;
    const unit = await Unit.findById(id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createUnit = async (req, res) => {
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

exports.updateUnit = async (req, res) => {
  try {
    const id = req.params.id;
    let { name, code, description } = req.body;
    name = typeof name === 'string' ? name.trim() : '';
    code = typeof code === 'string' ? code.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    if (!name) {
      return res.status(400).json({ error: 'Unit name is required' });
    }
    // Check for duplicate name (case-insensitive, trim, except for this id)
    const existing = await Unit.findByName(name);
    if (existing && String(existing.id) !== String(id)) {
      return res.status(409).json({ error: 'Unit already exists with this name' });
    }
    const updated = await Unit.update(id, { name, code, description });
    if (!updated) return res.status(404).json({ error: 'Unit not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUnit = async (req, res) => {
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
