// API Controller for System Component (ES6 style, refactored)

import SystemComponent from '../../models/SystemComponent.js';
import Tag from '../../models/Tag.js';
import Contact from '../../models/Contact.js';
import IpAddress from '../../models/IpAddress.js';
import System from '../../models/System.js';
import Configuration from '../../models/Configuration.js';
import { pool } from '../../../config/config.js';

const apiComponentController = {};

function parseArrayField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') return val.split(',').map(s => s.trim());
  return [];
}

// Helper: get app_type options from DB (Configuration)
async function getAppTypeOptionsFromConfig() {
  let appTypeOptions = [];
  try {
    const config = await Configuration.findById('system_app_type');
    
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch {
        parsed = null;
      }
      
      if (Array.isArray(parsed)) {
        appTypeOptions = parsed.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.appTypes && Array.isArray(parsed.appTypes)) {
          appTypeOptions = parsed.appTypes.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        } else if (parsed.options && Array.isArray(parsed.options)) {
          appTypeOptions = parsed.options.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        }
      } else if (typeof parsed === 'string') {
        appTypeOptions = parsed.split(',').map(s => ({ id: s.trim(), text: s.trim() })).filter(x => x.id);
      }
    }
    
    return appTypeOptions;
  } catch (e) {
    appTypeOptions = [];
    return appTypeOptions;
  }
}

// Helper: validate app_type
async function validateAppType(appType) {
  if (!appType || appType.trim() === '') return null; // Allow empty
  
  const appTypeOptions = await getAppTypeOptionsFromConfig();
  const allowedAppTypes = (appTypeOptions || []).map(a => a.id);
  
  if (!allowedAppTypes.includes(appType)) {
    return `App type must be one of: ${allowedAppTypes.join(', ')}`;
  }
  
  return null; // Valid
}

// List all components (with optional search and pagination)
apiComponentController.getAll = async (req, res) => {
  try {
    const { search = '', page = 1, pageSize = 10, system_id } = req.query;
    const pageInt = parseInt(page, 10) || 1;
    const pageSizeInt = parseInt(pageSize, 10) || 10;
    let filter = { search: search.trim(), page: pageInt, pageSize: pageSizeInt };
    if (system_id) filter.system_id = system_id;
    const components = await SystemComponent.findFilteredList(filter);
    const totalCount = await SystemComponent.countFiltered(filter);
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
    const component = await SystemComponent.findByIdWithRelations(req.params.id);
    if (!component) return res.status(404).json({ error: 'Component not found' });
    res.json(component);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new component
apiComponentController.create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    let { system_id, name, app_type, description, fqdn, contacts, ips, tags } = req.body || {};
    
    // Validate required fields
    if (!name || name.trim() === '') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'name is required' });
    }
    
    // Validate system_id if provided
    if (system_id && isNaN(Number(system_id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid system_id' });
    }
    
    // Validate system_id exists if provided
    if (system_id && !(await System.exists(system_id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid system_id' });
    }
    
    // Validate app_type
    const appTypeError = await validateAppType(app_type);
    if (appTypeError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: appTypeError });
    }
    // Parse array fields
    contacts = parseArrayField(contacts);
    ips = parseArrayField(ips);
    tags = parseArrayField(tags);
    fqdn = parseArrayField(fqdn);
    // Validate tags
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid tag ID: ${tagId}` });
        }
      }
    }
    // Validate contacts
    if (contacts && contacts.length > 0) {
      for (const contactId of contacts) {
        if (!(await Contact.exists(contactId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid contact ID: ${contactId}` });
        }
      }
    }
    // Validate ips
    if (ips && ips.length > 0) {
      for (const ipId of ips) {
        if (!(await IpAddress.exists(ipId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid IP address ID: ${ipId}` });
        }
      }
    }
    // Create component
    const component = await SystemComponent.create({
      system_id,
      name,
      app_type,
      description,
      fqdn,
      updated_by: req.user?.username || 'api-user' // Get from JWT token
    }, client);
    
    // Set relationships
    if (contacts && contacts.length > 0) {
      await SystemComponent.setContacts(component.id, contacts, client);
    }
    if (ips && ips.length > 0) {
      await SystemComponent.setIPs(component.id, ips, client);
      // --- Sync IPs between component và system cha ---
      if (system_id) {
        // Lấy danh sách IP hiện có của system cha
        let systemIpIds = [];
        try {
          systemIpIds = await System.getIpIdsBySystemId(system_id);
        } catch (e) {
          systemIpIds = [];
        }
        // Thêm các IP mới nếu chưa có trong system_ip
        const ipsToAdd = ips.filter(ip => !systemIpIds.includes(ip));
        if (ipsToAdd.length > 0) {
          try {
            await System.addIPs(system_id, ipsToAdd);
          } catch (e) {}
        }
      }
    }
    if (tags && tags.length > 0) {
      await SystemComponent.setTags(component.id, tags, client);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    const componentWithDetails = await SystemComponent.findByIdWithRelations(component.id);
    res.status(201).json(componentWithDetails);
  } catch (err) {
    console.error('Error creating component:', err);
    
    // Rollback transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
    res.status(500).json({ error: err.message });
  } finally {
    // Always release the client back to the pool
    client.release();
  }
};

// Update a component
apiComponentController.update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const id = req.params.id;
    let { system_id, name, app_type, description, fqdn, contacts, ips, tags } = req.body || {};
    const component = await SystemComponent.findById(id);
    if (!component) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Component not found' });
    }
    // Validate system_id if provided
    if (system_id !== undefined && system_id && isNaN(Number(system_id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid system_id' });
    }
    
    if (system_id !== undefined && system_id && !(await System.exists(system_id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid system_id' });
    }
    
    // Validate app_type if provided
    if (app_type !== undefined) {
      const appTypeError = await validateAppType(app_type);
      if (appTypeError) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: appTypeError });
      }
    }
    
    // Parse and validate fields
    contacts = contacts !== undefined ? parseArrayField(contacts) : undefined;
    ips = ips !== undefined ? parseArrayField(ips) : undefined;
    tags = tags !== undefined ? parseArrayField(tags) : undefined;
    fqdn = fqdn !== undefined ? parseArrayField(fqdn) : undefined;
    
    // Validate tags
    if (tags !== undefined && tags.length > 0) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid tag ID: ${tagId}` });
        }
      }
    }
    // Validate contacts
    if (contacts !== undefined && contacts.length > 0) {
      for (const contactId of contacts) {
        if (!(await Contact.exists(contactId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid contact ID: ${contactId}` });
        }
      }
    }
    // Validate ips
    if (ips !== undefined && ips.length > 0) {
      for (const ipId of ips) {
        if (!(await IpAddress.exists(ipId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid IP address ID: ${ipId}` });
        }
      }
    }
    // Check if any basic fields actually changed
    const basicFieldsChanged = (
      (system_id !== undefined && system_id !== component.system_id) ||
      (name !== undefined && name !== component.name) ||
      (app_type !== undefined && app_type !== component.app_type) ||
      (description !== undefined && description !== component.description) ||
      (fqdn !== undefined && JSON.stringify(component.fqdn) !== JSON.stringify(fqdn))
    );
    
    // Only update if there are actual changes
    let updatedComponent = component;
    if (basicFieldsChanged) {
      updatedComponent = await SystemComponent.update(id, {
        system_id: system_id !== undefined ? system_id : component.system_id,
        name: name !== undefined ? name : component.name,
        app_type: app_type !== undefined ? app_type : component.app_type,
        description: description !== undefined ? description : component.description,
        fqdn: fqdn !== undefined ? fqdn : component.fqdn,
        updated_by: req.user?.username || 'api-user' // Get from JWT token
      }, client);
    }
    
    // Check if relationships changed
    let relationshipsChanged = false;
    
    // Update relationships if provided
    if (contacts !== undefined) {
      await SystemComponent.setContacts(id, contacts, client);
      relationshipsChanged = true;
    }
    if (ips !== undefined) {
      await SystemComponent.setIPs(id, ips, client);
      relationshipsChanged = true;
      // --- Sync IPs giữa component và system cha khi update ---
      const system_id = component.system_id;
      if (system_id && Array.isArray(ips)) {
        let systemIpIds = [];
        try {
          systemIpIds = await System.getIpIdsBySystemId(system_id);
        } catch (e) {
          systemIpIds = [];
        }
        const ipsToAdd = ips.filter(ip => !systemIpIds.includes(ip));
        if (ipsToAdd.length > 0) {
          try {
            await System.addIPs(system_id, ipsToAdd);
          } catch (e) {}
        }
      }
    }
    if (tags !== undefined) {
      await SystemComponent.setTags(id, tags, client);
      relationshipsChanged = true;
    }
    
    // Update updated_at if only relationships changed
    if (relationshipsChanged && !basicFieldsChanged) {
      await SystemComponent.update(id, {
        system_id: component.system_id,
        name: component.name,
        app_type: component.app_type,
        description: component.description,
        fqdn: component.fqdn,
        updated_by: req.user?.username || 'api-user'
      }, client);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    const componentWithDetails = await SystemComponent.findByIdWithRelations(id);
    res.json(componentWithDetails);
  } catch (err) {
    console.error('Error updating component:', err);
    
    // Rollback transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
    res.status(500).json({ error: err.message });
  } finally {
    // Always release the client back to the pool
    client.release();
  }
};

// Delete a component
apiComponentController.remove = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const id = req.params.id;
    const component = await SystemComponent.findById(id);
    if (!component) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Component not found' });
    }
    
    // Get all IPs linked to this component
    const ips = await SystemComponent.getIPs(id);
    
    // Remove system_ip links for these IPs and the parent system
    if (component.system_id && Array.isArray(ips) && ips.length > 0) {
      for (const ip of ips) {
        await System.removeIP(component.system_id, ip.id, client);
      }
    }
    
    // Delete the component
    await SystemComponent.delete(id, client);
    
    // Commit transaction
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting component:', err);
    
    // Rollback transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
    res.status(500).json({ error: err.message });
  } finally {
    // Always release the client back to the pool
    client.release();
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
