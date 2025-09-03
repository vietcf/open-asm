// API Controller for System Component (ES6 style, refactored)

import SystemComponent from '../../models/SystemComponent.js';
import Tag from '../../models/Tag.js';
import Contact from '../../models/Contact.js';
import IpAddress from '../../models/IpAddress.js';
import System from '../../models/System.js';
import systemOptions from '../../../config/systemOptions.js';

const apiComponentController = {};

function parseArrayField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') return val.split(',').map(s => s.trim());
  return [];
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
  try {
    let { system_id, name, app_type, description, fqdn, contacts, ips, tags } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    // Validate system_id if provided
    if (system_id && isNaN(Number(system_id))) {
      return res.status(400).json({ error: 'Invalid system_id' });
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
          return res.status(400).json({ error: `Invalid tag ID: ${tagId}` });
        }
      }
    }
    // Validate contacts
    if (contacts && contacts.length > 0) {
      for (const contactId of contacts) {
        if (!(await Contact.exists(contactId))) {
          return res.status(400).json({ error: `Invalid contact ID: ${contactId}` });
        }
      }
    }
    // Validate ips
    if (ips && ips.length > 0) {
      for (const ipId of ips) {
        if (!(await IpAddress.exists(ipId))) {
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
      updated_by: req.session?.user?.username || null
    });
    if (contacts && contacts.length > 0) {
      await SystemComponent.setContacts(component.id, contacts);
    }
    if (ips && ips.length > 0) {
      await SystemComponent.setIPs(component.id, ips);
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
      await SystemComponent.setTags(component.id, tags);
    }
    const componentWithDetails = await SystemComponent.findByIdWithRelations(component.id);
    res.status(201).json(componentWithDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a component
apiComponentController.update = async (req, res) => {
  try {
    const id = req.params.id;
    let { system_id, name, app_type, description, fqdn, contacts, ips, tags } = req.body || {};
    const component = await SystemComponent.findById(id);
    if (!component) return res.status(404).json({ error: 'Component not found' });
    // Parse and validate fields
    contacts = contacts !== undefined ? parseArrayField(contacts) : undefined;
    ips = ips !== undefined ? parseArrayField(ips) : undefined;
    tags = tags !== undefined ? parseArrayField(tags) : undefined;
    fqdn = fqdn !== undefined ? parseArrayField(fqdn) : undefined;
    // Validate tags
    if (tags !== undefined && tags.length > 0) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          return res.status(400).json({ error: `Invalid tag ID: ${tagId}` });
        }
      }
    }
    // Validate contacts
    if (contacts !== undefined && contacts.length > 0) {
      for (const contactId of contacts) {
        if (!(await Contact.exists(contactId))) {
          return res.status(400).json({ error: `Invalid contact ID: ${contactId}` });
        }
      }
    }
    // Validate ips
    if (ips !== undefined && ips.length > 0) {
      for (const ipId of ips) {
        if (!(await IpAddress.exists(ipId))) {
          return res.status(400).json({ error: `Invalid IP address ID: ${ipId}` });
        }
      }
    }
    // Update main fields
    const updatedComponent = await SystemComponent.update(id, {
      system_id: system_id !== undefined ? system_id : component.system_id,
      name: name !== undefined ? name : component.name,
      app_type: app_type !== undefined ? app_type : component.app_type,
      description: description !== undefined ? description : component.description,
      fqdn: fqdn !== undefined ? fqdn : component.fqdn,
      updated_by: req.session?.user?.username || null
    });
    // Update relationships if provided
    if (contacts !== undefined) {
      await SystemComponent.setContacts(id, contacts);
    }
    if (ips !== undefined) {
      await SystemComponent.setIPs(id, ips);
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
      await SystemComponent.setTags(id, tags);
    }
    const componentWithDetails = await SystemComponent.findByIdWithRelations(id);
    res.json(componentWithDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a component
apiComponentController.remove = async (req, res) => {
  try {
    const id = req.params.id;
    const component = await SystemComponent.findById(id);
    if (!component) return res.status(404).json({ error: 'Component not found' });
    // Get all IPs linked to this component
    const ips = await SystemComponent.getIPs(id);
    // Remove system_ip links for these IPs and the parent system
    if (component.system_id && Array.isArray(ips) && ips.length > 0) {
      for (const ip of ips) {
        await System.removeIP(component.system_id, ip.id);
      }
    }
    await SystemComponent.delete(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const components = await SystemComponent.findByNameExact(name.trim());
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
