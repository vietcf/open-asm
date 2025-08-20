// API Controller for System (ES6 style, refactored)
import System from '../../models/System.js';
import Unit from '../../models/Unit.js';
import Tag from '../../models/Tag.js';
import Contact from '../../models/Contact.js';
import IpAddress from '../../models/IpAddress.js';
import Domain from '../../models/Domain.js';
import systemOptions from '../../../config/systemOptions.js';

const apiSystemController = {};

// Helper: parse array fields from req.body (for multi-selects)
function parseArrayField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') return val.split(',').map(s => s.trim());
  return [];
}

// Helper: validate system level
function validateLevel(level) {
  if (level === undefined || level === null || level === '') return null; // Allow empty/null
  
  const levelStr = String(level);
  const validLevels = systemOptions.levels.map(l => l.value);
  
  if (!validLevels.includes(levelStr)) {
    return `Level must be one of: ${validLevels.join(', ')}`;
  }
  
  return null; // Valid
}

// List all systems (with optional search and pagination)
apiSystemController.getAll = async (req, res) => {
  try {
    const { search = '', page = 1, pageSize = 10 } = req.query;
    
    // Convert page and pageSize to integers
    const pageInt = parseInt(page, 10) || 1;
    const pageSizeInt = parseInt(pageSize, 10) || 10;
    
    // Use filtered search if search parameter provided, otherwise get all
    let systems, totalCount;
    
    if (search && search.trim()) {
      systems = await System.findFilteredList({ 
        search: search.trim(), 
        page: pageInt, 
        pageSize: pageSizeInt 
      });
      totalCount = await System.countFiltered({ search: search.trim() });
    } else {
      systems = await System.findAll(pageInt, pageSizeInt);
      totalCount = await System.count();
    }
    
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
    const system = await System.findById(req.params.id);
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
    
    // Validate required fields first
    if (!system_id || !name) return res.status(400).json({ error: 'system_id and name are required' });
    
    // Validate that fields are not just empty strings
    if (system_id.trim() === '' || name.trim() === '') {
      return res.status(400).json({ error: 'system_id and name cannot be empty strings' });
    }
    
    // Check for duplicate system_id
    if (await System.existsBySystemId(system_id)) {
      return res.status(409).json({ error: `System ID '${system_id}' already exists` });
    }
    
    // Check for duplicate system name
    if (await System.existsByName(name)) {
      return res.status(409).json({ error: `System name '${name}' already exists` });
    }
    
    // Validate level field
    const levelError = validateLevel(level);
    if (levelError) {
      return res.status(400).json({ error: levelError });
    }
    
    // Parse array fields (alias is already array from JSON, don't parse it)
    domains = parseArrayField(domains);
    managers = parseArrayField(managers);
    ip_addresses = parseArrayField(ip_addresses);
    tags = parseArrayField(tags);
    docs = docs || [];
    
    // Validate relationships after parsing
    if (department_id && !(await Unit.exists(department_id))) return res.status(400).json({ error: 'Invalid department_id' });
    
    // Validate tags array
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          return res.status(400).json({ error: `Invalid tag ID: ${tagId}` });
        }
      }
    }
    
    // Validate managers array
    if (managers && managers.length > 0) {
      for (const managerId of managers) {
        if (!(await Contact.exists(managerId))) {
          return res.status(400).json({ error: `Invalid manager ID: ${managerId}` });
        }
      }
    }
    
    // Validate ip_addresses array
    if (ip_addresses && ip_addresses.length > 0) {
      for (const ipId of ip_addresses) {
        if (!(await IpAddress.exists(ipId))) {
          return res.status(400).json({ error: `Invalid IP address ID: ${ipId}` });
        }
      }
    }
    
    // Validate domains array
    if (domains && domains.length > 0) {
      for (const domainId of domains) {
        if (!(await Domain.exists(domainId))) {
          return res.status(400).json({ error: `Invalid domain ID: ${domainId}` });
        }
      }
    }
    
    // Format alias for PostgreSQL array (keep as-is if it's already an array)
    let formattedAlias = null;
    if (alias && Array.isArray(alias) && alias.length > 0) {
      formattedAlias = alias;
    }
    
    // Create basic system
    const system = await System.create({
      system_id,
      name,
      alias: formattedAlias,
      description,
      level,
      department_id
    });
    
    // Set relationships if provided
    if (managers && managers.length > 0) {
      await System.setContacts(system.id, managers);
    }
    if (ip_addresses && ip_addresses.length > 0) {
      await System.setIPs(system.id, ip_addresses);
    }
    if (domains && domains.length > 0) {
      await System.setDomains(system.id, domains);
    }
    if (tags && tags.length > 0) {
      await System.setTags(system.id, tags);
    }
    
    // Return the created system with relationships
    const systemWithDetails = await System.findById(system.id);
    res.status(201).json(systemWithDetails);
  } catch (err) {
    console.error('Error creating system:', err);
    
    // Handle specific database constraint errors
    if (err.code === '23505') { // unique_violation (PostgreSQL error code)
      if (err.constraint === 'systems_system_id_key') {
        return res.status(409).json({ error: `System ID already exists` });
      }
      if (err.constraint === 'systems_name_key') {
        return res.status(409).json({ error: `System name already exists` });
      }
      // Handle other unique constraint violations
      return res.status(409).json({ error: 'Duplicate value violates unique constraint' });
    }
    
    res.status(500).json({ error: err.message });
  }
};

// Update a system
apiSystemController.update = async (req, res) => {
  try {
    const id = req.params.id;
    let { system_id, name, alias, description, level, department_id, domains, managers, ip_addresses, tags, docs } = req.body || {};
    const system = await System.findById(id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    
    // Check for duplicate system_id if it's being changed
    if (system_id !== undefined && system_id !== system.system_id) {
      // Validate that system_id is not empty
      if (!system_id || system_id.trim() === '') {
        return res.status(400).json({ error: 'system_id cannot be empty' });
      }
      
      if (await System.existsBySystemIdExcluding(system_id, id)) {
        return res.status(409).json({ error: `System ID '${system_id}' already exists` });
      }
    }
    
    // Check for duplicate system name if it's being changed
    if (name !== undefined && name !== system.name) {
      // Validate that name is not empty
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'name cannot be empty' });
      }
      
      if (await System.existsByNameExcluding(name, id)) {
        return res.status(409).json({ error: `System name '${name}' already exists` });
      }
    }
    
    // Validate level field if it's being changed
    if (level !== undefined) {
      const levelError = validateLevel(level);
      if (levelError) {
        return res.status(400).json({ error: levelError });
      }
    }
    
    // Validate and parse array fields only if they are provided
    // Validate department_id if provided
    if (department_id !== undefined && department_id && !(await Unit.exists(department_id))) {
      return res.status(400).json({ error: 'Invalid department_id' });
    }
    
    // Parse and validate domains array if provided
    if (domains !== undefined) {
      domains = parseArrayField(domains);
      if (domains && domains.length > 0) {
        for (const domainId of domains) {
          if (!(await Domain.exists(domainId))) {
            return res.status(400).json({ error: `Invalid domain ID: ${domainId}` });
          }
        }
      }
    }
    
    // Parse and validate managers array if provided
    if (managers !== undefined) {
      managers = parseArrayField(managers);
      if (managers && managers.length > 0) {
        for (const managerId of managers) {
          if (!(await Contact.exists(managerId))) {
            return res.status(400).json({ error: `Invalid manager ID: ${managerId}` });
          }
        }
      }
    }
    
    // Parse and validate ip_addresses array if provided
    if (ip_addresses !== undefined) {
      ip_addresses = parseArrayField(ip_addresses);
      if (ip_addresses && ip_addresses.length > 0) {
        for (const ipId of ip_addresses) {
          if (!(await IpAddress.exists(ipId))) {
            return res.status(400).json({ error: `Invalid IP address ID: ${ipId}` });
          }
        }
      }
    }
    
    // Parse and validate tags array if provided
    if (tags !== undefined) {
      tags = parseArrayField(tags);
      if (tags && tags.length > 0) {
        for (const tagId of tags) {
          if (!(await Tag.exists(tagId))) {
            return res.status(400).json({ error: `Invalid tag ID: ${tagId}` });
          }
        }
      }
    }
    
    // Format alias for PostgreSQL array
    let formattedAlias = system.alias; // keep existing if not provided
    if (alias !== undefined) {
      if (alias && Array.isArray(alias) && alias.length > 0) {
        formattedAlias = alias;
      } else {
        formattedAlias = null;
      }
    }
    
    // Update basic system fields
    const updatedSystem = await System.update(id, {
      system_id: system_id !== undefined ? system_id : system.system_id,
      name: name !== undefined ? name : system.name,
      alias: formattedAlias,
      description: description !== undefined ? description : system.description,
      level: level !== undefined ? level : system.level,
      department_id: department_id !== undefined ? department_id : system.department_id
    });
    
    // Update relationships if provided
    if (managers !== undefined) {
      await System.setContacts(id, managers);
    }
    if (ip_addresses !== undefined) {
      await System.setIPs(id, ip_addresses);
    }
    if (domains !== undefined) {
      await System.setDomains(id, domains);
    }
    if (tags !== undefined) {
      await System.setTags(id, tags);
    }
    
    // Return updated system with relationships
    const systemWithDetails = await System.findById(id);
    res.json(systemWithDetails);
  } catch (err) {
    console.error('Error updating system:', err);
    
    // Handle specific database constraint errors
    if (err.code === '23505') { // unique_violation (PostgreSQL error code)
      if (err.constraint === 'systems_system_id_key') {
        return res.status(409).json({ error: `System ID already exists` });
      }
      if (err.constraint === 'systems_name_key') {
        return res.status(409).json({ error: `System name already exists` });
      }
      // Handle other unique constraint violations
      return res.status(409).json({ error: 'Duplicate value violates unique constraint' });
    }
    
    res.status(500).json({ error: err.message });
  }
};

// Delete a system
apiSystemController.remove = async (req, res) => {
  try {
    const id = req.params.id;
    const system = await System.findById(id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    await System.remove(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
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
