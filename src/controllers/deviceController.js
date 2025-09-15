import Platform from '../models/Platform.js';
import DeviceType from '../models/DeviceType.js';
import Device from '../models/Device.js';
import Configuration from '../models/Configuration.js';
import Tag from '../models/Tag.js';
import Contact from '../models/Contact.js';
import IpAddress from '../models/IpAddress.js';
import { pool } from '../../config/config.js';
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Helper: Load device location options from DB config
async function getLocationOptionsFromConfig() {
  let locationOptions = [];
  try {
    const config = await Configuration.findById('device_location');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        locationOptions = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) { locationOptions = []; }
  if (!Array.isArray(locationOptions) || locationOptions.length === 0) {
    locationOptions = [
      { value: 'DC', label: 'DC' },
      { value: 'DR', label: 'DR' }
    ];
  }
  return locationOptions;
}

// Helper: Load allowed page sizes for device list from DB config (ưu tiên device_page_size, fallback page_size)
async function getPageSizeOptionsFromConfig() {
  let pageSizeOptions = [];
  let config = null;
  try {
    config = await Configuration.findById('device_page_size');
    if (!config || !config.value) {
      config = await Configuration.findById('page_size');
    }
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        pageSizeOptions = parsed.map(item => typeof item === 'object' ? item : Number(item)).filter(x => !isNaN(x));
      } else if (typeof config.value === 'string') {
        pageSizeOptions = config.value.split(',').map(v => Number(v.trim())).filter(x => !isNaN(x));
      }
    }
  } catch (e) { pageSizeOptions = []; }
  if (!Array.isArray(pageSizeOptions) || pageSizeOptions.length === 0) {
    pageSizeOptions = [10, 20, 50];
  }
  return pageSizeOptions;
}

const deviceController = {};
// List all devices with search, filter, and pagination
deviceController.listDevice = async (req, res) => {
  try {
    // Chuẩn hóa các tham số filter (device_type_id, tags, platform_id, location, manufacturer, device_role, search)
    const filterParams = {
      search: req.query.search ? req.query.search.trim() : '',
      device_type_id: req.query.device_type_id ? Number(req.query.device_type_id) : undefined,
      tags: req.query['tags[]'] || req.query.tags || [],
      platform_id: req.query.platform_id ? Number(req.query.platform_id) : undefined,
      location: req.query.location ? req.query.location.trim() : undefined,
      manufacturer: req.query.manufacturer ? req.query.manufacturer.trim() : undefined,
      device_role: req.query.device_role ? req.query.device_role.trim() : undefined
    };
    // Chuẩn hóa tags về mảng số
    if (typeof filterParams.tags === 'string') filterParams.tags = [filterParams.tags];
    filterParams.tags = (filterParams.tags || []).map(t => Number(t)).filter(Boolean);
    if (!filterParams.tags.length) delete filterParams.tags;
    const page = parseInt(req.query.page, 10) || 1;
    let pageSize = parseInt(req.query.page_size, 10);
    const allowedPageSizes = await getPageSizeOptionsFromConfig();
    if (!pageSize || !allowedPageSizes.includes(pageSize)) pageSize = allowedPageSizes[0] || 10;
    const deviceList = await Device.findFilteredList({ ...filterParams, page, pageSize });
    const totalCount = await Device.countFiltered({ ...filterParams });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const errorMessage = req.flash('error')[0] || req.query.error || null;
    const successMessage = req.flash('success')[0] || req.query.success || null;
    // Load location options from DB config (shared helper)
    const locationOptions = await getLocationOptionsFromConfig();
    // Đơn giản hóa truyền tags ra view (giống serverController)
    const tagsForView = Array.isArray(req.query['tags[]']) ? req.query['tags[]'] :
      (req.query['tags[]'] ? [req.query['tags[]']] : (Array.isArray(req.query.tags) ? req.query.tags : req.query.tags ? [req.query.tags] : []));

    res.render('pages/device/device_list', {
      deviceList,
      search: filterParams.search,
      device_type_id: req.query.device_type_id || '',
      tags: tagsForView,
      platform_id: req.query.platform_id,
      location: req.query.location,
      manufacturer: req.query.manufacturer || '',
      device_role: req.query.device_role || '',
      page,
      pageSize,
      totalPages,
      errorMessage,
      successMessage,
      totalCount,
      startItem,
      endItem,
      allowedPageSizes,
      locationOptions,
      title: 'Device List',
      activeMenu: 'device'
    });
  } catch (err) {
    console.error('Error loading devices:', err);
    return res.status(500).send('Error loading devices: ' + err.message);
  }
};

// Render add device form
deviceController.addDeviceForm = async (req, res) => {
  try {
    const error = (req.flash('error') || [])[0];
    const success = (req.flash('success') || [])[0];
  // Load location options from DB config (shared helper)
  const locationOptions = await getLocationOptionsFromConfig();
    res.render('pages/device/device_add', {
      error,
      success,
      locationOptions,
      title: 'Add Device',
      activeMenu: 'device'
    });
  } catch (err) {
    res.status(500).send('Error loading add device form: ' + err.message);
  }
};

// Render edit device form
deviceController.editDeviceForm = async (req, res) => {
  try {
    // Lấy device đủ thông tin chi tiết từ model
    const device = await Device.getFullDetail(req.params.id);
    if (!device) return res.status(404).send('Device not found');
    // Map serial_number và management_address cho view
    device.serial = device.serial_number;
    device.management = device.management_address;
    const error = (req.flash('error') || [])[0];
    const success = (req.flash('success') || [])[0];
    // Load location options from DB config (shared helper)
    const locationOptions = await getLocationOptionsFromConfig();
    res.render('pages/device/device_edit', {
      device,
      error,
      success,
      selectedTags: device.tags,
      selectedContacts: device.contacts,
      locationOptions,
      title: 'Edit Device',
      activeMenu: 'device'
    });
  } catch (err) {
    res.status(500).send('Error loading edit device form: ' + err.message);
  }
};

// Create a new device (with manufacturer)
deviceController.createDevice = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Extract all fields from the form
    const {
      name,
      manufacturer,
      device_role,
      platform_id,
      location,
      serial,
      management,
      description,
      ip_addresses,
      tags,
      device_type_id,
      contacts
    } = req.body;
    // Validate & normalize
    const safe = v => (typeof v === 'undefined' || v === '') ? null : v;
    const safeStr = v => (typeof v === 'undefined' || v === '') ? null : (typeof v === 'string' ? v.trim() : v);
    if (!name || !name.trim()) {
      req.flash('error', 'Device name is required!');
      client.release();
      return res.redirect('/device/device/add');
    }
    if (!device_type_id || device_type_id === '' || device_type_id === 'null') {
      req.flash('error', 'Device type is required!');
      client.release();
      return res.redirect('/device/device/add');
    }
    if (!ip_addresses || (Array.isArray(ip_addresses) ? ip_addresses.length === 0 : !ip_addresses)) {
      req.flash('error', 'At least one IP address is required!');
      client.release();
      return res.redirect('/device/device/add');
    }
    // Chuẩn hóa các biến truyền vào model
    const data = {
      name: name.trim(),
      manufacturer: safeStr(manufacturer),
      device_role: safeStr(device_role),
      platform_id: safe(platform_id),
      location: safeStr(location),
      serial: safeStr(serial),
      management: safeStr(management),
      description: safeStr(description),
      device_type_id: safe(device_type_id),
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    };
    // Insert device only
    // @ts-ignore - client parameter is supported by model methods
    const device = await Device.create(data, client);
    // Set IP addresses
    if (ip_addresses) {
      const ipList = Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses];
      // @ts-ignore - client parameter is supported by model methods
      await Device.setIpAddresses(device.id, ipList, client);
    }
    // Set tags
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      // @ts-ignore - client parameter is supported by model methods
      await Device.setTags(device.id, tagList, client);
    }
    // Set contacts
    if (contacts) {
      const contactList = Array.isArray(contacts) ? contacts : [contacts];
      // @ts-ignore - client parameter is supported by model methods
      await Device.setContacts(device.id, contactList, client);
    }
    await client.query('COMMIT');
    req.flash('success', 'Device added successfully!');
    res.redirect('/device/device');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Error creating device: ' + err.message);
    res.redirect('/device/device/add');
  } finally {
    client.release();
  }
};

// Update a device (with manufacturer)
deviceController.updateDevice = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Normalize all fields
    const safe = v => (typeof v === 'undefined' || v === '') ? null : v;
    const safeStr = v => (typeof v === 'undefined' || v === '') ? null : (typeof v === 'string' ? v.trim() : v);
    const { name, manufacturer, device_role, platform_id, device_type_id, description, tags, ip_addresses, location, serial, management, contacts } = req.body;
    if (!name || !name.trim()) {
      req.flash('error', 'Device name is required!');
      client.release();
      return res.redirect(`/device/device/edit/${req.params.id}`);
    }
    // Update device with all normalized fields
    await Device.update(req.params.id, {
      name: name.trim(),
      manufacturer: safeStr(manufacturer),
      device_role: safeStr(device_role),
      platform_id: safe(platform_id),
      device_type_id: safe(device_type_id),
      description: safeStr(description),
      location: safeStr(location),
      serial_number: safeStr(serial),
      management_address: safeStr(management),
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    }, client);
    // Set tags
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      // @ts-ignore - client parameter is supported by model methods
      await Device.setTags(req.params.id, tagList, client);
    } else {
      // @ts-ignore - client parameter is supported by model methods
      await Device.setTags(req.params.id, [], client);
    }
    // Set IP addresses
    if (ip_addresses) {
      const ipList = Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses];
      // @ts-ignore - client parameter is supported by model methods
      await Device.setIpAddresses(req.params.id, ipList, client);
    }
    // Set contacts
    if (contacts) {
      const contactList = Array.isArray(contacts) ? contacts : [contacts];
      // @ts-ignore - client parameter is supported by model methods
      await Device.setContacts(req.params.id, contactList, client);
    }
    await client.query('COMMIT');
    req.flash('success', 'Device updated successfully!');
    res.redirect('/device/device');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Error updating device: ' + err.message);
    res.redirect(`/device/device/edit/${req.params.id}`);
  } finally {
    client.release();
  }
};

// Delete a device
deviceController.deleteDevice = async (req, res) => {
  try {
    const id = req.params.id;
    // Remove related links and cascade delete IPs (similar to server deletion)
    await Device.remove(id, pool);
    req.flash('success', 'Device deleted successfully!');
    res.redirect('/device/device');
  } catch (err) {
    req.flash('error', 'Unable to delete device: ' + err.message);
    res.redirect('/device/device');
  }
};

// Create a new platform
deviceController.createPlatform = async (req, res) => {
  // Normalize and trim input
  const name = req.body.name ? req.body.name.trim() : '';
  const description = req.body.description ? req.body.description.trim() : '';
  const page = parseInt(req.body.page, 10) || 1;
  const search = req.body.search ? req.body.search.trim() : '';
  try {
    // Validate required name
    if (!name) {
      const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=Platform name is required`;
      return res.redirect(`/device/platform${query}`);
    }
    await Platform.create({ name, description });
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Platform added successfully`;
    return res.redirect(`/device/platform${query}`);
  } catch (err) {
    let errorMsg = 'Unable to add platform';
    // Detect unique violation (PostgreSQL: 23505)
    if (err && (err.code === '23505' || (err.message && err.message.toLowerCase().includes('unique')))) {
      errorMsg = 'Platform name already exists. Please choose a different name.';
      // Do not log duplicate key error to console
    } else {
      console.error('Error creating platform:', err);
      if (err && err.message) {
        errorMsg = 'Unable to add platform: ' + err.message;
      }
    }
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=${encodeURIComponent(errorMsg)}`;
    return res.redirect(`/device/platform${query}`);
  }
};

// Update an existing platform
deviceController.updatePlatform = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { description } = req.body;
  const page = parseInt(req.body.page, 10) || 1;
  const search = req.body.search ? req.body.search.trim() : '';
  try {
    // Only description is editable
    await Platform.update(id, description);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Platform updated successfully`;
    return res.redirect(`/device/platform${query}`);
  } catch (err) {
    console.error('Error updating platform:', err);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=Unable to update platform`;
    return res.redirect(`/device/platform${query}`);
  }
};

// Delete a platform
deviceController.deletePlatform = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const page = parseInt(req.body.page, 10) || 1;
  const search = req.body.search ? req.body.search.trim() : '';
  try {
    await Platform.remove(id);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Platform deleted successfully`;
    return res.redirect(`/device/platform${query}`);
  } catch (err) {
    console.error('Error deleting platform:', err);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=Unable to delete platform`;
    return res.redirect(`/device/platform${query}`);
  }
};

// List platforms with search and pagination
deviceController.listPlatform = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    let pageSize = parseInt(req.query.pageSize, 10);
    // Load allowed page sizes from configuration
    let allowedPageSizes = [10, 20, 50];
    if (!pageSize) pageSize = 10;
    let platformList, totalCount;
    if (search) {
      totalCount = await Platform.searchCount(search);
      platformList = await Platform.searchPage(search, page, pageSize);
    } else {
      totalCount = await Platform.countAll();
      platformList = await Platform.findPage(page, pageSize);
    }
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const errorMessage = req.query.error || null;
    const successMessage = req.flash('success')[0] || req.query.success || null;
    res.render('pages/device/device_platform', {
      platformList,
      search,
      page,
      pageSize,
      totalPages,
      totalCount,
      errorMessage,
      successMessage,
      allowedPageSizes,
      title: 'Platform List',
      activeMenu: 'device-platform'
    });
  } catch (err) {
    console.error('Error loading platforms:', err);
    return res.status(500).send('Error loading platforms: ' + err.message);
  }
};

// API for select2 ajax platform search
deviceController.apiPlatformSearch = async (req, res) => {
  try {
    const search = req.query.q ? req.query.q.trim() : '';
    const results = await Platform.select2Search(search);
    return res.json(results);
  } catch (err) {
    console.error('Error searching platforms:', err);
    return res.status(500).send('Error searching platforms: ' + err.message);
  }
};

// API for select2 ajax device type search
deviceController.apiDeviceTypeSearch = async (req, res) => {
  try {
    const search = req.query.q ? req.query.q.trim() : '';
    const results = await DeviceType.select2Search(search);
    return res.json(results);
  } catch (err) {
    console.error('Error searching device types:', err);
    return res.status(500).send('Error searching device types: ' + err.message);
  }
};

// API for select2 ajax device search (used in platform and device type forms)
deviceController.apiDeviceSearch = async (req, res) => {
  try {
    const search = req.query.q ? req.query.q.trim() : '';
    const results = await Device.select2Search(search);
    return res.json(results);
  } catch (err) {
    console.error('Error searching devices:', err);
    return res.status(500).send('Error searching devices: ' + err.message);
  }
};

// ===== DEVICE TYPE MENU HANDLERS =====
deviceController.listDeviceType = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    let pageSize = parseInt(req.query.pageSize, 10);
    let allowedPageSizes = [10, 20, 50];
    if (!pageSize) pageSize = 10;
    const totalCount = await DeviceType.countFiltered(search);
    const deviceTypeList = await DeviceType.findFilteredPage({ search, page, pageSize });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const errorMessage = req.flash('error')[0] || req.query.error || null;
    const successMessage = req.flash('success')[0] || req.query.success || null;
    return res.render('pages/device/device_type_list', {
      deviceTypeList,
      search,
      page,
      pageSize,
      totalPages,
      totalCount,
      startItem,
      endItem,
      errorMessage,
      successMessage,
      allowedPageSizes,
      title: 'Device Type List',
      activeMenu: 'device-type'
    });
  } catch (err) {
    console.error('Error loading device types:', err);
    return res.status(500).send('Error loading device types: ' + err.message);
  }
};

deviceController.createDeviceType = async (req, res) => {
  try {
    const { name, description } = req.body;
    const page = parseInt(req.body.page, 10) || 1;
    const search = req.body.search ? req.body.search.trim() : '';
    if (!name || !name.trim()) {
      const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=Device type name is required`;
      return res.redirect(`/device/type${query}`);
    }
    await DeviceType.create({ name: name.trim(), description });
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Device type added successfully`;
    return res.redirect(`/device/type${query}`);
  } catch (err) {
    let errorMsg = 'Unable to add device type';
    if (err && (err.code === '23505' || (err.message && err.message.toLowerCase().includes('unique')))) {
      errorMsg = 'Device type name already exists. Please choose a different name.';
    } else {
      console.error('Error creating device type:', err);
      if (err && err.message) {
        errorMsg = 'Unable to add device type: ' + err.message;
      }
    }
    const page = parseInt(req.body.page, 10) || 1;
    const search = req.body.search ? req.body.search.trim() : '';
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=${encodeURIComponent(errorMsg)}`;
    return res.redirect(`/device/type${query}`);
  }
};

deviceController.updateDeviceType = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { description } = req.body;
    const page = parseInt(req.body.page, 10) || 1;
    const search = req.body.search ? req.body.search.trim() : '';
    // Only description is editable
    await DeviceType.update(id, { description });
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Device type updated successfully`;
    return res.redirect(`/device/type${query}`);
  } catch (err) {
    console.error('Error updating device type:', err);
    const page = parseInt(req.body.page, 10) || 1;
    const search = req.body.search ? req.body.search.trim() : '';
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=Unable to update device type`;
    return res.redirect(`/device/type${query}`);
  }
};

deviceController.deleteDeviceType = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const page = parseInt(req.body.page, 10) || 1;
    const search = req.body.search ? req.body.search.trim() : '';
    await DeviceType.remove(id);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Device type deleted successfully`;
    return res.redirect(`/device/type${query}`);
  } catch (err) {
    let errorMessage = err.message || 'Delete failed.';
    if (errorMessage.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete: This device type is in use.';
    }
    const page = parseInt(req.body.page, 10) || 1;
    const search = req.body.search ? req.body.search.trim() : '';
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=${encodeURIComponent(errorMessage)}`;
    return res.redirect(`/device/type${query}`);
  }
};

// Export device list as CSV or Excel (filtered)
deviceController.exportDeviceList = async (req, res) => {
  try {
    // Chuẩn hóa các tham số filter (device_type_id, tags, manufacturer, device_role, search)
    const filterParams = {
      search: req.query.search ? req.query.search.trim() : '',
      device_type_id: req.query.device_type_id ? Number(req.query.device_type_id) : undefined,
      tags: req.query['tags[]'] || req.query.tags || [],
      manufacturer: req.query.manufacturer ? req.query.manufacturer.trim() : undefined,
      device_role: req.query.device_role ? req.query.device_role.trim() : undefined,
    };
    if (typeof filterParams.tags === 'string') filterParams.tags = [filterParams.tags];
    filterParams.tags = (filterParams.tags || []).map(t => Number(t)).filter(Boolean);
    if (!filterParams.tags.length) delete filterParams.tags;
    // Lấy toàn bộ danh sách (không phân trang)
    const deviceList = await Device.findFilteredList({ ...filterParams, platform_id: undefined, location: undefined, page: 1, pageSize: 10000 });
    const headers = [
      'ID', 'Name', 'Device Type', 'Manufacturer', 'Serial Number', 'Management Address',
      'IP Address(es)', 'Location', 'Tags', 'Contacts', 'Description', 'Updated By', 'Updated At'
    ];
    const rows = deviceList.map(device => [
      device.id,
      device.name || '',
      device.device_type_name || '',
      device.manufacturer || '',
      device.serial_number || '',
      device.management_address || '',
      (device.ip_addresses && device.ip_addresses.length ? device.ip_addresses.map(ip => ip.ip_address || ip.address || ip).join(', ') : ''),
      device.location || '',
      (device.tags && device.tags.length ? device.tags.map(t => t.name).join(', ') : ''),
      (device.contacts && device.contacts.length ? device.contacts.map(c => c.email || c.name || 'Unknown').join(', ') : ''),
      device.description ? device.description.replace(/\r?\n|\r/g, ' ') : '',
      device.updated_by || '',
      device.updated_at ? new Date(device.updated_at).toLocaleString('en-GB') : ''
    ]);
    // Luôn xuất file Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Device List');
    worksheet.addRow(headers);
    rows.forEach(row => worksheet.addRow(row));
    worksheet.columns.forEach(col => { col.width = 22; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="device_list.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting device list:', err);
    res.status(500).send('Error exporting device list: ' + err.message);
  }
};


// API endpoint to get manufacturers from devices table for autocomplete
deviceController.apiManufacturers = async (req, res) => {
  try {
    const { search } = req.query;
    const client = await pool.connect();
    
    try {
      let query = `
        SELECT DISTINCT manufacturer 
        FROM devices 
        WHERE manufacturer IS NOT NULL 
        AND manufacturer != ''
      `;
      const params = [];
      
      if (search && search.trim()) {
        query += ` AND manufacturer ILIKE $1`;
        params.push(`%${search.trim()}%`);
      }
      
      query += ` ORDER BY manufacturer ASC LIMIT 20`;
      
      const result = await client.query(query, params);
      const manufacturers = result.rows.map(row => ({
        id: row.manufacturer,
        text: row.manufacturer
      }));
      
      res.json(manufacturers);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error fetching manufacturers:', err);
    res.status(500).json({ error: 'Error fetching manufacturers: ' + err.message });
  }
};

// API endpoint to get device roles from devices table for autocomplete
deviceController.apiDeviceRoles = async (req, res) => {
  try {
    const { search } = req.query;
    const client = await pool.connect();
    
    try {
      let query = `
        SELECT DISTINCT device_role 
        FROM devices 
        WHERE device_role IS NOT NULL 
        AND device_role != ''
      `;
      const params = [];
      
      if (search && search.trim()) {
        query += ` AND device_role ILIKE $1`;
        params.push(`%${search.trim()}%`);
      }
      
      query += ` ORDER BY device_role ASC LIMIT 20`;
      
      const result = await client.query(query, params);
      const deviceRoles = result.rows.map(row => ({
        id: row.device_role,
        text: row.device_role
      }));
      
      res.json(deviceRoles);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error fetching device roles:', err);
    res.status(500).json({ error: 'Error fetching device roles: ' + err.message });
  }
};

// ====== DEVICE IMPORT FUNCTIONS ======

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

// Download device template
deviceController.downloadDeviceTemplate = async (req, res) => {
  try {
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Device Template');
    
    // Add headers
    worksheet.addRow([
      'Name (Optional - auto-generated if empty)',
      'IPAddress (Require, comma-separated if multiple)',
      'Device Type (Require)',
      'Platform (OS)',
      'Location',
      'Serial',
      'Management (comma-separated if multiple)',
      'Manufacturer',
      'Device Role',
      'Description',
      'Tag (comma-separated if multiple)',
      'Contact (comma-separated if multiple)'
    ]);
    
    // Add sample data
    worksheet.addRow([
      'Test Device 1',
      '192.168.1.100,192.168.1.101',
      'Router',
      'Linux',
      'DC',
      'SN123456',
      '192.168.1.1,192.168.1.2',
      'Cisco',
      'Core Router',
      'Test device description',
      'Tag1,Tag2',
      'admin@company.com,manager@company.com'
    ]);
    
    // Add sample with auto-generated name
    worksheet.addRow([
      '', // Empty name - will be auto-generated
      '192.168.2.3',
      'Switch',
      'Windows',
      'DR',
      'SN789012',
      '192.168.2.1',
      'HP',
      'Access Switch',
      'Auto-generated name example',
      'Tag1',
      'admin@company.com'
    ]);
    
    // Set column widths
    worksheet.columns = [
      { width: 30 },  // Name
      { width: 40 },  // IPAddress
      { width: 20 },  // Device Type
      { width: 20 },  // Platform
      { width: 15 },  // Location
      { width: 15 },  // Serial
      { width: 20 },  // Management
      { width: 20 },  // Manufacturer
      { width: 20 },  // Device Role
      { width: 30 },  // Description
      { width: 25 },  // Tag
      { width: 30 }   // Contact
    ];
    
    // Create temp directory if not exists
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, 'temp_device_template.xlsx');
    await workbook.xlsx.writeFile(tempPath);
    
    // Check if file exists and get size
    if (fs.existsSync(tempPath)) {
      const stats = fs.statSync(tempPath);
      
      // Use res.download() for proper file download handling
      res.download(tempPath, 'device_list_template.xlsx', (err) => {
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
    console.error('Error creating device template:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error creating template: ' + err.message });
    }
  }
};

// Validate device import file
deviceController.validateImportDevices = async (req, res) => {
  try {
    if (!req.file) {
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
      
      const headers = jsonData[0];
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

    // Get valid options from database
    const validLocations = await getLocationOptionsFromConfig();
    const validLocationValues = validLocations.map(loc => loc.value || loc.label || loc);

    // Validate each row
    const validationResults = [];
    const ipRegex = /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 1,
        name: sanitizeString(row['Name (Optional - auto-generated if empty)'] || ''),
        ip_addresses: sanitizeString(row['IPAddress (Require, comma-separated if multiple)'] || ''),
        device_type: sanitizeString(row['Device Type (Require)'] || ''),
        platform: sanitizeString(row['Platform (OS)'] || ''),
        location: sanitizeString(row['Location'] || ''),
        serial: sanitizeString(row['Serial'] || ''),
        management: sanitizeString(row['Management'] || ''),
        manufacturer: sanitizeString(row['Manufacturer'] || ''),
        device_role: sanitizeString(row['Device Role'] || ''),
        description: sanitizeString(row['Description'] || ''),
        tag: sanitizeString(row['Tag (comma-separated if multiple)'] || ''),
        contact: sanitizeString(row['Contact (comma-separated if multiple)'] || ''),
        validation_status: 'PASS',
        validation_reason: ''
      };

      // Device name is not required - will be auto-generated if empty

      // Validate required fields
      if (!result.ip_addresses) {
        result.validation_status = 'FAIL';
        result.validation_reason = 'IP addresses are required';
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

      if (!result.device_type) {
        result.validation_status = 'FAIL';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + 'Device type is required';
      } else {
        // Validate Device Type exists
        const existingDeviceTypes = await DeviceType.findByNameExact(result.device_type);
        if (!existingDeviceTypes || existingDeviceTypes.length === 0) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Device type not found: ${result.device_type}`;
        }
      }

      // Validate Platform (if provided)
      if (result.platform) {
        const existingPlatforms = await Platform.findByNameExact(result.platform);
        if (!existingPlatforms || existingPlatforms.length === 0) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Platform not found: ${result.platform}`;
        }
      }

      // Validate location
      if (result.location && !validLocationValues.includes(result.location)) {
        result.validation_status = 'FAIL';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Invalid location: ${result.location}. Valid values: ${validLocationValues.join(', ')}`;
      }

      // Check if device already exists (by name OR by assigned IP)
      let deviceExists = false;
      let deviceExistsReason = '';

      // Check by device name
      if (result.name) {
        const existingDevice = await Device.findByName(result.name);
        if (existingDevice) {
          deviceExists = true;
          deviceExistsReason = 'Device name already exists';
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
          deviceExists = true;
          if (deviceExistsReason) {
            deviceExistsReason += `; IP(s) already assigned to devices: ${assignedIPs.join(', ')}`;
          } else {
            deviceExistsReason = `IP(s) already assigned to devices: ${assignedIPs.join(', ')}`;
          }
        }
      }

      // If device exists, mark as FAIL
      if (deviceExists) {
        result.validation_status = 'FAIL';
        result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + deviceExistsReason;
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

      // Validate Contacts
      if (result.contact) {
        const contactList = result.contact.split(',').map(c => c.trim()).filter(c => c);
        const invalidContacts = [];
        for (const contactEmail of contactList) {
          const existingContacts = await Contact.findByEmailSearch(contactEmail);
          if (!existingContacts || existingContacts.length === 0) {
            invalidContacts.push(contactEmail);
          }
        }
        if (invalidContacts.length > 0) {
          result.validation_status = 'FAIL';
          result.validation_reason = (result.validation_reason ? result.validation_reason + '; ' : '') + `Contact(s) not found: ${invalidContacts.join(', ')}`;
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
      'Device Type (Require)',
      'Platform (OS)',
      'Location',
      'Serial',
      'Management (comma-separated if multiple)',
      'Manufacturer',
      'Device Role',
      'Description',
      'Tag (comma-separated if multiple)',
      'Contact (comma-separated if multiple)',
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
        result.device_type,
        result.platform,
        result.location,
        result.serial,
        result.management,
        result.manufacturer,
        result.device_role,
        result.description,
        result.tag,
        result.contact,
        result.validation_status,
        result.validation_reason
      ]);

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
      { width: 30 },  // Name
      { width: 40 },  // IPAddress
      { width: 20 },  // Device Type
      { width: 20 },  // Platform
      { width: 15 },  // Location
      { width: 15 },  // Serial
      { width: 20 },  // Management
      { width: 20 },  // Manufacturer
      { width: 20 },  // Device Role
      { width: 30 },  // Description
      { width: 25 },  // Tag
      { width: 30 },  // Contact
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

    // Calculate validation summary
    const allPassed = validationResults.every(result => result.validation_status === 'PASS');
    const passCount = validationResults.filter(result => result.validation_status === 'PASS').length;
    const failCount = validationResults.filter(result => result.validation_status === 'FAIL').length;
    
    res.setHeader('X-Validation-Summary', JSON.stringify({
      allPassed,
      passCount,
      failCount,
      totalCount: validationResults.length
    }));

  } catch (err) {
    console.error('Error validating device import file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error validating import file: ' + err.message });
    }
  }
};

// Import devices
deviceController.importDevices = async (req, res) => {
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
    if (ext === '.csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
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
      
      const headers = jsonData[0];
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

    await client.query('BEGIN');

    const importResults = [];
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 1,
        name: sanitizeString(row['Name (Optional - auto-generated if empty)'] || ''),
        ip_addresses: sanitizeString(row['IPAddress (Require, comma-separated if multiple)'] || ''),
        device_type: sanitizeString(row['Device Type (Require)'] || ''),
        platform: sanitizeString(row['Platform (OS)'] || ''),
        location: sanitizeString(row['Location'] || ''),
        serial: sanitizeString(row['Serial'] || ''),
        management: sanitizeString(row['Management'] || ''),
        manufacturer: sanitizeString(row['Manufacturer'] || ''),
        device_role: sanitizeString(row['Device Role'] || ''),
        description: sanitizeString(row['Description'] || ''),
        tag: sanitizeString(row['Tag (comma-separated if multiple)'] || ''),
        contact: sanitizeString(row['Contact (comma-separated if multiple)'] || ''),
        import_status: 'SUCCESS',
        import_reason: ''
      };

      try {
        // Double-check device doesn't exist (safety check)
        let deviceExists = false;
        
        // Check by device name
        if (result.name) {
          const existingDevice = await Device.findByName(result.name);
          if (existingDevice) {
            deviceExists = true;
            result.import_reason = 'Device name already exists';
          }
        }
        
        // Check by assigned IP addresses
        if (!deviceExists && result.ip_addresses) {
          const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
          for (const ip of ipList) {
            const existingIP = await IpAddress.findByAddressWithDetails(ip);
            if (existingIP && existingIP.status === 'assigned') {
              deviceExists = true;
              result.import_reason = `IP ${ip} is already assigned to a device`;
              break;
            }
          }
        }
        
        if (deviceExists) {
          result.import_status = 'FAILED';
          result.import_reason = result.import_reason || 'Device already exists';
        } else {
          // Generate device name if not provided
          let deviceName = result.name;
          if (!deviceName || deviceName.trim() === '') {
            // Get first IP address
            const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
            const firstIP = ipList[0] || 'unknown';
            
            // Get device type and convert to lowercase
            let deviceTypeName = '';
            if (result.device_type) {
              deviceTypeName = result.device_type.toLowerCase().replace(/\s+/g, '-');
            }
            
            // Generate device name: <device-type>_<first-ip>
            if (deviceTypeName) {
              deviceName = `${deviceTypeName}_${firstIP}`;
            } else {
              deviceName = `device_${firstIP}`;
            }
          }
          
          // Create device
          const deviceId = await Device.create({
            name: deviceName,
            device_type_id: null, // Will be set by device type name
            platform_id: null, // Will be set by platform name
            location: result.location || null,
            serial_number: result.serial || null,
            management_address: result.management || null,
            manufacturer: result.manufacturer || null,
            device_role: result.device_role || null,
            description: result.description || null
          });

          // Set IP addresses
          if (result.ip_addresses) {
            const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
            const ipIds = [];
            
            // Create detailed description for IP
            const ipDescription = [
              `Note: This IP address was automatically created from device import feature`,
              `Device: ${deviceName}`,
              `Device Type: ${result.device_type || 'N/A'}`,
              `Location: ${result.location || 'N/A'}`,
              `Serial: ${result.serial || 'N/A'}`,
              `Management: ${result.management || 'N/A'}`,
              `Manufacturer: ${result.manufacturer || 'N/A'}`,
              `Device Role: ${result.device_role || 'N/A'}`,
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
              // @ts-ignore - client parameter is supported by model methods
              await Device.setIpAddresses(deviceId, ipIds, client);
            }
          }

          // Set tags
          if (result.tag) {
            const tagList = result.tag.split(',').map(t => t.trim()).filter(t => t);
            // @ts-ignore - client parameter is supported by model methods
            await Device.setTags(deviceId, tagList, client);
          }

          // Set contacts
          if (result.contact) {
            const contactList = result.contact.split(',').map(c => c.trim()).filter(c => c);
            // @ts-ignore - client parameter is supported by model methods
            await Device.setContacts(deviceId, contactList, client);
          }
        } // End of else block for device creation

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
      'Device Type (Require)',
      'Platform (OS)',
      'Location',
      'Serial',
      'Management (comma-separated if multiple)',
      'Manufacturer',
      'Device Role',
      'Description',
      'Tag (comma-separated if multiple)',
      'Contact (comma-separated if multiple)',
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
        result.device_type,
        result.platform,
        result.location,
        result.serial,
        result.management,
        result.manufacturer,
        result.device_role,
        result.description,
        result.tag,
        result.contact,
        result.import_status,
        result.import_reason
      ]);

      // Color code import status
      if (result.import_status === 'FAILED') {
        row.getCell(13).font = { color: { argb: 'FFFF0000' } }; // Import Status column
        row.getCell(14).font = { color: { argb: 'FFFF0000' } }; // Import Reason column
      } else {
        row.getCell(13).font = { color: { argb: 'FF008000' } }; // Import Status column
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 30 },  // Name
      { width: 40 },  // IPAddress
      { width: 20 },  // Device Type
      { width: 20 },  // Platform
      { width: 15 },  // Location
      { width: 15 },  // Serial
      { width: 20 },  // Management
      { width: 20 },  // Manufacturer
      { width: 20 },  // Device Role
      { width: 30 },  // Description
      { width: 25 },  // Tag
      { width: 30 },  // Contact
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
    console.error('Error importing devices:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error importing devices: ' + err.message });
    }
  } finally {
    client.release();
  }
};

// Download device validation file
deviceController.downloadDeviceValidationFile = async (req, res) => {
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
    console.error('Error downloading device validation file:', err);
    res.status(500).json({ error: 'Error downloading file: ' + err.message });
  }
};

export default deviceController;