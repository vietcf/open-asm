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
import {
  listDevices as listDevicesService,
  getDevice as getDeviceService,
  createDevice as createDeviceService,
  updateDevice as updateDeviceService,
  deleteDevice as deleteDeviceService,
  getLocationOptions
} from '../services/deviceService.js';
import { ServiceError } from '../services/errors.js';
import {
  listPlatforms as listPlatformsService,
  createPlatform as createPlatformService,
  updatePlatform as updatePlatformService,
  deletePlatform as deletePlatformService
} from '../services/platformService.js';
import {
  listDeviceTypes as listDeviceTypesService,
  createDeviceType as createDeviceTypeService,
  updateDeviceType as updateDeviceTypeService,
  deleteDeviceType as deleteDeviceTypeService
} from '../services/deviceTypeService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Load device status options from DB config
async function getDeviceStatusOptionsFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('device_status');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        options = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) { options = []; }
  if (!Array.isArray(options) || options.length === 0) {
    options = [];
  }
  return options;
}

// Helper: Load device type options from DeviceType table
async function getDeviceTypeOptionsFromConfig() {
  let options = [];
  try {
    const DeviceType = (await import('../models/DeviceType.js')).default;
    const deviceTypes = await DeviceType.findAll();
    options = deviceTypes.map(dt => ({ value: dt.id, label: dt.name }));
  } catch (e) { 
    console.error('Error loading device types:', e);
    options = [];
  }
  if (!Array.isArray(options) || options.length === 0) {
    // Fallback: create default device types if none exist
    try {
      const DeviceType = (await import('../models/DeviceType.js')).default;
      const defaultTypes = ['Server', 'Network', 'Storage'];
      for (const typeName of defaultTypes) {
        await DeviceType.create({ name: typeName });
      }
      // Reload after creating defaults
      const deviceTypes = await DeviceType.findAll();
      options = deviceTypes.map(dt => ({ value: dt.id, label: dt.name }));
    } catch (err) {
      console.error('Error creating default device types:', err);
      options = [];
    }
  }
  return options;
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
    pageSizeOptions = [];
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
    let pageSize = parseInt(req.query.pageSize, 10);
    const allowedPageSizes = await getPageSizeOptionsFromConfig();
    if (!pageSize || !allowedPageSizes.includes(pageSize)) pageSize = allowedPageSizes[0] || 10;
    const { items: deviceList, totalCount } = await listDevicesService({ ...filterParams, page, pageSize });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const errorMessage = req.flash('error')[0] || req.query.error || null;
    const successMessage = req.flash('success')[0] || req.query.success || null;
    // Load location options from DB config (shared helper)
    const locationOptions = await getLocationOptions();
    // Đơn giản hóa truyền tags ra view (giống serverController)
    const tagsForView = Array.isArray(req.query['tags[]']) ? req.query['tags[]'] :
      (req.query['tags[]'] ? [req.query['tags[]']] : (Array.isArray(req.query.tags) ? req.query.tags : req.query.tags ? [req.query.tags] : []));

    // Load selected tags from database (for filter restoration)
    let selectedTags = [];
    if (filterParams.tags && filterParams.tags.length > 0) {
      try {
        const Tag = (await import('../models/Tag.js')).default;
        selectedTags = await Tag.findByIds(filterParams.tags);
      } catch (err) {
        console.error('Error loading selected tags:', err);
        selectedTags = [];
      }
    }

    // Load selected device type from database (for filter restoration)
    let selectedDeviceType = null;
    if (filterParams.device_type_id) {
      try {
        const DeviceType = (await import('../models/DeviceType.js')).default;
        const deviceType = await DeviceType.findById(filterParams.device_type_id);
        if (deviceType) {
          selectedDeviceType = { id: deviceType.id, text: deviceType.name };
        }
      } catch (err) {
        console.error('Error loading selected device type:', err);
        selectedDeviceType = null;
      }
    }

    // Load selected platform from database (for filter restoration)
    let selectedPlatform = null;
    if (filterParams.platform_id) {
      try {
        const Platform = (await import('../models/Platform.js')).default;
        const platform = await Platform.findById(filterParams.platform_id);
        if (platform) {
          selectedPlatform = { id: platform.id, text: platform.name };
        }
      } catch (err) {
        console.error('Error loading selected platform:', err);
        selectedPlatform = null;
      }
    }

    res.render('pages/device/device_list', {
      deviceList,
      search: filterParams.search,
      device_type_id: req.query.device_type_id || '',
      tags: tagsForView,
      selectedTags: selectedTags,
      selectedDeviceType: selectedDeviceType,
      selectedPlatform: selectedPlatform,
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
    
    // Load options from DB config
    const [locationOptions, statusOptions, typesOptions] = await Promise.all([
      getLocationOptions(),
      getDeviceStatusOptionsFromConfig(),
      getDeviceTypeOptionsFromConfig()
    ]);
    
    res.render('pages/device/device_add', {
      error,
      success,
      locationOptions,
      statusOptions,
      typesOptions,
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
    // Lấy device đủ thông tin chi tiết từ service
    let device;
    try {
      device = await getDeviceService(req.params.id);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return res.status(404).send('Device not found');
      throw err;
    }

    // Map serial_number và management_address cho view
    device.serial = device.serial_number;
    device.management = device.management_address;
    const error = (req.flash('error') || [])[0];
    const success = (req.flash('success') || [])[0];

    // Load options from DB config
    const [locationOptions, statusOptions, typesOptions] = await Promise.all([
      getLocationOptions(),
      getDeviceStatusOptionsFromConfig(),
      getDeviceTypeOptionsFromConfig()
    ]);

    res.render('pages/device/device_edit', {
      device,
      error,
      success,
      selectedTags: device.tags,
      selectedContacts: device.contacts,
      locationOptions,
      statusOptions,
      typesOptions,
      title: 'Edit Device',
      activeMenu: 'device'
    });
  } catch (err) {
    res.status(500).send('Error loading edit device form: ' + err.message);
  }
};

// Create a new device (with manufacturer)
deviceController.createDevice = async (req, res) => {
  try {
    // Extract all fields from the form
    const {
      name,
      manufacturer,
      device_role,
      os,
      location,
      serial_number,
      management_address,
      description,
      ip_addresses,
      tags,
      type,
      managers
    } = req.body;

    if (!type || type === '' || type === 'null') {
      req.flash('error', 'Device type is required!');
      return res.redirect('/device/device/add');
    }
    // The frontend form accepts either a numeric device_type_id or a free-text
    // type name (auto-creating the type if it doesn't exist yet) — this
    // convenience behavior is form-specific and deliberately not part of the
    // shared service, which only accepts an existing device_type_id.
    let deviceTypeId = null;
    if (!isNaN(type)) {
      deviceTypeId = parseInt(type);
    } else {
      try {
        const deviceTypes = await DeviceType.findByNameExact(type);
        let deviceType = deviceTypes.length > 0 ? deviceTypes[0] : null;
        if (!deviceType) {
          deviceType = await DeviceType.create({ name: type });
        }
        deviceTypeId = deviceType.id;
      } catch (err) {
        console.error('Error handling device type:', err);
        req.flash('error', 'Invalid device type: ' + type);
        return res.redirect('/device/device/add');
      }
    }

    await createDeviceService({
      name,
      manufacturer,
      device_role,
      platform_id: os,
      location,
      serial: serial_number,
      management: management_address,
      description,
      ip_addresses,
      tags,
      contacts: managers,
      device_type_id: deviceTypeId,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    });
    req.flash('success', 'Device added successfully!');
    res.redirect('/device/device');
  } catch (err) {
    req.flash('error', (err.code ? err.message : 'Error creating device: ' + err.message));
    res.redirect('/device/device/add');
  }
};

// Update a device (with manufacturer)
deviceController.updateDevice = async (req, res) => {
  try {
    const { name, manufacturer, device_role, os, type, description, tags, ip_addresses, location, serial_number, management_address, managers } = req.body;

    // Same free-text-type-name auto-create convenience as createDevice; only
    // touch device_type_id if a type was actually submitted (leaves the
    // existing type untouched otherwise, instead of nulling it out).
    let deviceTypeId;
    if (type && type !== 'null') {
      if (!isNaN(type)) {
        deviceTypeId = parseInt(type);
      } else {
        try {
          const deviceTypes = await DeviceType.findByNameExact(type);
          let deviceType = deviceTypes.length > 0 ? deviceTypes[0] : null;
          if (!deviceType) {
            deviceType = await DeviceType.create({ name: type });
          }
          deviceTypeId = deviceType.id;
        } catch (err) {
          console.error('Error handling device type:', err);
          req.flash('error', 'Invalid device type: ' + type);
          return res.redirect(`/device/device/edit/${req.params.id}`);
        }
      }
    }

    // tags/contacts are always included (even as []) to preserve the previous
    // "always fully replace" behavior for these two associations.
    const input = {
      name,
      manufacturer,
      device_role,
      platform_id: os,
      description,
      location,
      serial: serial_number,
      management: management_address,
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
      contacts: Array.isArray(managers) ? managers : (managers ? [managers] : []),
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    };
    if (deviceTypeId !== undefined) input.device_type_id = deviceTypeId;
    if (ip_addresses) {
      input.ip_addresses = Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses];
    }

    await updateDeviceService(req.params.id, input);
    req.flash('success', 'Device updated successfully!');
    res.redirect('/device/device');
  } catch (err) {
    req.flash('error', (err.code ? err.message : 'Error updating device: ' + err.message));
    res.redirect(`/device/device/edit/${req.params.id}`);
  }
};

// Delete a device
deviceController.deleteDevice = async (req, res) => {
  try {
    const deleteIp = ['true', '1'].includes(String(req.body.delete_ip ?? req.query.delete_ip).toLowerCase());
    await deleteDeviceService(req.params.id, { deleteIp });
    req.flash('success', 'Device deleted successfully!');
    res.redirect('/device/device');
  } catch (err) {
    req.flash('error', 'Unable to delete device: ' + err.message);
    res.redirect('/device/device');
  }
};

// Create a new platform
deviceController.createPlatform = async (req, res) => {
  const page = parseInt(req.body.page, 10) || 1;
  const search = req.body.search ? req.body.search.trim() : '';
  try {
    await createPlatformService({ name: req.body.name, description: req.body.description });
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Platform added successfully`;
    return res.redirect(`/device/platform${query}`);
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to add platform: ' + err.message;
    if (!(err instanceof ServiceError)) console.error('Error creating platform:', err);
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
    // Only description is editable from this form
    await updatePlatformService(id, { description });
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Platform updated successfully`;
    return res.redirect(`/device/platform${query}`);
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to update platform';
    if (!(err instanceof ServiceError)) console.error('Error updating platform:', err);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=${encodeURIComponent(errorMsg)}`;
    return res.redirect(`/device/platform${query}`);
  }
};

// Delete a platform
deviceController.deletePlatform = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const page = parseInt(req.body.page, 10) || 1;
  const search = req.body.search ? req.body.search.trim() : '';
  try {
    await deletePlatformService(id);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Platform deleted successfully`;
    return res.redirect(`/device/platform${query}`);
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to delete platform';
    if (!(err instanceof ServiceError)) console.error('Error deleting platform:', err);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=${encodeURIComponent(errorMsg)}`;
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
    const { items: platformList, totalCount } = await listPlatformsService({ search, page, pageSize });
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
    const search = req.query.search ? req.query.search.trim() : '';
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
    const { items: deviceTypeList, totalCount } = await listDeviceTypesService({ search, page, pageSize });
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
  const page = parseInt(req.body.page, 10) || 1;
  const search = req.body.search ? req.body.search.trim() : '';
  try {
    await createDeviceTypeService({ name: req.body.name, description: req.body.description });
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Device type added successfully`;
    return res.redirect(`/device/type${query}`);
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to add device type: ' + err.message;
    if (!(err instanceof ServiceError)) console.error('Error creating device type:', err);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=${encodeURIComponent(errorMsg)}`;
    return res.redirect(`/device/type${query}`);
  }
};

deviceController.updateDeviceType = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const page = parseInt(req.body.page, 10) || 1;
  const search = req.body.search ? req.body.search.trim() : '';
  try {
    // Only description is editable from this form
    await updateDeviceTypeService(id, { description: req.body.description });
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Device type updated successfully`;
    return res.redirect(`/device/type${query}`);
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to update device type';
    if (!(err instanceof ServiceError)) console.error('Error updating device type:', err);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=${encodeURIComponent(errorMsg)}`;
    return res.redirect(`/device/type${query}`);
  }
};

deviceController.deleteDeviceType = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const page = parseInt(req.body.page, 10) || 1;
  const search = req.body.search ? req.body.search.trim() : '';
  try {
    await deleteDeviceTypeService(id);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&success=Device type deleted successfully`;
    return res.redirect(`/device/type${query}`);
  } catch (err) {
    const errorMessage = err instanceof ServiceError ? err.message : 'Unable to delete device type';
    if (!(err instanceof ServiceError)) console.error('Error deleting device type:', err);
    const query = `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}&error=${encodeURIComponent(errorMessage)}`;
    return res.redirect(`/device/type${query}`);
  }
};

// Export device list as CSV or Excel (filtered)
deviceController.exportDeviceList = async (req, res) => {
  try {
    // Chuẩn hóa các tham số filter (device_type_id, tags, platform_id, location, manufacturer, device_role, search)
    const filterParams = {
      search: req.query.search ? req.query.search.trim() : '',
      device_type_id: req.query.device_type_id ? Number(req.query.device_type_id) : undefined,
      tags: req.query['tags[]'] || req.query.tags || [],
      platform_id: req.query.platform_id ? Number(req.query.platform_id) : undefined,
      location: req.query.location ? req.query.location.trim() : undefined,
      manufacturer: req.query.manufacturer ? req.query.manufacturer.trim() : undefined,
      device_role: req.query.device_role ? req.query.device_role.trim() : undefined,
    };
    if (typeof filterParams.tags === 'string') filterParams.tags = [filterParams.tags];
    filterParams.tags = (filterParams.tags || []).map(t => Number(t)).filter(Boolean);
    if (!filterParams.tags.length) delete filterParams.tags;
    
    console.log('Export filter params:', filterParams);
    
    // Lấy toàn bộ danh sách (không phân trang)
    const deviceList = await Device.findFilteredList({ ...filterParams, page: 1, pageSize: 10000 });
    const headers = [
      'ID', 'Name', 'Device Type', 'Platform (OS)', 'Manufacturer', 'Serial Number', 'Management Address',
      'IP Address(es)', 'Location', 'Tags', 'Contacts', 'Description', 'Updated By', 'Updated At'
    ];
    const rows = deviceList.map(device => [
      device.id,
      device.name || '',
      device.device_type_name || '',
      device.platform_name || '',
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
    console.log('Starting device template download...');
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
      'Serial Number',
      'Management Address (comma-separated if multiple)',
      'Manufacturer',
      'Device Role',
      'Manager (comma-separated if multiple)',
      'Tag (comma-separated if multiple)',
      'Description'
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
      'admin@company.com,manager@company.com',
      'Tag1,Tag2',
      'Test device description'
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
      'admin@company.com',
      'Tag1',
      'Auto-generated name example'
    ]);
    
    // Set column widths
    worksheet.columns = [
      { width: 30 },  // Name
      { width: 40 },  // IPAddress
      { width: 20 },  // Device Type
      { width: 20 },  // Platform
      { width: 15 },  // Location
      { width: 15 },  // Serial Number
      { width: 30 },  // Management Address
      { width: 20 },  // Manufacturer
      { width: 20 },  // Device Role
      { width: 30 },  // Manager
      { width: 25 },  // Tag
      { width: 30 }   // Description
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
    console.log('Starting device validation...');
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File uploaded:', req.file.originalname, 'Size:', req.file.size);

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    let rows = [];

    // Parse file based on extension
    const ext = path.extname(originalFileName).toLowerCase();
    console.log('File extension:', ext);
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
      'Device Type (Require)',
      'Platform (OS)',
      'Location',
      'Serial Number',
      'Management Address (comma-separated if multiple)',
      'Manufacturer',
      'Device Role',
      'Manager (comma-separated if multiple)',
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
    const validLocations = await getLocationOptions();
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
        serial_number: sanitizeString(row['Serial Number'] || ''),
        management_address: sanitizeString(row['Management Address (comma-separated if multiple)'] || ''),
        manufacturer: sanitizeString(row['Manufacturer'] || ''),
        device_role: sanitizeString(row['Device Role'] || ''),
        manager: sanitizeString(row['Manager (comma-separated if multiple)'] || ''),
        tag: sanitizeString(row['Tag (comma-separated if multiple)'] || ''),
        description: sanitizeString(row['Description'] || ''),
        validation_status: 'PASS',
        validation_reason: ''
      };

      // Device name is not required - will be auto-generated if empty
      
      // Collect all validation errors instead of stopping at first error
      const validationErrors = [];

      // Validate required fields
      if (!result.ip_addresses) {
        validationErrors.push('IP addresses are required');
      } else {
        // Validate IP addresses format
        const ipList = result.ip_addresses.split(',').map(ip => ip.trim()).filter(ip => ip);
        for (const ip of ipList) {
          if (!ipRegex.test(ip)) {
            validationErrors.push(`Invalid IP format: ${ip}`);
          }
        }
      }

      if (!result.device_type) {
        validationErrors.push('Device type is required');
      } else {
        // Validate Device Type exists
        const existingDeviceTypes = await DeviceType.findByNameExact(result.device_type);
        if (!existingDeviceTypes || existingDeviceTypes.length === 0) {
          validationErrors.push(`Device type not found: ${result.device_type}`);
        }
      }

      // Validate Platform (if provided)
      if (result.platform) {
        const existingPlatforms = await Platform.findByNameExact(result.platform);
        if (!existingPlatforms || existingPlatforms.length === 0) {
          validationErrors.push(`Platform not found: ${result.platform}`);
        }
      }

      // Validate location
      if (result.location && !validLocationValues.includes(result.location)) {
        validationErrors.push(`Invalid location: ${result.location}. Valid values: ${validLocationValues.join(', ')}`);
      }

      // Management address is just text, no validation needed

      // Check if device already exists (by name OR by assigned IP)
      // Check by device name
      if (result.name) {
        const existingDevice = await Device.findByName(result.name);
        if (existingDevice) {
          validationErrors.push('Device name already exists');
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
          validationErrors.push(`IP(s) already assigned to devices: ${assignedIPs.join(', ')}`);
        }
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
          validationErrors.push(`Tag(s) not found: ${invalidTags.join(', ')}`);
        }
      }

      // Set final validation status based on all collected errors
      if (validationErrors.length > 0) {
        result.validation_status = 'FAIL';
        result.validation_reason = validationErrors.join('; ');
      }

      // Validate Contacts (Managers)
      if (result.manager) {
        const contactList = result.manager.split(',').map(c => c.trim()).filter(c => c);
        const invalidContacts = [];
        for (const contactEmail of contactList) {
          const existingContacts = await Contact.findByEmailSearch(contactEmail);
          if (!existingContacts || existingContacts.length === 0) {
            invalidContacts.push(contactEmail);
          }
        }
        if (invalidContacts.length > 0) {
          validationErrors.push(`Contact(s) not found: ${invalidContacts.join(', ')}`);
        }
      }

      // Update validation status if we found additional errors
      if (validationErrors.length > 0) {
        result.validation_status = 'FAIL';
        result.validation_reason = validationErrors.join('; ');
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
      'Serial Number',
      'Management Address (comma-separated if multiple)',
      'Manufacturer',
      'Device Role',
      'Manager (comma-separated if multiple)',
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
        result.device_type,
        result.platform,
        result.location,
        result.serial_number,
        result.management_address,
        result.manufacturer,
        result.device_role,
        result.manager,
        result.tag,
        result.description,
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

    // Calculate validation summary
    const allPassed = validationResults.every(result => result.validation_status === 'PASS');
    const passCount = validationResults.filter(result => result.validation_status === 'PASS').length;
    const failCount = validationResults.filter(result => result.validation_status === 'FAIL').length;
    
    // Send Excel file directly
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
    res.setHeader('Content-Length', fs.statSync(excelFilePath).size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    // Same key names as IP/Subnet/Server validation summary
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
    console.error('Error validating device import file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error validating import file: ' + err.message });
    }
  }
};

// Import devices
deviceController.importDevices = async (req, res) => {
  const client = await pool.connect();
  let clientReleased = false;
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
        serial_number: sanitizeString(row['Serial Number'] || ''),
        management_address: sanitizeString(row['Management Address (comma-separated if multiple)'] || ''),
        manufacturer: sanitizeString(row['Manufacturer'] || ''),
        device_role: sanitizeString(row['Device Role'] || ''),
        manager: sanitizeString(row['Manager (comma-separated if multiple)'] || ''),
        tag: sanitizeString(row['Tag (comma-separated if multiple)'] || ''),
        description: sanitizeString(row['Description'] || ''),
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
          
          // Get device type ID
          let deviceTypeId = null;
          if (result.device_type) {
            const deviceType = await DeviceType.findByNameExact(result.device_type);
            if (deviceType && deviceType.length > 0) {
              deviceTypeId = deviceType[0].id;
            } else {
              console.error(`Device type not found during import: ${result.device_type}`);
              throw new Error(`Device type not found: ${result.device_type}`);
            }
          }

          // Get platform ID
          let platformId = null;
          if (result.platform) {
            const platform = await Platform.findByNameExact(result.platform);
            if (platform && platform.length > 0) {
              platformId = platform[0].id;
            } else {
              console.error(`Platform not found during import: ${result.platform}`);
              throw new Error(`Platform not found: ${result.platform}`);
            }
          }

          // Create device
          const device = await Device.create({
            name: deviceName,
            device_type_id: deviceTypeId,
            platform_id: platformId,
            location: result.location || null,
            serial_number: result.serial_number || null,
            management_address: result.management_address || null,
            manufacturer: result.manufacturer || null,
            device_role: result.device_role || null,
            description: result.description || null,
            updated_by: username
          });
          
          const deviceId = device.id;
          
          // Validate deviceId is a proper integer
          if (deviceId === null || deviceId === undefined || typeof deviceId !== 'number' || !Number.isInteger(deviceId)) {
            console.error(`Invalid device ID: ${deviceId}`);
            throw new Error(`Failed to create device - invalid ID: ${deviceId}`);
          }

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
              `Serial: ${result.serial_number || 'N/A'}`,
              `Management: ${result.management_address || 'N/A'}`,
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
              
              // Ensure ipRecord exists and has an id
              if (ipRecord && ipRecord.id) {
                ipIds.push(ipRecord.id);
              } else {
                console.error(`Failed to get IP record for address: ${ip}`);
                throw new Error(`Failed to create or find IP address: ${ip}`);
              }
            }
            
            if (ipIds.length > 0) {
              // Validate all IP IDs are integers
              const invalidIpIds = ipIds.filter(id => id === null || id === undefined || typeof id !== 'number' || !Number.isInteger(id));
              if (invalidIpIds.length > 0) {
                console.error(`Invalid IP IDs found:`, invalidIpIds);
                throw new Error(`Invalid IP IDs: ${invalidIpIds.join(', ')}`);
              }
              
              console.log(`Setting IP addresses for device ${deviceId}:`, ipIds);
              // @ts-ignore - client parameter is supported by model methods
              await Device.setIpAddresses(deviceId, ipIds, client);
            }
          }

          // Set tags
          if (result.tag) {
            const tagNames = result.tag.split(',').map(t => t.trim()).filter(t => t);
            const tagIds = [];
            
            for (const tagName of tagNames) {
              const tag = await Tag.findByNameExact(tagName);
              if (tag && tag.length > 0) {
                tagIds.push(tag[0].id);
              } else {
                console.error(`Tag not found: ${tagName}`);
                throw new Error(`Tag not found: ${tagName}`);
              }
            }
            
            if (tagIds.length > 0) {
              // Validate all tag IDs are integers
              const invalidTagIds = tagIds.filter(id => id === null || id === undefined || typeof id !== 'number' || !Number.isInteger(id));
              if (invalidTagIds.length > 0) {
                console.error(`Invalid tag IDs found:`, invalidTagIds);
                throw new Error(`Invalid tag IDs: ${invalidTagIds.join(', ')}`);
              }
              
              // @ts-ignore - client parameter is supported by model methods
              await Device.setTags(deviceId, tagIds, client);
            }
          }

          // Set managers (contacts)
          if (result.manager) {
            const managerEmails = result.manager.split(',').map(c => c.trim()).filter(c => c);
            const managerIds = [];
            
            for (const managerEmail of managerEmails) {
              const contact = await Contact.findByEmailSearch(managerEmail);
              if (contact && contact.length > 0) {
                managerIds.push(contact[0].id);
              } else {
                console.error(`Manager not found: ${managerEmail}`);
                throw new Error(`Manager not found: ${managerEmail}`);
              }
            }
            
            if (managerIds.length > 0) {
              // Validate all manager IDs are integers
              const invalidManagerIds = managerIds.filter(id => id === null || id === undefined || typeof id !== 'number' || !Number.isInteger(id));
              if (invalidManagerIds.length > 0) {
                console.error(`Invalid manager IDs found:`, invalidManagerIds);
                throw new Error(`Invalid manager IDs: ${invalidManagerIds.join(', ')}`);
              }
              
              // @ts-ignore - client parameter is supported by model methods
              await Device.setContacts(deviceId, managerIds, client);
            }
          }
        } // End of else block for device creation

      } catch (err) {
        console.error(`Error processing row ${i + 1}:`, err);
        result.import_status = 'FAILED';
        result.import_reason = err.message;
        
        // If it's a database error, rollback and stop processing
        if (err.code && err.code.startsWith('23')) { // PostgreSQL constraint violations
          await client.query('ROLLBACK');
          client.release();
          clientReleased = true;
          return res.status(400).json({
            error: `Database error at row ${i + 1}: ${err.message}`
          });
        }
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
      'Serial Number',
      'Management Address (comma-separated if multiple)',
      'Manufacturer',
      'Device Role',
      'Manager (comma-separated if multiple)',
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
        result.device_type,
        result.platform,
        result.location,
        result.serial_number,
        result.management_address,
        result.manufacturer,
        result.device_role,
        result.manager,
        result.tag,
        result.description,
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

    // Set header for frontend to know import results — same shape as
    // Subnet/Firewall import (total/success/failed) for consistent UI.
    const successCount = importResults.filter(result => result.import_status === 'SUCCESS').length;
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
    // Note: clientReleased is only set true once client.release() has
    // actually been called (see the per-row constraint-violation branch
    // above) — not merely after rollback — so the finally block below
    // still releases the connection on this path.
    if (!clientReleased) {
      await client.query('ROLLBACK');
    }
    console.error('Error importing devices:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error importing devices: ' + err.message });
    }
  } finally {
    if (!clientReleased) {
      client.release();
    }
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