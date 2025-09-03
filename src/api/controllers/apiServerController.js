// API Controller for Server (ES6)
import Server from '../../models/Server.js';
import IpAddress from '../../models/IpAddress.js';
import Platform from '../../models/Platform.js';
import Contact from '../../models/Contact.js';
import System from '../../models/System.js';
import Agent from '../../models/Agent.js';
import Service from '../../models/Service.js';
import Tag from '../../models/Tag.js';
import { pool } from '../../../config/config.js';
import Configuration from '../../models/Configuration.js';

// Helpers to load server options from DB (Configuration)
async function getServerLocationOptions() {
  let options = [];
  try {
    const config = await Configuration.findById('device_location');
    if (config && config.value) options = JSON.parse(config.value);
  } catch {}
  return options;
}
async function getServerStatusOptions() {
  let options = [];
  try {
    const config = await Configuration.findById('server_status');
    if (config && config.value) options = JSON.parse(config.value);
  } catch {}
  return options;
}
async function getServerTypeOptions() {
  let options = [];
  try {
    const config = await Configuration.findById('server_type');
    if (config && config.value) options = JSON.parse(config.value);
  } catch {}
  return options;
}

const apiServerController = {};

// List all servers (with filter and pagination)
apiServerController.listServers = async (req, res) => {
  try {
    const { search, status, type, location, tags, ip, manager, systems, services, os, page = 1, pageSize = 10 } = req.query;
    // Normalize array parameters
    const normalize = v => (!v ? [] : Array.isArray(v) ? v : [v]);
    const filterParams = {
      search: search ? search.trim().toLowerCase() : '',
      status,
      type,
      location,
      tags: normalize(tags),
      ip: normalize(ip),
      manager: normalize(manager),
      systems: normalize(systems),
      services: normalize(services),
      os: normalize(os),
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 10
    };
    const serverList = await Server.findFilteredList(filterParams);
    const total = await Server.countFiltered(filterParams);
    res.json({ data: serverList, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Find servers by specific field values (exact match)
apiServerController.findServers = async (req, res) => {
  try {
    const { name, ip_address } = req.query;
    
    // Validate that at least one search criteria is provided
    if (!name && !ip_address) {
      return res.status(400).json({ error: 'At least one search criteria must be provided (name or ip_address)' });
    }
    
    // Build search criteria
    const criteria = {};
    if (name) criteria.name = name.trim();
    if (ip_address) criteria.ip_address = ip_address.trim();
    
    // Find servers with detailed information
    const servers = await Server.findByCriteria(criteria);
    
    if (!servers || servers.length === 0) {
      return res.status(404).json({ 
        error: 'No servers found matching the specified criteria',
        criteria 
      });
    }
    
    res.json({ 
      data: servers, 
      total: servers.length,
      criteria 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single server by id
apiServerController.getServer = async (req, res) => {
  try {
    const server = await Server.findByIdWithDetails(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new server
apiServerController.createServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Ensure destructuring does not fail if body is missing fields
    let { name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, description } = req.body || {};
    // Normalize and trim input fields
    name = typeof name === 'string' ? name.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    status = typeof status === 'string' ? status.trim() : '';
    location = typeof location === 'string' ? location.trim() : '';
    type = typeof type === 'string' ? type.trim() : '';
    os = typeof os === 'string' ? os.trim() : os;
    // Validate required fields
    if (!name) return res.status(400).json({ error: 'Server name is required' });
    
    // Check if server name already exists
    const existingServer = await Server.findByName(name);
    if (existingServer) {
      return res.status(400).json({ error: 'Server name already exists' });
    }
    
    if (location) {
      const locationOptions = await getServerLocationOptions();
      if (!locationOptions.some(opt => opt.value === location)) {
        return res.status(400).json({ error: `Invalid location: ${location}` });
      }
    }
    if (status) {
      const statusOptions = await getServerStatusOptions();
      if (!statusOptions.some(opt => opt.value === status)) {
        return res.status(400).json({ error: `Invalid status: ${status}` });
      }
    }
    if (os && !(await Platform.exists(os))) {
      return res.status(400).json({ error: `Invalid platform (os) ID: ${os}` });
    }
    // Normalize array fields
    if (managers && !Array.isArray(managers)) managers = [managers];
    if (systems && !Array.isArray(systems)) systems = [systems];
    if (agents && !Array.isArray(agents)) agents = [agents];
    if (services && !Array.isArray(services)) services = [services];
    if (tags && !Array.isArray(tags)) tags = [tags];
    if (ip_addresses && !Array.isArray(ip_addresses)) ip_addresses = [ip_addresses];
    managers = (managers || []).map(x => Number(x)).filter(x => !isNaN(x));
    systems = (systems || []).map(x => Number(x)).filter(x => !isNaN(x));
    agents = (agents || []).map(x => Number(x)).filter(x => !isNaN(x));
    services = (services || []).map(x => Number(x)).filter(x => !isNaN(x));
    tags = (tags || []).map(x => Number(x)).filter(x => !isNaN(x));
    ip_addresses = (ip_addresses || []).map(x => Number(x)).filter(x => !isNaN(x));
    // Validate manager IDs
    const invalidManagers = [];
    for (const mid of managers) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await Contact.exists(mid))) invalidManagers.push(mid);
    }
    if (invalidManagers.length > 0) return res.status(400).json({ error: `Invalid manager (contact) IDs: ${invalidManagers.join(', ')}` });
    // Validate system IDs
    const invalidSystems = [];
    for (const sid of systems) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await System.exists(sid))) invalidSystems.push(sid);
    }
    if (invalidSystems.length > 0) return res.status(400).json({ error: `Invalid system IDs: ${invalidSystems.join(', ')}` });
    // Validate agent IDs
    const invalidAgents = [];
    for (const aid of agents) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await Agent.exists(aid))) invalidAgents.push(aid);
    }
    if (invalidAgents.length > 0) return res.status(400).json({ error: `Invalid agent IDs: ${invalidAgents.join(', ')}` });
    // Validate service IDs
    const invalidServices = [];
    for (const sid of services) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await Service.exists(sid))) invalidServices.push(sid);
    }
    if (invalidServices.length > 0) return res.status(400).json({ error: `Invalid service IDs: ${invalidServices.join(', ')}` });
    // Validate tag IDs
    const invalidTags = [];
    for (const tid of tags) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await Tag.exists(tid))) invalidTags.push(tid);
    }
    if (invalidTags.length > 0) return res.status(400).json({ error: `Invalid tag IDs: ${invalidTags.join(', ')}` });
    // Validate IP address IDs
    if (!ip_addresses || ip_addresses.length === 0) return res.status(400).json({ error: 'At least one IP address is required' });
    const invalidIps = [];
    const assignedIps = [];
    for (const ipId of ip_addresses) {
      // eslint-disable-next-line no-await-in-loop
      const ipDetails = await IpAddress.findById(ipId);
      if (!ipDetails) {
        invalidIps.push(ipId);
      } else if (ipDetails.status === 'assigned') {
        assignedIps.push(`IP ${ipDetails.ip_address} (ID: ${ipId})`);
      }
    }
    if (invalidIps.length > 0) return res.status(400).json({ error: `Invalid IP address IDs: ${invalidIps.join(', ')}` });
    if (assignedIps.length > 0) return res.status(400).json({ error: `Cannot use already assigned IP addresses: ${assignedIps.join(', ')}` });
    // Create server in database
    const username = req.user && req.user.username ? req.user.username : 'admin';
    const serverId = await Server.create({ name, os, status, location, type, description, username, client });
    await Server.setIpAddresses(serverId, ip_addresses, client);
    await Server.setManagers(serverId, managers, client);
    await Server.setSystems(serverId, systems, client);
    await Server.setAgents(serverId, agents, client);
    await Server.setServices(serverId, services, client);
    await Server.setTags(serverId, tags, client);
    await client.query('COMMIT');
    
    // Fetch the complete server data with all relationships
    const newServer = await Server.findByIdWithDetails(serverId);
    res.status(201).json(newServer);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// Update a server (real implementation, call model)
/**
 * Update a server by ID. Only fields present in the request body are updated; others remain unchanged.
 * Validates only provided fields. Handles arrays and foreign keys robustly. Uses transaction for atomicity.
 * @route PUT /api/v1/servers/:id
 */
/**
 * Update a server by ID. Only fields present in the request body are updated; others remain unchanged.
 * Validates only provided fields. Handles arrays and foreign keys robustly. Uses transaction for atomicity.
 *
 * @route PUT /api/v1/servers/:id
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
// Hàm cập nhật server, tối ưu, dễ đọc, ít lặp code
apiServerController.updateServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    const current = await Server.findById(id);
    if (!current) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Server not found' });
    }

    // Helper
    const allowedFields = [
      'name', 'description', 'os', 'status', 'type', 'location',
      'tags', 'managers', 'systems', 'agents', 'services', 'ip_addresses'
    ];
    const has = key => Object.prototype.hasOwnProperty.call(req.body, key);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalizeArray = val => (Array.isArray(val) ? val : [val]).map(Number).filter(x => !isNaN(x));

    // Validate that all fields sent in the request are allowed
    const invalidFields = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (invalidFields.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid field(s): ${invalidFields.join(', ')}` });
    }

    // Prepare the fields to update
    const updateFields = {
      name: has('name') ? (typeof body.name === 'string' ? body.name.trim() : body.name) : current.name,
      description: has('description') ? (typeof body.description === 'string' ? body.description.trim() : body.description) : current.description,
      os: has('os') ? body.os : current.os_id,
      status: has('status') ? body.status : current.status,
      type: has('type') ? body.type : current.type,
      location: has('location') ? body.location : current.location,
    };

    // Check if server name already exists (only if name is being updated and different from current)
    if (has('name') && updateFields.name && updateFields.name !== current.name) {
      const existingServer = await Server.findByName(updateFields.name);
      if (existingServer && existingServer.id !== parseInt(id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Server name already exists' });
      }
    }

    // Validate enum fields if provided
    if (has('location') && updateFields.location) {
      const locationOptions = await getServerLocationOptions();
      if (!locationOptions.some(opt => opt.value === updateFields.location)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid location: ${updateFields.location}` });
      }
    }
    if (has('status') && updateFields.status) {
      const statusOptions = await getServerStatusOptions();
      if (!statusOptions.some(opt => opt.value === updateFields.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid status: ${updateFields.status}` });
      }
    }
    if (has('os') && updateFields.os && !(await Platform.exists(updateFields.os))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid platform (os) ID: ${updateFields.os}` });
    }

    // Configure array fields
    const arrayFields = [
      { key: 'tags', model: Tag, set: Server.setTags },
      { key: 'managers', model: Contact, set: Server.setManagers },
      { key: 'systems', model: System, set: Server.setSystems },
      { key: 'agents', model: Agent, set: Server.setAgents },
      { key: 'services', model: Service, set: Server.setServices },
      { key: 'ip_addresses', model: IpAddress, set: Server.setIpAddresses },
    ];

    // Normalize and validate array fields
    const normalizedArrays = {};
    for (const { key, model } of arrayFields) {
      if (has(key)) {
        const arr = normalizeArray(body[key]);
        if (arr.length > 0) {
          const invalid = [];
          const assignedIps = [];
          
          for (const itemId of arr) {
            if (key === 'ip_addresses') {
              // Special validation for IP addresses - check both existence and assignment status
              // eslint-disable-next-line no-await-in-loop
              const ipDetails = await IpAddress.findById(itemId);
              if (!ipDetails) {
                invalid.push(itemId);
              } else if (ipDetails.status === 'assigned' && ipDetails.server_id !== parseInt(id)) {
                // IP is assigned to a different server
                assignedIps.push(`IP ${ipDetails.ip_address} (ID: ${itemId})`);
              }
            } else {
              // Regular validation for other relationship types
              // eslint-disable-next-line no-await-in-loop
              if (!(await model.exists(itemId))) invalid.push(itemId);
            }
          }
          
          if (invalid.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Invalid ${key.replace('_', ' ')} IDs: ${invalid.join(', ')}` });
          }
          
          if (assignedIps.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Cannot use already assigned IP addresses: ${assignedIps.join(', ')}` });
          }
        }
        normalizedArrays[key] = arr;
      }
    }

    // Update main fields
    const username = req.user && req.user.username ? req.user.username : 'admin';
    await Server.update(id, { ...updateFields, username, client });

    // Update array fields if present
    for (const { key, set } of arrayFields) {
      if (has(key)) {
        await set(id, normalizedArrays[key], client);
      }
    }

    await client.query('COMMIT');
    const updatedServer = await Server.findByIdWithDetails(id);
    console.info(`[Server Update] id=${id} by user=${username} fields=[${Object.keys(body).join(', ')}] at ${new Date().toISOString()}`);
    res.json(updatedServer);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Server Update Error] id=${req.params.id}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};


// Delete a server
apiServerController.deleteServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    await Server.remove(id, client);
    await client.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export default apiServerController;
