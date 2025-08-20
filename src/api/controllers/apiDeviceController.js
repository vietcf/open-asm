// Device API Controller (ES6 style)
import Device from '../../models/Device.js';
import Tag from '../../models/Tag.js';
import Contact from '../../models/Contact.js';
import IpAddress from '../../models/IpAddress.js';
import Platform from '../../models/Platform.js';
import DeviceType from '../../models/DeviceType.js';

const apiDeviceController = {};

// List all devices (with filter and pagination)
apiDeviceController.listDevices = async (req, res) => {
  try {
    const { search, device_type_id, platform_id, location, tags, page = 1, pageSize = 20 } = req.query;
    // Normalize array parameters
    let filterTags = tags;
    if (typeof filterTags === 'string') filterTags = [filterTags];
    if (Array.isArray(filterTags)) filterTags = filterTags.map(Number).filter(Boolean);
    const filter = {
      search,
      device_type_id: device_type_id ? Number(device_type_id) : undefined,
      platform_id: platform_id ? Number(platform_id) : undefined,
      location,
      tags: filterTags,
      page: parseInt(page, 10) || 1,
      pageSize: Math.max(1, Math.min(parseInt(pageSize, 10) || 20, 100))
    };
    const totalCount = await Device.countFiltered(filter);
    const totalPages = Math.max(1, Math.ceil(totalCount / filter.pageSize));
    const devices = await Device.findFilteredList(filter);
    res.json({ totalCount, page: filter.page, pageSize: filter.pageSize, totalPages, devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Find devices by specific field values (exact match)
apiDeviceController.findDevices = async (req, res) => {
  try {
    const { name, ip_address } = req.query;
    
    // Validate that at least one search criteria is provided
    if (!name && !ip_address) {
      return res.status(400).json({ error: 'At least one search criteria must be provided (name or ip_address)' });
    }
    
    // Build search criteria
    const criteria = {};
    if (name) criteria.name = name.trim();
    if (ip_address) criteria.ip_address = ip_address.trim();
    
    // Find devices with detailed information
    const devices = await Device.findByCriteria(criteria);
    
    if (!devices || devices.length === 0) {
      return res.status(404).json({ 
        error: 'No devices found matching the specified criteria',
        criteria 
      });
    }
    
    res.json({ 
      data: devices, 
      total: devices.length,
      criteria 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single device by id (full detail)
apiDeviceController.getDevice = async (req, res) => {
  try {
    const id = req.params.id;
    const device = await Device.getFullDetail(id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new device
apiDeviceController.createDevice = async (req, res) => {
  try {
    let {
      name, device_type_id, ip_addresses, platform_id, location, serial, management, manufacturer, description, tags, contacts
    } = req.body || {};
    
    // Required fields validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Device name is required and cannot be empty' });
    }
    
    if (!device_type_id) {
      return res.status(400).json({ error: 'Device type ID is required' });
    }
    
    if (!ip_addresses || !Array.isArray(ip_addresses) || ip_addresses.length === 0) {
      return res.status(400).json({ error: 'At least one IP address is required' });
    }
    
    // Normalize name (convert to lowercase)
    name = name.trim().toLowerCase();
    
    // Check for duplicate name (case-insensitive)
    const duplicate = await Device.findByName(name);
    if (duplicate) {
      return res.status(409).json({ error: 'Device already exists with this name' });
    }
    
    // Validate device_type_id exists
    if (DeviceType && DeviceType.exists && !(await DeviceType.exists(device_type_id))) {
      return res.status(400).json({ error: 'Invalid device_type_id' });
    }
    
    // Validate IP address IDs - check both existence and assignment status
    const invalidIps = [];
    const assignedIps = [];
    for (const ipId of ip_addresses) {
      // eslint-disable-next-line no-await-in-loop
      const ipDetails = await IpAddress.findById(ipId);
      if (!ipDetails) {
        invalidIps.push(ipId);
      } else if (ipDetails.status === 'assigned') {
        assignedIps.push(`IP ${ipDetails.ip_address} (ID: ${ipId})`);
      }
    }
    if (invalidIps.length > 0) return res.status(400).json({ error: `Invalid IP address IDs: ${invalidIps.join(', ')}` });
    if (assignedIps.length > 0) return res.status(400).json({ error: `Cannot use already assigned IP addresses: ${assignedIps.join(', ')}` });
    
    // Validate platform_id if provided
    if (platform_id && Platform && Platform.exists && !(await Platform.exists(platform_id))) {
      return res.status(400).json({ error: 'Invalid platform_id' });
    }
    
    // Validate tags if provided
    if (tags && Array.isArray(tags)) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          return res.status(400).json({ error: `Tag does not exist: ${tagId}` });
        }
      }
    }
    
    // Validate contacts if provided
    if (contacts && Array.isArray(contacts)) {
      for (const contactId of contacts) {
        if (!(await Contact.exists(contactId))) {
          return res.status(400).json({ error: `Contact does not exist: ${contactId}` });
        }
      }
    }
    
    // Insert device
    const device = await Device.create({
      name,
      manufacturer,
      platform_id,
      device_type_id,
      location,
      serial_number: serial,
      management_address: management,
      description
    });
    
    // Set required IP addresses
    await Device.setIpAddresses(device.id, ip_addresses);
    
    // Set optional relationships if provided
    if (tags && Array.isArray(tags)) {
      await Device.setTags(device.id, tags);
    }
    if (contacts && Array.isArray(contacts)) {
      await Device.setContacts(device.id, contacts);
    }
    
    const result = await Device.getFullDetail(device.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a device (only update provided fields, validate, keep old values if not provided)
apiDeviceController.updateDevice = async (req, res) => {
  try {
    const id = req.params.id;
    const current = await Device.getFullDetail(id);
    if (!current) return res.status(404).json({ error: 'Device not found' });

    // Allowed fields for update
    const allowedFields = [
      'name', 'manufacturer', 'platform_id', 'device_type_id', 'location',
      'serial', 'management', 'description', 'tags', 'contacts', 'ip_addresses'
    ];
    const has = key => Object.prototype.hasOwnProperty.call(req.body, key);
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    // Validate that all fields sent in the request are allowed
    const invalidFields = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (invalidFields.length > 0) {
      return res.status(400).json({ error: `Invalid field(s): ${invalidFields.join(', ')}` });
    }

    // Prepare update fields, fallback to current if not provided
    const updateFields = {
      name: has('name') ? (typeof body.name === 'string' ? body.name.trim().toLowerCase() : body.name) : current.name,
      manufacturer: has('manufacturer') ? body.manufacturer : current.manufacturer,
      platform_id: has('platform_id') ? body.platform_id : current.platform_id,
      device_type_id: has('device_type_id') ? body.device_type_id : current.device_type_id,
      location: has('location') ? body.location : current.location,
      serial_number: has('serial') ? body.serial : current.serial_number,
      management_address: has('management') ? body.management : current.management_address,
      description: has('description') ? body.description : current.description,
      updated_by: req.user ? req.user.username : null
    };

    // Validate fields only if provided, but required fields cannot be empty if updated
    if (has('name')) {
      if (!updateFields.name || typeof updateFields.name !== 'string' || !updateFields.name.trim()) {
        return res.status(400).json({ error: 'Device name cannot be empty' });
      }
    }
    if (has('device_type_id')) {
      if (!updateFields.device_type_id) {
        return res.status(400).json({ error: 'Device type ID cannot be empty' });
      }
    }
    if (has('ip_addresses')) {
      if (!Array.isArray(body.ip_addresses) || body.ip_addresses.length === 0) {
        return res.status(400).json({ error: 'At least one IP address is required' });
      }
    }

    // Validate device_type_id
    if (has('device_type_id') && DeviceType && DeviceType.exists && !(await DeviceType.exists(updateFields.device_type_id))) {
      return res.status(400).json({ error: 'Invalid device_type_id' });
    }
    // Validate platform_id
    if (has('platform_id') && updateFields.platform_id && Platform && Platform.exists && !(await Platform.exists(updateFields.platform_id))) {
      return res.status(400).json({ error: 'Invalid platform_id' });
    }

    // Validate tags
    if (has('tags') && Array.isArray(body.tags)) {
      for (const tagId of body.tags) {
        if (!(await Tag.exists(tagId))) {
          return res.status(400).json({ error: `Tag does not exist: ${tagId}` });
        }
      }
    }
    // Validate contacts
    if (has('contacts') && Array.isArray(body.contacts)) {
      for (const contactId of body.contacts) {
        if (!(await Contact.exists(contactId))) {
          return res.status(400).json({ error: `Contact does not exist: ${contactId}` });
        }
      }
    }

    // Validate ip_addresses if provided - check both existence and assignment status
    if (has('ip_addresses') && Array.isArray(body.ip_addresses)) {
      const invalidIps = [];
      const assignedIps = [];
      for (const ipId of body.ip_addresses) {
        // eslint-disable-next-line no-await-in-loop
        const ipDetails = await IpAddress.findById(ipId);
        if (!ipDetails) {
          invalidIps.push(ipId);
        } else if (ipDetails.status === 'assigned' && ipDetails.device_id !== parseInt(id)) {
          // IP is assigned to a different device
          assignedIps.push(`IP ${ipDetails.ip_address} (ID: ${ipId})`);
        }
      }
      if (invalidIps.length > 0) return res.status(400).json({ error: `Invalid IP address IDs: ${invalidIps.join(', ')}` });
      if (assignedIps.length > 0) return res.status(400).json({ error: `Cannot use already assigned IP addresses: ${assignedIps.join(', ')}` });
    }

    // Check for duplicate name (except for this id) - use direct query
    if (has('name')) {
      const duplicate = await Device.findByName
        ? await Device.findByName(updateFields.name)
        : null;
      if (duplicate && String(duplicate.id) !== String(id)) {
        return res.status(409).json({ error: 'Device already exists with this name' });
      }
    }

    // Update device
    await Device.update(id, updateFields);
    
    // Set relationships if provided
    if (has('ip_addresses')) await Device.setIpAddresses(id, body.ip_addresses);
    if (has('tags')) await Device.setTags(id, body.tags);
    if (has('contacts')) await Device.setContacts(id, body.contacts);

    const result = await Device.getFullDetail(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a device
apiDeviceController.deleteDevice = async (req, res) => {
  try {
    const id = req.params.id;
    const device = await Device.findById(id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    await Device.remove(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default apiDeviceController;
