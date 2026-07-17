
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
import { ServiceError } from '../services/errors.js';
import { parseCsvLine } from '../utils/csvParser.js';
import {
  listIpAddresses as listIpAddressesService,
  createIpAddress as createIpAddressService,
  updateIpAddress as updateIpAddressService,
  deleteIpAddress as deleteIpAddressService,
  getIpStatusOptions,
  IPV4_REGEX
} from '../services/ipAddressService.js';
import {
  listSubnets as listSubnetsService,
  createSubnet as createSubnetService,
  updateSubnet as updateSubnetService,
  deleteSubnet as deleteSubnetService
} from '../services/subnetService.js';
import {
  listDomains as listDomainsService,
  createDomain as createDomainService,
  updateDomain as updateDomainService,
  deleteDomain as deleteDomainService
} from '../services/domainService.js';

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

    // Gọi service filter
    const { items: ipList, totalCount } = await listIpAddressesService({
      search,
      tags: filterTags,
      status: filterStatus,
      systems: filterSystems,
      contacts: filterContacts,
      page,
      pageSize
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];

  // Load ipStatusOptions from DB (Configuration) via helper
  const ipStatusOptions = await getIpStatusOptions();

    // --- Fetch display names for selected filters (for select2 persistence) ---
    let selectedTags = [];
    if (Array.isArray(filterTags) && filterTags.length > 0) {
      const tagList = await Tag.findByIds(filterTags);
      selectedTags = filterTags.map(tid => {
        const found = tagList.find(t => t.id == tid);
        return found ? { id: found.id, name: found.name } : null;
      }).filter(Boolean);
    }
    
    let selectedSystems = [];
    if (Array.isArray(filterSystems) && filterSystems.length > 0) {
      const systemList = await System.findByIds(filterSystems);
      selectedSystems = filterSystems.map(sid => {
        const found = systemList.find(s => s.id == sid);
        return found ? { id: found.id, name: found.name } : null;
      }).filter(Boolean);
    }
    
    let selectedContacts = [];
    if (Array.isArray(filterContacts) && filterContacts.length > 0) {
      const contactList = await Contact.findByIds(filterContacts);
      selectedContacts = filterContacts.map(cid => {
        const found = contactList.find(c => c.id == cid);
        return found ? { id: found.id, name: found.name } : null;
      }).filter(Boolean);
    }

    res.render('pages/network/ip_address_list', {
      ipList,
      page,
      pageSize,
      totalPages,
      totalCount,
      search,
      filterTags: selectedTags,
      filterStatus,
      filterSystems: selectedSystems,
      filterContacts: selectedContacts,
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
    const { address, description, status, tags, contacts, systems, page } = req.body;

    // Parse multiple IP addresses separated by comma
    const ipAddresses = address ? address.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0) : [];

    // Pre-validate format for all addresses up front (fail fast on the first
    // bad one, with the specific-IP message) — the service also validates
    // format per-address, but this keeps the friendlier original message.
    for (const ip of ipAddresses) {
      if (!IPV4_REGEX.test(ip)) {
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

    const updated_by = req.session.user?.username || '';
    // One shared client across the whole batch keeps it atomic: all-or-none.
    const createdIPs = [];
    for (const ip of ipAddresses) {
      const created = await createIpAddressService({ address: ip, description, status, tags, contacts, systems, updated_by }, client);
      createdIPs.push(created);
    }

    await client.query('COMMIT');
    const successMessage = createdIPs.length === 1
      ? 'IP address added successfully!'
      : `${createdIPs.length} IP addresses added successfully!`;
    req.flash('success', successMessage);
    return res.redirect(`/network/ip-address?page=${page || 1}`);
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err instanceof ServiceError ? err.message : (err.message || 'Add failed.');
    if (!(err instanceof ServiceError) && errorMessage.includes('duplicate key value') && errorMessage.includes('unique constraint')) {
      errorMessage = 'One or more IP addresses already exist.';
    }
    req.flash('error', errorMessage);
    return res.redirect(`/network/ip-address?page=${req.body.page || 1}`);
  } finally {
    client.release();
  }
};

// Handle updating an IP address (with transaction)
networkController.updateIP = async (req, res) => {
  try {
    const { description, status, tags, contacts, systems, page } = req.body;
    const id = req.params.id;
    // tags/contacts/systems always included (even as []) to preserve the
    // previous "always fully replace these associations" edit-form behavior.
    await updateIpAddressService(id, {
      description,
      status,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      contacts: contacts ? (Array.isArray(contacts) ? contacts : [contacts]) : [],
      systems: systems ? (Array.isArray(systems) ? systems : [systems]) : [],
      updated_by: req.session.user?.username || ''
    });
    req.flash('success', 'IP address updated successfully!');
    return res.redirect(`/network/ip-address?page=${page || 1}`);
  } catch (err) {
    let errorMessage = err instanceof ServiceError ? err.message : (err.message || 'Save failed.');
    if (!(err instanceof ServiceError) && errorMessage.includes('duplicate key value') && errorMessage.includes('unique constraint')) {
      errorMessage = 'IP address already exists.';
    }
    req.flash('error', errorMessage);
    return res.redirect(`/network/ip-address?page=${req.body.page || 1}`);
  }
};

// Handle deleting an IP address
networkController.deleteIP = async (req, res) => {
  try {
    const page = req.body.page || req.query.page || 1;
    await deleteIpAddressService(req.params.id);
    req.flash('success', 'IP address deleted successfully!');
    return res.redirect(`/network/ip-address?page=${page}`);
  } catch (err) {
    req.flash('error', err.message || 'Delete failed.');
    return res.redirect(`/network/ip-address?page=${req.body.page || 1}`);
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
    const filterZone = req.query.zone ? req.query.zone.trim() : '';
    const filterEnvironment = req.query.environment ? req.query.environment.trim() : '';

    const { items: subnetList, totalCount } = await listSubnetsService({ search, tags: filterTags, zone: filterZone, environment: filterEnvironment, page, pageSize });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    // Xây dựng cây subnet để hiển thị dạng cha-con
    const subnetTree = Subnet.buildSubnetTree(subnetList);
    
    // Lấy danh sách unique zones và environments cho filter
    const uniqueZones = await Subnet.getUniqueZones();
    const uniqueEnvironments = await Subnet.getUniqueEnvironments();
    
    // --- Fetch display names for selected filters (for select2 persistence) ---
    let selectedTags = [];
    if (Array.isArray(filterTags) && filterTags.length > 0) {
      const tagList = await Tag.findByIds(filterTags);
      selectedTags = filterTags.map(tid => {
        const found = tagList.find(t => t.id == tid);
        return found ? { id: found.id, name: found.name } : null;
      }).filter(Boolean);
    }
    
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];
    res.render('pages/network/subnet_list', {
      subnetList,
      subnetTree, // truyền thêm biến này
      page,
      pageSize,
      totalPages,
      totalCount,
      search,
      filterTags: selectedTags,
      filterZone,
      filterEnvironment,
      uniqueZones,
      uniqueEnvironments,
      successMessage,
      errorMessage,
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
  try {
    const { address, description, zone, environment, tags } = req.body;
    await createSubnetService({
      address, description, zone, environment, tags,
      updated_by: req.session.user?.username || ''
    });
    req.flash('success', 'Subnet added successfully!');
    return res.redirect('/network/subnet-address');
  } catch (err) {
    let errorMessage = err instanceof ServiceError ? err.message : (err.message || 'Add failed.');
    if (!(err instanceof ServiceError)) {
      if (errorMessage.includes('duplicate key value') && errorMessage.includes('unique constraint')) {
        errorMessage = 'Subnet address already exists.';
      } else if (err.code === '23503' && errorMessage.includes('tag_object_tag_id_fkey')) {
        errorMessage = 'One or more selected tags do not exist. Please select valid tags.';
      } else if (err.code === '23503') {
        errorMessage = 'Cannot create subnet due to invalid reference. Please check all selected options.';
      }
    }
    req.flash('error', errorMessage);
    return res.redirect('/network/subnet-address');
  }
};

// Handle updating subnet description (with transaction)
networkController.updateSubnet = async (req, res) => {
  try {
    const { description, zone, environment, page, tags } = req.body;
    await updateSubnetService(req.params.id, {
      description: description || '',
      zone: zone || '',
      environment: environment || '',
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      updated_by: req.session.user?.username || ''
    });
    req.flash('success', 'Subnet updated successfully!');
    return res.redirect(`/network/subnet-address?page=${page || 1}`);
  } catch (err) {
    let errorMessage = err instanceof ServiceError ? err.message : (err.message || 'Save failed.');
    if (!(err instanceof ServiceError)) {
      if (errorMessage.includes('duplicate key value') && errorMessage.includes('unique constraint')) {
        errorMessage = 'Subnet address already exists.';
      } else if (err.code === '23503' && errorMessage.includes('tag_object_tag_id_fkey')) {
        errorMessage = 'One or more selected tags do not exist. Please select valid tags.';
      } else if (err.code === '23503') {
        errorMessage = 'Cannot update subnet due to invalid reference. Please check all selected options.';
      }
    }
    req.flash('error', errorMessage);
    return res.redirect(`/network/subnet-address?page=${req.body.page || 1}`);
  }
};

// Handle deleting a subnet
networkController.deleteSubnet = async (req, res) => {
  try {
    const page = req.body.page || req.query.page || 1;
    await deleteSubnetService(req.params.id);
    req.flash('success', 'Subnet deleted successfully!');
    return res.redirect(`/network/subnet-address?page=${page}`);
  } catch (err) {
    let errorMessage = err.message || 'Delete failed.';
    if (!(err instanceof ServiceError) && errorMessage.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete: This subnet is in use.';
    }
    req.flash('error', errorMessage);
    return res.redirect(`/network/subnet-address?page=${req.body.page || 1}`);
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
    
    // Parse filter parameters
    const filterStatus = req.query.status || '';
    const filterTags = Array.isArray(req.query['tags[]']) ? req.query['tags[]'] :
      (req.query['tags[]'] ? [req.query['tags[]']] : (Array.isArray(req.query.tags) ? req.query.tags : req.query.tags ? [req.query.tags] : []));
    const filterSystems = Array.isArray(req.query['systems[]']) ? req.query['systems[]'] :
      (req.query['systems[]'] ? [req.query['systems[]']] : (Array.isArray(req.query.systems) ? req.query.systems : req.query.systems ? [req.query.systems] : []));
    
    // Tìm kiếm domain với filters
    const { items: domainList, totalCount } = await listDomainsService({
      search,
      tags: filterTags,
      systems: filterSystems,
      status: filterStatus,
      page,
      pageSize
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];
    // Load record type options from DB (Configuration)
    const recordTypeOptions = await getRecordTypeOptionsFromConfig();

    // --- Fetch display names for selected filters (for select2 persistence) ---
    let selectedTags = [];
    if (Array.isArray(filterTags) && filterTags.length > 0) {
      const tagList = await Tag.findByIds(filterTags);
      selectedTags = filterTags.map(tid => {
        const found = tagList.find(t => t.id == tid);
        return found ? { id: found.id, name: found.name } : null;
      }).filter(Boolean);
    }
    
    let selectedSystems = [];
    if (Array.isArray(filterSystems) && filterSystems.length > 0) {
      const systemList = await System.findByIds(filterSystems);
      selectedSystems = filterSystems.map(sid => {
        const found = systemList.find(s => s.id == sid);
        return found ? { id: found.id, name: found.name } : null;
      }).filter(Boolean);
    }
    res.render('pages/network/domain_list', {
      domainList,
      page,
      pageSize,
      totalPages,
      totalCount,
      search,
      successMessage,
      errorMessage,
      recordTypeOptions,
      filterStatus,
      filterTags: selectedTags,
      filterSystems: selectedSystems,
      title: 'Domain',
      activeMenu: 'domain'
    });
  } catch (err) {
    res.status(500).send('Error loading domains: ' + err.message);
  }
};

// Handle creating a new domain
networkController.createDomain = async (req, res) => {
  try {
    const { domain, description, ip_id, record_type, systems, tags } = req.body;
    await createDomainService({ domain, description, ip_id, record_type, systems, tags });
    req.flash('success', 'Domain added successfully!');
    res.redirect('/network/domain');
  } catch (err) {
    let errorMessage = err instanceof ServiceError ? err.message : (err.message || 'Add failed.');
    if (!(err instanceof ServiceError) && errorMessage.includes('duplicate key value')) {
      errorMessage = 'Domain already exists.';
    }
    req.flash('error', errorMessage);
    res.redirect('/network/domain');
  }
};

// Handle updating a domain
networkController.updateDomain = async (req, res) => {
  try {
    const { description, ip_id, record_type, systems, tags } = req.body;
    const id = req.params.id;
    await updateDomainService(id, {
      description: description || '',
      ip_id,
      record_type: record_type ? record_type.trim() : 'A',
      systems: systems ? (Array.isArray(systems) ? systems : [systems]) : [],
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : []
    });
    req.flash('success', 'Domain updated successfully!');
    res.redirect('/network/domain');
  } catch (err) {
    let errorMessage = err instanceof ServiceError ? err.message : (err.message || 'Update failed.');
    if (!(err instanceof ServiceError) && errorMessage.includes('duplicate key value')) {
      errorMessage = 'Domain already exists.';
    }
    req.flash('error', errorMessage);
    res.redirect('/network/domain');
  }
};

// Handle deleting a domain
networkController.deleteDomain = async (req, res) => {
  try {
    const id = req.params.id;
    await deleteDomainService(id);
    req.flash('success', 'Domain deleted successfully!');
    res.redirect('/network/domain');
  } catch (err) {
    let errorMessage = err.message || 'Delete failed.';
    if (!(err instanceof ServiceError) && errorMessage.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete: This domain is in use.';
    }
    req.flash('error', errorMessage);
    res.redirect('/network/domain');
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
    
    // Get subnet information for this IP
    const subnetInfo = await IpAddress.getSubnetInfo(ipDetail.ip_address);
    
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
      tags: ipDetail.tags ? ipDetail.tags.map(tag => tag.name || tag) : [],
      contacts: ipDetail.contacts ? ipDetail.contacts.map(contact => contact.name || contact) : [],
      systems: ipDetail.systems ? ipDetail.systems.map(system => system.name || system) : [],
      // Add subnet information
      subnet: subnetInfo ? {
        id: subnetInfo.id,
        address: subnetInfo.address,
        description: subnetInfo.description,
        zone: subnetInfo.zone,
        environment: subnetInfo.environment,
        prefix_length: subnetInfo.prefix_length
      } : null
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
      zone: undefined,
      environment: undefined,
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

    // Every column must be present and in this exact order, matching the
    // downloadable template - optional columns may have empty cell values,
    // but the header row itself must not be missing/reordered/renamed.
    const expectedHeaders = [
      'IPAddress (Require, one per row)',
      'Description (Optional)',
      'Status (Optional)',
      'Tag (Optional, comma-separated if multiple)',
      'Contact (Optional, Email or Email prefix, comma-separated if multiple)',
      'System Name (Optional, comma-separated if multiple)'
    ];
    const validateHeaderOrder = (headerValues) => {
      if (headerValues.length !== expectedHeaders.length) {
        return `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headerValues.length}`;
      }
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (headerValues[i] !== expectedHeaders[i]) {
          return `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headerValues[i]}"`;
        }
      }
      return null;
    };

    // Parse file based on extension
    if (fileExtension === 'csv') {
      const results = [];

      // Simple CSV parsing without csv-parser dependency
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');
      const headers = parseCsvLine(lines[0]);

      const headerError = validateHeaderOrder(headers);
      if (headerError) {
        return res.status(400).json({ error: headerError });
      }

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = parseCsvLine(lines[i]);
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

      const headerError = validateHeaderOrder(headers.slice(1));
      if (headerError) {
        return res.status(400).json({ error: headerError });
      }

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
    // Shared with single/comma-add and the real import step (ipAddressService)
    // instead of a separately-maintained, drifted regex.
    const statusOptions = await getIpStatusOptions();
    const validStatuses = statusOptions.length ? statusOptions.map(s => String(s.value).toLowerCase()) : null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because Excel starts from 1 and we skip header
      const result = {
        row: rowNumber,
        ip_address: row['IPAddress (Require, one per row)'] || '',
        description: row['Description (Optional)'] || row['Description'] || '',
        status: row['Status (Optional)'] || row['Status'] || 'reserved',
        tags: row['Tag (Optional, comma-separated if multiple)'] || row['Tag (comma-separated if multiple)'] || row['Tags'] || '',
        contacts: row['Contact (Optional, Email or Email prefix, comma-separated if multiple)'] || row['Contact (Email or Email prefix, comma-separated if multiple)'] || row['Contact (Email, comma-separated if multiple)'] || row['Contacts'] || '',
        system: row['System Name (Optional, comma-separated if multiple)'] || row['System Name (comma-separated if multiple)'] || row['System'] || '',
        validation_status: 'Pass',
        validation_reason: ''
      };

      // Validate IP address
      if (!result.ip_address) {
        result.validation_status = 'Fail';
        result.validation_reason = 'IP Address is required';
      } else if (!IPV4_REGEX.test(result.ip_address)) {
        result.validation_status = 'Fail';
        result.validation_reason = 'Invalid IP address format';
      }

      // Validate status against the actually configured status options — no
      // options configured means no restriction, matching ipAddressService.
      if (validStatuses && result.status && !validStatuses.includes(result.status.toLowerCase())) {
        result.validation_status = 'Fail';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Invalid status. Must be one of: ${validStatuses.join(', ')}`;
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

    // Detect IP addresses duplicated within the file itself — the per-row
    // loop above only checks each IP against the DB, so two identical IPs in
    // the same file both "Pass" individually. That's exactly the case most
    // likely to hit a duplicate-key error mid-import (see importIPs).
    const rowsByIp = new Map();
    for (const result of validationResults) {
      if (!result.ip_address) continue;
      const key = result.ip_address.trim();
      if (!rowsByIp.has(key)) rowsByIp.set(key, []);
      rowsByIp.get(key).push(result);
    }
    for (const dupRows of rowsByIp.values()) {
      if (dupRows.length <= 1) continue;
      for (const result of dupRows) {
        result.validation_status = 'Fail';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + 'Duplicate IP address within this file';
      }
    }

    // Create validation results Excel file
    try {
      
      // Tạo file Excel với kết quả validation
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Validation Results');
      
      // Định nghĩa headers - đầy đủ các trường từ file ban đầu + 2 trường validation
      const headers = [
        'IPAddress (Require, one per row)',
        'Description (Optional)',
        'Status (Optional)',
        'Tag (Optional, comma-separated if multiple)',
        'Contact (Optional, Email or Email prefix, comma-separated if multiple)',
        'System Name (Optional, comma-separated if multiple)',
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
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const filePath = req.file.path;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();

    let rows = [];

    // Every column must be present and in this exact order, matching the
    // downloadable template - optional columns may have empty cell values,
    // but the header row itself must not be missing/reordered/renamed.
    const expectedHeaders = [
      'IPAddress (Require, one per row)',
      'Description (Optional)',
      'Status (Optional)',
      'Tag (Optional, comma-separated if multiple)',
      'Contact (Optional, Email or Email prefix, comma-separated if multiple)',
      'System Name (Optional, comma-separated if multiple)'
    ];
    const validateHeaderOrder = (headerValues) => {
      if (headerValues.length !== expectedHeaders.length) {
        return `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headerValues.length}`;
      }
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (headerValues[i] !== expectedHeaders[i]) {
          return `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headerValues[i]}"`;
        }
      }
      return null;
    };

      // Parse file (same logic as validation)
      if (fileExtension === 'csv') {
        const results = [];

        // Simple CSV parsing without csv-parser dependency
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        const headers = parseCsvLine(lines[0]);

        const headerError = validateHeaderOrder(headers);
        if (headerError) {
          return res.status(400).json({ error: headerError });
        }

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = parseCsvLine(lines[i]);
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

      const headerError = validateHeaderOrder(headers.slice(1));
      if (headerError) {
        return res.status(400).json({ error: headerError });
      }

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
    // Tracks IPs already processed earlier in this same file — a second
    // occurrence is failed immediately instead of being attempted (see
    // finding #2: two identical rows in one file previously both "succeeded"
    // right up until the duplicate-key error aborted the transaction).
    const seenIps = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const result = {
        row: rowNumber,
        ip_address: (row['IPAddress (Require, one per row)'] || '').toString().trim(),
        description: row['Description (Optional)'] || row['Description'] || '',
        status: row['Status (Optional)'] || row['Status'] || 'reserved',
        tags: row['Tag (Optional, comma-separated if multiple)'] || row['Tag (comma-separated if multiple)'] || row['Tags'] || '',
        contacts: row['Contact (Optional, Email or Email prefix, comma-separated if multiple)'] || row['Contact (Email or Email prefix, comma-separated if multiple)'] || row['Contact (Email, comma-separated if multiple)'] || row['Contacts'] || '',
        system: row['System Name (Optional, comma-separated if multiple)'] || row['System Name (comma-separated if multiple)'] || row['System'] || '',
        import_status: 'Success',
        import_reason: ''
      };

      if (seenIps.has(result.ip_address)) {
        result.import_status = 'Failed';
        result.import_reason = 'Duplicate IP address within this file';
        importResults.push(result);
        continue;
      }
      seenIps.add(result.ip_address);

      // Resolve tag/contact/system names to IDs up front. A name that
      // doesn't resolve fails the whole row (matching validateImportIPs)
      // instead of being silently dropped from the created IP's associations.
      const notFound = [];
      const tagIds = [];
      for (const tagName of result.tags.split(',').map(t => t.trim()).filter(Boolean)) {
        const tags = await Tag.findByNameExact(tagName);
        if (tags && tags.length > 0) tagIds.push(tags[0].id);
        else notFound.push(`Tag "${tagName}"`);
      }
      const contactIds = [];
      for (const email of result.contacts.split(',').map(c => c.trim()).filter(Boolean)) {
        const contacts = await Contact.findByEmailSearch(email);
        if (contacts && contacts.length > 0) contactIds.push(contacts[0].id);
        else notFound.push(`Contact "${email}"`);
      }
      const systemIds = [];
      for (const systemName of result.system.split(',').map(s => s.trim()).filter(Boolean)) {
        const systems = await System.findByNameExact(systemName);
        if (systems && systems.length > 0) systemIds.push(systems[0].id);
        else notFound.push(`System "${systemName}"`);
      }
      if (notFound.length > 0) {
        result.import_status = 'Failed';
        result.import_reason = `Not found: ${notFound.join(', ')}`;
        importResults.push(result);
        continue;
      }

      // Each row gets its own savepoint: createIpAddressService runs the same
      // format/status/duplicate validation as the single-add path, but if it
      // (or anything else) still hits a raw DB error, that error leaves the
      // whole shared transaction "aborted" in Postgres until rolled back —
      // without a savepoint, every row after the first failure would also
      // fail and the final COMMIT would discard the entire batch, even rows
      // already reported as Success (see finding #1).
      const savepoint = `import_row_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepoint}`);
        await createIpAddressService({
          address: result.ip_address,
          description: result.description,
          status: result.status,
          tags: tagIds,
          contacts: contactIds,
          systems: systemIds,
          updated_by
        }, client);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        result.import_reason = 'Successfully created IP address';
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        result.import_status = 'Failed';
        result.import_reason = err instanceof ServiceError ? err.message : (err.message || 'Unknown error');
      }

      importResults.push(result);
    }

    await client.query('COMMIT');

    // Set header for frontend to know import results — same shape as
    // Subnet/Firewall import (total/success/failed) for consistent UI.
    const successCount = importResults.filter(result => result.import_status === 'Success').length;
    res.set('X-Import-Summary', JSON.stringify({
      total: importResults.length,
      success: successCount,
      failed: importResults.length - successCount
    }));

    // Create import results Excel file (same as validation)
    try {

      // Tạo file Excel với kết quả import
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Import Results');
      
      // Định nghĩa headers - đầy đủ các trường từ file ban đầu + 2 trường import
      const headers = [
        'IPAddress (Require, one per row)',
        'Description (Optional)',
        'Status (Optional)',
        'Tag (Optional, comma-separated if multiple)',
        'Contact (Optional, Email or Email prefix, comma-separated if multiple)',
        'System Name (Optional, comma-separated if multiple)',
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
    const filterZone = req.query.zone ? req.query.zone.trim() : '';
    const filterEnvironment = req.query.environment ? req.query.environment.trim() : '';
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
      zone: filterZone,
      environment: filterEnvironment,
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
      (ip.contacts && ip.contacts.length ? ip.contacts.map(c => {
        // Extract username from email (part before @)
        const emailUsername = c.email ? c.email.split('@')[0] : '';
        return emailUsername || c.name || '';
      }).join(', ') : '')
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
    const filterZone = req.query.zone ? req.query.zone.trim() : '';
    const filterEnvironment = req.query.environment ? req.query.environment.trim() : '';
    
    // Lấy toàn bộ danh sách (không phân trang)
    let subnetList = [];
    if (search || filterTags.length > 0 || filterZone || filterEnvironment) {
      subnetList = await Subnet.findFilteredList({ 
        search, 
        tags: filterTags, 
        zone: filterZone,
        environment: filterEnvironment,
        page: 1, 
        pageSize: 10000 
      });
    } else {
      subnetList = await Subnet.findAll();
    }
    
    // Định nghĩa các cột xuất Excel
    const headers = [
      'ID', 'Subnet Address', 'Description', 'Zone', 'Environment', 'Tags', 'Created At', 'Updated At', 'Updated By'
    ];
    const rows = subnetList.map(subnet => [
      subnet.id,
      subnet.address || '',
      subnet.description ? subnet.description.replace(/\r?\n|\r/g, ' ') : '',
      subnet.zone || '',
      subnet.environment || '',
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

// Export Domain List as Excel (filtered)
networkController.exportDomainList = async (req, res) => {
  try {
    // Chuẩn hóa filter giống listDomain
    const normalizeArray = v => (Array.isArray(v) ? v : (v ? [v] : []));
    const search = req.query.search ? req.query.search.trim() : '';
    let filterTags = req.query['tags[]'] || req.query.tags || [];
    let filterSystems = req.query['systems[]'] || req.query.systems || [];
    const filterZone = req.query.zone ? req.query.zone.trim() : '';
    const filterEnvironment = req.query.environment ? req.query.environment.trim() : '';
    filterTags = normalizeArray(filterTags).filter(x => x !== '');
    filterSystems = normalizeArray(filterSystems).filter(x => x !== '');
    
    // Lấy toàn bộ danh sách (không phân trang)
    const domainList = await Domain.findFilteredList({
      search,
      tags: filterTags,
      systems: filterSystems,
      zone: filterZone,
      environment: filterEnvironment,
      page: 1,
      pageSize: 10000
    });
    
    // Định nghĩa các cột xuất Excel
    const headers = [
      'ID', 'Domain Name', 'Description', 'Zone', 'Environment', 'Tags', 'Created At', 'Updated At', 'Updated By', 'Systems'
    ];
    const rows = domainList.map(domain => [
      domain.id,
      domain.name || '',
      domain.description ? domain.description.replace(/\r?\n|\r/g, ' ') : '',
      domain.zone || '',
      domain.environment || '',
      (domain.tags && domain.tags.length ? domain.tags.map(t => t.name).join(', ') : ''),
      domain.created_at ? new Date(domain.created_at).toLocaleString('en-GB') : '',
      domain.updated_at ? new Date(domain.updated_at).toLocaleString('en-GB') : '',
      domain.updated_by || '',
      (domain.systems && domain.systems.length ? domain.systems.map(s => s.name).join(', ') : '')
    ]);
    
    // Tạo file Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Domain List');
    worksheet.addRow(headers);
    rows.forEach(row => worksheet.addRow(row));
    worksheet.columns.forEach(col => { col.width = 22; });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="domain_list.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting domain list:', err);
    res.status(500).send('Error exporting domain list: ' + err.message);
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
      'Description (Optional)',
      'Status (Optional)',
      'Tag (Optional, comma-separated if multiple)',
      'Contact (Optional, Email or Email prefix, comma-separated if multiple)',
      'System Name (Optional, comma-separated if multiple)'
    ]);
    
    // Add sample data
    worksheet.addRow([
      '192.168.192.101',
      'MGMT: MGMT Network + Firewall',
      'assigned',
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
      'Description (Optional)',
      'Zone (Optional)',
      'Environment (Optional)',
      'Tag (Optional, comma-separated if multiple)'
    ]);

    // Add sample data
    worksheet.addRow([
      '192.168.1.0/24',
      'Office Network',
      'Production',
      'Internal',
      'Network,Office'
    ]);
    
    worksheet.addRow([
      '10.0.0.0/8',
      'Private Network',
      'Development',
      'External',
      'Network,Private'
    ]);
    
    // Set column widths
    worksheet.columns = [
      { width: 25 },  // Subnet Address
      { width: 30 },  // Description
      { width: 20 },  // Zone
      { width: 20 },  // Environment
      { width: 30 }   // Tags
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
    // Same column order/count import expects — checked here too so a file
    // can't "pass validation" and then be rejected outright at import time.
    const expectedHeaders = [
      'Subnet Address (Require)',
      'Description (Optional)',
      'Zone (Optional)',
      'Environment (Optional)',
      'Tag (Optional, comma-separated if multiple)'
    ];
    const validateHeaderOrder = (headerValues) => {
      if (headerValues.length !== expectedHeaders.length) {
        return `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headerValues.length}`;
      }
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (headerValues[i] !== expectedHeaders[i]) {
          return `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headerValues[i]}"`;
        }
      }
      return null;
    };

    if (fileExtension === 'csv') {
      const results = [];

      // Simple CSV parsing without csv-parser dependency
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');
      const headers = parseCsvLine(lines[0]);

      const headerError = validateHeaderOrder(headers);
      if (headerError) {
        return res.status(400).json({ error: headerError });
      }

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = parseCsvLine(lines[i]);
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

      const headerError = validateHeaderOrder(headers.slice(1));
      if (headerError) {
        return res.status(400).json({ error: headerError });
      }

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
        description: row['Description (Optional)'] || '',
        zone: row['Zone (Optional)'] || '',
        environment: row['Environment (Optional)'] || '',
        tags: row['Tag (Optional, comma-separated if multiple)'] || '',
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

    // Detect subnet addresses duplicated within the file itself — the
    // per-row loop above only checks each address against the DB, so two
    // identical addresses in the same file both "Pass" individually, which
    // is exactly the case most likely to hit a duplicate-key error mid-import
    // (see importSubnets).
    const rowsByAddress = new Map();
    for (const result of validationResults) {
      if (!result.subnet_address) continue;
      const key = result.subnet_address.trim();
      if (!rowsByAddress.has(key)) rowsByAddress.set(key, []);
      rowsByAddress.get(key).push(result);
    }
    for (const dupRows of rowsByAddress.values()) {
      if (dupRows.length <= 1) continue;
      for (const result of dupRows) {
        result.validation_status = 'Fail';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + 'Duplicate subnet address within this file';
      }
    }

    // Create validation results Excel file
    console.log('Creating Excel file with', validationResults.length, 'results');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Validation Results');
    
    // Add headers
    worksheet.addRow([
      'Subnet Address (Require)',
      'Description (Optional)',
      'Zone (Optional)',
      'Environment (Optional)',
      'Tag (Optional, comma-separated if multiple)',
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
      const row =       worksheet.addRow([
        result.subnet_address,
        result.description,
        result.zone,
        result.environment,
        result.tags,
        result.validation_status,
        result.validation_reason
      ]);

      // Color code validation status
      if (result.validation_status === 'Fail') {
        row.getCell(6).font = { color: { argb: 'FFFF0000' } }; // Validation Status column
        row.getCell(7).font = { color: { argb: 'FFFF0000' } }; // Validation Reason column
      } else {
        row.getCell(6).font = { color: { argb: 'FF008000' } }; // Validation Status column
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 25 },  // Subnet Address
      { width: 30 },  // Description
      { width: 20 },  // Zone
      { width: 20 },  // Environment
      { width: 30 },  // Tags
      { width: 20 },  // Validation Status
      { width: 40 }   // Validation Reason
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

    // Send file download response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${validationFileName}"`);
    
    console.log('Sending file:', validationFileName);
    res.sendFile(validationFilePath);
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
  // Declared outside the try block so the catch below can still reach it
  // to rollback/release — a client created with `const` inside try is out
  // of scope in catch, which previously leaked the connection (and left
  // the transaction open) on any error after pool.connect().
  let client;
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
      const headers = parseCsvLine(lines[0]);

      // Validate headers order and required fields
      const expectedHeaders = [
        'Subnet Address (Require)',
        'Description (Optional)',
        'Zone (Optional)',
        'Environment (Optional)',
        'Tag (Optional, comma-separated if multiple)'
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
        const values = parseCsvLine(lines[i]);
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
      // { header: 1 } reads row 1 itself as the header list — using the
      // default (object-per-row) mode and inferring headers from
      // Object.keys(rows[0]) instead looked at which cells of the FIRST
      // DATA row happened to be non-blank, so a row with any blank optional
      // column undercounted the columns (e.g. "Expected 5 columns, got 3")
      // even though the real header row was correct and Validate had passed.
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        const headers = jsonData[0];
        const expectedHeaders = [
          'Subnet Address (Require)',
          'Description (Optional)',
          'Zone (Optional)',
          'Environment (Optional)',
          'Tag (Optional, comma-separated if multiple)'
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

        for (let i = 1; i < jsonData.length; i++) {
          const row = {};
          headers.forEach((header, index) => { row[header] = jsonData[i][index] || ''; });
          rows.push(row);
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Only CSV and Excel files are allowed.' });
    }

    // Start transaction
    client = await pool.connect();
    await client.query('BEGIN');

    const importResults = [];
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';
    // Tracks addresses already processed earlier in this same file — a
    // second occurrence is failed immediately instead of being attempted
    // (see finding: two identical rows in one file previously both
    // "succeeded" right up until the duplicate-key error aborted the
    // whole shared transaction, silently discarding every row on COMMIT).
    const seenAddresses = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because Excel starts from 1 and we skip header
      const result = {
        row: rowNumber,
        subnet_address: sanitizeString(row['Subnet Address (Require)'] || ''),
        description: sanitizeString(row['Description (Optional)'] || ''),
        zone: sanitizeString(row['Zone (Optional)'] || ''),
        environment: sanitizeString(row['Environment (Optional)'] || ''),
        tags: sanitizeString(row['Tag (Optional, comma-separated if multiple)'] || ''),
        import_status: 'Success',
        import_reason: ''
      };

      if (seenAddresses.has(result.subnet_address)) {
        result.import_status = 'Failed';
        result.import_reason = 'Duplicate subnet address within this file';
        importResults.push(result);
        continue;
      }
      seenAddresses.add(result.subnet_address);

      // Resolve tag names to IDs up front. A name that doesn't resolve
      // fails the whole row (matching validateImportSubnets) instead of
      // being silently dropped from the created subnet's tags.
      const tagNames = result.tags.split(',').map(t => t.trim()).filter(Boolean);
      const tagIds = [];
      const notFoundTags = [];
      for (const tagName of tagNames) {
        const existingTags = await Tag.findByNameExact(tagName);
        if (existingTags && existingTags.length > 0) tagIds.push(existingTags[0].id);
        else notFoundTags.push(tagName);
      }
      if (notFoundTags.length > 0) {
        result.import_status = 'Failed';
        result.import_reason = `Tag(s) not found: ${notFoundTags.join(', ')}`;
        importResults.push(result);
        continue;
      }

      // Each row gets its own savepoint: createSubnetService runs the same
      // format/duplicate/tag validation as the single-add path, but if it
      // (or anything else) still hits a raw DB error, that error leaves the
      // whole shared transaction "aborted" in Postgres until rolled back —
      // without a savepoint, every row after the first failure would also
      // fail and the final COMMIT would discard the entire batch, even rows
      // already reported as Success.
      const savepoint = `import_subnet_row_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepoint}`);
        await createSubnetService({
          address: result.subnet_address,
          description: result.description || null,
          zone: result.zone || null,
          environment: result.environment || null,
          tags: tagIds,
          updated_by: username
        }, client);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        result.import_reason = 'Successfully created subnet';
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        console.error(`Error importing subnet row ${i + 1}:`, err);
        result.import_status = 'Failed';
        result.import_reason = err instanceof ServiceError ? err.message : (err.message || 'Unknown error');
      }

      importResults.push(result);
    }

    // Commit transaction
    await client.query('COMMIT');

    // Create import results Excel file (same as validation)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import Results');
    
    // Add headers
    worksheet.addRow([
      'Subnet Address (Require)',
      'Description (Optional)',
      'Zone (Optional)',
      'Environment (Optional)',
      'Tag (Optional, comma-separated if multiple)',
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
        result.zone,
        result.environment,
        result.tags,
        result.import_status,
        result.import_reason
      ]);

      // Color code import status
      if (result.import_status === 'Failed') {
        row.getCell(6).font = { color: { argb: 'FFFF0000' } }; // Import Status column
        row.getCell(7).font = { color: { argb: 'FFFF0000' } }; // Import Reason column
      } else {
        row.getCell(6).font = { color: { argb: 'FF008000' } }; // Import Status column
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 25 },  // Subnet Address
      { width: 30 },  // Description
      { width: 20 },  // Zone
      { width: 20 },  // Environment
      { width: 30 },  // Tags
      { width: 20 },  // Import Status
      { width: 40 }   // Import Reason
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
    const successCount = importResults.filter(result => result.import_status === 'Success').length;
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

    // Set header for frontend to know import results
    res.set('X-Import-Summary', JSON.stringify({
      total: importResults.length,
      success: successCount,
      failed: failCount
    }));

    // Send file download response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${importFileName}"`);
    
    console.log('Sending import results file:', importFileName);
    res.sendFile(importFilePath);

  } catch (err) {
    console.error('=== SUBNET IMPORT ERROR ===');
    console.error('Error importing subnets:', err);
    console.error('Error stack:', err.stack);
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Error rolling back subnet import transaction:', rollbackErr);
      }
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error importing subnets', detail: err.message });
    }
  } finally {
    if (client) {
      client.release();
    }
  }
};

// ====== DOMAIN IMPORT METHODS ======
// Same validate-then-import pattern as Subnet import (see importSubnets
// above): validate-only step reports Pass/Fail per row without touching the
// DB (Import button in the UI stays hidden unless every row Passes), then
// the real import step re-parses the file, runs each row in its own
// SAVEPOINT (so one bad row can't abort the whole shared transaction and
// silently discard rows already reported as Success), and pre-checks
// duplicate domain names within the file itself before ever reaching the DB.

// Download domain template
networkController.downloadDomainTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Domain Template');

    worksheet.addRow([
      'Domain Name (Require)',
      'Description (Optional)',
      'Record Type (Optional, default A)',
      'IP Address (Optional)',
      'System Name (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)'
    ]);

    worksheet.addRow([
      'example.com',
      'Main company domain',
      'A',
      '10.0.0.10',
      'SYS001',
      'Network,Office'
    ]);
    worksheet.addRow([
      'sub.example.com',
      'Subdomain for internal services',
      'CNAME',
      '',
      '',
      ''
    ]);

    worksheet.columns = [
      { width: 30 }, // Domain Name
      { width: 30 }, // Description
      { width: 20 }, // Record Type
      { width: 20 }, // IP Address
      { width: 30 }, // System Name
      { width: 30 }  // Tags
    ];

    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, 'temp_domain_template.xlsx');
    await workbook.xlsx.writeFile(tempFilePath);

    res.download(tempFilePath, 'domain_template.xlsx', (err) => {
      if (err) {
        console.error('Error downloading template:', err);
      }
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
    console.error('Error generating domain template:', err);
    res.status(500).json({ error: 'Error generating template', detail: err.message });
  }
};

// Validate domain import
networkController.validateImportDomains = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();

    let rows = [];

    // Same column order/count import expects — checked here too so a file
    // can't "pass validation" and then be rejected outright at import time.
    const expectedHeaders = [
      'Domain Name (Require)',
      'Description (Optional)',
      'Record Type (Optional, default A)',
      'IP Address (Optional)',
      'System Name (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)'
    ];
    const validateHeaderOrder = (headerValues) => {
      if (headerValues.length !== expectedHeaders.length) {
        return `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headerValues.length}`;
      }
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (headerValues[i] !== expectedHeaders[i]) {
          return `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headerValues[i]}"`;
        }
      }
      return null;
    };

    if (fileExtension === 'csv') {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');
      const headers = parseCsvLine(lines[0]);

      const headerError = validateHeaderOrder(headers);
      if (headerError) {
        return res.status(400).json({ error: headerError });
      }

      const results = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = parseCsvLine(lines[i]);
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

      const headerError = validateHeaderOrder(headers.slice(1));
      if (headerError) {
        return res.status(400).json({ error: headerError });
      }

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) rowData[header] = cell.value;
        });
        if (Object.keys(rowData).length > 0) rows.push(rowData);
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Validate each row
    const validationResults = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const result = {
        row: rowNumber,
        domain_name: (row['Domain Name (Require)'] || '').toString().trim(),
        description: (row['Description (Optional)'] || '').toString().trim(),
        record_type: (row['Record Type (Optional, default A)'] || '').toString().trim(),
        ip_address: (row['IP Address (Optional)'] || '').toString().trim(),
        systems: (row['System Name (Optional, comma-separated if multiple)'] || '').toString().trim(),
        tags: (row['Tag (Optional, comma-separated if multiple)'] || '').toString().trim(),
        validation_status: 'Pass',
        validation_reason: ''
      };

      if (!result.domain_name) {
        result.validation_status = 'Fail';
        result.validation_reason = 'Domain Name is required';
      }

      // Check if domain already exists
      if (result.domain_name) {
        try {
          const existingDomain = await Domain.findByDomain(result.domain_name);
          if (existingDomain) {
            result.validation_status = 'Fail';
            result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + 'Domain already exists';
          }
        } catch (err) {
          // If error checking existence, continue with validation
        }
      }

      // Validate IP Address (if provided)
      if (result.ip_address) {
        try {
          const existingIp = await IpAddress.findByAddress(result.ip_address);
          if (!existingIp) {
            result.validation_status = 'Fail';
            result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `IP address not found: ${result.ip_address}`;
          }
        } catch (err) {
          // If error checking IP, continue with validation
        }
      }

      // Validate Systems (if provided)
      if (result.systems) {
        const systemNames = result.systems.split(',').map(s => s.trim()).filter(Boolean);
        const invalidSystems = [];
        for (const systemName of systemNames) {
          try {
            const systems = await System.findByNameExact(systemName);
            if (!systems || systems.length === 0) invalidSystems.push(systemName);
          } catch (err) {
            // If error checking system, continue with validation
          }
        }
        if (invalidSystems.length > 0) {
          result.validation_status = 'Fail';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `System(s) not found: ${invalidSystems.join(', ')}`;
        }
      }

      // Validate Tags (if provided)
      if (result.tags) {
        const tagNames = result.tags.split(',').map(t => t.trim()).filter(Boolean);
        const invalidTags = [];
        for (const tagName of tagNames) {
          try {
            const tags = await Tag.findByNameExact(tagName);
            if (!tags || tags.length === 0) invalidTags.push(tagName);
          } catch (err) {
            // If error checking tag, continue with validation
          }
        }
        if (invalidTags.length > 0) {
          result.validation_status = 'Fail';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Tag(s) not found: ${invalidTags.join(', ')}`;
        }
      }

      validationResults.push(result);
    }

    // Detect domain names duplicated within the file itself — the per-row
    // loop above only checks each name against the DB, so two identical
    // names in the same file both "Pass" individually, which is exactly the
    // case most likely to hit a duplicate-key error mid-import (see
    // importDomains).
    const rowsByDomain = new Map();
    for (const result of validationResults) {
      if (!result.domain_name) continue;
      if (!rowsByDomain.has(result.domain_name)) rowsByDomain.set(result.domain_name, []);
      rowsByDomain.get(result.domain_name).push(result);
    }
    for (const dupRows of rowsByDomain.values()) {
      if (dupRows.length <= 1) continue;
      for (const result of dupRows) {
        result.validation_status = 'Fail';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + 'Duplicate domain name within this file';
      }
    }

    // Create validation results Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Validation Results');

    worksheet.addRow([
      'Domain Name (Require)',
      'Description (Optional)',
      'Record Type (Optional, default A)',
      'IP Address (Optional)',
      'System Name (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)',
      'Validation Status',
      'Validation Reason'
    ]);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    validationResults.forEach(result => {
      const row = worksheet.addRow([
        result.domain_name,
        result.description,
        result.record_type,
        result.ip_address,
        result.systems,
        result.tags,
        result.validation_status,
        result.validation_reason
      ]);
      if (result.validation_status === 'Fail') {
        row.getCell(7).font = { color: { argb: 'FFFF0000' } };
        row.getCell(8).font = { color: { argb: 'FFFF0000' } };
      } else {
        row.getCell(7).font = { color: { argb: 'FF008000' } };
      }
    });

    worksheet.columns = [
      { width: 30 }, { width: 30 }, { width: 20 }, { width: 20 }, { width: 30 }, { width: 30 }, { width: 20 }, { width: 40 }
    ];

    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const validationFileName = `${timestamp}_${req.file.originalname}_validation.xlsx`;
    const validationFilePath = path.join(tempDir, validationFileName);
    await workbook.xlsx.writeFile(validationFilePath);

    const allPassed = validationResults.every(result => result.validation_status === 'Pass');
    const passCount = validationResults.filter(result => result.validation_status === 'Pass').length;
    const failCount = validationResults.length - passCount;

    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (cleanupErr) {
      console.error('Error cleaning up uploaded file:', cleanupErr);
    }

    setTimeout(() => {
      try {
        if (fs.existsSync(validationFilePath)) fs.unlinkSync(validationFilePath);
      } catch (cleanupErr) {
        console.error('Error cleaning up validation file:', cleanupErr);
      }
    }, 10000);

    res.set('X-Validation-Summary', JSON.stringify({
      total: validationResults.length,
      passed: passCount,
      failed: failCount,
      allPassed
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${validationFileName}"`);
    res.sendFile(validationFilePath);

  } catch (err) {
    console.error('Error validating domain import file:', err);
    res.status(500).json({ error: 'Error validating file', detail: err.message });
  }
};

// Import domains
networkController.importDomains = async (req, res) => {
  let client;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    let rows = [];

    const ext = path.extname(originalFileName).toLowerCase();
    const expectedHeaders = [
      'Domain Name (Require)',
      'Description (Optional)',
      'Record Type (Optional, default A)',
      'IP Address (Optional)',
      'System Name (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)'
    ];

    if (ext === '.csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = parseCsvLine(lines[0]);

      if (headers.length !== expectedHeaders.length) {
        return res.status(400).json({ error: `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headers.length}` });
      }
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (headers[i] !== expectedHeaders[i]) {
          return res.status(400).json({ error: `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headers[i]}"` });
        }
      }

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => { row[header] = values[index] || ''; });
        rows.push(row);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // { header: 1 } reads row 1 itself as the header list — the default
      // (object-per-row) mode instead infers headers from which cells of
      // the FIRST DATA row are non-blank, undercounting columns whenever
      // that row has any blank optional field.
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        const headers = jsonData[0];
        if (headers.length !== expectedHeaders.length) {
          return res.status(400).json({ error: `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headers.length}` });
        }
        for (let i = 0; i < expectedHeaders.length; i++) {
          if (headers[i] !== expectedHeaders[i]) {
            return res.status(400).json({ error: `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headers[i]}"` });
          }
        }
        for (let i = 1; i < jsonData.length; i++) {
          const row = {};
          headers.forEach((header, index) => { row[header] = jsonData[i][index] || ''; });
          rows.push(row);
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Only CSV and Excel files are allowed.' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const importResults = [];
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';
    // Tracks domain names already processed earlier in this same file — see
    // importSubnets for why this must be checked before ever reaching the DB.
    const seenDomains = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const result = {
        row: rowNumber,
        domain_name: (row['Domain Name (Require)'] || '').toString().trim(),
        description: (row['Description (Optional)'] || '').toString().trim(),
        record_type: (row['Record Type (Optional, default A)'] || '').toString().trim(),
        ip_address: (row['IP Address (Optional)'] || '').toString().trim(),
        systems: (row['System Name (Optional, comma-separated if multiple)'] || '').toString().trim(),
        tags: (row['Tag (Optional, comma-separated if multiple)'] || '').toString().trim(),
        import_status: 'Success',
        import_reason: ''
      };

      if (!result.domain_name) {
        result.import_status = 'Failed';
        result.import_reason = 'Domain Name is required';
        importResults.push(result);
        continue;
      }

      if (seenDomains.has(result.domain_name)) {
        result.import_status = 'Failed';
        result.import_reason = 'Duplicate domain name within this file';
        importResults.push(result);
        continue;
      }
      seenDomains.add(result.domain_name);

      // Resolve IP/System/Tag references up front. A value that doesn't
      // resolve fails the whole row (matching validateImportDomains)
      // instead of being silently dropped from the created domain.
      const notFound = [];

      let ipId = null;
      if (result.ip_address) {
        const existingIp = await IpAddress.findByAddress(result.ip_address);
        if (existingIp) ipId = existingIp.id;
        else notFound.push(`IP address "${result.ip_address}"`);
      }

      const systemIds = [];
      for (const systemName of result.systems.split(',').map(s => s.trim()).filter(Boolean)) {
        const systems = await System.findByNameExact(systemName);
        if (systems && systems.length > 0) systemIds.push(systems[0].id);
        else notFound.push(`System "${systemName}"`);
      }

      const tagIds = [];
      for (const tagName of result.tags.split(',').map(t => t.trim()).filter(Boolean)) {
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

      // Each row gets its own savepoint — see importSubnets for why this is
      // required: without it, a raw DB error on one row would abort the
      // whole shared transaction and the final COMMIT would silently
      // discard the entire batch, including rows already marked Success.
      const savepoint = `import_domain_row_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepoint}`);
        await createDomainService({
          domain: result.domain_name,
          description: result.description || null,
          record_type: result.record_type || null,
          ip_id: ipId,
          systems: systemIds,
          tags: tagIds,
          updated_by: username
        }, client);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        result.import_reason = 'Successfully created domain';
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        console.error(`Error importing domain row ${i + 1}:`, err);
        result.import_status = 'Failed';
        result.import_reason = err instanceof ServiceError ? err.message : (err.message || 'Unknown error');
      }

      importResults.push(result);
    }

    await client.query('COMMIT');

    // Create import results Excel file (same as validation)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import Results');

    worksheet.addRow([
      'Domain Name (Require)',
      'Description (Optional)',
      'Record Type (Optional, default A)',
      'IP Address (Optional)',
      'System Name (Optional, comma-separated if multiple)',
      'Tag (Optional, comma-separated if multiple)',
      'Import Status',
      'Import Reason'
    ]);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    importResults.forEach(result => {
      const row = worksheet.addRow([
        result.domain_name,
        result.description,
        result.record_type,
        result.ip_address,
        result.systems,
        result.tags,
        result.import_status,
        result.import_reason
      ]);
      if (result.import_status === 'Failed') {
        row.getCell(7).font = { color: { argb: 'FFFF0000' } };
        row.getCell(8).font = { color: { argb: 'FFFF0000' } };
      } else {
        row.getCell(7).font = { color: { argb: 'FF008000' } };
      }
    });

    worksheet.columns = [
      { width: 30 }, { width: 30 }, { width: 20 }, { width: 20 }, { width: 30 }, { width: 30 }, { width: 20 }, { width: 40 }
    ];

    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const importFileName = `${timestamp}_${originalFileName}_imported.xlsx`;
    const importFilePath = path.join(tempDir, importFileName);
    await workbook.xlsx.writeFile(importFilePath);

    const successCount = importResults.filter(result => result.import_status === 'Success').length;
    const failCount = importResults.length - successCount;

    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (cleanupErr) {
      console.error('Error cleaning up uploaded file:', cleanupErr);
    }

    setTimeout(() => {
      try {
        if (fs.existsSync(importFilePath)) fs.unlinkSync(importFilePath);
      } catch (cleanupErr) {
        console.error('Error cleaning up import file:', cleanupErr);
      }
    }, 10000);

    res.set('X-Import-Summary', JSON.stringify({
      total: importResults.length,
      success: successCount,
      failed: failCount
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${importFileName}"`);
    res.sendFile(importFilePath);

  } catch (err) {
    console.error('=== DOMAIN IMPORT ERROR ===');
    console.error('Error importing domains:', err);
    console.error('Error stack:', err.stack);
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Error rolling back domain import transaction:', rollbackErr);
      }
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error importing domains', detail: err.message });
    }
  } finally {
    if (client) {
      client.release();
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

// API endpoint to get zones from subnets table for autocomplete
networkController.apiZones = async (req, res) => {
  try {
    const { search } = req.query;
    const zones = await Subnet.getDistinctZones(search);
    res.json(zones);
  } catch (err) {
    console.error('Error fetching zones:', err);
    res.status(500).json({ error: 'Error fetching zones: ' + err.message });
  }
};

// API endpoint to get environments from subnets table for autocomplete
networkController.apiEnvironments = async (req, res) => {
  try {
    const { search } = req.query;
    const environments = await Subnet.getDistinctEnvironments(search);
    res.json(environments);
  } catch (err) {
    console.error('Error fetching environments:', err);
    res.status(500).json({ error: 'Error fetching environments: ' + err.message });
  }
};

// API: Find subnet containing an IP address
networkController.apiFindSubnetForIP = async (req, res) => {
  try {
    const ipAddress = req.params.ip;

    if (!ipAddress) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    // Validate IP format
    if (!IPV4_REGEX.test(ipAddress)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    // Subnets can nest (e.g. 10.0.0.0/8 and 10.1.0.0/16 both contain
    // 10.1.2.3) — ORDER BY masklen DESC LIMIT 1 picks the smallest, most
    // specific one, matching what a user actually means by "the subnet"
    // an IP belongs to.
    const containing = await Subnet.findContainingSubnet(ipAddress);
    if (!containing) {
      return res.json({
        found: false,
        message: 'No subnet found containing this IP address'
      });
    }

    // findContainingSubnet is a plain SELECT * (no tags join) — findById
    // has the tags join already, so fetch through it for the full shape.
    const matchingSubnet = await Subnet.findById(containing.id);

    res.json({
      found: true,
      subnet: {
        id: matchingSubnet.id,
        address: matchingSubnet.address,
        description: matchingSubnet.description,
        zone: matchingSubnet.zone,
        environment: matchingSubnet.environment,
        tags: matchingSubnet.tags || []
      }
    });

  } catch (err) {
    console.error('Error finding subnet for IP:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// API: Get IP addresses in a subnet
networkController.apiGetSubnetIpAddresses = async (req, res) => {
  try {
    const subnetId = req.params.id;
    
    // Check if subnet exists
    const subnet = await Subnet.findById(subnetId);
    
    if (!subnet) {
      return res.status(404).json({
        success: false,
        message: 'Subnet not found'
      });
    }
    
    // Get IP addresses in this subnet
    const query = `
      SELECT 
        ip.id,
        ip.ip_address,
        ip.description,
        ip.status,
        s.name as server_name,
        d.name as device_name
      FROM ip_addresses ip
      LEFT JOIN servers s ON ip.server_id = s.id
      LEFT JOIN devices d ON ip.device_id = d.id
      WHERE ip.ip_address::inet <<= (SELECT address FROM subnets WHERE id = $1)
      ORDER BY ip.ip_address::inet
    `;
    
    const result = await pool.query(query, [subnetId]);
    
    const response = {
      success: true,
      data: result.rows,
      count: result.rows.length
    };
    
    res.json(response);
    
  } catch (err) {
    console.error('Error getting subnet IP addresses:', err);
    
    const errorResponse = {
      success: false,
      message: 'Internal server error',
      error: err.message
    };
    
    res.status(500).json(errorResponse);
  }
};

export default networkController;
