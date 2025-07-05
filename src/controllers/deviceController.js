const config = require('../../config/config');
const Platform = require('../models/Platform');
const DeviceType = require('../models/DeviceType');
const Device = require('../models/Device');
const Configuration = require('../models/Configuration');
const { pool } = require('../../config/config');
const ExcelJS = require('exceljs');

// List all devices with search, filter, and pagination
exports.listDevice = async (req, res) => {
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
    let allowedPageSizes = [10, 20, 50];
    if (!pageSize) pageSize = 10;
    const deviceList = await Device.filterList({ ...filterParams, page, pageSize });
    const totalCount = await Device.filterCount({ ...filterParams });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const errorMessage = req.flash('error')[0] || req.query.error || null;
    const successMessage = req.flash('success')[0] || req.query.success || null;
    // Đổi require sang file mới
    const deviceConfig = require('../../config/deviceOptions');
    const locationOptions = deviceConfig.locationOptions;
    // Đảm bảo truyền tags ra view luôn là mảng chuỗi (phù hợp với select2)
    let tagsForView = req.query['tags[]'] || req.query.tags || [];
    if (typeof tagsForView === 'string') tagsForView = [tagsForView];
    tagsForView = tagsForView.map(String);
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
exports.addDeviceForm = async (req, res) => {
  try {
    const error = (req.flash('error') || [])[0];
    const success = (req.flash('success') || [])[0];
    // Load location options from config
    // Đổi require sang file mới
    const deviceConfig = require('../../config/deviceOptions');
    const locationOptions = deviceConfig.locationOptions;
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
exports.editDeviceForm = async (req, res) => {
  try {
    // Lấy device đã enrich đủ trường từ model
    const device = await Device.findByIdEnriched(req.params.id);
    if (!device) return res.status(404).send('Device not found');
    // Map serial_number và management_address cho view
    device.serial = device.serial_number;
    device.management = device.management_address;
    const error = (req.flash('error') || [])[0];
    const success = (req.flash('success') || [])[0];
    // Load location options from config
    // Đổi require sang file mới
    const deviceConfig = require('../../config/deviceOptions');
    const locationOptions = deviceConfig.locationOptions;
    res.render('pages/device/device_edit', {
      device,
      error,
      success,
      selectedTags: device.selectedTags,
      selectedContacts: device.selectedContacts,
      locationOptions,
      title: 'Edit Device',
      activeMenu: 'device'
    });
  } catch (err) {
    res.status(500).send('Error loading edit device form: ' + err.message);
  }
};

// Create a new device (with manufacturer)
exports.createDevice = async (req, res) => {
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
    const device = await Device.insertDevice(data, client);
    // Set IP addresses
    if (ip_addresses) {
      const ipList = Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses];
      await Device.setIpAddresses(device.id, ipList, client);
    }
    // Set tags
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      await Device.setTags(device.id, tagList, client);
    }
    // Set contacts
    if (contacts) {
      const contactList = Array.isArray(contacts) ? contacts : [contacts];
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
exports.updateDevice = async (req, res) => {
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
      await Device.setTags(req.params.id, tagList, client);
    } else {
      await Device.setTags(req.params.id, [], client);
    }
    // Set IP addresses
    if (ip_addresses) {
      const ipList = Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses];
      await Device.setIpAddresses(req.params.id, ipList, client);
    }
    // Set contacts
    if (contacts) {
      const contactList = Array.isArray(contacts) ? contacts : [contacts];
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
exports.deleteDevice = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Remove device_id from all IPs assigned to this device
    await Device.setIpAddresses(req.params.id, [], client);
    // Remove all tag_object links for this device
    await Device.setTags(req.params.id, [], client);
    // Remove all contacts for this device
    await Device.setContacts(req.params.id, [], client);
    // Delete the device
    await Device.delete(req.params.id, client);
    await client.query('COMMIT');
    res.redirect('/device/device');
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).send('Error deleting device: ' + err.message);
  } finally {
    client.release();
  }
};

// Create a new platform
exports.createPlatform = async (req, res) => {
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
exports.updatePlatform = async (req, res) => {
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
exports.deletePlatform = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const page = parseInt(req.body.page, 10) || 1;
  const search = req.body.search ? req.body.search.trim() : '';
  try {
    await Platform.delete(id);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Platform deleted successfully`;
    return res.redirect(`/device/platform${query}`);
  } catch (err) {
    console.error('Error deleting platform:', err);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=Unable to delete platform`;
    return res.redirect(`/device/platform${query}`);
  }
};

// List platforms with search and pagination
exports.listPlatform = async (req, res) => {
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
exports.apiPlatformSearch = async (req, res) => {
  try {
    const search = req.query.q ? req.query.q.trim() : '';
    const results = await Platform.searchForSelect2(search);
    return res.json(results);
  } catch (err) {
    console.error('Error searching platforms:', err);
    return res.status(500).send('Error searching platforms: ' + err.message);
  }
};

// API for select2 ajax device type search
exports.apiDeviceTypeSearch = async (req, res) => {
  try {
    const search = req.query.q ? req.query.q.trim() : '';
    const results = await DeviceType.searchForSelect2(search);
    return res.json(results);
  } catch (err) {
    console.error('Error searching device types:', err);
    return res.status(500).send('Error searching device types: ' + err.message);
  }
};

// API for select2 ajax device search (used in platform and device type forms)
exports.apiDeviceSearch = async (req, res) => {
  try {
    const search = req.query.q ? req.query.q.trim() : '';
    const results = await Device.searchForSelect2(search);
    return res.json(results);
  } catch (err) {
    console.error('Error searching devices:', err);
    return res.status(500).send('Error searching devices: ' + err.message);
  }
};

// ===== DEVICE TYPE MENU HANDLERS =====
exports.listDeviceType = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    let pageSize = parseInt(req.query.pageSize, 10);
    let allowedPageSizes = [10, 20, 50];
    if (!pageSize) pageSize = 10;
    // Pagination
    const offset = (page - 1) * pageSize;
    let deviceTypeList, totalCount;
    if (search) {
      const q = `%${search}%`;
      const countRes = await pool.query('SELECT COUNT(*) FROM device_types WHERE name ILIKE $1 OR description ILIKE $1', [q]);
      totalCount = parseInt(countRes.rows[0].count, 10);
      const result = await pool.query('SELECT * FROM device_types WHERE name ILIKE $1 OR description ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3', [q, pageSize, offset]);
      deviceTypeList = result.rows;
    } else {
      const countRes = await pool.query('SELECT COUNT(*) FROM device_types');
      totalCount = parseInt(countRes.rows[0].count, 10);
      const result = await pool.query('SELECT * FROM device_types ORDER BY id LIMIT $1 OFFSET $2', [pageSize, offset]);
      deviceTypeList = result.rows;
    }
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const errorMessage = req.flash('error')[0] || req.query.error || null;
    const successMessage = req.flash('success')[0] || req.query.success || null;return res.render('pages/device/device_type_list', {
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

exports.createDeviceType = async (req, res) => {
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

exports.updateDeviceType = async (req, res) => {
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

exports.deleteDeviceType = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const page = parseInt(req.body.page, 10) || 1;
    const search = req.body.search ? req.body.search.trim() : '';
    await DeviceType.delete(id);
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
exports.exportDeviceList = async (req, res) => {
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
    const deviceList = await Device.filterList({ ...filterParams, page: 1, pageSize: 10000 });
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
      (device.contacts && device.contacts.length ? device.contacts.map(c => `${c.name} <${c.email}>`).join(', ') : ''),
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