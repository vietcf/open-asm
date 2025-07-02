// API Controller for Server
const Server = require('../../models/Server');
const IpAddress = require('../../models/IpAddress');
const Platform = require('../../models/Platform');
const Contact = require('../../models/Contact');
const System = require('../../models/System');
const Agent = require('../../models/Agent');
const Service = require('../../models/Service');
const Tag = require('../../models/Tag');
const pool = require('../../../config/config').pool;
const serverOptions = require('../../../config/serverOptions');

// List all servers (with filter, pagination)
exports.listServers = async (req, res) => {
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
    const serverList = await Server.filterList(filterParams);
    const total = await Server.filterCount(filterParams);
    res.json({ data: serverList, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single server by id
exports.getServer = async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new server
exports.createServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let { name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, description } = req.body;
    // --- Validation block start ---
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Server name is required' });
    }
    // Validate location
    if (location && !serverOptions.locations.some(opt => opt.value === location)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid location: ${location}` });
    }
    // Validate status
    if (status && !serverOptions.status.some(opt => opt.value === status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }
    // Validate os (platform)
    if (os && !(await Platform.exists(os))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid platform (os) ID: ${os}` });
    }
    // Validate managers
    if (managers) {
      let managerList = Array.isArray(managers) ? managers : [managers];
      const invalidManagers = [];
      for (const mid of managerList) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await Contact.exists(mid))) invalidManagers.push(mid);
      }
      if (invalidManagers.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid manager (contact) IDs: ${invalidManagers.join(', ')}` });
      }
    }
    // Validate systems
    if (systems) {
      let systemList = Array.isArray(systems) ? systems : [systems];
      const invalidSystems = [];
      for (const sid of systemList) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await System.exists(sid))) invalidSystems.push(sid);
      }
      if (invalidSystems.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid system IDs: ${invalidSystems.join(', ')}` });
      }
    }
    // Validate agents
    if (agents) {
      let agentList = Array.isArray(agents) ? agents : [agents];
      const invalidAgents = [];
      for (const aid of agentList) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await Agent.exists(aid))) invalidAgents.push(aid);
      }
      if (invalidAgents.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid agent IDs: ${invalidAgents.join(', ')}` });
      }
    }
    // Validate services
    if (services) {
      let serviceList = Array.isArray(services) ? services : [services];
      const invalidServices = [];
      for (const sid of serviceList) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await Service.exists(sid))) invalidServices.push(sid);
      }
      if (invalidServices.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid service IDs: ${invalidServices.join(', ')}` });
      }
    }
    // Validate tags
    if (tags) {
      let tagList = Array.isArray(tags) ? tags : [tags];
      const invalidTags = [];
      for (const tid of tagList) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await Tag.exists(tid))) invalidTags.push(tid);
      }
      if (invalidTags.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid tag IDs: ${invalidTags.join(', ')}` });
      }
    }
    // Validate ip_addresses
    let ipIdsValidate = ip_addresses ? (Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses]) : [];
    if (!ipIdsValidate || ipIdsValidate.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one IP address is required' });
    }
    const invalidIps = [];
    for (const ipId of ipIdsValidate) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await IpAddress.exists(ipId))) invalidIps.push(ipId);
    }
    if (invalidIps.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid IP address IDs: ${invalidIps.join(', ')}` });
    }
    // --- Validation block end ---
    os = (os === '' || os === undefined) ? null : os;
    status = (status === '' || status === undefined) ? null : status;
    type = (type === '' || type === undefined) ? null : type;
    const username = req.user && req.user.username ? req.user.username : 'admin';
    const insertServerRes = await client.query(
      'INSERT INTO servers (name, os_id, status, location, type, description, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, os, status, location, type, description || null, username]
    );
    const serverId = insertServerRes.rows[0].id;
    // Handle IP addresses
    let ipIds = ip_addresses ? (Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses]) : [];
    if (!ipIds || ipIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one IP address is required' });
    }
    await client.query('UPDATE ip_addresses SET server_id = NULL, status = NULL WHERE server_id = $1', [serverId]);
    for (const ipId of ipIds) {
      await client.query('UPDATE ip_addresses SET server_id = $1, status = $2 WHERE id = $3', [serverId, 'assigned', ipId]);
    }
    // Managers
    let managerList = managers ? (Array.isArray(managers) ? managers : [managers]) : [];
    await client.query('DELETE FROM server_contact WHERE server_id = $1', [serverId]);
    for (const mid of managerList) {
      await client.query('INSERT INTO server_contact (server_id, contact_id) VALUES ($1, $2)', [serverId, mid]);
    }
    // Systems
    let systemList = systems ? (Array.isArray(systems) ? systems : [systems]) : [];
    await client.query('DELETE FROM server_system WHERE server_id = $1', [serverId]);
    for (const sid of systemList) {
      await client.query('INSERT INTO server_system (server_id, system_id) VALUES ($1, $2)', [serverId, sid]);
    }
    // Agents
    let agentList = agents ? (Array.isArray(agents) ? agents : [agents]) : [];
    await client.query('DELETE FROM server_agents WHERE server_id = $1', [serverId]);
    for (const aid of agentList) {
      await client.query('INSERT INTO server_agents (server_id, agent_id) VALUES ($1, $2)', [serverId, aid]);
    }
    // Services
    let serviceList = services ? (Array.isArray(services) ? services : [services]) : [];
    await client.query('DELETE FROM server_services WHERE server_id = $1', [serverId]);
    for (const sid of serviceList) {
      await client.query('INSERT INTO server_services (server_id, service_id) VALUES ($1, $2)', [serverId, sid]);
    }
    // Tags
    let tagList = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    await client.query(`DELETE FROM tag_object WHERE object_type = 'server' AND object_id = $1`, [serverId]);
    for (const tid of tagList) {
      await client.query(`INSERT INTO tag_object (object_type, object_id, tag_id) VALUES ('server', $1, $2)`, [serverId, tid]);
    }
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
exports.updateServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    let { name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, description } = req.body;
    // --- Validation block start ---
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Server name is required' });
    }
    // Validate location
    if (location && !serverOptions.locations.some(opt => opt.value === location)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid location: ${location}` });
    }
    // Validate status
    if (status && !serverOptions.status.some(opt => opt.value === status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }
    os = (os === '' || os === undefined) ? null : os;
    status = (status === '' || status === undefined) ? null : status;
    type = (type === '' || type === undefined) ? null : type;
    const username = req.user && req.user.username ? req.user.username : 'admin';
    await client.query(
      'UPDATE servers SET name=$1, os_id=$2, status=$3, location=$4, type=$5, description=$6, updated_by=$7, updated_at=NOW() WHERE id=$8',
      [name, os, status, location, type, description || null, username, id]
    );
    // IP addresses
    let ipIds = ip_addresses ? (Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses]) : [];
    if (!ipIds || ipIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one IP address is required' });
    }
    await client.query('UPDATE ip_addresses SET server_id = NULL, status = NULL WHERE server_id = $1', [id]);
    for (const ipId of ipIds) {
      await client.query('UPDATE ip_addresses SET server_id = $1, status = $2 WHERE id = $3', [id, 'assigned', ipId]);
    }
    // Managers
    let managerList = managers ? (Array.isArray(managers) ? managers : [managers]) : [];
    await client.query('DELETE FROM server_contact WHERE server_id = $1', [id]);
    for (const mid of managerList) {
      await client.query('INSERT INTO server_contact (server_id, contact_id) VALUES ($1, $2)', [id, mid]);
    }
    // Systems
    let systemList = systems ? (Array.isArray(systems) ? systems : [systems]) : [];
    await client.query('DELETE FROM server_system WHERE server_id = $1', [id]);
    for (const sid of systemList) {
      await client.query('INSERT INTO server_system (server_id, system_id) VALUES ($1, $2)', [id, sid]);
    }
    // Agents
    let agentList = agents ? (Array.isArray(agents) ? agents : [agents]) : [];
    await client.query('DELETE FROM server_agents WHERE server_id = $1', [id]);
    for (const aid of agentList) {
      await client.query('INSERT INTO server_agents (server_id, agent_id) VALUES ($1, $2)', [id, aid]);
    }
    // Services
    let serviceList = services ? (Array.isArray(services) ? services : [services]) : [];
    await client.query('DELETE FROM server_services WHERE server_id = $1', [id]);
    for (const sid of serviceList) {
      await client.query('INSERT INTO server_services (server_id, service_id) VALUES ($1, $2)', [id, sid]);
    }
    // Tags
    let tagList = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    await client.query(`DELETE FROM tag_object WHERE object_type = 'server' AND object_id = $1`, [id]);
    for (const tid of tagList) {
      await client.query(`INSERT INTO tag_object (object_type, object_id, tag_id) VALUES ('server', $1, $2)`, [id, tid]);
    }
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
exports.deleteServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    await client.query('DELETE FROM server_contact WHERE server_id = $1', [id]);
    await client.query('DELETE FROM server_system WHERE server_id = $1', [id]);
    await client.query('DELETE FROM server_agents WHERE server_id = $1', [id]);
    await client.query('DELETE FROM server_services WHERE server_id = $1', [id]);
    await client.query(`DELETE FROM tag_object WHERE object_type = 'server' AND object_id = $1`, [id]);
    await client.query('UPDATE ip_addresses SET server_id = NULL, status = NULL WHERE server_id = $1', [id]);
    await client.query('DELETE FROM servers WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
