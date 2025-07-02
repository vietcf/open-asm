// RESTful API controller for System resource
// Uses System model methods, validates input, and checks foreign keys
const System = require('../../models/System');
const Unit = require('../../models/Unit');
const Tag = require('../../models/Tag');
const Contact = require('../../models/Contact');
const IpAddress = require('../../models/IpAddress');

// Helper: parse array fields from req.body (for multi-selects)
function parseArrayField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') return val.split(',').map(s => s.trim());
  return [];
}

/**
 * @swagger
 * tags:
 *   name: System
 *   description: API for managing systems
 */

// GET /api/systems
exports.getAll = async (req, res) => {
  try {
    const systems = await System.findAll();
    res.json(systems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/systems/:id
exports.getById = async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    res.json(system);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/systems
exports.create = async (req, res) => {
  // Validation block
  const { system_id, name, alias, description, level, department_id, domains, managers, ip_addresses, tags, docs } = req.body;
  if (!system_id || !name) return res.status(400).json({ error: 'system_id and name are required' });
  if (department_id && !(await Unit.exists(department_id))) return res.status(400).json({ error: 'Invalid department_id' });
  if (tags && tags.length && !(await Tag.exists(tags))) return res.status(400).json({ error: 'Invalid tag(s)' });
  if (managers && managers.length && !(await Contact.exists(managers))) return res.status(400).json({ error: 'Invalid manager(s)' });
  if (ip_addresses && ip_addresses.length && !(await IpAddress.exists(ip_addresses))) return res.status(400).json({ error: 'Invalid ip_address(es)' });
  // Create
  try {
    const system = await System.create({
      system_id,
      name,
      alias,
      description,
      level,
      department_id,
      domains: parseArrayField(domains),
      managers: parseArrayField(managers),
      ip_addresses: parseArrayField(ip_addresses),
      tags: parseArrayField(tags),
      docs: docs || []
    });
    res.status(201).json(system);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/systems/:id
exports.update = async (req, res) => {
  // Validation block
  const { system_id, name, alias, description, level, department_id, domains, managers, ip_addresses, tags, docs } = req.body;
  try {
    const system = await System.findByPk(req.params.id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    if (department_id && !(await Unit.exists(department_id))) return res.status(400).json({ error: 'Invalid department_id' });
    if (tags && tags.length && !(await Tag.exists(tags))) return res.status(400).json({ error: 'Invalid tag(s)' });
    if (managers && managers.length && !(await Contact.exists(managers))) return res.status(400).json({ error: 'Invalid manager(s)' });
    if (ip_addresses && ip_addresses.length && !(await IpAddress.exists(ip_addresses))) return res.status(400).json({ error: 'Invalid ip_address(es)' });
    // Update
    await system.update({
      system_id,
      name,
      alias,
      description,
      level,
      department_id,
      domains: parseArrayField(domains),
      managers: parseArrayField(managers),
      ip_addresses: parseArrayField(ip_addresses),
      tags: parseArrayField(tags),
      docs: docs || []
    });
    res.json(system);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/systems/:id
exports.remove = async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    await system.destroy();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
