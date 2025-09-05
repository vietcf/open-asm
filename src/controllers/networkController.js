
import IpAddress from '../models/IpAddress.js';
import Subnet from '../models/Subnet.js';
import Domain from '../models/Domain.js';
import Configuration from '../models/Configuration.js';
import { pool } from '../../config/config.js';
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
import ExcelJS from 'exceljs';


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
    // Validate IP address format
    if (!address || !/^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(address)) {
      req.flash('error', 'Invalid IP address format. Please enter a valid IPv4 address, e.g. 192.168.1.100');
      await client.query('ROLLBACK');
      return res.redirect('/network/ip-address');
    }
    const statusValue = status && status.trim() ? status : 'reserved';
    const updated_by = req.session.user?.username || '';
    // Create IP address record (pass client for transaction)
    const newIp = await IpAddress.create({ address, description, status: statusValue, updated_by }, client);
    // @ts-ignore - client parameter is supported by model methods
    await IpAddress.setTags(newIp.id, tags, client);
    // @ts-ignore - client parameter is supported by model methods
    await IpAddress.setContacts(newIp.id, contacts, client);
    // @ts-ignore - client parameter is supported by model methods
    await IpAddress.setSystems(newIp.id, systems, client);
    await client.query('COMMIT');
    req.flash('success', 'IP address added successfully!');
    return res.redirect('/network/ip-address');
  } catch (err) {
    await client.query('ROLLBACK');
    let errorMessage = err.message || 'Add failed.';
    if (errorMessage.includes('duplicate key value') && errorMessage.includes('unique constraint')) {
      errorMessage = 'IP address already exists.';
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

export default networkController;
