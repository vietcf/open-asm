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
import { ServiceError } from '../services/errors.js';
import { IPV4_REGEX } from '../services/ipAddressService.js';
import { sanitizeExcelRow } from '../utils/excelSafe.js';
import {
  listAgents as listAgentsService,
  createAgent as createAgentService,
  updateAgent as updateAgentService,
  deleteAgent as deleteAgentService
} from '../services/agentService.js';
import {
  listServices as listServicesService,
  createService as createServiceService,
  updateService as updateServiceService,
  deleteService as deleteServiceService
} from '../services/serviceService.js';
import {
  listServers as listServersService,
  getServer as getServerService,
  createServer as createServerService,
  updateServer as updateServerService,
  deleteServer as deleteServerService,
  getServerLocationOptions,
  getServerStatusOptions,
  getServerTypeOptions
} from '../services/serverService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Load server options from DB config
const getServerLocationsFromConfig = getServerLocationOptions;
const getServerStatusOptionsFromConfig = getServerStatusOptions;
const getServerTypeOptionsFromConfig = getServerTypeOptions;

// Helper: always return array of strings for select2 filters
function normalizeFilterArray(val) {
  if (!val || val === 'undefined' || val === undefined) return [];
  if (Array.isArray(val)) return val.filter(v => v && v !== 'undefined' && v !== undefined).map(String);
  if (typeof val === 'string' && val !== 'undefined') return [val];
  return [];
}


const serverController = {};

// List all servers with search and pagination
serverController.listServer = async (req, res) => {
  try {
    // Use global pageSizeOptions from res.locals
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    let pageSize = parseInt(req.query.pageSize, 10) || pageSizeOptions[0];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    const page = parseInt(req.query.page, 10) || 1;

    // --- Normalize filter params ---
    const filterParams = {
      search: req.query.search ? req.query.search.trim().toLowerCase() : '',
      location: typeof req.query.location !== 'undefined' ? req.query.location : '',
      type: typeof req.query.type !== 'undefined' ? req.query.type : '',
      status: typeof req.query.status !== 'undefined' ? req.query.status : '',
      tags: normalizeFilterArray(req.query['tags[]'] || req.query.tags),
      manager: normalizeFilterArray(req.query['contacts[]'] || req.query.manager),
      systems: normalizeFilterArray(req.query['systems[]'] || req.query.systems),
      services: normalizeFilterArray(req.query['services[]'] || req.query.services),
      os: normalizeFilterArray(req.query['os[]'] || req.query.os)
    };
    
    console.log('Filter params:', filterParams);

    // --- Query server list and count ---
    const { items: serverList, totalCount } = await listServersService({
      search: filterParams.search,
      status: filterParams.status,
      type: filterParams.type,
      location: filterParams.location,
      tags: filterParams.tags,
      manager: filterParams.manager,
      systems: filterParams.systems,
      services: filterParams.services,
      os: filterParams.os,
      page,
      pageSize
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

    // Load selected data for filter (if any)
    let selectedTags = [];
    let selectedSystems = [];
    let selectedManagers = [];
    let selectedServices = [];
    let selectedOS = null;
    
    if (filterParams.tags && filterParams.tags.length > 0) {
      selectedTags = await Tag.findByIds(filterParams.tags);
    }
    
    if (filterParams.systems && filterParams.systems.length > 0) {
      selectedSystems = await System.findByIds(filterParams.systems);
    }
    
    if (filterParams.manager && filterParams.manager.length > 0) {
      console.log('Loading managers with IDs:', filterParams.manager);
      selectedManagers = await Contact.findByIds(filterParams.manager);
      console.log('Loaded managers:', selectedManagers);
    }
    
    if (filterParams.services && filterParams.services.length > 0) {
      selectedServices = await Service.findByIds(filterParams.services);
    }
    
    if (filterParams.os && filterParams.os.length > 0) {
      // Load OS/Platform info from database
      console.log('Loading OS with value:', filterParams.os[0]);
      try {
        const platform = await Platform.findById(filterParams.os[0]);
        if (platform) {
          selectedOS = { id: platform.id, text: platform.name };
        } else {
          selectedOS = { id: filterParams.os[0], text: filterParams.os[0] };
        }
      } catch (err) {
        console.error('Error loading platform:', err);
        selectedOS = { id: filterParams.os[0], text: filterParams.os[0] };
      }
      console.log('Selected OS:', selectedOS);
    }

    // Build query string carrying all active filters, used by pagination links
    // so filters aren't lost when navigating between pages.
    const filterQueryParams = new URLSearchParams();
    if (pageSize) filterQueryParams.set('pageSize', pageSize);
    if (filterParams.search) filterQueryParams.set('search', filterParams.search);
    if (filterParams.status) filterQueryParams.set('status', filterParams.status);
    if (filterParams.type) filterQueryParams.set('type', filterParams.type);
    if (filterParams.location) filterQueryParams.set('location', filterParams.location);
    if (filterParams.tags && filterParams.tags.length) filterParams.tags.forEach(id => filterQueryParams.append('tags[]', id));
    if (filterParams.manager && filterParams.manager.length) filterParams.manager.forEach(id => filterQueryParams.append('contacts[]', id));
    if (filterParams.systems && filterParams.systems.length) filterParams.systems.forEach(id => filterQueryParams.append('systems[]', id));
    if (filterParams.services && filterParams.services.length) filterParams.services.forEach(id => filterQueryParams.append('services[]', id));
    if (filterParams.os && filterParams.os.length) filterQueryParams.set('os', filterParams.os[0]);
    const serverFilterQuery = filterQueryParams.toString();

    res.render('pages/server/server_list', {
      serverList,
      search: filterParams.search,
      page,
      pageSize,
      serverFilterQuery,
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
      filterManager: filterParams.manager,
      filterSystems: filterParams.systems,
      filterServices: filterParams.services,
      filterOs: filterParams.os,
      selectedTags,
      selectedSystems,
      selectedManagers,
      selectedServices,
      selectedOS,
      title: 'Server List',
      activeMenu: 'server-list'
    });
  } catch (err) {
    res.status(500).send('Error loading servers: ' + err.message);
  }
};

// Create a new server
serverController.createServer = async (req, res) => {
  try {
    const { name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, description } = req.body || {};
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    await createServerService({
      name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, description,
      updated_by: username
    });
    req.flash('success', 'Server added successfully');
    res.redirect('/server/server/list');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to add server: ' + err.message;
    req.flash('error', message);
    res.redirect('/server/server/list');
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
  try {
    const id = req.params.id;
    const { name, os, status, location, type, managers, systems, agents, services, tags, ip_addresses, vip_ip_addresses, description } = req.body || {};
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    // The edit form always fully replaces every association on submit, so
    // include the keys explicitly (even as []) rather than relying on
    // whatever happens to be present in the body — matches the previous
    // "always overwrite" behavior of this form.
    await updateServerService(id, {
      name, os, status, location, type, description,
      managers: managers || [],
      systems: systems || [],
      agents: agents || [],
      services: services || [],
      tags: tags || [],
      ip_addresses,
      vip_ip_addresses: vip_ip_addresses || [],
      updated_by: username
    });
    req.flash('success', 'Server updated successfully');
    res.redirect('/server/server/list');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to update server: ' + err.message;
    req.flash('error', message);
    res.redirect('/server/server/list');
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
    let pageSize = parseInt(req.query.pageSize, 10) || pageSizeOptions[0];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const { items: serviceList, totalCount } = await listServicesService({ search, page, pageSize });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const success = req.flash('success')[0];
    const error = req.flash('error')[0];
    
    
    res.render('pages/server/service_list', {
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
    await createServiceService({ name, description });
    req.flash('success', 'Service added successfully');
    res.redirect('/server/service/list');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to add service';
    req.flash('error', message);
    res.redirect('/server/service/list');
  }
};

serverController.updateService = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;
    await updateServiceService(id, { name, description });
    req.flash('success', 'Service updated successfully');
    res.redirect('/server/service/list');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to update service';
    req.flash('error', message);
    res.redirect('/server/service/list');
  }
};

serverController.deleteService = async (req, res) => {
  try {
    const id = req.params.id;
    await deleteServiceService(id);
    req.flash('success', 'Service deleted successfully');
    res.redirect('/server/service/list');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to delete service';
    req.flash('error', message);
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
    let pageSize = parseInt(req.query.pageSize, 10) || pageSizeOptions[0];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search ? req.query.search.trim() : '';

    // Truy vấn agent list
    const { items: agentList, totalCount } = await listAgentsService({ search, page, pageSize });
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
    await createAgentService({ name, version, description });
    req.flash('success', 'Agent added successfully');
    res.redirect('/server/agent/list');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : (err.message || 'Unable to add agent');
    req.flash('error', message);
    res.redirect('/server/agent/list');
  }
};

serverController.updateAgent = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, version, description } = req.body;
    await updateAgentService(id, { name, version, description });
    req.flash('success', 'Agent updated successfully');
    res.redirect('/server/agent/list');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : (err.message || 'Unable to update agent');
    req.flash('error', message);
    res.redirect('/server/agent/list');
  }
};

serverController.deleteAgent = async (req, res) => {
  try {
    const id = req.params.id;
    await deleteAgentService(id);
    req.flash('success', 'Agent deleted successfully');
    res.redirect('/server/agent/list');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : (err.message || 'Unable to delete agent');
    req.flash('error', message);
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
    const deleteIp = ['true', '1'].includes(String(req.body.delete_ip ?? req.query.delete_ip).toLowerCase());
    await deleteServerService(id, { deleteIp });
    req.flash('success', 'Server deleted successfully');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to delete server: ' + err.message;
    req.flash('error', message);
  }
  res.redirect('/server/server/list');
};

// Export server list as Excel (filtered)
serverController.exportServerList = async (req, res) => {
  try {
    // Chuẩn hóa các tham số filter (giống listServer)
    function normalizeFilterArray(val) {
      if (!val || val === 'undefined' || val === undefined) return [];
      if (Array.isArray(val)) return val.filter(v => v && v !== 'undefined' && v !== undefined).map(String);
      if (typeof val === 'string' && val !== 'undefined') return [val];
      return [];
    }
    const filterParams = {
      search: req.query.search ? req.query.search.trim().toLowerCase() : '',
      location: typeof req.query.location !== 'undefined' ? req.query.location : '',
      type: typeof req.query.type !== 'undefined' ? req.query.type : '',
      status: typeof req.query.status !== 'undefined' ? req.query.status : '',
      tags: normalizeFilterArray(req.query['tags[]'] || req.query.tags),
      manager: normalizeFilterArray(req.query['contacts[]'] || req.query.manager),
      systems: normalizeFilterArray(req.query['systems[]'] || req.query.systems),
      services: normalizeFilterArray(req.query['services[]'] || req.query.services),
      os: normalizeFilterArray(req.query['os[]'] || req.query.os)
    };
    
    console.log('Export filter params:', filterParams);
    
    // Lấy toàn bộ danh sách (không phân trang)
    const serverList = await Server.findFilteredList({
      search: filterParams.search,
      status: filterParams.status,
      type: filterParams.type,
      location: filterParams.location,
      tags: filterParams.tags,
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
    rows.forEach(row => worksheet.addRow(sanitizeExcelRow(row)));
    worksheet.columns.forEach(col => { col.width = 22; });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="server_list_${timestamp}.xlsx"`);
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
    console.log('Starting server template download...');
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Server Template');
    
    // Add headers
    worksheet.addRow([
      'Name (Optional - auto-generated if empty)',
      'IPAddress (Require, comma-separated if multiple)',
      'OS (Optional)',
      'Status (Optional)',
      'Location (Optional)',
      'Type (Optional)',
      'Manager (Optional, comma-separated if multiple)',
      'System (Optional, comma-separated if multiple)',
      'Agent (Optional, comma-separated if multiple)',
      'Service (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)',
      'Description (Optional)'
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
    try {
      await fs.promises.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore error
      console.log('Temp directory creation:', err.message);
    }
    const tempPath = path.join(tempDir, 'temp_server_template.xlsx');
    console.log('Writing template to:', tempPath);
    await workbook.xlsx.writeFile(tempPath);
    console.log('Template file written successfully');
    
    // Check if file exists
    if (fs.existsSync(tempPath)) {
      // Use res.download() for proper file download handling — same
      // approach as IP/Subnet/Device templates
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
    console.log('Starting server validation...');
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File uploaded:', req.file.originalname, 'Size:', req.file.size);

    const filePath = req.file.path;
    // path.basename strips any directory components a crafted upload
    // filename could carry, before it's woven into a filesystem path below.
    const originalFileName = path.basename(req.file.originalname);
    let rows = [];

    // Parse file based on extension
    const ext = path.extname(originalFileName).toLowerCase();
    console.log('File extension:', ext);
    let headers = [];
    
    // Excel only — CSV import is no longer supported (multer's fileFilter
    // already rejects non-Excel uploads; this is the belt-and-suspenders
    // check for anything that reaches here another way).
    if (ext === '.xlsx' || ext === '.xls') {
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
      return res.status(400).json({ error: 'Unsupported file format. Only Excel files (.xlsx, .xls) are allowed.' });
    }

    // Validate file format - check required columns
    const requiredColumns = [
      'Name (Optional - auto-generated if empty)',
      'IPAddress (Require, comma-separated if multiple)',
      'OS (Optional)',
      'Status (Optional)',
      'Location (Optional)',
      'Type (Optional)',
      'Manager (Optional, comma-separated if multiple)',
      'System (Optional, comma-separated if multiple)',
      'Agent (Optional, comma-separated if multiple)',
      'Service (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)',
      'Description (Optional)'
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

    // Check column order - must match the template exactly
    for (let i = 0; i < requiredColumns.length; i++) {
      if (headers[i] !== requiredColumns[i]) {
        return res.status(400).json({
          error: `Invalid column order. Expected "${requiredColumns[i]}" at position ${i + 1}, got "${headers[i]}"`
        });
      }
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

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 1,
        name: sanitizeString(row['Name (Optional - auto-generated if empty)'] || ''),
        ip_addresses: sanitizeString(row['IPAddress (Require, comma-separated if multiple)'] || ''),
        os: sanitizeString(row['OS (Optional)'] || ''),
        status: sanitizeString(row['Status (Optional)'] || ''),
        location: sanitizeString(row['Location (Optional)'] || ''),
        type: sanitizeString(row['Type (Optional)'] || ''),
        manager: sanitizeString(row['Manager (Optional, comma-separated if multiple)'] || ''),
        system: sanitizeString(row['System (Optional, comma-separated if multiple)'] || ''),
        agent: sanitizeString(row['Agent (Optional, comma-separated if multiple)'] || ''),
        service: sanitizeString(row['Service (Optional, comma-separated if multiple)'] || ''),
        tag: sanitizeString(row['Tag (Optional, comma-separated if multiple)'] || ''),
        description: sanitizeString(row['Description (Optional)'] || ''),
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
          if (!IPV4_REGEX.test(ip)) {
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
      'OS (Optional)',
      'Status (Optional)',
      'Location (Optional)',
      'Type (Optional)',
      'Manager (Optional, comma-separated if multiple)',
      'System (Optional, comma-separated if multiple)',
      'Agent (Optional, comma-separated if multiple)',
      'Service (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)',
      'Description (Optional)',
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
      const row = worksheet.addRow(sanitizeExcelRow([
        result.name,
        result.ip_addresses,
        result.os,
        result.status,
        result.location,
        result.type,
        result.manager,
        result.system,
        result.agent,
        result.service,
        result.tag,
        result.description,
        result.validation_status,
        result.validation_reason
      ]));

      // Color code validation status
      if (result.validation_status === 'FAIL') {
        row.getCell(13).font = { color: { argb: 'FFFF0000' } }; // Validation Status column
        row.getCell(14).font = { color: { argb: 'FFFF0000' } }; // Validation Reason column
      } else {
        row.getCell(13).font = { color: { argb: 'FF008000' } }; // Validation Status column
      }
    });

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
    // Same key names as IP/Subnet validation summary — the frontend here
    // already reads summary.total/passed/failed, which this previously
    // didn't send (totalCount/passCount/failCount instead), so those
    // fields rendered as "undefined" in the validation results message.
    res.setHeader('X-Validation-Summary', JSON.stringify({
      total: validationResults.length,
      passed: passCount,
      failed: failCount,
      allPassed
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
    console.error('Error stack:', err.stack);
    console.error('Error message:', err.message);
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
    // path.basename strips any directory components a crafted upload
    // filename could carry, before it's woven into a filesystem path below.
    const originalFileName = path.basename(req.file.originalname);
    let rows = [];

    // Parse file (same logic as validation)
    const ext = path.extname(originalFileName).toLowerCase();
    let headers = [];
    
    // Excel only — CSV import is no longer supported (multer's fileFilter
    // already rejects non-Excel uploads; this is the belt-and-suspenders
    // check for anything that reaches here another way).
    if (ext === '.xlsx' || ext === '.xls') {
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
      return res.status(400).json({ error: 'Unsupported file format. Only Excel files (.xlsx, .xls) are allowed.' });
    }

    // Validate file format - check required columns
    const requiredColumns = [
      'Name (Optional - auto-generated if empty)',
      'IPAddress (Require, comma-separated if multiple)',
      'OS (Optional)',
      'Status (Optional)',
      'Location (Optional)',
      'Type (Optional)',
      'Manager (Optional, comma-separated if multiple)',
      'System (Optional, comma-separated if multiple)',
      'Agent (Optional, comma-separated if multiple)',
      'Service (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)',
      'Description (Optional)'
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

    // Check column order - must match the template exactly
    for (let i = 0; i < requiredColumns.length; i++) {
      if (headers[i] !== requiredColumns[i]) {
        return res.status(400).json({
          error: `Invalid column order. Expected "${requiredColumns[i]}" at position ${i + 1}, got "${headers[i]}"`
        });
      }
    }

    await client.query('BEGIN');

    const importResults = [];
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';
    // Tracks names/IPs already claimed earlier in this same file. IPs matter
    // most: ip_addresses.ip_address has a real DB UNIQUE constraint, so two
    // rows creating the same new IP would hit a raw duplicate-key error mid
    // transaction — without a savepoint (see below) that poisons every row
    // after it, and the final COMMIT silently discards the whole batch,
    // including rows already reported as Success.
    const seenNames = new Set();
    const seenIps = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 1,
        name: sanitizeString(row['Name (Optional - auto-generated if empty)'] || ''),
        ip_addresses: sanitizeString(row['IPAddress (Require, comma-separated if multiple)'] || ''),
        os: sanitizeString(row['OS (Optional)'] || ''),
        status: sanitizeString(row['Status (Optional)'] || ''),
        location: sanitizeString(row['Location (Optional)'] || ''),
        type: sanitizeString(row['Type (Optional)'] || ''),
        manager: sanitizeString(row['Manager (Optional, comma-separated if multiple)'] || ''),
        system: sanitizeString(row['System (Optional, comma-separated if multiple)'] || ''),
        agent: sanitizeString(row['Agent (Optional, comma-separated if multiple)'] || ''),
        service: sanitizeString(row['Service (Optional, comma-separated if multiple)'] || ''),
        tag: sanitizeString(row['Tag (Optional, comma-separated if multiple)'] || ''),
        description: sanitizeString(row['Description (Optional)'] || ''),
        import_status: 'Success',
        import_reason: ''
      };

      const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(Boolean);
      if (ipList.length === 0) {
        result.import_status = 'Failed';
        result.import_reason = 'At least one IP address is required';
        importResults.push(result);
        continue;
      }

      const dupIp = ipList.find(ip => seenIps.has(ip));
      if (dupIp) {
        result.import_status = 'Failed';
        result.import_reason = `Duplicate IP address within this file: ${dupIp}`;
        importResults.push(result);
        continue;
      }

      // Check IPs against already-committed data (pre-existing assignments
      // from before this import ran) — in-file collisions are handled
      // separately by seenIps above.
      const alreadyAssigned = [];
      for (const ip of ipList) {
        const existingIP = await IpAddress.findByAddressWithDetails(ip);
        if (existingIP && existingIP.status === 'assigned') alreadyAssigned.push(ip);
      }
      if (alreadyAssigned.length > 0) {
        result.import_status = 'Failed';
        result.import_reason = `IP already assigned to a server: ${alreadyAssigned.join(', ')}`;
        importResults.push(result);
        continue;
      }
      ipList.forEach(ip => seenIps.add(ip));

      // Generate server name if not provided
      let serverName = result.name;
      if (!serverName) {
        const firstIP = ipList[0];
        const platformName = result.os ? result.os.replace(/\s+/g, '-').toLowerCase() : '';
        serverName = platformName ? `server_${platformName}_${firstIP}` : `server_${firstIP}`;
      }

      if (seenNames.has(serverName)) {
        result.import_status = 'Failed';
        result.import_reason = `Duplicate server name within this file: ${serverName}`;
        importResults.push(result);
        continue;
      }
      if (serverName) {
        const existingServer = await Server.findByName(serverName);
        if (existingServer) {
          result.import_status = 'Failed';
          result.import_reason = 'Server name already exists';
          importResults.push(result);
          continue;
        }
      }
      seenNames.add(serverName);

      // Resolve OS/Manager/System/Agent/Service/Tag names to IDs up front.
      // A name that doesn't resolve fails the whole row instead of being
      // silently dropped from the created server.
      const notFound = [];

      let osId = null;
      if (result.os) {
        const platforms = await Platform.findByNameExact(result.os);
        if (platforms && platforms.length > 0) osId = platforms[0].id;
        else notFound.push(`OS "${result.os}"`);
      }
      const managerIds = [];
      for (const email of result.manager.split(',').map(m => m.trim()).filter(Boolean)) {
        const contacts = await Contact.findByEmailSearch(email);
        if (contacts && contacts.length > 0) managerIds.push(contacts[0].id);
        else notFound.push(`Manager "${email}"`);
      }
      const systemIds = [];
      for (const systemName of result.system.split(',').map(s => s.trim()).filter(Boolean)) {
        const systems = await System.findByNameExact(systemName);
        if (systems && systems.length > 0) systemIds.push(systems[0].id);
        else notFound.push(`System "${systemName}"`);
      }
      const agentIds = [];
      for (const agentName of result.agent.split(',').map(a => a.trim()).filter(Boolean)) {
        const agents = await Agent.findByNameExact(agentName);
        if (agents && agents.length > 0) agentIds.push(agents[0].id);
        else notFound.push(`Agent "${agentName}"`);
      }
      const serviceIds = [];
      for (const serviceName of result.service.split(',').map(s => s.trim()).filter(Boolean)) {
        const services = await Service.findByNameExact(serviceName);
        if (services && services.length > 0) serviceIds.push(services[0].id);
        else notFound.push(`Service "${serviceName}"`);
      }
      const tagIds = [];
      for (const tagName of result.tag.split(',').map(t => t.trim()).filter(Boolean)) {
        const tags = await Tag.findByNameExact(tagName);
        if (tags && tags.length > 0) tagIds.push(tags[0].id);
        else notFound.push(`Tag "${tagName}"`);
      }
      if (notFound.length > 0) {
        result.import_status = 'Failed';
        result.import_reason = `Not found: ${notFound.join(', ')}`;
        importResults.push(result);
        continue;
      }

      // Each row gets its own savepoint, wrapping BOTH the new-IP creation
      // and the server creation — so a failure partway through rolls back
      // any IP just created for this row too, instead of leaving an
      // orphaned "assigned" IP with no server attached to it.
      const savepoint = `import_server_row_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepoint}`);

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

        const ipIds = [];
        for (const ip of ipList) {
          let ipRecord = await IpAddress.findByAddress(ip);
          if (!ipRecord) {
            // Created as 'reserved', not 'assigned' — createServerService's
            // validateIpAddressIds() rejects any IP already marked
            // 'assigned' as belonging to some other server. Server.setIpAddresses
            // (called inside createServerService) is what actually promotes
            // it to 'assigned' once linked to this new server.
            ipRecord = await IpAddress.create({
              address: ip,
              description: ipDescription,
              status: 'reserved',
              updated_by: username
            }, client);
          }
          ipIds.push(ipRecord.id);
        }

        await createServerService({
          name: serverName,
          os: osId,
          status: result.status || null,
          location: result.location || null,
          type: result.type || null,
          description: result.description || null,
          managers: managerIds,
          systems: systemIds,
          agents: agentIds,
          services: serviceIds,
          tags: tagIds,
          ip_addresses: ipIds,
          updated_by: username
        }, client);

        // Set contacts on each IP too (managers), matching the pre-existing
        // import behavior of also linking managers to the IPs themselves.
        if (managerIds.length > 0) {
          for (const ipId of ipIds) {
            await IpAddress.setContacts(ipId, managerIds, client);
          }
        }

        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        result.import_reason = 'Successfully created server';
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        console.error(`Error importing server row ${i + 1}:`, err);
        result.import_status = 'Failed';
        result.import_reason = err instanceof ServiceError ? err.message : (err.message || 'Unknown error');
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
      'OS (Optional)',
      'Status (Optional)',
      'Location (Optional)',
      'Type (Optional)',
      'Manager (Optional, comma-separated if multiple)',
      'System (Optional, comma-separated if multiple)',
      'Agent (Optional, comma-separated if multiple)',
      'Service (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)',
      'Description (Optional)',
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
      const row = worksheet.addRow(sanitizeExcelRow([
        result.name,
        result.ip_addresses,
        result.os,
        result.status,
        result.location,
        result.type,
        result.manager,
        result.system,
        result.agent,
        result.service,
        result.tag,
        result.description,
        result.import_status,
        result.import_reason
      ]));

      // Color code import status
      if (result.import_status === 'Failed') {
        row.getCell(13).font = { color: { argb: 'FFFF0000' } }; // Import Status column
        row.getCell(14).font = { color: { argb: 'FFFF0000' } }; // Import Reason column
      } else {
        row.getCell(13).font = { color: { argb: 'FF008000' } }; // Import Status column
      }
    });

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

    // Set header for frontend to know import results — same shape as
    // Subnet/Firewall import (total/success/failed) for consistent UI.
    const successCount = importResults.filter(result => result.import_status === 'Success').length;
    res.setHeader('X-Import-Summary', JSON.stringify({
      total: importResults.length,
      success: successCount,
      failed: importResults.length - successCount
    }));

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
    // path.basename strips any directory components (../ or absolute
    // paths) an attacker could smuggle through the :filename route param.
    const filename = path.basename(req.params.filename || '');
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
