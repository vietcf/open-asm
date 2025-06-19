// Server controller for CRUD and detail logic
const config = require('../../config/config');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const Server = require('../models/Server');
const IpAddress = require('../models/IpAddress');
const Service = require('../models/Service');
const Agent = require('../models/Agent');
const Configuration = require('../models/Configuration');
const serverOptions = require('../../config/serverOptions');
const ExcelJS = require('exceljs');

const pool = require('../../config/config').pool;

// Helper to normalize filter values for select2 (always array of string)
function normalizeFilterArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return [];
}

// List all servers with search and pagination
exports.listServer = async (req, res) => {
  try {
    // Lấy allowedPageSizes từ config
    let allowedPageSizes = [10, 20, 50];
    try {
      const configPageSize = await Configuration.findByKey('page_size');
      if (configPageSize && typeof configPageSize.value === 'string') {
        allowedPageSizes = configPageSize.value.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);
      }
    } catch (e) {}
    // Lấy pageSize từ query, kiểm tra hợp lệ
    let pageSize = parseInt(req.query.page_size, 10) || allowedPageSizes[0];
    if (!allowedPageSizes.includes(pageSize)) pageSize = allowedPageSizes[0];
    const page = parseInt(req.query.page, 10) || 1;

    // --- CHUẨN HÓA FILTER PARAMS ---
    const filterParams = {
      search: req.query.search ? req.query.search.trim().toLowerCase() : '',
      location: typeof req.query.location !== 'undefined' ? req.query.location : '',
      type: typeof req.query.type !== 'undefined' ? req.query.type : '',
      status: typeof req.query.status !== 'undefined' ? req.query.status : '',
      tags: normalizeFilterArray(req.query['tags[]'] || req.query.tags),
      ip: normalizeFilterArray(req.query['ip[]'] || req.query.ip),
      manager: normalizeFilterArray(req.query['manager[]'] || req.query.manager),
      systems: normalizeFilterArray(req.query['systems[]'] || req.query.systems),
      services: normalizeFilterArray(req.query['services[]'] || req.query.services),
      os: normalizeFilterArray(req.query['os[]'] || req.query.os)
    };
    // ...có thể bổ sung filter khác nếu cần...

    // --- TRUY VẤN SERVER LIST ---
    let serverList, totalCount;
    serverList = await Server.filterList({
      search: filterParams.search,
      status: filterParams.status,
      type: filterParams.type,
      location: filterParams.location,
      tags: filterParams.tags,
      ip: filterParams.ip,
      manager: filterParams.manager,
      systems: filterParams.systems,
      services: filterParams.services,
      os: filterParams.os,
      page,
      pageSize
    });
    totalCount = await Server.filterCount({
      search: filterParams.search,
      status: filterParams.status,
      type: filterParams.type,
      location: filterParams.location,
      tags: filterParams.tags,
      ip: filterParams.ip,
      manager: filterParams.manager,
      systems: filterParams.systems,
      services: filterParams.services,
      os: filterParams.os
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

    const success = req.flash('success')[0];
    const error = req.flash('error')[0];
    const siteConfig = await Configuration.findByKey('site_name');
    const siteName = siteConfig ? siteConfig.value : undefined;

    res.render('layouts/layout', {
      cssPath: config.cssPath,
      jsPath: config.jsPath,
      imgPath: config.imgPath,
      body: ejs.render(
        fs.readFileSync(path.join(__dirname, '../../public/html/pages/server/server_list.ejs'), 'utf8'),
        { serverList, search: filterParams.search, page, pageSize, totalPages, totalCount, startItem, endItem, allowedPageSizes, success, error,
          locations: serverOptions.locations, statusOptions: serverOptions.status, typeOptions: serverOptions.types,
          filterLocation: filterParams.location, filterType: filterParams.type, filterStatus: filterParams.status,
          filterTags: filterParams.tags, filterIp: filterParams.ip, filterManager: filterParams.manager, filterSystems: filterParams.systems, filterServices: filterParams.services, filterOs: filterParams.os
        }
      ),
      title: 'Server List',
      activeMenu: 'server-list',
      user: req.session.user,
      siteName
    });
  } catch (err) {
    res.status(500).send('Error loading servers: ' + err.message);
  }
};

// Create a new server
exports.createServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let { name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, description } = req.body;
    // Validate name
    if (!name || !name.trim()) {
      throw new Error('Server Name is required.');
    }
    // Convert empty string values for integer fields to null
    os = (os === '' || os === undefined) ? null : os;
    status = (status === '' || status === undefined) ? null : status;
    type = (type === '' || type === undefined) ? null : type;
    // location có thể là chuỗi rỗng nếu DB cho phép
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';
    // Insert server (os_id, updated_by only, created_at/updated_at dùng mặc định DB)
    const insertServerRes = await client.query(
      'INSERT INTO servers (name, os_id, status, location, type, description, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, os, status, location, type, description || null, username]
    );
    const serverId = insertServerRes.rows[0].id;
    // Xử lý IP addresses: ip_addresses là mảng các ID IP (string)
    let ipIds = [];
    if (ip_addresses) {
      ipIds = Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses];
      ipIds = ipIds
        .map(ipId => typeof ipId === 'string' ? ipId.trim() : ipId)
        .filter(ipId => ipId && !isNaN(Number(ipId)) && Number.isInteger(Number(ipId)) && Number(ipId) > 0)
        .map(ipId => Number(ipId));
    }
    if (!ipIds || ipIds.length === 0) {
      throw new Error('At least one IP address is required.');
    }
    // Đầu tiên, clear server_id và status của các IP đã gán cho server này trước đó (nếu có)
    await client.query('UPDATE ip_addresses SET server_id = NULL, status = NULL WHERE server_id = $1', [serverId]);
    // Sau đó, gán server_id và status='assigned' cho các IP được chọn
    for (const ipId of ipIds) {
      await client.query('UPDATE ip_addresses SET server_id = $1, status = $2 WHERE id = $3', [serverId, 'assigned', ipId]);
    }
    // Insert managers (server_contact)
    let managerList = managers ? (Array.isArray(managers) ? managers : [managers]) : [];
    managerList = managerList.filter(m => m && m !== '');
    for (const contactId of managerList) {
      await client.query('INSERT INTO server_contact (server_id, contact_id) VALUES ($1, $2)', [serverId, contactId]);
    }
    // Insert systems (server_system)
    let systemList = systems ? (Array.isArray(systems) ? systems : [systems]) : [];
    systemList = systemList.filter(s => s && s !== '');
    for (const systemId of systemList) {
      await client.query('INSERT INTO server_system (server_id, system_id) VALUES ($1, $2)', [serverId, systemId]);
    }
    // Insert agents (server_agents)
    let agentList = agents ? (Array.isArray(agents) ? agents : [agents]) : [];
    agentList = agentList.filter(a => a && a !== '');
    for (const agentId of agentList) {
      await client.query('INSERT INTO server_agents (server_id, agent_id) VALUES ($1, $2)', [serverId, agentId]);
    }
    // Insert services (server_services)
    let serviceList = services ? (Array.isArray(services) ? services : [services]) : [];
    serviceList = serviceList.filter(sv => sv && sv !== '');
    for (const serviceId of serviceList) {
      await client.query('INSERT INTO server_services (server_id, service_id) VALUES ($1, $2)', [serverId, serviceId]);
    }
    // Insert tags (tag_object, object_type = 'server')
    let tagList = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    tagList = tagList.filter(t => t && t !== '');
    for (const tagId of tagList) {
      await client.query(
        "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'server', $2) ON CONFLICT DO NOTHING",
        [tagId, serverId]
      );
    }
    await client.query('COMMIT');
    req.flash('success', 'Server added successfully');
    res.redirect('/server/server/list');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Unable to add server: ' + err.message);
    res.redirect('/server/server/list');
  } finally {
    client.release();
  }
};

// Get server details (for AJAX/detail modal)
exports.detailServer = async (req, res) => {
  try {
    const id = req.params.id;
    // Get server by ID
    const server = await Server.findById(id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    // Get IP addresses
    const ipList = await require('../models/IpAddress').findByServerId(id);
    // Get agents
    const agentRows = await pool.query(
      `SELECT a.id, a.name, a.version, a.description FROM server_agents sa JOIN agents a ON sa.agent_id = a.id WHERE sa.server_id = $1`, [id]
    );
    // Get services
    const serviceRows = await pool.query(
      `SELECT s.id, s.name, s.description FROM server_services ss JOIN services s ON ss.service_id = s.id WHERE ss.server_id = $1`, [id]
    );
    // Get linked systems
    const systemRows = await pool.query(
      `SELECT sys.id, sys.name FROM server_system ss JOIN systems sys ON ss.system_id = sys.id WHERE ss.server_id = $1`, [id]
    );
    // Get platform info
    let platform = null;
    try {
      const platRows = await pool.query(
        `SELECT p.id, p.name FROM platforms p JOIN servers s ON s.os_id = p.id WHERE s.id = $1`, [id]
      );
      platform = platRows.rows.length > 0 ? platRows.rows[0] : null;
    } catch (e) { platform = null; }
    // Get manager info (if server_contact table exists)
    let manager = null;
    try {
      const mgrRes = await pool.query(
        `SELECT c.name FROM server_contact sc JOIN contacts c ON sc.contact_id = c.id WHERE sc.server_id = $1 LIMIT 1`, [id]
      );
      manager = mgrRes.rows.length > 0 ? mgrRes.rows[0].name : null;
    } catch (e) { manager = null; }
    // Get audit fields
    let createdAt = null, updatedAt = null, updatedBy = null;
    try {
      const auditRes = await pool.query(
        'SELECT created_at, updated_at, updated_by FROM servers WHERE id = $1', [id]
      );
      if (auditRes.rows.length > 0) {
        createdAt = auditRes.rows[0].created_at;
        updatedAt = auditRes.rows[0].updated_at;
        updatedBy = auditRes.rows[0].updated_by || '';
      }
    } catch (e) { createdAt = null; updatedAt = null; updatedBy = null; }
    // Get tags for this server (array of tag ids and names)
    let tags = [];
    try {
      const tagRows = await pool.query(
        `SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_type = 'server' AND tobj.object_id = $1`,
        [id]
      );
      tags = tagRows.rows;
    } catch (e) { tags = []; }
    res.json({
      ...server,
      description: server.description || '',
      ip: ipList,
      agents: agentRows.rows,
      services: serviceRows.rows,
      systems: systemRows.rows,
      manager,
      platform,
      tags,
      created_at: createdAt,
      updated_at: updatedAt,
      updated_by: updatedBy
    });

    console.log(`Server detail loaded for ID ${id}`);
  } catch (err) {
    res.status(500).json({ error: 'Error loading server detail', detail: err.message });
  }
};

// Render edit server form
exports.editServerForm = async (req, res) => {
  try {
    const id = req.params.id;
    const serverRow = await pool.query('SELECT * FROM servers WHERE id = $1', [id]);
    if (!serverRow.rows.length) return res.status(404).send('Server not found');
    const server = serverRow.rows[0];
    // Get selected manager ids and names for this server (for select2)
    let selectedContacts = [];
    try {
      const mgrRes = await pool.query('SELECT c.id, c.name FROM server_contact sc JOIN contacts c ON sc.contact_id = c.id WHERE sc.server_id = $1', [id]);
      selectedContacts = mgrRes.rows.map(row => ({ id: row.id, text: row.name }));
    } catch (e) { selectedContacts = []; }
    // Get selected system ids and names for select2
    let selectedSystems = [];
    try {
      const sysRes = await pool.query('SELECT system_id FROM server_system WHERE server_id = $1', [id]);
      const sysIds = sysRes.rows.map(row => row.system_id);
      if (sysIds.length) {
        const sysRows = await pool.query('SELECT id, name FROM systems WHERE id = ANY($1)', [sysIds]);
        selectedSystems = sysRows.rows.map(row => ({ id: row.id, text: row.name }));
      }
    } catch (e) { selectedSystems = []; }
    // Get selected agent ids and names for select2
    let selectedAgents = [];
    try {
      const agRes = await pool.query('SELECT agent_id FROM server_agents WHERE server_id = $1', [id]);
      const agIds = agRes.rows.map(row => row.agent_id);
      if (agIds.length) {
        const agRows = await pool.query('SELECT id, name, version FROM agents WHERE id = ANY($1)', [agIds]);
        selectedAgents = agRows.rows.map(row => ({ id: row.id, text: row.name + (row.version ? ' (' + row.version + ')' : '') }));
      }
    } catch (e) { selectedAgents = []; }
    // Get selected service ids and names for select2
    let selectedServices = [];
    try {
      const svRes = await pool.query('SELECT service_id FROM server_services WHERE server_id = $1', [id]);
      const svIds = svRes.rows.map(row => row.service_id);
      if (svIds.length) {
        const svRows = await pool.query('SELECT id, name FROM services WHERE id = ANY($1)', [svIds]);
        selectedServices = svRows.rows.map(row => ({ id: row.id, text: row.name }));
      }
    } catch (e) { selectedServices = []; }
    // Get selected platform id and info for select2
    let selectedPlatform = null;
    let platforms = [];
    try {
      // Get the os_id field from the server fetched above
      selectedPlatform = server.os_id;
      // Get all platforms to render select2
      const platRows = await pool.query('SELECT id, name FROM platforms');
      platforms = platRows.rows;
    } catch (e) { selectedPlatform = null; platforms = []; }
    // Get selected IPs for this server (ip_addresses table)
    let selectedIPs = [];
    try {
      const ipRows = await pool.query('SELECT id, ip_address FROM ip_addresses WHERE server_id = $1', [id]);
      selectedIPs = ipRows.rows.map(row => ({ id: row.id, text: row.ip_address }));
    } catch (e) { selectedIPs = []; }
    // Get selected tags for this server (for select2)
    let selectedTags = [];
    try {
      const tags = await Server.getTags(id);
      selectedTags = tags.map(tag => ({ id: tag.id, text: tag.name }));
    } catch (e) { selectedTags = []; }
    //console.log('selectedTags:', selectedTags);
    const siteConfig = await Configuration.findByKey('site_name');
    const siteName = siteConfig ? siteConfig.value : undefined;
    res.render('layouts/layout', {
      cssPath: config.cssPath,
      jsPath: config.jsPath,
      imgPath: config.imgPath,
      body: ejs.render(
        fs.readFileSync(path.join(__dirname, '../../public/html/pages/server/server_edit.ejs'), 'utf8'),
        { server, selectedContacts, selectedSystems, selectedAgents, selectedServices, selectedPlatform, selectedIPs, platforms, selectedTags,
          locations: serverOptions.locations, statusOptions: serverOptions.status, typeOptions: serverOptions.types }
      ),
      title: 'Edit Server',
      activeMenu: 'server-list',
      user: req.session.user,
      siteName
    });
  } catch (err) {
    res.status(500).send('Error loading server: ' + err.message);
  }
};

// Render add server form
exports.addServerForm = async (req, res) => {
  try {
    const siteConfig = await Configuration.findByKey('site_name');
    const siteName = siteConfig ? siteConfig.value : undefined;
    res.render('layouts/layout', {
      cssPath: require('../../config/config').cssPath,
      jsPath: require('../../config/config').jsPath,
      imgPath: require('../../config/config').imgPath,
      body: require('ejs').render(
        require('fs').readFileSync(require('path').join(__dirname, '../../public/html/pages/server/server_add.ejs'), 'utf8'),
        { locations: serverOptions.locations, statusOptions: serverOptions.status, typeOptions: serverOptions.types }
      ),
      title: 'Add Server',
      activeMenu: 'server-list',
      user: req.session.user,
      siteName
    });
  } catch (err) {
    res.status(500).send('Error loading add server form: ' + err.message);
  }
};

// Handle update server
exports.updateServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    let { name, os, status, location, type, managers, systems, agents, services, ip, tags, ip_addresses, description } = req.body;
    if (!name || !name.trim()) {
      throw new Error('Server Name is required.');
    }
    // Convert empty string values for integer fields to null
    os = (os === '' || os === undefined) ? null : os;
    status = (status === '' || status === undefined) ? null : status;
    type = (type === '' || type === undefined) ? null : type;
    // location can be string, allow empty string if DB allows
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';
    // Update server fields (set updated_at = NOW(), updated_by)
    await client.query(
      'UPDATE servers SET name=$1, os_id=$2, status=$3, location=$4, type=$5, description=$6, updated_at=NOW(), updated_by=$7 WHERE id=$8',
      [name, os, status, location, type, description || null, username, id]
    );
    // Update IP addresses: ip_addresses là mảng id IP
    await client.query('UPDATE ip_addresses SET server_id = NULL, status = NULL WHERE server_id = $1', [id]);
    let ipIds = [];
    if (ip_addresses) {
      ipIds = Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses];
      ipIds = ipIds
        .map(ipId => typeof ipId === 'string' ? ipId.trim() : ipId)
        .filter(ipId => ipId && !isNaN(Number(ipId)) && Number.isInteger(Number(ipId)) && Number(ipId) > 0)
        .map(ipId => Number(ipId));
    }
    if (!ipIds || ipIds.length === 0) {
      throw new Error('At least one IP address is required.');
    }
    for (const ipId of ipIds) {
      await client.query('UPDATE ip_addresses SET server_id = $1, status = $2 WHERE id = $3', [id, 'assigned', ipId]);
    }
    // Update managers (server_contact table)
    await client.query('DELETE FROM server_contact WHERE server_id = $1', [id]);
    if (managers) {
      let managerList = Array.isArray(managers) ? managers : [managers];
      managerList = managerList.filter(m => m && m !== '');
      for (const contactId of managerList) {
        await client.query('INSERT INTO server_contact (server_id, contact_id) VALUES ($1, $2)', [id, contactId]);
      }
    }
    // Update systems (server_system table)
    await client.query('DELETE FROM server_system WHERE server_id = $1', [id]);
    if (systems) {
      let systemList = Array.isArray(systems) ? systems : [systems];
      systemList = systemList.filter(s => s && s !== '');
      for (const systemId of systemList) {
        await client.query('INSERT INTO server_system (server_id, system_id) VALUES ($1, $2)', [id, systemId]);
      }
    }
    // Update agents (server_agents table)
    await client.query('DELETE FROM server_agents WHERE server_id = $1', [id]);
    if (agents) {
      let agentList = Array.isArray(agents) ? agents : [agents];
      agentList = agentList.filter(a => a && a !== '');
      for (const agentId of agentList) {
        await client.query('INSERT INTO server_agents (server_id, agent_id) VALUES ($1, $2)', [id, agentId]);
      }
    }
    // Update services (server_services table)
    await client.query('DELETE FROM server_services WHERE server_id = $1', [id]);
    if (services) {
      let serviceList = Array.isArray(services) ? services : [services];
      serviceList = serviceList.filter(sv => sv && sv !== '');
      for (const serviceId of serviceList) {
        await client.query('INSERT INTO server_services (server_id, service_id) VALUES ($1, $2)', [id, serviceId]);
      }
    }
    // Update tags (tag_object, object_type = 'server')
    await client.query("DELETE FROM tag_object WHERE object_type = 'server' AND object_id = $1", [id]);
    if (tags && (Array.isArray(tags) ? tags.length > 0 : tags)) {
      let tagList = Array.isArray(tags) ? tags : [tags];
      tagList = tagList.filter(t => t && t !== '');
      for (const tagId of tagList) {
        await client.query(
          "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'server', $2) ON CONFLICT DO NOTHING",
          [tagId, id]
        );
      }
    }
    await client.query('COMMIT');
    req.flash('success', 'Server updated successfully');
    res.redirect('/server/server/list');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Unable to update server: ' + err.message);
    res.redirect('/server/server/list');
  } finally {
    client.release();
  }
};

// ===== SERVICE HANDLERS =====
// List all services
// Render the service list page
// Render the add service form
// Create a new service
// Update a service
// Delete a service

exports.listService = async (req, res) => {
  try {
    // Lấy allowedPageSizes từ config
    let allowedPageSizes = [10, 20, 50];
    try {
      const configPageSize = await Configuration.findByKey('page_size');
      if (configPageSize && typeof configPageSize.value === 'string') {
        allowedPageSizes = configPageSize.value.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);
      }
    } catch (e) {}
    // Lấy pageSize từ query, kiểm tra hợp lệ
    let pageSize = parseInt(req.query.page_size, 10) || allowedPageSizes[0];
    if (!allowedPageSizes.includes(pageSize)) pageSize = allowedPageSizes[0];
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const totalCount = await Service.countAll(search);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const serviceList = await Service.findPage(page, pageSize, search);
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const success = req.flash('success')[0];
    const error = req.flash('error')[0];
    const content = require('ejs').render(
      require('fs').readFileSync(require('path').join(__dirname, '../../public/html/pages/server/service_list.ejs'), 'utf8'),
      {
        serviceList,
        search,
        page,
        pageSize,
        totalPages,
        totalCount,
        startItem,
        endItem,
        allowedPageSizes,
        success,
        error,
        user: req.session.user,
        hasPermission: req.app.locals.hasPermission
      }
    );
    const siteConfig = await Configuration.findByKey('site_name');
    const siteName = siteConfig ? siteConfig.value : undefined;
    res.render('layouts/layout', {
      cssPath: require('../../config/config').cssPath,
      jsPath: require('../../config/config').jsPath,
      imgPath: require('../../config/config').imgPath,
      body: content,
      title: 'Service List',
      activeMenu: 'service',
      user: req.session.user,
      siteName
    });
  } catch (err) {
    res.status(500).send('Error loading services: ' + err.message);
  }
};

exports.createService = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      req.flash('error', 'Service Name is required!');
      return res.redirect('/server/service/list');
    }
    await Service.createService({ name, description });
    req.flash('success', 'Service added successfully');
    res.redirect('/server/service/list');
  } catch (err) {
    req.flash('error', 'Unable to add service');
    res.redirect('/server/service/list');
  }
};

exports.updateService = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      req.flash('error', 'Service Name is required!');
      return res.redirect('/server/service/list');
    }
    await Service.updateService(id, { name, description });
    req.flash('success', 'Service updated successfully');
    res.redirect('/server/service/list');
  } catch (err) {
    req.flash('error', 'Unable to update service');
    res.redirect('/server/service/list');
  }
};

exports.deleteService = async (req, res) => {
  try {
    const id = req.params.id;
    await Service.deleteService(id);
    req.flash('success', 'Service deleted successfully');
    res.redirect('/server/service/list');
  } catch (err) {
    req.flash('error', 'Unable to delete service');
    res.redirect('/server/service/list');
  }
};

// ===== AGENT HANDLERS =====
// List all agents
// List all agents with search and pagination
exports.listAgent = async (req, res) => {
  try {
    // Lấy allowedPageSizes từ config
    let allowedPageSizes = [10, 20, 50];
    try {
      const configPageSize = await Configuration.findByKey('page_size');
      if (configPageSize && typeof configPageSize.value === 'string') {
        allowedPageSizes = configPageSize.value.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);
      }
    } catch (e) {}
    // Lấy pageSize từ query, kiểm tra hợp lệ
    let pageSize = parseInt(req.query.page_size, 10) || allowedPageSizes[0];
    if (!allowedPageSizes.includes(pageSize)) pageSize = allowedPageSizes[0];
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search ? req.query.search.trim() : '';

    // Truy vấn agent list
    const agentList = await require('../models/Agent').filterList({ search, page, pageSize });
    const totalCount = await require('../models/Agent').filterCount({ search });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const success = req.flash('success')[0];
    const error = req.flash('error')[0];
    const siteConfig = await Configuration.findByKey('site_name');
    const siteName = siteConfig ? siteConfig.value : undefined;
    res.render('layouts/layout', {
      cssPath: config.cssPath,
      jsPath: config.jsPath,
      imgPath: config.imgPath,
      body: ejs.render(
        fs.readFileSync(path.join(__dirname, '../../public/html/pages/server/agent_list.ejs'), 'utf8'),
        { agentList, search, page, pageSize, totalPages, totalCount, allowedPageSizes, success, error, user: req.session.user, hasPermission: req.app.locals.hasPermission }
      ),
      title: 'Agent List',
      activeMenu: 'server',
      activeSubMenu: 'agent-list',
      user: req.session.user,
      siteName
    });
  } catch (err) {
    res.status(500).send('Error loading agents: ' + err.message);
  }
};

exports.createAgent = async (req, res) => {
  try {
    const { name, version, description } = req.body;
    if (!name || !name.trim()) {
      req.flash('error', 'Agent Name is required!');
      return res.redirect('/server/agent/list');
    }
    await Agent.createAgent({ name, version, description });
    req.flash('success', 'Agent added successfully');
    res.redirect('/server/agent/list');
  } catch (err) {
    if (err.code === '23505') {
      req.flash('error', 'Agent name already exists. Please choose a different name.');
    } else {
      req.flash('error', err.message || 'Unable to add agent');
    }
    res.redirect('/server/agent/list');
  }
};

exports.updateAgent = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, version, description } = req.body;
    if (!name || !name.trim()) {
      req.flash('error', 'Agent Name is required!');
      return res.redirect('/server/agent/list');
    }
    await Agent.updateAgent(id, { name, version, description });
    req.flash('success', 'Agent updated successfully');
    res.redirect('/server/agent/list');
  } catch (err) {
    if (err.code === '23505') {
      req.flash('error', 'Agent name already exists. Please choose a different name.');
    } else {
      req.flash('error', err.message || 'Unable to update agent');
    }
    res.redirect('/server/agent/list');
  }
};

exports.deleteAgent = async (req, res) => {
  try {
    const id = req.params.id;
    await Agent.deleteAgent(id);
    req.flash('success', 'Agent deleted successfully');
    res.redirect('/server/agent/list');
  } catch (err) {
    let errorMessage = err.message || 'Unable to delete agent';
    req.flash('error', errorMessage);
    res.redirect('/server/agent/list');
  }
};

// API: Get services for select2 ajax
exports.apiSearchService = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    let sql = 'SELECT id, name FROM services';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT 20';
    const result = await pool.query(sql, params);
    const data = result.rows.map(row => ({ id: row.id, text: row.name }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading services', detail: err.message });
  }
};

// API: Get agents for select2 ajax
exports.apiSearchAgent = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    let sql = 'SELECT id, name, version FROM agents';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1 OR LOWER(version) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT 20';
    const result = await pool.query(sql, params);
    const data = result.rows.map(row => ({ id: row.id, text: row.version ? `${row.name} (${row.version})` : row.name }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading agents', detail: err.message });
  }
};

// API: Get servers for select2 ajax
exports.apiSearchServer = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    let sql = 'SELECT id, name FROM servers';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT 20';
    const result = await pool.query(sql, params);
    // Select2 expects: { results: [ { id, text } ] }
    const data = result.rows.map(row => ({ id: row.id, text: row.name }));
    res.json({ results: data });
  } catch (err) {
    res.status(500).json({ error: 'Error loading servers', detail: err.message });
  }
};

// Delete a server and all related links
// This function deletes a server by its ID, removes all related records in join tables (server_contact, server_system, server_agents, server_services, ip_addresses),
// and then deletes the server itself. It redirects to the server list with a success or error message.
exports.deleteServer = async (req, res) => {
  try {
    const id = req.params.id;
    // Remove related links (if ON DELETE CASCADE is not set in DB)
    await pool.query('DELETE FROM server_contact WHERE server_id = $1', [id]);
    await pool.query('DELETE FROM server_system WHERE server_id = $1', [id]);
    await pool.query('DELETE FROM server_agents WHERE server_id = $1', [id]);
    await pool.query('DELETE FROM server_services WHERE server_id = $1', [id]);
    await pool.query('DELETE FROM ip_addresses WHERE server_id = $1', [id]);
    // Remove the server itself
    await pool.query('DELETE FROM servers WHERE id = $1', [id]);
    res.redirect('/server/list?success=Server deleted successfully');
  } catch (err) {
    res.redirect('/server/list?error=Unable to delete server');
  }
};

// Export server list as Excel (filtered)
exports.exportServerList = async (req, res) => {
  try {
    // Chuẩn hóa các tham số filter (giống listServer)
    function normalizeFilterArray(val) {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === 'string') return [val];
      return [];
    }
    const filterParams = {
      search: req.query.search ? req.query.search.trim().toLowerCase() : '',
      location: typeof req.query.location !== 'undefined' ? req.query.location : '',
      type: typeof req.query.type !== 'undefined' ? req.query.type : '',
      status: typeof req.query.status !== 'undefined' ? req.query.status : '',
      tags: normalizeFilterArray(req.query['tags[]'] || req.query.tags),
      ip: normalizeFilterArray(req.query['ip[]'] || req.query.ip),
      manager: normalizeFilterArray(req.query['manager[]'] || req.query.manager),
      systems: normalizeFilterArray(req.query['systems[]'] || req.query.systems),
      services: normalizeFilterArray(req.query['services[]'] || req.query.services),
      os: normalizeFilterArray(req.query['os[]'] || req.query.os)
    };
    // Lấy toàn bộ danh sách (không phân trang)
    const serverList = await Server.filterList({
      search: filterParams.search,
      status: filterParams.status,
      type: filterParams.type,
      location: filterParams.location,
      tags: filterParams.tags,
      ip: filterParams.ip,
      manager: filterParams.manager,
      systems: filterParams.systems,
      services: filterParams.services,
      os: filterParams.os,
      page: 1,
      pageSize: 10000
    });
    // Định nghĩa các cột xuất Excel
    const headers = [
      'ID', 'Name', 'Description', 'IP Address(es)', 'Status', 'Location', 'Type',
      'Managers', 'Platform (OS)', 'Agents', 'Services', 'Systems', 'Tags',
      'Created At', 'Updated At', 'Updated By'
    ];
    const rows = serverList.map(server => [
      server.id,
      server.name || '',
      server.description ? server.description.replace(/\r?\n|\r/g, ' ') : '',
      (server.ip_addresses && server.ip_addresses.length ? server.ip_addresses.map(ip => ip.ip_address).join(', ') : ''),
      server.status || '',
      server.location || '',
      server.type || '',
      (server.managers && server.managers.length ? server.managers.map(m => m.name).join(', ') : ''),
      server.platform_name || '',
      (server.agents && server.agents.length ? server.agents.map(a => a.name).join(', ') : ''),
      (server.services && server.services.length ? server.services.map(s => s.name).join(', ') : ''),
      (server.systems && server.systems.length ? server.systems.map(sy => sy.name).join(', ') : ''),
      (server.tags && server.tags.length ? server.tags.map(t => t.name).join(', ') : ''),
      server.created_at ? new Date(server.created_at).toLocaleString('en-GB') : '',
      server.updated_at ? new Date(server.updated_at).toLocaleString('en-GB') : '',
      server.updated_by || ''
    ]);
    // Tạo file Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Server List');
    worksheet.addRow(headers);
    rows.forEach(row => worksheet.addRow(row));
    worksheet.columns.forEach(col => { col.width = 22; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="server_list.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting server list:', err);
    res.status(500).send('Error exporting server list: ' + err.message);
  }
};
