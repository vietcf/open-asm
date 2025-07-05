// Server controller for CRUD and detail logic

import { pool } from '../../config/config.js';
import Server from '../models/Server.js';
import IpAddress from '../models/IpAddress.js';
import Service from '../models/Service.js';
import Agent from '../models/Agent.js';
import Configuration from '../models/Configuration.js';
import serverOptions from '../../config/serverOptions.js';
import ExcelJS from 'exceljs';



// Helper: always return array of strings for select2 filters
function normalizeFilterArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return [];
}

const serverController = {};

// List all servers with search and pagination
serverController.listServer = async (req, res) => {
  try {
    // Use global pageSizeOptions from res.locals
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    let pageSize = parseInt(req.query.page_size, 10) || pageSizeOptions[0];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    const page = parseInt(req.query.page, 10) || 1;

    // --- Normalize filter params ---
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

    // --- Query server list and count ---
    const serverList = await Server.findFilteredList({
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
    const totalCount = await Server.countFiltered({
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

    res.render('pages/server/server_list', {
      serverList,
      search: filterParams.search,
      page,
      pageSize,
      totalPages,
      totalCount,
      startItem,
      endItem,
      success,
      error,
      locations: serverOptions.locations,
      statusOptions: serverOptions.status,
      typesOptions: serverOptions.types,
      filterLocation: filterParams.location,
      filterType: filterParams.type,
      filterStatus: filterParams.status,
      filterTags: filterParams.tags,
      filterIp: filterParams.ip,
      filterManager: filterParams.manager,
      filterSystems: filterParams.systems,
      filterServices: filterParams.services,
      filterOs: filterParams.os,
      title: 'Server List',
      activeMenu: 'server-list'
    });
  } catch (err) {
    res.status(500).send('Error loading servers: ' + err.message);
  }
};

// Create a new server
serverController.createServer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let { name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, description } = req.body;
    // Validation and normalization
    if (!name || !name.trim()) {
      throw new Error('Server Name is required.');
    }
    os = (os === '' || os === undefined) ? null : os;
    status = (status === '' || status === undefined) ? null : status;
    type = (type === '' || type === undefined) ? null : type;
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    // Normalize lists
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
    let managerList = managers ? (Array.isArray(managers) ? managers : [managers]) : [];
    managerList = managerList.filter(m => m && m !== '');
    let systemList = systems ? (Array.isArray(systems) ? systems : [systems]) : [];
    systemList = systemList.filter(s => s && s !== '');
    let agentList = agents ? (Array.isArray(agents) ? agents : [agents]) : [];
    agentList = agentList.filter(a => a && a !== '');
    let serviceList = services ? (Array.isArray(services) ? services : [services]) : [];
    serviceList = serviceList.filter(sv => sv && sv !== '');
    let tagList = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    tagList = tagList.filter(t => t && t !== '');

    // DB logic: use Server model methods
    const serverId = await Server.create({ name, os, status, location, type, description, username, client });
    await Server.setIpAddresses(serverId, ipIds, client);
    await Server.setManagers(serverId, managerList, client);
    await Server.setSystems(serverId, systemList, client);
    await Server.setAgents(serverId, agentList, client);
    await Server.setServices(serverId, serviceList, client);
    await Server.setTags(serverId, tagList, client);

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
serverController.detailServer = async (req, res) => {
  try {
    const id = req.params.id;
    // Validate id
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: 'Invalid server id' });
    }
    // Get full server detail from model
    const detail = await Server.getFullDetail(id);
    if (!detail) return res.status(404).json({ error: 'Server not found' });
    res.json({
      ...detail,
      description: detail.description || ''
    });
    console.log(`Server detail loaded for ID ${id}`);
  } catch (err) {
    res.status(500).json({ error: 'Error loading server detail', detail: err.message });
  }
};

// Render edit server form
serverController.editServerForm = async (req, res) => {
  try {
    const id = req.params.id;
    const server = await Server.getFullDetail(id);
    if (!server) return res.status(404).send('Server not found');
    // Map fields for select2
    const selectedContacts = (server.managers || []).map(m => ({ id: m.id, text: m.name }));
    const selectedSystems = (server.systems || []).map(s => ({ id: s.id, text: s.name }));
    const selectedAgents = (server.agents || []).map(a => ({ id: a.id, text: a.name + (a.version ? ' (' + a.version + ')' : '') }));
    const selectedServices = (server.services || []).map(sv => ({ id: sv.id, text: sv.name }));
    const selectedIPs = (server.ip || []).map(ip => ({ id: ip.id, text: ip.ip_address }));
    const selectedTags = (server.tags || []).map(tag => ({ id: tag.id, text: tag.name }));
    // Get selected platform id (for select2 ajax, only need selected value)
    let selectedPlatform = server.os_id;
    res.render('pages/server/server_edit', {
      server,
      selectedContacts,
      selectedSystems,
      selectedAgents,
      selectedServices,
      selectedPlatform,
      selectedIPs,
      platforms: [], // not needed, select2 will load via ajax
      selectedTags,
      locations: serverOptions.locations,
      statusOptions: serverOptions.status,
      typesOptions: serverOptions.types,
      title: 'Edit Server',
      activeMenu: 'server-list'
    });
  } catch (err) {
    res.status(500).send('Error loading server: ' + err.message);
  }
};

// Render add server form
serverController.addServerForm = async (req, res) => {
  try {
    res.render('pages/server/server_add', {
      locations: serverOptions.locations, 
      statusOptions: serverOptions.status, 
      typesOptions: serverOptions.types,
      title: 'Add Server',
      activeMenu: 'server-list'
    });
  } catch (err) {
    res.status(500).send('Error loading add server form: ' + err.message);
  }
};

// Handle update server
serverController.updateServer = async (req, res) => {
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
    await Server.update(id, { name, os, status, location, type, description, username, client });
    // Normalize lists
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
    let managerList = managers ? (Array.isArray(managers) ? managers : [managers]) : [];
    managerList = managerList.filter(m => m && m !== '');
    let systemList = systems ? (Array.isArray(systems) ? systems : [systems]) : [];
    systemList = systemList.filter(s => s && s !== '');
    let agentList = agents ? (Array.isArray(agents) ? agents : [agents]) : [];
    agentList = agentList.filter(a => a && a !== '');
    let serviceList = services ? (Array.isArray(services) ? services : [services]) : [];
    serviceList = serviceList.filter(sv => sv && sv !== '');
    let tagList = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    tagList = tagList.filter(t => t && t !== '');
    // Use Server model methods for all relationships
    await Server.setIpAddresses(id, ipIds, client);
    await Server.setManagers(id, managerList, client);
    await Server.setSystems(id, systemList, client);
    await Server.setAgents(id, agentList, client);
    await Server.setServices(id, serviceList, client);
    await Server.setTags(id, tagList, client);
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

serverController.listService = async (req, res) => {
  try {
    // pageSizeOptions đã có sẵn qua res.locals.pageSizeOptions
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    let pageSize = parseInt(req.query.page_size, 10) || pageSizeOptions[0];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const totalCount = await Service.countAll(search);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const serviceList = await Service.findPage(page, pageSize, search);
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const success = req.flash('success')[0];
    const error = req.flash('error')[0];res.render('pages/server/service_list', {
      serviceList,
      search,
      page,
      pageSize,
      totalPages,
      totalCount,
      startItem,
      endItem,
      // allowedPageSizes không cần truyền, đã có global
      success,
      error,
      title: 'Service List',
      activeMenu: 'service'
    });
  } catch (err) {
    res.status(500).send('Error loading services: ' + err.message);
  }
};

serverController.createService = async (req, res) => {
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

serverController.updateService = async (req, res) => {
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

serverController.deleteService = async (req, res) => {
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
serverController.listAgent = async (req, res) => {
  try {
    // pageSizeOptions đã có sẵn qua res.locals.pageSizeOptions
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    let pageSize = parseInt(req.query.page_size, 10) || pageSizeOptions[0];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search ? req.query.search.trim() : '';

    // Truy vấn agent list
    const agentList = await require('../models/Agent').filterList({ search, page, pageSize });
    const totalCount = await require('../models/Agent').filterCount({ search });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const success = req.flash('success')[0];
    const error = req.flash('error')[0];res.render('pages/server/agent_list', {
      agentList, 
      search, 
      page, 
      pageSize, 
      totalPages, 
      totalCount, 
      success, 
      error,
      title: 'Agent List',
      activeMenu: 'agent' // Đặt đúng giá trị để sidebar.ejs nhận diện
    });
  } catch (err) {
    res.status(500).send('Error loading agents: ' + err.message);
  }
};

serverController.createAgent = async (req, res) => {
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

serverController.updateAgent = async (req, res) => {
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

serverController.deleteAgent = async (req, res) => {
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
serverController.apiSearchService = async (req, res) => {
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
serverController.apiSearchAgent = async (req, res) => {
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
serverController.apiSearchServer = async (req, res) => {
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
serverController.deleteServer = async (req, res) => {
  try {
    const id = req.params.id;
    // Remove related links (if ON DELETE CASCADE is not set in DB)
    await Server.remove(id, pool);
    res.redirect('/server/list?success=Server deleted successfully');
  } catch (err) {
    res.redirect('/server/list?error=Unable to delete server');
  }
};

// Export server list as Excel (filtered)
serverController.exportServerList = async (req, res) => {
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
    const serverList = await Server.findFilteredList({
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

export default serverController;
