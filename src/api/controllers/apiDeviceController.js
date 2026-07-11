// Device API Controller (ES6 style)
import Device from '../../models/Device.js';
import { pool } from '../../../config/config.js';
import {
  listDevices as listDevicesService,
  getDevice as getDeviceService,
  createDevice as createDeviceService,
  updateDevice as updateDeviceService,
  deleteDevice as deleteDeviceService,
  getLocationOptions
} from '../../services/deviceService.js';
import { handleServiceError } from '../utils/handleServiceError.js';

const apiDeviceController = {};

// List all devices (with filter and pagination)
apiDeviceController.listDevices = async (req, res) => {
  try {
    const { search, device_type_id, platform_id, location, manufacturer, device_role, tags, page = 1, pageSize = 20 } = req.query;
    // Normalize array parameters
    let filterTags = tags;
    if (typeof filterTags === 'string') filterTags = [filterTags];
    if (Array.isArray(filterTags)) filterTags = filterTags.map(Number).filter(Boolean);
    const filter = {
      search,
      device_type_id: device_type_id ? Number(device_type_id) : undefined,
      platform_id: platform_id ? Number(platform_id) : undefined,
      location,
      manufacturer,
      device_role,
      tags: filterTags,
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.max(1, Math.min(parseInt(pageSize, 10) || 20, 100))
    };
    const { items: devices, totalCount } = await listDevicesService(filter);
    const totalPages = Math.max(1, Math.ceil(totalCount / filter.pageSize));
    res.json({
      success: true,
      data: devices,
      pagination: {
        totalCount,
        page: filter.page,
        pageSize: filter.pageSize,
        totalPages
      }
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Find devices by specific field values (exact match)
apiDeviceController.findDevices = async (req, res) => {
  try {
    const { name, ip_address } = req.query;
    
    // Validate that at least one search criteria is provided
    if (!name && !ip_address) {
      return res.status(400).json({
        success: false,
        message: 'At least one search criteria must be provided (name or ip_address)'
      });
    }
    
    // Build search criteria
    const criteria = {};
    if (name) criteria.name = name.trim();
    if (ip_address) criteria.ip_address = ip_address.trim();
    
    // Find devices with detailed information
    const devices = await Device.findByCriteria(criteria);
    
    if (!devices || devices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No devices found matching the specified criteria',
        criteria
      });
    }
    
    res.json({
      success: true,
      data: devices,
      total: devices.length,
      criteria
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Get a single device by id (full detail)
apiDeviceController.getDevice = async (req, res) => {
  try {
    const device = await getDeviceService(req.params.id);
    res.json({
      success: true,
      data: device
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Create a new device
apiDeviceController.createDevice = async (req, res) => {
  try {
    const device = await createDeviceService(req.body || {});
    res.status(201).json({
      success: true,
      message: 'Device created successfully',
      data: device
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Update a device (only update provided fields, validate, keep old values if not provided)
apiDeviceController.updateDevice = async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const input = { ...body };
    if (req.user) input.updated_by = req.user.username;

    const device = await updateDeviceService(id, input);
    res.json({
      success: true,
      message: 'Device updated successfully',
      data: device
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Delete a device
apiDeviceController.deleteDevice = async (req, res) => {
  try {
    await deleteDeviceService(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};


// API endpoint to get all device configuration options
apiDeviceController.getConfig = async (req, res) => {
  try {
    const [locationOptions, manufacturers, deviceRoles] = await Promise.all([
      getLocationOptions(),
      getManufacturersFromDB(),
      getDeviceRolesFromDB()
    ]);
    
    res.json({
      success: true,
      data: {
        location: locationOptions,
        manufacturers: manufacturers,
        device_roles: deviceRoles
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Helper: Get manufacturers from database
async function getManufacturersFromDB() {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT DISTINCT manufacturer 
        FROM devices 
        WHERE manufacturer IS NOT NULL 
        AND manufacturer != ''
        ORDER BY manufacturer ASC
      `);
      return result.rows.map(row => ({
        value: row.manufacturer,
        label: row.manufacturer
      }));
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error fetching manufacturers:', err);
    return [];
  }
}

// Helper: Get device roles from database
async function getDeviceRolesFromDB() {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT DISTINCT device_role 
        FROM devices 
        WHERE device_role IS NOT NULL 
        AND device_role != ''
        ORDER BY device_role ASC
      `);
      return result.rows.map(row => ({
        value: row.device_role,
        label: row.device_role
      }));
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error fetching device roles:', err);
    return [];
  }
}

export default apiDeviceController;
