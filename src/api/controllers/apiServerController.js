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
import serverOptions from '../../../config/serverOptions.js';

const apiServerController = {};

// List all servers (with filter, pagination)
apiServerController.listServers = async (req, res) => {
  try {
    const { search, status, type, location, tags, ip, manager, systems, services, os, page = 1, pageSize = 10 } = req.query;
    // Normalize arrays
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

// Get a single server by id
apiServerController.getServer = async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
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
    let { name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, description } = req.body;
    // Normalize and trim
    name = typeof name === 'string' ? name.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    status = typeof status === 'string' ? status.trim() : '';
    location = typeof location === 'string' ? location.trim() : '';
    type = typeof type === 'string' ? type.trim() : '';
    os = typeof os === 'string' ? os.trim() : os;
    // Validate required fields
    if (!name) return res.status(400).json({ error: 'Server name is required' });
    if (location && !serverOptions.locations.some(opt => opt.value === location)) {
      return res.status(400).json({ error: `Invalid location: ${location}` });
    }
    if (status && !serverOptions.status.some(opt => opt.value === status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }
    if (os && !(await Platform.exists(os))) {
      return res.status(400).json({ error: `Invalid platform (os) ID: ${os}` });
    }
    // Normalize arrays 
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
    // Validate managers
    const invalidManagers = [];
    for (const mid of managers) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await Contact.exists(mid))) invalidManagers.push(mid);
    }
    if (invalidManagers.length > 0) return res.status(400).json({ error: `Invalid manager (contact) IDs: ${invalidManagers.join(', ')}` });
    // Validate systems
    const invalidSystems = [];
    for (const sid of systems) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await System.exists(sid))) invalidSystems.push(sid);
    }
    if (invalidSystems.length > 0) return res.status(400).json({ error: `Invalid system IDs: ${invalidSystems.join(', ')}` });
    // Validate agents
    const invalidAgents = [];
    for (const aid of agents) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await Agent.exists(aid))) invalidAgents.push(aid);
    }
    if (invalidAgents.length > 0) return res.status(400).json({ error: `Invalid agent IDs: ${invalidAgents.join(', ')}` });
    // Validate services
    const invalidServices = [];
    for (const sid of services) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await Service.exists(sid))) invalidServices.push(sid);
    }
    if (invalidServices.length > 0) return res.status(400).json({ error: `Invalid service IDs: ${invalidServices.join(', ')}` });
    // Validate tags
    const invalidTags = [];
    for (const tid of tags) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await Tag.exists(tid))) invalidTags.push(tid);
    }
    if (invalidTags.length > 0) return res.status(400).json({ error: `Invalid tag IDs: ${invalidTags.join(', ')}` });
    // Validate ip_addresses
    if (!ip_addresses || ip_addresses.length === 0) return res.status(400).json({ error: 'At least one IP address is required' });
    const invalidIps = [];
    for (const ipId of ip_addresses) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await IpAddress.exists(ipId))) invalidIps.push(ipId);
    }
    if (invalidIps.length > 0) return res.status(400).json({ error: `Invalid IP address IDs: ${invalidIps.join(', ')}` });
    // Create server
    const username = req.user && req.user.username ? req.user.username : 'admin';
    const serverId = await Server.create({ name, os, status, location, type, description, username, client });
    await Server.setIpAddresses(serverId, ip_addresses, client);
    await Server.setManagers(serverId, managers, client);
    await Server.setSystems(serverId, systems, client);
    await Server.setAgents(serverId, agents, client);
    await Server.setServices(serverId, services, client);
    await Server.setTags(serverId, tags, client);
    await client.query('COMMIT');
    res.status(201).json({ id: serverId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// Update a server
apiServerController.updateServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    // Đảm bảo destructure không lỗi nếu body thiếu field
    let { name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, description } = req.body || {};
    // Lấy dữ liệu cũ
    const current = await Server.findById(id);
    if (!current) return res.status(404).json({ error: 'Server not found' });
    // Chỉ update trường được gửi lên, giữ lại giá trị cũ nếu không gửi
    name = typeof name === 'string' && name.trim() !== '' ? name.trim() : current.name;
    description = typeof description === 'string' && description.trim() !== '' ? description.trim() : current.description;
    os = (os === '' || os === undefined) ? current.os_id : os;
    status = (status === '' || status === undefined) ? current.status : status;
    type = (type === '' || type === undefined) ? current.type : type;
    location = (location === '' || location === undefined) ? current.location : location;
    // Validate required fields
    if (!name) return res.status(400).json({ error: 'Server name is required' });
    if (location && !serverOptions.locations.some(opt => opt.value === location)) {
      return res.status(400).json({ error: `Invalid location: ${location}` });
    }
    if (status && !serverOptions.status.some(opt => opt.value === status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }
    if (os && !(await Platform.exists(os))) {
      return res.status(400).json({ error: `Invalid platform (os) ID: ${os}` });
    }
    // Normalize arrays
    if (tags && !Array.isArray(tags)) tags = [tags];
    if (managers && !Array.isArray(managers)) managers = [managers];
    if (systems && !Array.isArray(systems)) systems = [systems];
    if (agents && !Array.isArray(agents)) agents = [agents];
    if (services && !Array.isArray(services)) services = [services];
    if (ip_addresses && !Array.isArray(ip_addresses)) ip_addresses = [ip_addresses];
    tags = tags !== undefined ? tags.map(Number).filter(x => !isNaN(x)) : (Array.isArray(current.tags) ? current.tags.map(t => t.id) : []);
    managers = managers !== undefined ? managers.map(Number).filter(x => !isNaN(x)) : (Array.isArray(current.managers) ? current.managers.map(m => m.id) : []);
    systems = systems !== undefined ? systems.map(Number).filter(x => !isNaN(x)) : (Array.isArray(current.systems) ? current.systems.map(s => s.id) : []);
    agents = agents !== undefined ? agents.map(Number).filter(x => !isNaN(x)) : (Array.isArray(current.agents) ? current.agents.map(a => a.id) : []);
    services = services !== undefined ? services.map(Number).filter(x => !isNaN(x)) : (Array.isArray(current.services) ? current.services.map(s => s.id) : []);
    ip_addresses = ip_addresses !== undefined ? ip_addresses.map(Number).filter(x => !isNaN(x)) : (Array.isArray(current.ip) ? current.ip.map(i => i.id) : []);
    // Validate foreign keys
    const invalidManagers = [];
    for (const mid of managers) {
      if (!(await Contact.exists(mid))) invalidManagers.push(mid);
    }
    if (invalidManagers.length > 0) return res.status(400).json({ error: `Invalid manager (contact) IDs: ${invalidManagers.join(', ')}` });
    const invalidSystems = [];
    for (const sid of systems) {
      if (!(await System.exists(sid))) invalidSystems.push(sid);
    }
    if (invalidSystems.length > 0) return res.status(400).json({ error: `Invalid system IDs: ${invalidSystems.join(', ')}` });
    const invalidAgents = [];
    for (const aid of agents) {
      if (!(await Agent.exists(aid))) invalidAgents.push(aid);
    }
    if (invalidAgents.length > 0) return res.status(400).json({ error: `Invalid agent IDs: ${invalidAgents.join(', ')}` });
    const invalidServices = [];
    for (const sid of services) {
      if (!(await Service.exists(sid))) invalidServices.push(sid);
    }
    if (invalidServices.length > 0) return res.status(400).json({ error: `Invalid service IDs: ${invalidServices.join(', ')}` });
    const invalidTags = [];
    for (const tid of tags) {
      if (!(await Tag.exists(tid))) invalidTags.push(tid);
    }
    if (invalidTags.length > 0) return res.status(400).json({ error: `Invalid tag IDs: ${invalidTags.join(', ')}` });
    if (!ip_addresses || ip_addresses.length === 0) return res.status(400).json({ error: 'At least one IP address is required' });
    const invalidIps = [];
    for (const ipId of ip_addresses) {
      if (!(await IpAddress.exists(ipId))) invalidIps.push(ipId);
    }
    if (invalidIps.length > 0) return res.status(400).json({ error: `Invalid IP address IDs: ${invalidIps.join(', ')}` });
    // Update server
    const username = req.user && req.user.username ? req.user.username : 'admin';
    // Use Server.update model method for updating server info
    await Server.update({
      id,
      name,
      os,
      status,
      location,
      type,
      description,
      username,
      client
    });
    await Server.setIpAddresses(id, ip_addresses, client);
    await Server.setManagers(id, managers, client);
    await Server.setSystems(id, systems, client);
    await Server.setAgents(id, agents, client);
    await Server.setServices(id, services, client);
    await Server.setTags(id, tags, client);
    await client.query('COMMIT');
    res.json({ id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
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
