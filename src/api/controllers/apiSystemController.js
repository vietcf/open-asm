
// API Controller for System (ES6 style, refactored)
import System from '../../models/System.js';
import Unit from '../../models/Unit.js';
import Tag from '../../models/Tag.js';
import Contact from '../../models/Contact.js';
import IpAddress from '../../models/IpAddress.js';

const apiSystemController = {};

// Helper: parse array fields from req.body (for multi-selects)
function parseArrayField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') return val.split(',').map(s => s.trim());
  return [];
}

// List all systems
apiSystemController.getAll = async (req, res) => {
  try {
    const systems = await System.findAll();
    res.json(systems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get system by id
apiSystemController.getById = async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    res.json(system);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new system
apiSystemController.create = async (req, res) => {
  try {
    let { system_id, name, alias, description, level, department_id, domains, managers, ip_addresses, tags, docs } = req.body || {};
    // Validate required fields
    if (!system_id || !name) return res.status(400).json({ error: 'system_id and name are required' });
    if (department_id && !(await Unit.exists(department_id))) return res.status(400).json({ error: 'Invalid department_id' });
    if (tags && tags.length && !(await Tag.exists(tags))) return res.status(400).json({ error: 'Invalid tag(s)' });
    if (managers && managers.length && !(await Contact.exists(managers))) return res.status(400).json({ error: 'Invalid manager(s)' });
    if (ip_addresses && ip_addresses.length && !(await IpAddress.exists(ip_addresses))) return res.status(400).json({ error: 'Invalid ip_address(es)' });
    // Parse array fields
    domains = parseArrayField(domains);
    managers = parseArrayField(managers);
    ip_addresses = parseArrayField(ip_addresses);
    tags = parseArrayField(tags);
    docs = docs || [];
    // Create
    const system = await System.create({
      system_id,
      name,
      alias,
      description,
      level,
      department_id,
      domains,
      managers,
      ip_addresses,
      tags,
      docs
    });
    res.status(201).json(system);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a system
apiSystemController.update = async (req, res) => {
  try {
    const id = req.params.id;
    let { system_id, name, alias, description, level, department_id, domains, managers, ip_addresses, tags, docs } = req.body || {};
    const system = await System.findByPk(id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    if (department_id && !(await Unit.exists(department_id))) return res.status(400).json({ error: 'Invalid department_id' });
    if (tags && tags.length && !(await Tag.exists(tags))) return res.status(400).json({ error: 'Invalid tag(s)' });
    if (managers && managers.length && !(await Contact.exists(managers))) return res.status(400).json({ error: 'Invalid manager(s)' });
    if (ip_addresses && ip_addresses.length && !(await IpAddress.exists(ip_addresses))) return res.status(400).json({ error: 'Invalid ip_address(es)' });
    // Parse array fields
    domains = parseArrayField(domains);
    managers = parseArrayField(managers);
    ip_addresses = parseArrayField(ip_addresses);
    tags = parseArrayField(tags);
    docs = docs || [];
    // Update
    await system.update({
      system_id,
      name,
      alias,
      description,
      level,
      department_id,
      domains,
      managers,
      ip_addresses,
      tags,
      docs
    });
    res.json(system);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a system
apiSystemController.remove = async (req, res) => {
  try {
    const id = req.params.id;
    const system = await System.findByPk(id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    await system.destroy();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default apiSystemController;
