// Server controller for CRUD and detail logic


import { pool } from '../../config/config.js';
import Server from '../models/Server.js';
import IpAddress from '../models/IpAddress.js';
import Service from '../models/Service.js';
import Agent from '../models/Agent.js';
import Platform from '../models/Platform.js';
import Configuration from '../models/Configuration.js';
import Tag from '../models/Tag.js';
import Contact from '../models/Contact.js';
import System from '../models/System.js';
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Load server options from DB config
async function getServerLocationsFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('device_location');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        options = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) { options = []; }
  if (!Array.isArray(options) || options.length === 0) {
    options = [
      { value: 'DC', label: 'DC' },
      { value: 'DR', label: 'DR' }
    ];
  }
  return options;
}

async function getServerStatusOptionsFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('server_status');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        options = parsed.map(item => typeof item === 'object' ? item : { value: String(item.value), label: String(item.label) });
      }
    }
  } catch (e) { options = []; }
  if (!Array.isArray(options) || options.length === 0) {
    options = [
      { value: 'ONLINE', label: 'ONLINE' },
      { value: 'OFFLINE', label: 'OFFLINE' },
      { value: 'MAINTENANCE', label: 'MAINTENANCE' }
    ];
  }
  return options;
}

async function getServerTypeOptionsFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('server_type');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        options = parsed.map(item => typeof item === 'object' ? item : { value: String(item.value), label: String(item.label) });
      }
    }
  } catch (e) { options = []; }
  if (!Array.isArray(options) || options.length === 0) {
    options = [
      { value: 'PHYSICAL', label: 'PHYSICAL' },
      { value: 'VIRTUAL-MACHINE', label: 'VIRTUAL-MACHINE' },
      { value: 'CLOUD-INSTANCE', label: 'CLOUD-INSTANCE' }
    ];
  }
  return options;
}

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

    const [locations, statusOptions, typesOptions] = await Promise.all([
      getServerLocationsFromConfig(),
      getServerStatusOptionsFromConfig(),
      getServerTypeOptionsFromConfig()
    ]);
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
      locations,
      statusOptions,
      typesOptions,
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
    let selectedPlatform = server.os_id;
    // Truyền platform đã chọn (id, text) cho select2 ajax pre-populate
    const selectedPlatformObj = server.os_id && server.platform_name ? { id: server.os_id, text: server.platform_name } : null;
    const [locations, statusOptions, typesOptions] = await Promise.all([
      getServerLocationsFromConfig(),
      getServerStatusOptionsFromConfig(),
      getServerTypeOptionsFromConfig()
    ]);
    res.render('pages/server/server_edit', {
      server,
      selectedContacts,
      selectedSystems,
      selectedAgents,
      selectedServices,
      selectedPlatform,
      selectedPlatformObj,
      selectedIPs,
      selectedTags,
      locations,
      statusOptions,
      typesOptions,
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
    const [locations, statusOptions, typesOptions] = await Promise.all([
      getServerLocationsFromConfig(),
      getServerStatusOptionsFromConfig(),
      getServerTypeOptionsFromConfig()
    ]);
    res.render('pages/server/server_add', {
      locations,
      statusOptions,
      typesOptions,
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
    await Service.create({ name, description });
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
    await Service.update(id, { name, description });
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
    await Service.delete(id);
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
    const agentList = await Agent.findFilteredList({ search, page, pageSize });
    const totalCount = await Agent.countFiltered({ search });
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
    await Agent.create({ name, version, description });
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
    // Use new partial update method
    await Agent.update(id, { 
      name: name.trim(), 
      version: version ? version.trim() : null, 
      description: description ? description.trim() : null 
    });
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
    await Agent.delete(id);
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
    const data = await Service.select2Search({ search, limit: 20 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading services', detail: err.message });
  }
};

// API: Get agents for select2 ajax
serverController.apiSearchAgent = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    const data = await Agent.select2Search({ search, limit: 20 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading agents', detail: err.message });
  }
};

// API: Get servers for select2 ajax
serverController.apiSearchServer = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    const data = await Server.select2Search({ search, limit: 20 });
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
    res.redirect('/server/server/list?success=Server deleted successfully');
  } catch (err) {
    res.redirect('/server/server/list?error=Unable to delete server');
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
      (server.ip && server.ip.length ? server.ip.map(ip => ip.ip_address).join(', ') : ''),
      server.status || '',
      server.location || '',
      server.type || '',
      (server.managers && server.managers.length ? server.managers.map(m => m.email || m.name || 'Unknown').join(', ') : ''),
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

// ====== SERVER IMPORT FUNCTIONS ======

// Helper function to sanitize string data for Excel
function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  
  // Remove or replace problematic characters that can cause Excel corruption
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[\uFEFF]/g, '') // Remove BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .trim();
}

// Download server template
serverController.downloadServerTemplate = async (req, res) => {
  try {
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Server Template');
    
    // Add headers
    worksheet.addRow([
      'Name (Optional - auto-generated if empty)',
      'IPAddress (Require, comma-separated if multiple)',
      'OS',
      'Status',
      'Location',
      'Type',
      'Manager (comma-separated if multiple)',
      'System (comma-separated if multiple)',
      'Agent (comma-separated if multiple)',
      'Service (comma-separated if multiple)',
      'Tag (comma-separated if multiple)',
      'Description'
    ]);
    
    // Add sample data
    worksheet.addRow([
      'Test Server 1',
      '192.168.1.100,192.168.1.101',
      'Linux',
      'ONLINE',
      'DC',
      'Physical',
      'admin@company.com,manager@company.com',
      'System1,System2',
      'Agent1,Agent2',
      'Service1,Service2',
      'Tag1,Tag2',
      'Test server description'
    ]);
    
    // Add sample with auto-generated name
    worksheet.addRow([
      '', // Empty name - will be auto-generated
      '192.168.2.3',
      'Windows',
      'OFFLINE',
      'DR',
      'Virtual',
      'admin@company.com',
      'System1',
      'Agent1',
      'Service1',
      'Tag1',
      'Auto-generated name example'
    ]);
    
    // Set column widths
    worksheet.columns = [
      { width: 25 },  // Name
      { width: 40 },  // IPAddress
      { width: 15 },  // OS
      { width: 15 },  // Status
      { width: 15 },  // Location
      { width: 15 },  // Type
      { width: 30 },  // Manager
      { width: 25 },  // System
      { width: 25 },  // Agent
      { width: 25 },  // Service
      { width: 25 },  // Tag
      { width: 30 }   // Description
    ];
    
    // Create temp directory if not exists
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, 'temp_server_template.xlsx');
    await workbook.xlsx.writeFile(tempPath);
    
    // Check if file exists and get size
    if (fs.existsSync(tempPath)) {
      const stats = fs.statSync(tempPath);
      
      // Use res.download() for proper file download handling
      res.download(tempPath, 'server_list_template.xlsx', (err) => {
        if (err) {
          console.error('Error downloading template file:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error downloading template file' });
          }
        }
        
        // Clean up template file after download
        setTimeout(() => {
          try {
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
              console.log('Template file cleaned up:', tempPath);
            }
          } catch (cleanupErr) {
            console.error('Error cleaning up template file:', cleanupErr);
          }
        }, 5000); // 5 seconds delay
      });
    } else {
      throw new Error('Template Excel file was not created');
    }
    
  } catch (err) {
    console.error('Error creating server template:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error creating template: ' + err.message });
    }
  }
};

// Validate server import file
serverController.validateImportServers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    let rows = [];

    // Parse file based on extension
    const ext = path.extname(originalFileName).toLowerCase();
    let headers = [];
    
    if (ext === '.csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        return res.status(400).json({ error: 'File must contain at least a header row and one data row' });
      }
      
      headers = jsonData[0];
      for (let i = 1; i < jsonData.length; i++) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = jsonData[i][index] || '';
        });
        rows.push(row);
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Validate file format - check required columns
    const requiredColumns = [
      'Name (Optional - auto-generated if empty)',
      'IPAddress (Require, comma-separated if multiple)',
      'OS',
      'Status',
      'Location',
      'Type',
      'Manager (comma-separated if multiple)',
      'System (comma-separated if multiple)',
      'Agent (comma-separated if multiple)',
      'Service (comma-separated if multiple)',
      'Tag (comma-separated if multiple)',
      'Description'
    ];

    // Check for missing columns
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: 'File format validation failed',
        details: {
          missingColumns: missingColumns,
          message: `Missing required columns: ${missingColumns.join(', ')}`
        }
      });
    }

    // Check for extra columns
    const extraColumns = headers.filter(col => !requiredColumns.includes(col));
    if (extraColumns.length > 0) {
      return res.status(400).json({ 
        error: 'File format validation failed',
        details: {
          extraColumns: extraColumns,
          message: `Extra columns found: ${extraColumns.join(', ')}. Please use the correct template.`
        }
      });
    }

    // Check column order (optional - can be flexible)
    const columnOrderMismatch = requiredColumns.some((col, index) => headers[index] !== col);
    if (columnOrderMismatch) {
      console.warn('Column order mismatch detected, but continuing with validation...');
    }

    // Get valid options from database
    const [validLocations, validStatuses] = await Promise.all([
      getServerLocationsFromConfig(),
      getServerStatusOptionsFromConfig()
    ]);
    
    // Extract values from config objects
    const validLocationValues = validLocations.map(loc => loc.value || loc.label || loc);
    const validStatusValues = validStatuses.map(status => status.value || status.label || status);

    // Validate each row
    const validationResults = [];
    const ipRegex = /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 1,
        name: sanitizeString(row['Name (Optional - auto-generated if empty)'] || ''),
        ip_addresses: sanitizeString(row['IPAddress (Require, comma-separated if multiple)'] || ''),
        os: sanitizeString(row['OS'] || ''),
        status: sanitizeString(row['Status'] || ''),
        location: sanitizeString(row['Location'] || ''),
        type: sanitizeString(row['Type'] || ''),
        manager: sanitizeString(row['Manager (comma-separated if multiple)'] || ''),
        system: sanitizeString(row['System (comma-separated if multiple)'] || ''),
        agent: sanitizeString(row['Agent (comma-separated if multiple)'] || ''),
        service: sanitizeString(row['Service (comma-separated if multiple)'] || ''),
        tag: sanitizeString(row['Tag (comma-separated if multiple)'] || ''),
        description: sanitizeString(row['Description'] || ''),
        validation_status: 'PASS',
        validation_reason: ''
      };

      // Server name is not required - will be auto-generated if empty

      if (!result.ip_addresses) {
        result.validation_status = 'FAIL';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + 'IP addresses are required';
      } else {
        // Validate IP addresses format
        const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
        for (const ip of ipList) {
          if (!ipRegex.test(ip)) {
            result.validation_status = 'FAIL';
            result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Invalid IP format: ${ip}`;
          }
        }
      }

      // Validate status
      if (result.status && !validStatusValues.includes(result.status)) {
        result.validation_status = 'FAIL';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Invalid status: ${result.status}. Valid values: ${validStatusValues.join(', ')}`;
      }

      // Validate OS/Platform (if provided)
      if (result.os) {
        const existingPlatforms = await Platform.findByNameExact(result.os);
        if (!existingPlatforms || existingPlatforms.length === 0) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `OS/Platform not found: ${result.os}`;
        }
      }

      // Validate location
      if (result.location && !validLocationValues.includes(result.location)) {
        result.validation_status = 'FAIL';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Invalid location: ${result.location}. Valid values: ${validLocationValues.join(', ')}`;
      }

      // Check if server already exists (by name OR by assigned IP)
      let serverExists = false;
      let serverExistsReason = '';

      // Check by server name
      if (result.name) {
        const existingServer = await Server.findByName(result.name);
        if (existingServer) {
          serverExists = true;
          serverExistsReason = 'Server name already exists';
        }
      }

      // Check by assigned IP addresses
      if (result.ip_addresses) {
        const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
        const assignedIPs = [];
        for (const ip of ipList) {
          const existingIP = await IpAddress.findByAddressWithDetails(ip);
          if (existingIP && existingIP.status === 'assigned') {
            assignedIPs.push(ip);
          }
        }
        if (assignedIPs.length > 0) {
          serverExists = true;
          if (serverExistsReason) {
            serverExistsReason += `; IP(s) already assigned to servers: ${assignedIPs.join(', ')}`;
          } else {
            serverExistsReason = `IP(s) already assigned to servers: ${assignedIPs.join(', ')}`;
          }
        }
      }

      // If server exists, mark as FAIL
      if (serverExists) {
        result.validation_status = 'FAIL';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + serverExistsReason;
      }

      // Validate Tags
      if (result.tag) {
        const tagList = result.tag.split(',').map(t => t.trim()).filter(t => t);
        const invalidTags = [];
        for (const tagName of tagList) {
          const existingTags = await Tag.findByNameExact(tagName);
          if (!existingTags || existingTags.length === 0) {
            invalidTags.push(tagName);
          }
        }
        if (invalidTags.length > 0) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Tag(s) not found: ${invalidTags.join(', ')}`;
        }
      }

      // Validate Contacts/Managers
      if (result.manager) {
        const managerList = result.manager.split(',').map(m => m.trim()).filter(m => m);
        const invalidManagers = [];
        for (const managerEmail of managerList) {
          const existingContacts = await Contact.findByEmailSearch(managerEmail);
          if (!existingContacts || existingContacts.length === 0) {
            invalidManagers.push(managerEmail);
          }
        }
        if (invalidManagers.length > 0) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Manager(s) not found: ${invalidManagers.join(', ')}`;
        }
      }

      // Validate Systems
      if (result.system) {
        const systemList = result.system.split(',').map(s => s.trim()).filter(s => s);
        const invalidSystems = [];
        for (const systemName of systemList) {
          const existingSystems = await System.findByNameExact(systemName);
          if (!existingSystems || existingSystems.length === 0) {
            invalidSystems.push(systemName);
          }
        }
        if (invalidSystems.length > 0) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `System(s) not found: ${invalidSystems.join(', ')}`;
        }
      }

      // Validate Agents
      if (result.agent) {
        const agentList = result.agent.split(',').map(a => a.trim()).filter(a => a);
        const invalidAgents = [];
        for (const agentName of agentList) {
          const existingAgents = await Agent.findByNameExact(agentName);
          if (!existingAgents || existingAgents.length === 0) {
            invalidAgents.push(agentName);
          }
        }
        if (invalidAgents.length > 0) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Agent(s) not found: ${invalidAgents.join(', ')}`;
        }
      }

      // Validate Services
      if (result.service) {
        const serviceList = result.service.split(',').map(s => s.trim()).filter(s => s);
        const invalidServices = [];
        for (const serviceName of serviceList) {
          const existingServices = await Service.findByNameExact(serviceName);
          if (!existingServices || existingServices.length === 0) {
            invalidServices.push(serviceName);
          }
        }
        if (invalidServices.length > 0) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Service(s) not found: ${invalidServices.join(', ')}`;
        }
      }

      // Check if server already exists (by name or IP)
      if (result.validation_status === 'PASS') {
        let serverExists = false;
        let existingServerInfo = '';

        // Check by server name if provided
        if (result.name && result.name.trim() !== '') {
          const existingByName = await Server.findByName(result.name.trim());
          if (existingByName) {
            serverExists = true;
            existingServerInfo = `Server with name "${result.name}" already exists (ID: ${existingByName.id})`;
          }
        }

        // Check by IP addresses if server name check passed
        if (!serverExists && result.ip_addresses) {
          const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
          for (const ip of ipList) {
            // First check if IP exists and its status
            const ipRecord = await IpAddress.findByAddress(ip);
            if (ipRecord) {
              // If IP exists and is assigned, always fail
              if (ipRecord.status === 'assigned') {
                serverExists = true;
                existingServerInfo = `IP "${ip}" is already assigned - server/device already exists`;
                break;
              }
            }
          }
        }

        if (serverExists) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + existingServerInfo;
        }
      }

      validationResults.push(result);
    }

    // Create validation results Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Validation Results');
    
    // Add headers
    worksheet.addRow([
      'Name (Optional - auto-generated if empty)',
      'IPAddress (Require, comma-separated if multiple)',
      'OS',
      'Status',
      'Location',
      'Manager (comma-separated if multiple)',
      'System (comma-separated if multiple)',
      'Agent (comma-separated if multiple)',
      'Service (comma-separated if multiple)',
      'Tag (comma-separated if multiple)',
      'Description',
      'Validation Status',
      'Validation Reason'
    ]);

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    validationResults.forEach(result => {
      const row = worksheet.addRow([
        result.name,
        result.ip_addresses,
        result.os,
        result.status,
        result.location,
        result.manager,
        result.system,
        result.agent,
        result.service,
        result.tag,
        result.description,
        result.validation_status,
        result.validation_reason
      ]);

      // Color code validation status
      if (result.validation_status === 'FAIL') {
        row.getCell(12).font = { color: { argb: 'FFFF0000' } }; // Validation Status column
        row.getCell(13).font = { color: { argb: 'FFFF0000' } }; // Validation Reason column
      } else {
        row.getCell(12).font = { color: { argb: 'FF008000' } }; // Validation Status column
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 25 },  // Name
      { width: 40 },  // IPAddress
      { width: 15 },  // OS
      { width: 15 },  // Status
      { width: 15 },  // Location
      { width: 30 },  // Manager
      { width: 25 },  // System
      { width: 25 },  // Agent
      { width: 25 },  // Service
      { width: 25 },  // Tag
      { width: 30 },  // Description
      { width: 20 },  // Validation Status
      { width: 50 }   // Validation Reason
    ];

    // Create temp directory if not exists
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const excelFileName = `${timestamp}_${originalFileName}_validation.xlsx`;
    const excelFilePath = path.join(tempDir, excelFileName);
    await workbook.xlsx.writeFile(excelFilePath);    // Calculate validation summary
    const allPassed = validationResults.every(result => result.validation_status === 'PASS');
    const passCount = validationResults.filter(result => result.validation_status === 'PASS').length;
    const failCount = validationResults.filter(result => result.validation_status === 'FAIL').length;
    
    // Send Excel file directly
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
    res.setHeader('Content-Length', fs.statSync(excelFilePath).size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Validation-Summary', JSON.stringify({
      allPassed,
      passCount,
      failCount,
      totalCount: validationResults.length
    }));

    const fileBuffer = fs.readFileSync(excelFilePath);
    res.send(fileBuffer);

    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    // Clean up temp Excel file after a delay
    setTimeout(() => {
      try {
        if (fs.existsSync(excelFilePath)) {
          fs.unlinkSync(excelFilePath);
          console.log('Validation file cleaned up:', excelFilePath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up validation file:', cleanupErr);
      }
    }, 10000); // 10 seconds delay

  } catch (err) {
    console.error('Error validating server import file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error validating import file: ' + err.message });
    }
  }
};

// Import servers
serverController.importServers = async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    let rows = [];

    // Parse file (same logic as validation)
    const ext = path.extname(originalFileName).toLowerCase();
    let headers = [];
    
    if (ext === '.csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        return res.status(400).json({ error: 'File must contain at least a header row and one data row' });
      }
      
      headers = jsonData[0];
      for (let i = 1; i < jsonData.length; i++) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = jsonData[i][index] || '';
        });
        rows.push(row);
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Validate file format - check required columns
    const requiredColumns = [
      'Name (Optional - auto-generated if empty)',
      'IPAddress (Require, comma-separated if multiple)',
      'OS',
      'Status',
      'Location',
      'Type',
      'Manager (comma-separated if multiple)',
      'System (comma-separated if multiple)',
      'Agent (comma-separated if multiple)',
      'Service (comma-separated if multiple)',
      'Tag (comma-separated if multiple)',
      'Description'
    ];

    // Check for missing columns
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: 'File format validation failed',
        details: {
          missingColumns: missingColumns,
          message: `Missing required columns: ${missingColumns.join(', ')}`
        }
      });
    }

    // Check for extra columns
    const extraColumns = headers.filter(col => !requiredColumns.includes(col));
    if (extraColumns.length > 0) {
      return res.status(400).json({ 
        error: 'File format validation failed',
        details: {
          extraColumns: extraColumns,
          message: `Extra columns found: ${extraColumns.join(', ')}. Please use the correct template.`
        }
      });
    }

    await client.query('BEGIN');

    const importResults = [];
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 1,
        name: sanitizeString(row['Name (Optional - auto-generated if empty)'] || ''),
        ip_addresses: sanitizeString(row['IPAddress (Require, comma-separated if multiple)'] || ''),
        os: sanitizeString(row['OS'] || ''),
        status: sanitizeString(row['Status'] || ''),
        location: sanitizeString(row['Location'] || ''),
        type: sanitizeString(row['Type'] || ''),
        manager: sanitizeString(row['Manager (comma-separated if multiple)'] || ''),
        system: sanitizeString(row['System (comma-separated if multiple)'] || ''),
        agent: sanitizeString(row['Agent (comma-separated if multiple)'] || ''),
        service: sanitizeString(row['Service (comma-separated if multiple)'] || ''),
        tag: sanitizeString(row['Tag (comma-separated if multiple)'] || ''),
        description: sanitizeString(row['Description'] || ''),
        import_status: 'SUCCESS',
        import_reason: ''
      };

      try {
        // Double-check server doesn't exist (safety check)
        let serverExists = false;
        
        // Check by server name
        if (result.name) {
          const existingServer = await Server.findByName(result.name);
          if (existingServer) {
            serverExists = true;
            result.import_reason = 'Server name already exists';
          }
        }
        
        // Check by assigned IP addresses
        if (!serverExists && result.ip_addresses) {
          const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
          for (const ip of ipList) {
            const existingIP = await IpAddress.findByAddressWithDetails(ip);
            if (existingIP && existingIP.status === 'assigned') {
              serverExists = true;
              result.import_reason = `IP ${ip} is already assigned to a server`;
              break;
            }
          }
        }
        
        if (serverExists) {
          result.import_status = 'FAILED';
          result.import_reason = result.import_reason || 'Server already exists';
        } else {
          // Generate server name if not provided
          let serverName = result.name;
          if (!serverName || serverName.trim() === '') {
            // Get first IP address
            const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
            const firstIP = ipList[0] || 'unknown';
            
            // Get platform name and replace spaces with dashes
            let platformName = '';
            if (result.os && result.os.trim() !== '') {
              // Use OS string directly
              platformName = result.os.trim().replace(/\s+/g, '-').toLowerCase();
            }
            
            // Generate server name: server_<platform>_<first-ip>
            if (platformName) {
              serverName = `server_${platformName}_${firstIP}`;
            } else {
              serverName = `server_${firstIP}`;
            }
          }
          
          // Convert OS string to ID
          let osId = null;
          if (result.os && result.os.trim() !== '') {
            const platforms = await Platform.findByNameExact(result.os.trim());
            if (platforms && platforms.length > 0) {
              osId = platforms[0].id;
            }
          }

          // Create server
          const serverId = await Server.create({
            name: serverName,
            os: osId,
            status: result.status || null,
            location: result.location || null,
            type: result.type || null,
            description: result.description || null,
            username,
            client
          });

        // Set IP addresses
        if (result.ip_addresses) {
          const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
          const ipIds = [];
          
          // Create detailed description for IP
          const ipDescription = [
            `Note: This IP address was automatically created from server import feature`,
            `Server: ${serverName}`,
            `OS: ${result.os || 'N/A'}`,
            `Status: ${result.status || 'N/A'}`,
            `Location: ${result.location || 'N/A'}`,
            `Manager: ${result.manager || 'N/A'}`,
            `System: ${result.system || 'N/A'}`,
            `Agent: ${result.agent || 'N/A'}`,
            `Service: ${result.service || 'N/A'}`,
            `Tag: ${result.tag || 'N/A'}`,
            `Description: ${result.description || 'N/A'}`
          ].join('\n');
          
          for (const ip of ipList) {
            let ipRecord = await IpAddress.findByAddress(ip);
            
            if (!ipRecord) {
              // Create new IP address if not exists
              ipRecord = await IpAddress.create({
                address: ip,
                description: ipDescription,
                status: 'assigned',
                updated_by: username
              }, client);
            }
            
            ipIds.push(ipRecord.id);
          }
          
          if (ipIds.length > 0) {
            await Server.setIpAddresses(serverId, ipIds, client);
            
            // Set contacts for IP addresses (if managers exist)
            if (result.manager) {
              const managerList = result.manager.split(',').map(m => m.trim()).filter(m => m);
              const managerIds = [];
              for (const managerEmail of managerList) {
                const existingContacts = await Contact.findByEmailSearch(managerEmail);
                if (existingContacts && existingContacts.length > 0) {
                  managerIds.push(existingContacts[0].id);
                }
              }
              
              // Set contacts for each IP
              for (const ipId of ipIds) {
                if (managerIds.length > 0) {
                  // @ts-ignore - client parameter is supported by model methods
                  await IpAddress.setContacts(ipId, managerIds, client);
                }
              }
            }
          }
        }

        // Set managers
        if (result.manager) {
          const managerList = result.manager.split(',').map(m => m.trim()).filter(m => m);
          const managerIds = [];
          for (const managerEmail of managerList) {
            const existingContacts = await Contact.findByEmailSearch(managerEmail);
            if (existingContacts && existingContacts.length > 0) {
              managerIds.push(existingContacts[0].id);
            }
          }
          if (managerIds.length > 0) {
            await Server.setManagers(serverId, managerIds, client);
          }
        }

        // Set systems
        if (result.system) {
          const systemList = result.system.split(',').map(s => s.trim()).filter(s => s);
          const systemIds = [];
          for (const systemName of systemList) {
            const existingSystems = await System.findByNameExact(systemName);
            if (existingSystems && existingSystems.length > 0) {
              systemIds.push(existingSystems[0].id);
            }
          }
          if (systemIds.length > 0) {
            await Server.setSystems(serverId, systemIds, client);
          }
        }

        // Set agents
        if (result.agent) {
          const agentList = result.agent.split(',').map(a => a.trim()).filter(a => a);
          const agentIds = [];
          for (const agentName of agentList) {
            const existingAgents = await Agent.findByNameExact(agentName);
            if (existingAgents && existingAgents.length > 0) {
              agentIds.push(existingAgents[0].id);
            }
          }
          if (agentIds.length > 0) {
            await Server.setAgents(serverId, agentIds, client);
          }
        }

        // Set services
        if (result.service) {
          const serviceList = result.service.split(',').map(s => s.trim()).filter(s => s);
          const serviceIds = [];
          for (const serviceName of serviceList) {
            const existingServices = await Service.findByNameExact(serviceName);
            if (existingServices && existingServices.length > 0) {
              serviceIds.push(existingServices[0].id);
            }
          }
          if (serviceIds.length > 0) {
            await Server.setServices(serverId, serviceIds, client);
          }
        }

        // Set tags
        if (result.tag) {
          const tagList = result.tag.split(',').map(t => t.trim()).filter(t => t);
          const tagIds = [];
          for (const tagName of tagList) {
            const existingTags = await Tag.findByNameExact(tagName);
            if (existingTags && existingTags.length > 0) {
              tagIds.push(existingTags[0].id);
            }
          }
          if (tagIds.length > 0) {
            await Server.setTags(serverId, tagIds, client);
          }
        }
        } // End of else block for server creation

      } catch (err) {
        result.import_status = 'FAILED';
        result.import_reason = err.message;
      }

      importResults.push(result);
    }

    await client.query('COMMIT');

    // Create import results Excel file (same as validation)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import Results');
    
    // Add headers
    worksheet.addRow([
      'Name (Optional - auto-generated if empty)',
      'IPAddress (Require, comma-separated if multiple)',
      'OS',
      'Status',
      'Location',
      'Manager (comma-separated if multiple)',
      'System (comma-separated if multiple)',
      'Agent (comma-separated if multiple)',
      'Service (comma-separated if multiple)',
      'Tag (comma-separated if multiple)',
      'Description',
      'Import Status',
      'Import Reason'
    ]);

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    importResults.forEach(result => {
      const row = worksheet.addRow([
        result.name,
        result.ip_addresses,
        result.os,
        result.status,
        result.location,
        result.manager,
        result.system,
        result.agent,
        result.service,
        result.tag,
        result.description,
        result.import_status,
        result.import_reason
      ]);

      // Color code import status
      if (result.import_status === 'FAILED') {
        row.getCell(12).font = { color: { argb: 'FFFF0000' } }; // Import Status column
        row.getCell(13).font = { color: { argb: 'FFFF0000' } }; // Import Reason column
      } else {
        row.getCell(12).font = { color: { argb: 'FF008000' } }; // Import Status column
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 25 },  // Name
      { width: 40 },  // IPAddress
      { width: 15 },  // OS
      { width: 15 },  // Status
      { width: 15 },  // Location
      { width: 30 },  // Manager
      { width: 25 },  // System
      { width: 25 },  // Agent
      { width: 25 },  // Service
      { width: 25 },  // Tag
      { width: 30 },  // Description
      { width: 20 },  // Import Status
      { width: 50 }   // Import Reason
    ];

    // Create temp directory if not exists
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const excelFileName = `${timestamp}_${originalFileName}_imported.xlsx`;
    const excelFilePath = path.join(tempDir, excelFileName);
    await workbook.xlsx.writeFile(excelFilePath);

    // Send Excel file directly
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
    res.setHeader('Content-Length', fs.statSync(excelFilePath).size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const fileBuffer = fs.readFileSync(excelFilePath);
    res.send(fileBuffer);

    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    // Clean up temp Excel file after a delay
    setTimeout(() => {
      try {
        if (fs.existsSync(excelFilePath)) {
          fs.unlinkSync(excelFilePath);
          console.log('Validation file cleaned up:', excelFilePath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up validation file:', cleanupErr);
      }
    }, 10000); // 10 seconds delay

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing servers:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error importing servers: ' + err.message });
    }
  } finally {
    client.release();
  }
};

// Download server validation file
serverController.downloadServerValidationFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const filePath = path.join(process.cwd(), uploadsDir, 'temp', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading validation file:', err);
      }
      
      // Clean up file after download
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Downloaded validation file cleaned up:', filePath);
          }
        } catch (cleanupErr) {
          console.error('Error cleaning up downloaded file:', cleanupErr);
        }
      }, 5000); // 5 seconds delay
    });
  } catch (err) {
    console.error('Error downloading server validation file:', err);
    res.status(500).json({ error: 'Error downloading file: ' + err.message });
  }
};

export default serverController;
