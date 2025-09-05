// API Controller for System (ES6 style, refactored)

import System from '../../models/System.js';
import Unit from '../../models/Unit.js';
import Tag from '../../models/Tag.js';
import Contact from '../../models/Contact.js';
import IpAddress from '../../models/IpAddress.js';
import Domain from '../../models/Domain.js';
import SystemComponent from '../../models/SystemComponent.js';

import Configuration from '../../models/Configuration.js';
import { pool } from '../../../config/config.js';

const apiSystemController = {};

// Helper: parse array fields from req.body (for multi-selects)
function parseArrayField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') return val.split(',').map(s => s.trim());
  return [];
}


// Helper: get level options from DB (same logic as systemController)
async function getLevelOptionsFromConfig() {
  let levelOptions = [];
  try {
    const config = await Configuration.findById('system_level');
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch {
        parsed = null;
      }
      if (parsed) {
        if (Array.isArray(parsed)) {
          levelOptions = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
        } else if (parsed.levels && Array.isArray(parsed.levels)) {
          levelOptions = parsed.levels.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
        }
      } else {
        // fallback: comma string
        levelOptions = String(config.value).split(',').map(v => ({ value: v.trim(), label: v.trim() })).filter(x => x.value);
      }
    }
  } catch (e) {
    levelOptions = [];
  }
  if (!Array.isArray(levelOptions) || levelOptions.length === 0) {
    levelOptions = [1,2,3,4,5].map(v => ({ value: String(v), label: String(v) }));
  }
  return levelOptions;
}

// Helper: validate system level (async)
async function validateLevel(level) {
  if (level === undefined || level === null || level === '') return null; // Allow empty/null
  const levelStr = String(level);
  const levelOptions = await getLevelOptionsFromConfig();
  const validLevels = levelOptions.map(l => l.value);
  if (!validLevels.includes(levelStr)) {
    return `Level must be one of: ${validLevels.join(', ')}`;
  }
  return null; // Valid
}

// Helper: get scope options from DB (Configuration)
async function getScopeOptionsFromConfig() {
  let scopeOptions = [];
  try {
    const config = await Configuration.findById('system_user_scope');
    
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch {
        parsed = null;
      }
      
      if (Array.isArray(parsed)) {
        scopeOptions = parsed.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.scopes && Array.isArray(parsed.scopes)) {
          scopeOptions = parsed.scopes.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        } else if (parsed.options && Array.isArray(parsed.options)) {
          scopeOptions = parsed.options.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        }
      } else if (typeof parsed === 'string') {
        scopeOptions = parsed.split(',').map(s => ({ id: s.trim(), text: s.trim() })).filter(x => x.id);
      }
    }
    
    return scopeOptions;
  } catch (e) {
    scopeOptions = [];
    return scopeOptions;
  }
}

// Helper: get architecture options from DB (Configuration)
async function getArchitectureOptionsFromConfig() {
  let architectureOptions = [];
  try {
    const config = await Configuration.findById('system_arch');
    
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch {
        parsed = null;
      }
      
      if (Array.isArray(parsed)) {
        architectureOptions = parsed.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.architectures && Array.isArray(parsed.architectures)) {
          architectureOptions = parsed.architectures.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        } else if (parsed.options && Array.isArray(parsed.options)) {
          architectureOptions = parsed.options.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        }
      } else if (typeof parsed === 'string') {
        architectureOptions = parsed.split(',').map(s => ({ id: s.trim(), text: s.trim() })).filter(x => x.id);
      }
    }
    
    return architectureOptions;
  } catch (e) {
    architectureOptions = [];
    return architectureOptions;
  }
}

// Helper: validate scopes
async function validateScopes(scopes) {
  if (!scopes || scopes.length === 0) return null; // Allow empty
  
  const scopeOptions = await getScopeOptionsFromConfig();
  const allowedScopes = (scopeOptions || []).map(s => s.id);
  
  // Filter only valid scopes
  const validScopes = scopes.filter(scope => allowedScopes.includes(scope));
  return validScopes.length > 0 ? validScopes : null;
}

// Helper: validate architecture
async function validateArchitecture(architecture) {
  if (!architecture || architecture.length === 0) return null; // Allow empty
  
  const architectureOptions = await getArchitectureOptionsFromConfig();
  const allowedArchitectures = (architectureOptions || []).map(a => a.id);
  
  // Filter only valid architectures
  const validArchitectures = architecture.filter(arch => allowedArchitectures.includes(arch));
  return validArchitectures.length > 0 ? validArchitectures : null;
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    let { system_id, name, alias, description, level, department_id, domains, managers, ip_addresses, tags, docs, fqdn, scopes, architecture } = req.body || {};
    
    // Validate required fields first
    if (!system_id || !name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'system_id and name are required' });
    }
    
    // Validate that fields are not just empty strings
    if (system_id.trim() === '' || name.trim() === '') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'system_id and name cannot be empty strings' });
    }
    
    // Check for duplicate system_id
    if (await System.existsBySystemId(system_id)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `System ID '${system_id}' already exists` });
    }
    
    // Check for duplicate system name
    if (await System.existsByName(name)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `System name '${name}' already exists` });
    }
    
    // Validate level field
    const levelError = await validateLevel(level);
    if (levelError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: levelError });
    }
    
    // Parse array fields (alias is already array from JSON, don't parse it)
    domains = parseArrayField(domains);
    managers = parseArrayField(managers);
    ip_addresses = parseArrayField(ip_addresses);
    tags = parseArrayField(tags);
    docs = docs || [];
    
    // Parse and validate fqdn, scopes, architecture
    let fqdnList = [];
    if (fqdn) {
      if (typeof fqdn === 'string') {
        fqdnList = fqdn.split(',').map(s => s.trim()).filter(Boolean);
      } else if (Array.isArray(fqdn)) {
        fqdnList = fqdn.map(s => String(s).trim()).filter(Boolean);
      }
    }
    
    scopes = parseArrayField(scopes);
    architecture = parseArrayField(architecture);
    
    // Validate scopes and architecture
    const validatedScopes = await validateScopes(scopes);
    const validatedArchitecture = await validateArchitecture(architecture);
    
    // Validate relationships after parsing
    if (department_id && !(await Unit.exists(department_id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid department_id' });
    }
    
    // Validate tags array
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid tag ID: ${tagId}` });
        }
      }
    }
    
    // Validate managers array
    if (managers && managers.length > 0) {
      for (const managerId of managers) {
        if (!(await Contact.exists(managerId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid manager ID: ${managerId}` });
        }
      }
    }
    
    // Validate ip_addresses array
    if (ip_addresses && ip_addresses.length > 0) {
      for (const ipId of ip_addresses) {
        if (!(await IpAddress.exists(ipId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid IP address ID: ${ipId}` });
        }
      }
    }
    
    // Validate domains array
    if (domains && domains.length > 0) {
      for (const domainId of domains) {
        if (!(await Domain.exists(domainId))) {
          await client.query('ROLLBACK');
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
      department_id,
      fqdn: fqdnList,
      scopes: validatedScopes,
      architecture: validatedArchitecture,
      updated_by: req.user?.username || 'api-user' // Get from JWT token
    }, client);
    
    // Set relationships if provided
    if (managers && managers.length > 0) {
      await System.setContacts(system.id, managers, client);
    }
    if (ip_addresses && ip_addresses.length > 0) {
      await System.setIPs(system.id, ip_addresses, client);
    }
    if (domains && domains.length > 0) {
      await System.setDomains(system.id, domains, client);
    }
    if (tags && tags.length > 0) {
      await System.setTags(system.id, tags, client);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Return the created system with relationships
    const systemWithDetails = await System.findById(system.id);
    res.status(201).json(systemWithDetails);
  } catch (err) {
    console.error('Error creating system:', err);
    
    // Rollback transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
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
  } finally {
    // Always release the client back to the pool
    client.release();
  }
};

// Update a system
apiSystemController.update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const id = req.params.id;
    let { system_id, name, alias, description, level, department_id, domains, managers, ip_addresses, tags, docs, fqdn, scopes, architecture } = req.body || {};
    const system = await System.findById(id);
    if (!system) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'System not found' });
    }
    
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
      const levelError = await validateLevel(level);
      if (levelError) {
        return res.status(400).json({ error: levelError });
      }
    }
    
    // Validate and parse array fields only if they are provided
    // Validate department_id if provided
    if (department_id !== undefined && department_id && !(await Unit.exists(department_id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid department_id' });
    }
    
    // Parse and validate domains array if provided
    if (domains !== undefined) {
      domains = parseArrayField(domains);
      if (domains && domains.length > 0) {
        for (const domainId of domains) {
          if (!(await Domain.exists(domainId))) {
            await client.query('ROLLBACK');
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
            await client.query('ROLLBACK');
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
            await client.query('ROLLBACK');
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
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Invalid tag ID: ${tagId}` });
          }
        }
      }
    }
    
    // Parse and validate fqdn, scopes, architecture if provided
    let fqdnList = system.fqdn || []; // Keep existing if not provided
    let fqdnChanged = false;
    if (fqdn !== undefined) {
      const newFqdnList = [];
      if (fqdn) {
        if (typeof fqdn === 'string') {
          newFqdnList.push(...fqdn.split(',').map(s => s.trim()).filter(Boolean));
        } else if (Array.isArray(fqdn)) {
          newFqdnList.push(...fqdn.map(s => String(s).trim()).filter(Boolean));
        }
      }
      // Check if fqdn actually changed
      const currentFqdn = Array.isArray(system.fqdn) ? system.fqdn : (system.fqdn ? [system.fqdn] : []);
      fqdnChanged = JSON.stringify(currentFqdn.sort()) !== JSON.stringify(newFqdnList.sort());
      if (fqdnChanged) {
        fqdnList = newFqdnList;
      }
    }
    
    let validatedScopes = system.scopes || null; // Keep existing if not provided
    let scopesChanged = false;
    if (scopes !== undefined) {
      scopes = parseArrayField(scopes);
      const newScopes = await validateScopes(scopes);
      // Check if scopes actually changed
      const currentScopes = Array.isArray(system.scopes) ? system.scopes : (system.scopes ? [system.scopes] : []);
      scopesChanged = JSON.stringify(currentScopes.sort()) !== JSON.stringify((newScopes || []).sort());
      if (scopesChanged) {
        validatedScopes = newScopes;
      }
    }
    
    let validatedArchitecture = system.architecture || null; // Keep existing if not provided
    let architectureChanged = false;
    if (architecture !== undefined) {
      architecture = parseArrayField(architecture);
      const newArchitecture = await validateArchitecture(architecture);
      // Check if architecture actually changed
      const currentArchitecture = Array.isArray(system.architecture) ? system.architecture : (system.architecture ? [system.architecture] : []);
      architectureChanged = JSON.stringify(currentArchitecture.sort()) !== JSON.stringify((newArchitecture || []).sort());
      if (architectureChanged) {
        validatedArchitecture = newArchitecture;
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
    
    // Check if any basic fields actually changed
    const basicFieldsChanged = (
      (system_id !== undefined && system_id !== system.system_id) ||
      (name !== undefined && name !== system.name) ||
      (description !== undefined && description !== system.description) ||
      (level !== undefined && level !== system.level) ||
      (department_id !== undefined && department_id !== system.department_id) ||
      fqdnChanged || scopesChanged || architectureChanged ||
      (alias !== undefined && JSON.stringify(system.alias) !== JSON.stringify(formattedAlias))
    );
    
    // Only update if there are actual changes
    let updatedSystem = system;
    if (basicFieldsChanged) {
      updatedSystem = await System.update(id, {
        system_id: system_id !== undefined ? system_id : system.system_id,
        name: name !== undefined ? name : system.name,
        alias: formattedAlias,
        description: description !== undefined ? description : system.description,
        level: level !== undefined ? level : system.level,
        department_id: department_id !== undefined ? department_id : system.department_id,
        fqdn: fqdnList,
        scopes: validatedScopes,
        architecture: validatedArchitecture,
        updated_by: req.user?.username || 'api-user' // Get from JWT token
      }, client);
    }
    
    // Check if relationships changed
    let relationshipsChanged = false;
    
    // Update relationships if provided
    if (managers !== undefined) {
      await System.setContacts(id, managers, client);
      relationshipsChanged = true;
    }
    if (ip_addresses !== undefined) {
      await System.setIPs(id, ip_addresses, client);
      relationshipsChanged = true;
    }
    if (domains !== undefined) {
      await System.setDomains(id, domains, client);
      relationshipsChanged = true;
    }
    if (tags !== undefined) {
      await System.setTags(id, tags, client);
      relationshipsChanged = true;
    }
    
    // Update updated_at if only relationships changed
    if (relationshipsChanged && !basicFieldsChanged) {
      await System.update(id, {
        system_id: system.system_id,
        name: system.name,
        alias: system.alias,
        description: system.description,
        level: system.level,
        department_id: system.department_id,
        fqdn: system.fqdn,
        scopes: system.scopes,
        architecture: system.architecture,
        updated_by: req.user?.username || 'api-user'
      }, client);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Return updated system with relationships
    const systemWithDetails = await System.findById(id);
    res.json(systemWithDetails);
  } catch (err) {
    console.error('Error updating system:', err);
    
    // Rollback transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
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
  } finally {
    // Always release the client back to the pool
    client.release();
  }
};

// Delete a system
apiSystemController.remove = async (req, res) => {
  try {
    const id = req.params.id;
    const system = await System.findById(id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    // Kiểm tra nếu còn component thì không cho xóa system
  const count = await SystemComponent.countBySystemId(id);
    if (count > 0) {
      return res.status(400).json({ error: 'You must delete all components of this system before deleting the system.' });
    }
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
