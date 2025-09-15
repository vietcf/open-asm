
import IpAddress from '../models/IpAddress.js';
import Subnet from '../models/Subnet.js';
import Domain from '../models/Domain.js';
import Configuration from '../models/Configuration.js';
import Tag from '../models/Tag.js';
import Contact from '../models/Contact.js';
import System from '../models/System.js';
import { pool } from '../../config/config.js';
import fs from 'fs';
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// import ipAddressOptions from '../../config/ipAddressOptions.js';
// import subnetOptions from '../../config/subnetOptions.js';
// Helper: Load recordTypeOptions from DB (Configuration)
async function getRecordTypeOptionsFromConfig() {
  let recordTypeOptions = [];
  try {
    const config = await Configuration.findById('network_domain_record_type');
    if (config && config.value) {
      recordTypeOptions = JSON.parse(config.value);
    }
  } catch (e) {
    recordTypeOptions = [];
  }
  return recordTypeOptions;
}


// Helper: Load ipStatusOptions from DB (Configuration)
async function getIpStatusOptionsFromConfig() {
  let ipStatusOptions = [];
  try {
    const config = await Configuration.findById('ip_address_status');
    if (config && config.value) {
      ipStatusOptions = JSON.parse(config.value);
    }
  } catch (e) {
    ipStatusOptions = [];
  }
  return ipStatusOptions;
}

//------------------------- IP ADDRESS MENU PROCESSING -------------------------
// Render the IP address list page with layout
// Handles listing, searching, and pagination for IP addresses
// Renders the ip_address_list.ejs view with the list of IPs and pagination
// For each IP, also fetches tags and detailed contacts (id, name, email, phone)
const networkController = {};

networkController.listIP = async (req, res) => {
  try {
    // Normalize and parse query parameters
    const normalizeArray = v => (Array.isArray(v) ? v : (v ? [v] : []));
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    // pageSizeOptions đã có sẵn qua res.locals.pageSizeOptions
    let pageSize = parseInt(req.query.pageSize, 10);
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    // Lấy filter từ query
    let filterTags = req.query['tags[]'] || req.query.tags || [];
    let filterStatus = req.query.status || '';
    let filterSystems = req.query['systems[]'] || req.query.systems || [];
    let filterContacts = req.query['contacts[]'] || req.query.contacts || [];

    filterTags = normalizeArray(filterTags).filter(x => x !== '');
    filterSystems = normalizeArray(filterSystems).filter(x => x !== '');
    filterContacts = normalizeArray(filterContacts).filter(x => x !== '');

    // Gọi model filter
    const ipList = await IpAddress.findFilteredList({
      search,
      tags: filterTags,
      status: filterStatus,
      systems: filterSystems,
      contacts: filterContacts,
      page,
      pageSize
    });

    const totalCount = await IpAddress.countFiltered({
      search,
      tags: filterTags,
      status: filterStatus,
      systems: filterSystems,
      contacts: filterContacts
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];

  // Load ipStatusOptions from DB (Configuration) via helper
  const ipStatusOptions = await getIpStatusOptionsFromConfig();

    res.render('pages/network/ip_address_list', {
      ipList,
      page,
      pageSize,
      totalPages,
      totalCount,
      search,
      filterTags,
      filterStatus,
      filterSystems,
      filterContacts,
      successMessage,
      errorMessage,
      ipStatusOptions,
      title: 'IP Address',
      activeMenu: 'ip-address'
    });
  } catch (err) {
    console.error('Error loading IP addresses:', err);
    res.status(500).send('Error loading IP addresses: ' + err.message);
  }
};

// Handle creating a new IP address (with transaction)
networkController.createIP = async (req, res) => {
  /** @type {import('pg').PoolClient} */
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Extract and normalize form data, ensure arrays are not null
    let { address, description, status, tags, contacts, systems, page } = req.body;
    tags = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    contacts = contacts ? (Array.isArray(contacts) ? contacts : [contacts]) : [];
    systems = systems ? (Array.isArray(systems) ? systems : [systems]) : [];
    
    // Parse multiple IP addresses separated by comma
    const ipAddresses = address ? address.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0) : [];
    
    // Validate IP address format for each IP
    const ipRegex = /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/;
    for (const ip of ipAddresses) {
      if (!ipRegex.test(ip)) {
        req.flash('error', `Invalid IP address format: ${ip}. Please enter valid IPv4 addresses, e.g. 192.168.1.100`);
        await client.query('ROLLBACK');
        return res.redirect('/network/ip-address');
      }
    }
    
    if (ipAddresses.length === 0) {
      req.flash('error', 'Please enter at least one valid IP address.');
      await client.query('ROLLBACK');
      return res.redirect('/network/ip-address');
    }
    
    const statusValue = status && status.trim() ? status : 'reserved';
    const updated_by = req.session.user?.username || '';
    
    // Create IP address records for each IP
    const createdIPs = [];
    for (const ip of ipAddresses) {
      const newIp = await IpAddress.create({ address: ip, description, status: statusValue, updated_by }, client);
      // @ts-ignore - client parameter is supported by model methods
      await IpAddress.setTags(newIp.id, tags, client);
      // @ts-ignore - client parameter is supported by model methods
      await IpAddress.setContacts(newIp.id, contacts, client);
      // @ts-ignore - client parameter is supported by model methods
      await IpAddress.setSystems(newIp.id, systems, client);
      createdIPs.push(newIp);
    }
    
    await client.query('COMMIT');
    const successMessage = createdIPs.length === 1 
      ? 'IP address added successfully!' 
      : `${createdIPs.length} IP addresses added successfully!`;
    req.flash('success', successMessage);
    return res.redirect('/network/ip-address');
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Add failed.';
    if (errorMessage.includes('duplicate key value') && errorMessage.includes('unique constraint')) {
      errorMessage = 'One or more IP addresses already exist.';
    }
    req.flash('error', errorMessage);
    return res.redirect('/network/ip-address');
  } finally {
    client.release();
  }
};

// Handle updating an IP address (with transaction)
networkController.updateIP = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Extract and normalize form data, ensure arrays are not null
    let { description, status, tags, contacts, systems, page } = req.body;
    const id = req.params.id;
    tags = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    contacts = contacts ? (Array.isArray(contacts) ? contacts : [contacts]) : [];
    systems = systems ? (Array.isArray(systems) ? systems : [systems]) : [];
    const updated_by = req.session.user?.username || '';
    // Update IP address record (all within transaction)
    // @ts-ignore - client parameter is supported by model methods
    await IpAddress.update(id, { description, status, updated_by }, client);
    // @ts-ignore - client parameter is supported by model methods
    await IpAddress.setTags(id, tags, client);
    // @ts-ignore - client parameter is supported by model methods
    await IpAddress.setContacts(id, contacts, client);
    // @ts-ignore - client parameter is supported by model methods
    await IpAddress.setSystems(id, systems, client);
    await client.query('COMMIT');
    req.flash('success', 'IP address updated successfully!');
    return res.redirect(`/network/ip-address?page=${page || 1}`);
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Save failed.';
    if (errorMessage.includes('duplicate key value') && errorMessage.includes('unique constraint')) {
      errorMessage = 'IP address already exists.';
    }
    req.flash('error', errorMessage);
    return res.redirect(`/network/ip-address?page=${req.body.page || 1}`);
  } finally {
    client.release();
  }
};

// Handle deleting an IP address (with transaction)
networkController.deleteIP = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const page = req.body.page || req.query.page || 1;
    // @ts-ignore - client parameter is supported by model methods
    await IpAddress.setTags(req.params.id, [], client);
    // @ts-ignore - client parameter is supported by model methods
    await IpAddress.delete(req.params.id, client);
    await client.query('COMMIT');
    req.flash('success', 'IP address deleted successfully!');
    return res.redirect(`/network/ip-address?page=${page}`);
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Delete failed.';
    if (errorMessage.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete: This IP address is in use.';
    }
    req.flash('error', errorMessage);
    return res.redirect(`/network/ip-address?page=${req.body.page || 1}`);
  } finally {
    client.release();
  }
};

//------------------------- SUBNET MENU PROCESSING -------------------------
// Render the Subnet list page with layout
// Handles listing, searching, and pagination for subnets
// Renders the subnet_list.ejs view with the list of subnets and pagination
networkController.listSubnet = async (req, res) => {
  try {
    // Normalize and parse query parameters
    const normalizeArray = v => (Array.isArray(v) ? v : (v ? [v] : []));
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    let pageSize = parseInt(req.query.pageSize, 10);
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    
    // Lấy filter từ query
    let filterTags = req.query['tags[]'] || req.query.tags || [];
    filterTags = normalizeArray(filterTags).filter(x => x !== '');

    let subnetList = [], totalCount = 0, totalPages = 1;
    if (search || filterTags.length > 0) {
      totalCount = await Subnet.countFiltered({ search, tags: filterTags });
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      subnetList = await Subnet.findFilteredList({ search, tags: filterTags, page, pageSize });
    } else {
      totalCount = await Subnet.countAll();
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      subnetList = await Subnet.findPage(page, pageSize);
    }
    // Xây dựng cây subnet để hiển thị dạng cha-con
    const subnetTree = Subnet.buildSubnetTree(subnetList);
    const success = req.flash('success')[0];
    const error = req.flash('error')[0];
    res.render('pages/network/subnet_list', {
      subnetList,
      subnetTree, // truyền thêm biến này
      page,
      pageSize,
      totalPages,
      totalCount,
      search,
      filterTags,
      success,
      error,
      // allowedPageSizes không cần truyền, đã có global
      title: 'Subnet List',
      activeMenu: 'subnet-address'
    });
  } catch (err) {
    console.error('Error loading subnets:', err);
    res.status(500).send('Error loading subnets: ' + err.message);
  }
};

// Handle creating a new subnet (with transaction)
networkController.createSubnet = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let { address, description, page, tags } = req.body;
    tags = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    if (!address || !/\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(address)) {
      req.flash('error', 'Invalid subnet address format. Please enter a valid subnet, e.g. 192.168.1.0/24');
      await client.query('ROLLBACK');
      return res.redirect('/network/subnet-address');
    }
    const updated_by = req.session.user?.username || '';
    // Create subnet without tags
    // @ts-ignore - client parameter is supported by model methods
    const newSubnet = await Subnet.create({ address, description, updated_by }, client);
    // Assign tags using setTags method
    // @ts-ignore - client parameter is supported by model methods
    await Subnet.setTags(newSubnet.id, tags, client);
    await client.query('COMMIT');
    req.flash('success', 'Subnet added successfully!');
    return res.redirect('/network/subnet-address');
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Add failed.';
    if (errorMessage.includes('duplicate key value') && errorMessage.includes('unique constraint')) {
      errorMessage = 'Subnet address already exists.';
    }
    req.flash('error', errorMessage);
    return res.redirect('/network/subnet-address');
  } finally {
    client.release();
  }
};

// Handle updating subnet description (with transaction)
networkController.updateSubnet = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let { description, page, tags } = req.body;
    tags = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    description = description || '';
    const updated_by = req.session.user?.username || '';
    // @ts-ignore - client parameter is supported by model methods
    await Subnet.update(req.params.id, { description, updated_by }, client);
    // @ts-ignore - client parameter is supported by model methods
    await Subnet.setTags(req.params.id, tags, client);
    await client.query('COMMIT');
    req.flash('success', 'Subnet updated successfully!');
    return res.redirect(`/network/subnet-address?page=${page || 1}`);
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Save failed.';
    if (errorMessage.includes('duplicate key value') && errorMessage.includes('unique constraint')) {
      errorMessage = 'Subnet address already exists.';
    }
    req.flash('error', errorMessage);
    return res.redirect(`/network/subnet-address?page=${req.body.page || 1}`);
  } finally {
    client.release();
  }
};

// Handle deleting a subnet (with transaction)
networkController.deleteSubnet = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const page = req.body.page || req.query.page || 1;
    // @ts-ignore - client parameter is supported by model methods
    await Subnet.delete(req.params.id, client);
    await client.query('COMMIT');
    req.flash('success', 'Subnet deleted successfully!');
    return res.redirect(`/network/subnet-address?page=${page}`);
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Delete failed.';
    if (errorMessage.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete: This subnet is in use.';
    }
    req.flash('error', errorMessage);
    return res.redirect(`/network/subnet-address?page=${req.body.page || 1}`);
  } finally {
    client.release();
  }
};


//------------------------- DOMAIN MENU PROCESSING -------------------------
// Render the Domain list page with layout
networkController.listDomain = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    // pageSizeOptions đã có sẵn qua res.locals.pageSizeOptions
    let pageSize = parseInt(req.query.pageSize, 10);
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    // Tìm kiếm domain theo domain, description, IP, hoặc tên hệ thống
    let totalCount, domainList;
    if (search) {
      totalCount = await Domain.countSearch(search);
      domainList = await Domain.findSearchPage(search, page, pageSize);
    } else {
      totalCount = await Domain.countAll();
      domainList = await Domain.findPage(page, pageSize);
    }
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const success = req.flash('success')[0];
    const error = req.flash('error')[0];
    // Load record type options from DB (Configuration)
    const recordTypeOptions = await getRecordTypeOptionsFromConfig();
    res.render('pages/network/domain_list', {
      domainList,
      page,
      pageSize,
      totalPages,
      totalCount,
      search,
      success,
      error,
      recordTypeOptions,
      title: 'Domain',
      activeMenu: 'domain'
    });
  } catch (err) {
    res.status(500).send('Error loading domains: ' + err.message);
  }
};

// Handle creating a new domain (with transaction)
networkController.createDomain = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Extract and normalize form data
    let { domain, description, ip_id, record_type, systems } = req.body;
    domain = domain ? domain.trim() : '';
    description = description || '';
    record_type = record_type ? record_type.trim() : 'A';
    ip_id = ip_id && String(ip_id).trim() !== '' ? ip_id : null;
    systems = systems ? (Array.isArray(systems) ? systems : [systems]) : [];
    if (!domain) {
      req.flash('error', 'Domain name is required.');
      return res.redirect('/network/domain');
    }
    // Create domain, then set systems via model
    // @ts-ignore - client parameter is supported by model methods
    const newDomain = await Domain.create({ domain, description, ip_id, record_type }, client);
    // @ts-ignore - client parameter is supported by model methods
    await Domain.setSystems(newDomain.id, systems, client);
    await client.query('COMMIT');
    req.flash('success', 'Domain added successfully!');
    res.redirect('/network/domain');
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Add failed.';
    if (errorMessage.includes('duplicate key value')) {
      errorMessage = 'Domain already exists.';
    }
    req.flash('error', errorMessage);
    res.redirect('/network/domain');
  } finally {
    client.release();
  }
};

// Handle updating a domain (with transaction)
networkController.updateDomain = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Extract and normalize form data
    let { description, ip_id, record_type, systems } = req.body;
    description = description || '';
    record_type = record_type ? record_type.trim() : 'A';
    ip_id = ip_id && String(ip_id).trim() !== '' ? ip_id : null;
    systems = systems ? (Array.isArray(systems) ? systems : [systems]) : [];
    const id = req.params.id;
    // Update domain, then set systems via model
    // @ts-ignore - client parameter is supported by model methods
    await Domain.update(id, { description, ip_id, record_type }, client);
    // @ts-ignore - client parameter is supported by model methods
    await Domain.setSystems(id, systems, client);
    await client.query('COMMIT');
    req.flash('success', 'Domain updated successfully!');
    res.redirect('/network/domain');
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Update failed.';
    if (errorMessage.includes('duplicate key value')) {
      errorMessage = 'Domain already exists.';
    }
    req.flash('error', errorMessage);
    res.redirect('/network/domain');
  } finally {
    client.release();
  }
};

// Handle deleting a domain (with transaction)
networkController.deleteDomain = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    // Xóa domain và liên kết system qua model
    // @ts-ignore - client parameter is supported by model methods
    await Domain.delete(id, client);
    await client.query('COMMIT');
    req.flash('success', 'Domain deleted successfully!');
    res.redirect('/network/domain');
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Delete failed.';
    if (errorMessage.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete: This domain is in use.';
    }
    req.flash('error', errorMessage);
    res.redirect('/network/domain');
  } finally {
    client.release();
  }
};

//------------------------- AJAX API PROCESSING -------------------------
// Handle getting details of a single subnet and its IPs (AJAX/detail modal)
networkController.detailSubnet = async (req, res) => {
  try {
    // Get subnet info
    const subnet = await Subnet.findById(req.params.id);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });
    // Get all IPs in this subnet (Postgres: address <<= subnet.address)
    const ipList = await IpAddress.findBySubnet(subnet.address);
    subnet.ipList = ipList;
    // Calculate subnet usage percent
    let percentUsed = null;
    let totalIPs = null;
    const match = String(subnet.address).match(/\/(\d{1,2})$/);
    if (match) {
      const prefix = parseInt(match[1], 10);
      if (prefix >= 0 && prefix <= 32) {
        totalIPs = Math.pow(2, 32 - prefix);
        percentUsed = totalIPs > 0 ? Math.round((ipList.length / totalIPs) * 100) : 0;
      }
    }
    subnet.percentUsed = percentUsed;
    subnet.totalIPs = totalIPs;

    // Get tags for each IP (array of tag names)
    for (const ip of ipList) {
      const tagRows = await pool.query(
        `SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_type = 'ip_address' AND tobj.object_id = $1`,
        [ip.id]
      );
      ip.tags = tagRows.rows.map(row => row.name);
    }
  // Đã xóa debug log

    res.json(subnet);
  } catch (err) {
    console.error('Error loading subnet detail:', err);
    res.status(500).json({ error: 'Error loading subnet detail', detail: err.message });
  }
};

// API: Search IP addresses for select2 ajax
networkController.apiSearchIPAddresses = async (req, res) => {
  try {
    const { search = '', ids, limit } = req.query;
    if (ids) {
      // ids có thể là mảng hoặc 1 giá trị
      const idArr = Array.isArray(ids) ? ids : [ids];
      if (idArr.length === 0) return res.json([]);
      const result = await pool.query(
        `SELECT id, ip_address FROM ip_addresses WHERE id = ANY($1::int[])`,
        [idArr.map(Number)]
      );
      return res.json(result.rows.map(ip => ({ id: ip.id, text: ip.ip_address })));
    }
    const lim = parseInt(limit) || 20;
    const result = await pool.query(
      'SELECT id, ip_address FROM ip_addresses WHERE ip_address::text ILIKE $1 ORDER BY ip_address LIMIT $2',
      [`%${search}%`, lim]
    );
    res.json(result.rows.map(ip => ({ id: ip.id, text: ip.ip_address })));
  } catch (err) {
    console.error('API /network/api/ip-addresses error:', err);
    res.status(500).json({ error: 'Error searching IP addresses', detail: err.message });
  }
};

// API: Get detailed IP information for tooltip
networkController.apiGetIPDetail = async (req, res) => {
  try {
    const { search = '', ip } = req.query;
    
    if (!search && !ip) {
      return res.status(400).json({ error: 'Search term or IP address is required' });
    }
    
    const searchTerm = search || ip;
    
    // Use existing model method to get detailed IP information
    const ipDetail = await IpAddress.findByAddressWithDetails(searchTerm);
    
    if (!ipDetail) {
      return res.json([]);
    }
    
    // Format response to match expected structure
    const response = {
      id: ipDetail.id,
      ip_address: ipDetail.ip_address,
      ip: ipDetail.ip_address, // Alias for compatibility
      description: ipDetail.description,
      status: ipDetail.status,
      created_at: ipDetail.created_at,
      updated_at: ipDetail.updated_at,
      updated_by: ipDetail.updated_by,
      server_id: ipDetail.server?.id,
      server_name: ipDetail.server?.name,
      device_id: ipDetail.device?.id,
      device_name: ipDetail.device?.name,
      tags: ipDetail.tags,
      contacts: ipDetail.contacts,
      systems: ipDetail.systems
    };
    
    res.json([response]); // Return as array for consistency with search API
  } catch (err) {
    console.error('API /network/api/ip-addresses/detail error:', err);
    res.status(500).json({ error: 'Error getting IP detail', detail: err.message });
  }
};

// API: Domain search for select2 ajax (system add/edit)
networkController.apiDomainSearch = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    // Get max 20 domains, with search if available
    const domains = await Domain.findSearchPage(search, 1, 20);
    res.json(domains.map(domain => ({ id: domain.id, text: domain.domain })));
  } catch (err) {
    res.status(500).json({ error: 'Error loading domains' });
  }
};

// API: Search IP addresses for select2 ajax (server add only, chỉ lấy IP chưa assigned)
networkController.apiSearchUnassignedIPAddresses = async (req, res) => {
  try {
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 20;
    const ips = await IpAddress.findUnassignIP({ search, limit });
    res.json(ips.map(ip => ({ id: ip.id, text: ip.ip_address })));
  } catch (err) {
    console.error('API /network/api/ip-addresses/unassigned error:', err);
    res.status(500).json({ error: 'Error searching unassigned IP addresses', detail: err.message });
  }
};

// API: Search subnets for existence check
networkController.apiSearchSubnets = async (req, res) => {
  try {
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 20;
    
    if (!search) {
      return res.json([]);
    }
    
    // Search for exact subnet match
    const subnets = await Subnet.findFilteredList({ 
      search, 
      tags: [], // Empty tags array for search
      page: 1, 
      pageSize: limit 
    });
    
    // Filter for exact match
    const exactMatches = subnets.filter(subnet => 
      subnet.address && subnet.address.toLowerCase() === search.toLowerCase()
    );
    
    res.json(exactMatches.map(subnet => ({ 
      id: subnet.id, 
      address: subnet.address,
      description: subnet.description 
    })));
  } catch (err) {
    console.error('API /network/api/subnet-addresses error:', err);
    res.status(500).json({ error: 'Error searching subnets', detail: err.message });
  }
};

// API: Validate IP addresses import file
networkController.validateImportIPs = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    
    let rows = [];
    
    // Parse file based on extension
    if (fileExtension === 'csv') {
      const results = [];
      
      // Simple CSV parsing without csv-parser dependency
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index] || '';
          });
          results.push(rowData);
        }
      }
      
      rows = results;
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.worksheets[0];
      const headers = [];
      
      // Get headers from first row
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value;
      });
      
      
      // Get data rows
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const rowData = {};
        
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            rowData[header] = cell.value;
          }
        });
        
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }
    

    // Validate each row
    const validationResults = [];
    const ipRegex = /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/;
    const validStatuses = ['active', 'reserved', 'inactive'];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because Excel starts from 1 and we skip header
      const result = {
        row: rowNumber,
        ip_address: row['IPAddress (Require, one per row)'] || '',
        description: row['Description'] || '',
        status: row['Status'] || 'reserved',
        tags: row['Tag (comma-separated if multiple)'] || row['Tags'] || '',
        contacts: row['Contact (Email or Email prefix, comma-separated if multiple)'] || row['Contact (Email, comma-separated if multiple)'] || row['Contacts'] || '',
        system: row['System Name (comma-separated if multiple)'] || row['System'] || '',
        validation_status: 'Pass',
        validation_reason: ''
      };
      
      // Validate IP address
      if (!result.ip_address) {
        result.validation_status = 'Fail';
        result.validation_reason = 'IP Address is required';
      } else if (!ipRegex.test(result.ip_address)) {
        result.validation_status = 'Fail';
        result.validation_reason = 'Invalid IP address format';
      } else {
        // Check IP range
        const parts = result.ip_address.split('.');
        for (const part of parts) {
          const num = parseInt(part, 10);
          if (num < 0 || num > 255) {
            result.validation_status = 'Fail';
            result.validation_reason = 'IP address octet must be between 0 and 255';
            break;
          }
        }
      }
      
      // Validate status
      if (result.status && !validStatuses.includes(result.status.toLowerCase())) {
        result.validation_status = 'Fail';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + 'Invalid status. Must be: active, reserved, or inactive';
      }
      
      // Check if IP already exists
      try {
        const existingIP = await IpAddress.findByAddressWithDetails(result.ip_address);
        if (existingIP) {
          result.validation_status = 'Fail';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + 'IP address already exists';
        }
      } catch (err) {
        // If error checking existence, continue with validation
      }
      
      // Validate Tags (if provided)
      if (result.tags) {
        const tagNames = result.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        const invalidTags = [];
        for (const tagName of tagNames) {
          try {
            const tags = await Tag.findByNameExact(tagName);
            if (!tags || tags.length === 0) {
              invalidTags.push(tagName);
            }
          } catch (err) {
            // If error checking tag, continue with validation
          }
        }
        if (invalidTags.length > 0) {
          result.validation_status = 'Fail';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Tag(s) not found: ${invalidTags.join(', ')}`;
        }
      }
      
      // Validate Contacts (if provided)
      if (result.contacts) {
        const contactEmails = result.contacts.split(',').map(email => email.trim()).filter(email => email.length > 0);
        const invalidContacts = [];
        for (const email of contactEmails) {
          try {
            const contacts = await Contact.findByEmailSearch(email);
            if (!contacts || contacts.length === 0) {
              invalidContacts.push(email);
            }
          } catch (err) {
            // If error checking contact, continue with validation
          }
        }
        if (invalidContacts.length > 0) {
          result.validation_status = 'Fail';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Contact(s) not found: ${invalidContacts.join(', ')}`;
        }
      }
      
      // Validate Systems (if provided)
      if (result.system) {
        const systemNames = result.system.split(',').map(name => name.trim()).filter(name => name.length > 0);
        const invalidSystems = [];
        for (const systemName of systemNames) {
          try {
            const systems = await System.findByNameExact(systemName);
            if (!systems || systems.length === 0) {
              invalidSystems.push(systemName);
            }
          } catch (err) {
            // If error checking system, continue with validation
          }
        }
        if (invalidSystems.length > 0) {
          result.validation_status = 'Fail';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `System(s) not found: ${invalidSystems.join(', ')}`;
        }
      }
      
      validationResults.push(result);
    }
    
    // Create validation results Excel file
    try {
      
      // Tạo file Excel với kết quả validation
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Validation Results');
      
      // Định nghĩa headers - đầy đủ các trường từ file ban đầu + 2 trường validation
      const headers = [
        'IPAddress (Require, one per row)', 
        'Description', 
        'Status', 
        'Tag (comma-separated if multiple)', 
        'Contact (Email or Email prefix, comma-separated if multiple)', 
        'System Name (comma-separated if multiple)',
        'Validation Status', 
        'Validation Reason'
      ];
      
      // Add headers
      worksheet.addRow(headers);
      
      // Add validation results - đảm bảo đúng thứ tự với headers
      validationResults.forEach(result => {
        const row = [
          result.ip_address,                                                    // IPAddress (Require, one per row)
          result.description || '',                                            // Description
          result.status || 'reserved',                                         // Status
          result.tags || '',                                                   // Tag (comma-separated if multiple)
          result.contacts || '',                                               // Contact (Email, comma-separated if multiple)
          result.system || '',                                                 // System Name (comma-separated if multiple)
          result.validation_status || 'Pass',                                  // Validation Status
          result.validation_reason || ''                                       // Validation Reason
        ];
        worksheet.addRow(row);
      });
      
      // Set column widths
      worksheet.columns.forEach(col => { col.width = 22; });
      
      // Tạo thư mục temp nếu chưa có
      const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
      const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Tạo file Excel tạm với tên theo định dạng timestamp_filename_validated.xlsx
      const originalFileName = req.file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
      const timestamp = Date.now();
      const excelFileName = `${timestamp}_${originalFileName}_validation.xlsx`;
      const excelFilePath = path.join(tempDir, excelFileName);
      await workbook.xlsx.writeFile(excelFilePath);
      
      // Send Excel file directly
      
      // Set headers for Excel download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
      res.setHeader('Content-Length', fs.statSync(excelFilePath).size);
      
      // Check if all validations passed
      const allPassed = validationResults.every(result => result.validation_status === 'Pass');
      const passCount = validationResults.filter(result => result.validation_status === 'Pass').length;
      const failCount = validationResults.filter(result => result.validation_status === 'Fail').length;
      
      // Add validation summary to headers
      res.setHeader('X-Validation-Summary', JSON.stringify({
        total: validationResults.length,
        passed: passCount,
        failed: failCount,
        allPassed: allPassed
      }));
      
      // Send Excel file
      const excelBuffer = fs.readFileSync(excelFilePath);
      res.send(excelBuffer);
      
      // Clean up files after sending
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
    console.error('Error creating validation Excel file:', err);
    res.status(500).send('Error creating validation Excel file: ' + err.message);
  }
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
  } catch (err) {
    console.error('Error validating import file:', err);
    res.status(500).json({ error: 'Error validating import file', detail: err.message });
  }
};

// API: Import IP addresses from validated file
networkController.importIPs = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    
    let rows = [];
    
    // Parse file (same logic as validation)
    if (fileExtension === 'csv') {
      const results = [];
      
      // Simple CSV parsing without csv-parser dependency
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index] || '';
          });
          results.push(rowData);
        }
      }
      
      rows = results;
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.worksheets[0];
      const headers = [];
      
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value;
      });
      
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const rowData = {};
        
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            rowData[header] = cell.value;
          }
        });
        
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      }
    }
    
    const importResults = [];
    const updated_by = req.session.user?.username || '';
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const result = {
        row: rowNumber,
        ip_address: row['IPAddress (Require, one per row)'] || '',
        description: row['Description'] || '',
        status: row['Status'] || 'reserved',
        tags: row['Tag (comma-separated if multiple)'] || row['Tags'] || '',
        contacts: row['Contact (Email or Email prefix, comma-separated if multiple)'] || row['Contact (Email, comma-separated if multiple)'] || row['Contacts'] || '',
        system: row['System Name (comma-separated if multiple)'] || row['System'] || '',
        import_status: 'Success',
        import_reason: ''
      };
      
      try {
        // Create IP address
        const newIp = await IpAddress.create({ 
          address: result.ip_address, 
          description: result.description, 
          status: result.status, 
          updated_by 
        }, client);
        
        // Set tags if provided
        if (result.tags) {
          const tagNames = result.tags.split(',').map(t => t.trim()).filter(t => t);
          const tagIds = [];
          for (const tagName of tagNames) {
            const tags = await Tag.findByNameExact(tagName);
            if (tags && tags.length > 0) {
              tagIds.push(tags[0].id);
            }
          }
          if (tagIds.length > 0) {
            // @ts-ignore - client parameter is supported by model methods
            await IpAddress.setTags(newIp.id, tagIds, client);
          }
        }
        
        // Set contacts if provided
        if (result.contacts) {
          const contactEmails = result.contacts.split(',').map(c => c.trim()).filter(c => c);
          const contactIds = [];
          for (const email of contactEmails) {
            const contacts = await Contact.findByEmailSearch(email);
            if (contacts && contacts.length > 0) {
              contactIds.push(contacts[0].id);
            }
          }
          if (contactIds.length > 0) {
            // @ts-ignore - client parameter is supported by model methods
            await IpAddress.setContacts(newIp.id, contactIds, client);
          }
        }
        
        // Set systems if provided
        if (result.system) {
          const systemNames = result.system.split(',').map(s => s.trim()).filter(s => s);
          const systemIds = [];
          for (const systemName of systemNames) {
            const systems = await System.findByNameExact(systemName);
            if (systems && systems.length > 0) {
              systemIds.push(systems[0].id);
            }
          }
          if (systemIds.length > 0) {
            // @ts-ignore - client parameter is supported by model methods
            await IpAddress.setSystems(newIp.id, systemIds, client);
          }
        }
        
        result.import_reason = 'Successfully created IP address';
        
      } catch (err) {
        result.import_status = 'Failed';
        result.import_reason = err.message || 'Unknown error';
      }
      
      importResults.push(result);
    }
    
    await client.query('COMMIT');
    
    // Create import results Excel file (same as validation)
    try {
      
      // Tạo file Excel với kết quả import
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Import Results');
      
      // Định nghĩa headers - đầy đủ các trường từ file ban đầu + 2 trường import
      const headers = [
        'IPAddress (Require, one per row)', 
        'Description', 
        'Status', 
        'Tag (comma-separated if multiple)', 
        'Contact (Email or Email prefix, comma-separated if multiple)', 
        'System Name (comma-separated if multiple)',
        'Import Status', 
        'Import Reason'
      ];
      
      // Add headers
      worksheet.addRow(headers);
      
      // Add import results - đảm bảo đúng thứ tự với headers
      importResults.forEach(result => {
        const row = [
          result.ip_address,                                                    // IPAddress (Require, one per row)
          result.description || '',                                            // Description
          result.status || 'reserved',                                         // Status
          result.tags || '',                                                   // Tag (comma-separated if multiple)
          result.contacts || '',                                               // Contact (Email or Email prefix, comma-separated if multiple)
          result.system || '',                                                 // System Name (comma-separated if multiple)
          result.import_status || 'Success',                                   // Import Status
          result.import_reason || ''                                           // Import Reason
        ];
        worksheet.addRow(row);
      });
      
      // Set column widths
      worksheet.columns.forEach(col => { col.width = 22; });
      
      // Tạo thư mục temp nếu chưa có
      const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
      const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Tạo file Excel tạm với tên theo định dạng timestamp_filename_imported.xlsx
      const originalFileName = req.file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
      const timestamp = Date.now();
      const excelFileName = `${timestamp}_${originalFileName}_imported.xlsx`;
      const excelFilePath = path.join(tempDir, excelFileName);
      await workbook.xlsx.writeFile(excelFilePath);
      
      
      // Send Excel file directly
      
      // Set headers for Excel download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
      res.setHeader('Content-Length', fs.statSync(excelFilePath).size);
      
      // Send Excel file
      const excelBuffer = fs.readFileSync(excelFilePath);
      res.send(excelBuffer);
      
      // Clean up files after sending
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
    console.error('Error creating import Excel file:', err);
    res.status(500).send('Error creating import Excel file: ' + err.message);
  }
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing IPs:', err);
    res.status(500).json({ error: 'Error importing IPs', detail: err.message });
  } finally {
    client.release();
  }
};

// Export IP Address List as Excel (filtered)
networkController.exportIpAddressList = async (req, res) => {
  try {
    // Chuẩn hóa filter giống listIP
    const normalizeArray = v => (Array.isArray(v) ? v : (v ? [v] : []));
    const search = req.query.search ? req.query.search.trim() : '';
    let filterTags = req.query['tags[]'] || req.query.tags || [];
    let filterStatus = req.query.status || '';
    let filterSystems = req.query['systems[]'] || req.query.systems || [];
    let filterContacts = req.query['contacts[]'] || req.query.contacts || [];
    filterTags = normalizeArray(filterTags).filter(x => x !== '');
    filterSystems = normalizeArray(filterSystems).filter(x => x !== '');
    filterContacts = normalizeArray(filterContacts).filter(x => x !== '');
    // Lấy toàn bộ danh sách (không phân trang)
    const ipList = await IpAddress.findFilteredList({
      search,
      tags: filterTags,
      status: filterStatus,
      systems: filterSystems,
      contacts: filterContacts,
      page: 1,
      pageSize: 10000
    });
    // Định nghĩa các cột xuất Excel
    const headers = [
      'ID', 'IP Address', 'Description', 'Status', 'Tags', 'Created At', 'Updated At', 'Updated By', 'Systems', 'Contacts'
    ];
    const rows = ipList.map(ip => [
      ip.id,
      ip.ip_address || '',
      ip.description ? ip.description.replace(/\r?\n|\r/g, ' ') : '',
      ip.status || '',
      (ip.tags && ip.tags.length ? ip.tags.map(t => t.name).join(', ') : ''),
      ip.created_at ? new Date(ip.created_at).toLocaleString('en-GB') : '',
      ip.updated_at ? new Date(ip.updated_at).toLocaleString('en-GB') : '',
      ip.updated_by || '',
      (ip.systems && ip.systems.length ? ip.systems.map(s => s.name).join(', ') : ''),
      (ip.contacts && ip.contacts.length ? ip.contacts.map(c => `${c.name} <${c.email}>`).join(', ') : '')
    ]);
    // Tạo file Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('IP Address List');
    worksheet.addRow(headers);
    rows.forEach(row => worksheet.addRow(row));
    worksheet.columns.forEach(col => { col.width = 22; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="ip_address_list.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting IP address list:', err);
    res.status(500).send('Error exporting IP address list: ' + err.message);
  }
};

// Export Subnet List as Excel (filtered)
networkController.exportSubnetList = async (req, res) => {
  try {
    // Chuẩn hóa filter giống listSubnet
    const normalizeArray = v => (Array.isArray(v) ? v : (v ? [v] : []));
    const search = req.query.search ? req.query.search.trim() : '';
    let filterTags = req.query['tags[]'] || req.query.tags || [];
    filterTags = normalizeArray(filterTags).filter(x => x !== '');
    
    // Lấy toàn bộ danh sách (không phân trang)
    let subnetList = [];
    if (search || filterTags.length > 0) {
      subnetList = await Subnet.findFilteredList({ 
        search, 
        tags: filterTags, 
        page: 1, 
        pageSize: 10000 
      });
    } else {
      subnetList = await Subnet.findAll();
    }
    
    // Định nghĩa các cột xuất Excel
    const headers = [
      'ID', 'Subnet Address', 'Description', 'Tags', 'Created At', 'Updated At', 'Updated By'
    ];
    const rows = subnetList.map(subnet => [
      subnet.id,
      subnet.address || '',
      subnet.description ? subnet.description.replace(/\r?\n|\r/g, ' ') : '',
      (subnet.tags && subnet.tags.length ? subnet.tags.map(t => t.name).join(', ') : ''),
      subnet.created_at ? new Date(subnet.created_at).toLocaleString('en-GB') : '',
      subnet.updated_at ? new Date(subnet.updated_at).toLocaleString('en-GB') : '',
      subnet.updated_by || ''
    ]);
    
    // Tạo file Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Subnet List');
    worksheet.addRow(headers);
    rows.forEach(row => worksheet.addRow(row));
    worksheet.columns.forEach(col => { col.width = 22; });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="subnet_list.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting subnet list:', err);
    res.status(500).send('Error exporting subnet list: ' + err.message);
  }
};

// API: Download IP address import template
networkController.downloadTemplate = async (req, res) => {
  try {
    // Create Excel workbook for template
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('IP Address Template');
    
    // Add headers
    worksheet.addRow([
      'IPAddress (Require, one per row)',
      'Description',
      'Status',
      'Tag (comma-separated if multiple)',
      'Contact (Email or Email prefix, comma-separated if multiple)',
      'System Name (comma-separated if multiple)'
    ]);
    
    // Add sample data
    worksheet.addRow([
      '192.168.192.101',
      'MGMT: MGMT Network + Firewall',
      'active',
      'REST-Test-Tag,PCI-CDE',
      'toannn1.ho,longhv.ho',
      'Test System Minimal,Quản lý công việc'
    ]);
    
    worksheet.addRow([
      '192.168.1.103',
      'MGMT: MGMT Network',
      'reserved',
      'REST-Test-Tag',
      'toannn1.ho',
      ''
    ]);
    
    // Set column widths
    worksheet.columns = [
      { width: 30 },  // IPAddress
      { width: 25 },  // Description
      { width: 15 },  // Status
      { width: 25 },  // Tag
      { width: 30 },  // Contact
      { width: 25 }   // System Name
    ];
    
    // Write to temporary file first (like in test)
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, 'temp_template.xlsx');
    await workbook.xlsx.writeFile(tempPath);
    // Check if file exists and get size
    if (fs.existsSync(tempPath)) {
      const stats = fs.statSync(tempPath);
      
      // Use res.download() for proper file download handling
      res.download(tempPath, 'ipaddress_list_template.xlsx', (err) => {
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
    console.error('Error creating template file:', err);
    res.status(500).json({ error: 'Error creating template file', detail: err.message });
  }
};

// Download validation results file
networkController.downloadValidationFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const filePath = path.join(process.cwd(), uploadsDir, 'temp', filename);
    
    console.log('Downloading file:', filePath);
    
    if (fs.existsSync(filePath)) {
      res.download(filePath, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
        } else {
          console.log('File downloaded successfully');
        }
        
        // Clean up after download
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
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).json({ error: 'Error downloading file', detail: err.message });
  }
};

// ====== SUBNET IMPORT METHODS ======

// Helper function to sanitize string data for Excel
const sanitizeString = (str) => {
  if (!str) return '';
  return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
};

// Download subnet template
networkController.downloadSubnetTemplate = async (req, res) => {
  try {
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Subnet Template');
    
    // Add headers
    worksheet.addRow([
      'Subnet Address (Require)',
      'Description',
      'Tag (comma-separated if multiple)'
    ]);
    
    // Add sample data
    worksheet.addRow([
      '192.168.1.0/24',
      'Office Network',
      'Network,Office'
    ]);
    
    worksheet.addRow([
      '10.0.0.0/8',
      'Private Network',
      'Network,Private'
    ]);
    
    // Set column widths
    worksheet.columns = [
      { width: 25 },  // Subnet Address
      { width: 30 },  // Description
      { width: 25 }   // Tag
    ];
    
    // Create temp directory if not exists
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, 'temp_subnet_template.xlsx');
    await workbook.xlsx.writeFile(tempFilePath);
    
    res.download(tempFilePath, 'subnet_template.xlsx', (err) => {
      if (err) {
        console.error('Error downloading template:', err);
      }
      // Clean up temp file after download
      setTimeout(() => {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupErr) {
          console.error('Error cleaning up template file:', cleanupErr);
        }
      }, 5000);
    });
  } catch (err) {
    console.error('Error generating subnet template:', err);
    res.status(500).json({ error: 'Error generating template', detail: err.message });
  }
};

// Validate subnet import
networkController.validateImportSubnets = async (req, res) => {
  try {
    console.log('=== SUBNET VALIDATION START ===');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);
    console.log('Session user:', req.session?.user);
    console.log('File uploaded:', req.file);
    
    if (!req.file) {
      console.log('ERROR: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File uploaded:', req.file.originalname);
    const filePath = req.file.path;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    console.log('File extension:', fileExtension);
    
    let rows = [];
    
    // Parse file based on extension
    if (fileExtension === 'csv') {
      const results = [];
      
      // Simple CSV parsing without csv-parser dependency
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index] || '';
          });
          results.push(rowData);
        }
      }
      
      rows = results;
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.worksheets[0];
      const headers = [];
      
      // Get headers from first row
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value;
      });
      
      
      // Get data rows
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const rowData = {};
        
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            rowData[header] = cell.value;
          }
        });
        
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }
    

    // Validate each row
    console.log('Starting validation for', rows.length, 'rows');
    const validationResults = [];
    const subnetRegex = /^[0-9]{1,3}(\.[0-9]{1,3}){3}\/[0-9]{1,2}$/;
    
    for (let i = 0; i < rows.length; i++) {
      console.log('Validating row', i + 1, ':', rows[i]);
      const row = rows[i];
      const rowNumber = i + 2; // +2 because Excel starts from 1 and we skip header
      const result = {
        row: rowNumber,
        subnet_address: row['Subnet Address (Require)'] || '',
        description: row['Description'] || '',
        tags: row['Tag (comma-separated if multiple)'] || '',
        validation_status: 'Pass',
        validation_reason: ''
      };
      
      // Validate subnet address
      if (!result.subnet_address) {
        result.validation_status = 'Fail';
        result.validation_reason = 'Subnet Address is required';
      } else if (!subnetRegex.test(result.subnet_address)) {
        result.validation_status = 'Fail';
        result.validation_reason = 'Invalid subnet format. Must be in format: 192.168.1.0/24';
      }
      
      // Check if subnet already exists
      try {
        console.log('Checking if subnet exists:', result.subnet_address);
        const existingSubnet = await Subnet.findByAddress(result.subnet_address);
        console.log('Existing subnet found:', existingSubnet);
        if (existingSubnet) {
          result.validation_status = 'Fail';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + 'Subnet address already exists';
        }
      } catch (err) {
        console.log('Error checking subnet existence:', err.message);
        // If error checking existence, continue with validation
      }
      
      // Validate Tags (if provided)
      if (result.tags) {
        const tagNames = result.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        const invalidTags = [];
        for (const tagName of tagNames) {
          try {
            const tags = await Tag.findByNameExact(tagName);
            if (!tags || tags.length === 0) {
              invalidTags.push(tagName);
            }
          } catch (err) {
            // If error checking tag, continue with validation
          }
        }
        if (invalidTags.length > 0) {
          // Tag không hợp lệ sẽ làm fail validation
          result.validation_status = 'Fail';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Tag(s) not found: ${invalidTags.join(', ')}`;
        }
      }
      
      console.log('Final validation result for row', i + 1, ':', result);
      validationResults.push(result);
    }
    
    // Create validation results Excel file
    console.log('Creating Excel file with', validationResults.length, 'results');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Validation Results');
    
    // Add headers
    worksheet.addRow([
      'Subnet Address (Require)',
      'Description',
      'Tag (comma-separated if multiple)',
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
        result.subnet_address,
        result.description,
        result.tags,
        result.validation_status,
        result.validation_reason
      ]);

      // Color code validation status
      if (result.validation_status === 'Fail') {
        row.getCell(4).font = { color: { argb: 'FFFF0000' } }; // Validation Status column
        row.getCell(5).font = { color: { argb: 'FFFF0000' } }; // Validation Reason column
      } else {
        row.getCell(4).font = { color: { argb: 'FF008000' } }; // Validation Status column
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 25 },  // Subnet Address
      { width: 30 },  // Description
      { width: 25 },  // Tag
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
    const validationFileName = `${timestamp}_${req.file.originalname}_validation.xlsx`;
    const validationFilePath = path.join(tempDir, validationFileName);
    console.log('Writing Excel file to:', validationFilePath);

    await workbook.xlsx.writeFile(validationFilePath);
    console.log('Excel file written successfully');

    // Count validation results
    const allPassed = validationResults.every(result => result.validation_status === 'Pass');
    const passCount = validationResults.filter(result => result.validation_status === 'Pass').length;
    const failCount = validationResults.length - passCount;
    
    console.log('Validation summary:');
    console.log('- Total rows:', validationResults.length);
    console.log('- Passed:', passCount);
    console.log('- Failed:', failCount);
    console.log('- All passed:', allPassed);

    // Clean up uploaded file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupErr) {
      console.error('Error cleaning up uploaded file:', cleanupErr);
    }

    // Clean up validation file after 10 seconds
    setTimeout(() => {
      try {
        if (fs.existsSync(validationFilePath)) {
          fs.unlinkSync(validationFilePath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up validation file:', cleanupErr);
      }
    }, 10000);

    // Set header for frontend to know if import button should be enabled
    console.log('Setting response headers and sending response');
    res.set('X-Validation-Summary', JSON.stringify({
      total: validationResults.length,
      passed: passCount,
      failed: failCount,
      allPassed: allPassed
    }));

    const responseData = {
      success: true,
      message: `Validation completed. ${passCount} passed, ${failCount} failed.`,
      validation_summary: {
        total: validationResults.length,
        passed: passCount,
        failed: failCount,
        all_passed: allPassed
      },
      validation_file: validationFileName
    };
    
    console.log('Sending response:', responseData);
    res.json(responseData);
    console.log('=== SUBNET VALIDATION COMPLETED ===');

  } catch (err) {
    console.error('=== SUBNET VALIDATION ERROR ===');
    console.error('Error validating subnet import file:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Error validating file', detail: err.message });
  }
};

// Import subnets
networkController.importSubnets = async (req, res) => {
  try {
    console.log('=== SUBNET IMPORT START ===');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Session user:', req.session?.user);
    console.log('File uploaded:', req.file);
    
    if (!req.file) {
      console.log('ERROR: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    let rows = [];

    // Parse file based on extension
    const ext = path.extname(originalFileName).toLowerCase();
    if (ext === '.csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      // Validate headers order and required fields
      const expectedHeaders = [
        'Subnet Address (Require)',
        'Description', 
        'Tag (comma-separated if multiple)'
      ];
      
      if (headers.length !== expectedHeaders.length) {
        return res.status(400).json({ 
          error: `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headers.length}` 
        });
      }
      
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (headers[i] !== expectedHeaders[i]) {
          return res.status(400).json({ 
            error: `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headers[i]}"` 
          });
        }
      }
      
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
      rows = XLSX.utils.sheet_to_json(worksheet);
      
      // Validate headers for Excel files
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const expectedHeaders = [
          'Subnet Address (Require)',
          'Description', 
          'Tag (comma-separated if multiple)'
        ];
        
        if (headers.length !== expectedHeaders.length) {
          return res.status(400).json({ 
            error: `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headers.length}` 
          });
        }
        
        for (let i = 0; i < expectedHeaders.length; i++) {
          if (headers[i] !== expectedHeaders[i]) {
            return res.status(400).json({ 
              error: `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headers[i]}"` 
            });
          }
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Only CSV and Excel files are allowed.' });
    }

    // Start transaction
    const client = await pool.connect();
    await client.query('BEGIN');

    const importResults = [];
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 1,
        subnet_address: sanitizeString(row['Subnet Address (Require)'] || ''),
        description: sanitizeString(row['Description'] || ''),
        tags: sanitizeString(row['Tag (comma-separated if multiple)'] || ''),
        import_status: 'SUCCESS',
        import_reason: ''
      };

      try {
        // Double-check subnet doesn't exist (safety check)
        const existingSubnet = await Subnet.findByAddress(result.subnet_address);
        if (existingSubnet) {
          result.import_status = 'FAILED';
          result.import_reason = 'Subnet address already exists';
          importResults.push(result);
          continue;
        }

        // Create subnet
        const newSubnet = await Subnet.create({
          address: result.subnet_address,
          description: result.description || null,
          updated_by: username
        }, client);

        // Set tags if provided
        if (result.tags) {
          const tagList = result.tags.split(',').map(t => t.trim()).filter(t => t);
          const tagIds = [];
          for (const tagName of tagList) {
            const existingTags = await Tag.findByNameExact(tagName);
            if (existingTags && existingTags.length > 0) {
              tagIds.push(existingTags[0].id);
            }
          }
          if (tagIds.length > 0) {
            await Subnet.setTags(newSubnet.id, tagIds, client);
          }
        }

        importResults.push(result);

      } catch (err) {
        console.error(`Error importing subnet row ${i + 1}:`, err);
        result.import_status = 'FAILED';
        result.import_reason = err.message;
        importResults.push(result);
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    client.release();

    // Create import results Excel file (same as validation)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import Results');
    
    // Add headers
    worksheet.addRow([
      'Subnet Address (Require)',
      'Description',
      'Tag (comma-separated if multiple)',
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
        result.subnet_address,
        result.description,
        result.tag,
        result.import_status,
        result.import_reason
      ]);

      // Color code import status
      if (result.import_status === 'FAILED') {
        row.getCell(4).font = { color: { argb: 'FFFF0000' } }; // Import Status column
        row.getCell(5).font = { color: { argb: 'FFFF0000' } }; // Import Reason column
      } else {
        row.getCell(4).font = { color: { argb: 'FF008000' } }; // Import Status column
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 25 },  // Subnet Address
      { width: 30 },  // Description
      { width: 25 },  // Tag
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
    const importFileName = `${timestamp}_${originalFileName}_imported.xlsx`;
    const importFilePath = path.join(tempDir, importFileName);

    await workbook.xlsx.writeFile(importFilePath);

    // Count import results
    const successCount = importResults.filter(result => result.import_status === 'SUCCESS').length;
    const failCount = importResults.length - successCount;

    // Clean up uploaded file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupErr) {
      console.error('Error cleaning up uploaded file:', cleanupErr);
    }

    // Clean up import file after 10 seconds
    setTimeout(() => {
      try {
        if (fs.existsSync(importFilePath)) {
          fs.unlinkSync(importFilePath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up import file:', cleanupErr);
      }
    }, 10000);

    res.json({
      success: true,
      message: `Import completed. ${successCount} imported successfully, ${failCount} failed.`,
      import_summary: {
        total: importResults.length,
        success: successCount,
        failed: failCount
      },
      import_file: importFileName
    });

  } catch (err) {
    console.error('=== SUBNET IMPORT ERROR ===');
    console.error('Error importing subnets:', err);
    console.error('Error stack:', err.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error importing subnets', detail: err.message });
    }
  }
};

// Download subnet validation file
networkController.downloadSubnetValidationFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    const filePath = path.join(tempDir, filename);

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
          }
        } catch (cleanupErr) {
          console.error('Error cleaning up validation file:', cleanupErr);
        }
      }, 5000);
    });
  } catch (err) {
    console.error('Error downloading file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error downloading file', detail: err.message });
    }
  }
};

// Batch delete IP addresses
networkController.batchDeleteIpAddresses = async (req, res) => {
  const client = await pool.connect();
  try {
    const { ipIds } = req.body;
    
    // Validate input
    if (!ipIds || !Array.isArray(ipIds) || ipIds.length === 0) {
      return res.status(400).json({ 
        error: 'No IP addresses selected for deletion',
        detail: 'Please select at least one IP address to delete'
      });
    }
    
    if (ipIds.length > 100) {
      return res.status(400).json({ 
        error: 'Too many IP addresses selected',
        detail: 'Cannot delete more than 100 IP addresses at once. Please select fewer IPs.'
      });
    }
    
    // Validate all IDs are numbers
    const validIds = ipIds.filter(id => !isNaN(parseInt(id)) && parseInt(id) > 0);
    if (validIds.length !== ipIds.length) {
      const invalidIds = ipIds.filter(id => isNaN(parseInt(id)) || parseInt(id) <= 0);
      return res.status(400).json({ 
        error: 'Invalid IP address IDs provided',
        detail: `Invalid IDs: ${invalidIds.join(', ')}`
      });
    }
    
    await client.query('BEGIN');
    
    const results = {
      success: [],
      failed: [],
      total: ipIds.length
    };
    
    // Process each IP address
    for (const ipId of validIds) {
      try {
        // Check if IP exists
        const ipExists = await IpAddress.exists(ipId);
        if (!ipExists) {
          results.failed.push({
            id: ipId,
            reason: 'IP address not found'
          });
          continue;
        }
        
        // Get IP details for logging
        const ipDetails = await IpAddress.findById(ipId);
        
        // Remove tags first
        // @ts-ignore - client parameter is supported by model methods
        await IpAddress.setTags(ipId, [], client);
        
        // Delete the IP address
        // @ts-ignore - client parameter is supported by model methods
        await IpAddress.delete(ipId, client);
        
        results.success.push({
          id: ipId,
          ip_address: ipDetails?.ip_address || 'Unknown'
        });
        
      } catch (err) {
        let reason = 'Delete failed';
        
        if (err.message.includes('foreign key constraint') || err.message.includes('assigned to server')) {
          reason = 'IP address is in use by servers/devices. Please delete the associated servers/devices first';
          console.log(`IP ${ipId} cannot be deleted: ${err.message}`);
        } else if (err.message.includes('permission')) {
          reason = 'Permission denied';
          console.error(`Permission error deleting IP ${ipId}:`, err);
        } else {
          reason = err.message;
          console.error(`Unexpected error deleting IP ${ipId}:`, err);
        }
        
        results.failed.push({
          id: ipId,
          reason: reason
        });
      }
    }
    
    // If all failed, rollback
    if (results.success.length === 0) {
      await client.query('ROLLBACK');
      const failedReasons = results.failed.map(f => f.reason).join(', ');
      return res.status(400).json({
        error: 'No IP addresses were deleted',
        detail: `All deletions failed. Reasons: ${failedReasons}`,
        results: results
      });
    }
    
    // If some failed, still commit successful deletions
    await client.query('COMMIT');
    
    // Return results
    let message = `${results.success.length} IP address(es) deleted successfully`;
    if (results.failed.length > 0) {
      const failedReasons = results.failed.map(f => f.reason).join(', ');
      message += `. ${results.failed.length} failed: ${failedReasons}`;
    }
    
    res.json({
      success: true,
      message: message,
      results: results
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Batch delete IP addresses error:', err);
    res.status(500).json({ 
      error: 'Batch delete failed', 
      detail: err.message 
    });
  } finally {
    client.release();
  }
};

export default networkController;
