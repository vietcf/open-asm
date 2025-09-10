import Platform from '../models/Platform.js';
import DeviceType from '../models/DeviceType.js';
import Device from '../models/Device.js';
import Configuration from '../models/Configuration.js';
import { pool } from '../../config/config.js';
import ExcelJS from 'exceljs';


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
    // Chuẩn hóa các tham số filter (device_type_id, tags, platform_id, location, search)
    const filterParams = {
      search: req.query.search ? req.query.search.trim() : '',
      device_type_id: req.query.device_type_id ? Number(req.query.device_type_id) : undefined,
      tags: req.query['tags[]'] || req.query.tags || [],
      platform_id: req.query.platform_id ? Number(req.query.platform_id) : undefined,
      location: req.query.location ? req.query.location.trim() : undefined
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
    const { name, manufacturer, platform_id, device_type_id, description, tags, ip_addresses, location, serial, management, contacts } = req.body;
    if (!name || !name.trim()) {
      req.flash('error', 'Device name is required!');
      client.release();
      return res.redirect(`/device/device/edit/${req.params.id}`);
    }
    // Update device with all normalized fields
    await Device.update(req.params.id, {
      name: name.trim(),
      manufacturer: safeStr(manufacturer),
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
    // Chuẩn hóa các tham số filter (device_type_id, tags, search)
    const filterParams = {
      search: req.query.search ? req.query.search.trim() : '',
      device_type_id: req.query.device_type_id ? Number(req.query.device_type_id) : undefined,
      tags: req.query['tags[]'] || req.query.tags || [],
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

export default deviceController;