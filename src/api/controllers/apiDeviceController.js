
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
    const totalCount = await Device.filterCount(filter);
    const totalPages = Math.max(1, Math.ceil(totalCount / filter.pageSize));
    const devices = await Device.filterList(filter);
    res.json({ totalCount, page: filter.page, pageSize: filter.pageSize, totalPages, devices });
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
    name = typeof name === 'string' ? name.trim().toLowerCase() : '';
    if (!name) return res.status(400).json({ error: 'Device name is required' });
    if (!device_type_id) return res.status(400).json({ error: 'Device type is required' });
    if (!ip_addresses || !Array.isArray(ip_addresses) || ip_addresses.length === 0) {
      return res.status(400).json({ error: 'At least one IP address is required' });
    }
    // Validate device_type_id
    if (DeviceType && DeviceType.exists && !(await DeviceType.exists(device_type_id))) {
      return res.status(400).json({ error: 'Invalid device_type_id' });
    }
    // Validate platform_id
    if (platform_id && Platform && Platform.exists && !(await Platform.exists(platform_id))) {
      return res.status(400).json({ error: 'Invalid platform_id' });
    }
    // Validate all IPs exist
    for (const ipId of ip_addresses) {
      if (IpAddress && IpAddress.exists && !(await IpAddress.exists(ipId))) {
        return res.status(400).json({ error: `IP address does not exist: ${ipId}` });
      }
    }
    // Validate tags
    if (tags && Array.isArray(tags)) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          return res.status(400).json({ error: `Tag does not exist: ${tagId}` });
        }
      }
    }
    // Validate contacts
    if (contacts && Array.isArray(contacts)) {
      for (const contactId of contacts) {
        if (!(await Contact.exists(contactId))) {
          return res.status(400).json({ error: `Contact does not exist: ${contactId}` });
        }
      }
    }
    // Check for duplicate name (case-insensitive)
    const duplicate = await Device.findByName(name);
    if (duplicate) {
      return res.status(409).json({ error: 'Device already exists with this name' });
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
    // Set IPs, tags, contacts
    await Device.setIpAddresses(device.id, ip_addresses);
    if (tags) await Device.setTags(device.id, tags);
    if (contacts) await Device.setContacts(device.id, contacts);
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

    // Validate fields only if provided, as per Swagger (not required, but if present must not be empty)
    if (has('name') && (!updateFields.name || typeof updateFields.name !== 'string' || !updateFields.name.trim())) {
      return res.status(400).json({ error: 'Device name must not be empty if provided' });
    }
    if (has('device_type_id') && (updateFields.device_type_id === undefined || updateFields.device_type_id === null || updateFields.device_type_id === '')) {
      return res.status(400).json({ error: 'Device type must not be empty if provided' });
    }
    if (has('ip_addresses')) {
      if (!Array.isArray(body.ip_addresses) || body.ip_addresses.length === 0) {
        return res.status(400).json({ error: 'IP addresses must not be empty if provided' });
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

    // Validate ip_addresses
    let ip_addresses = has('ip_addresses') ? body.ip_addresses : (current.ip_addresses ? current.ip_addresses.map(ip => ip.id) : []);
    if (!Array.isArray(ip_addresses) || ip_addresses.length === 0) {
      return res.status(400).json({ error: 'At least one IP address is required' });
    }
    for (const ipId of ip_addresses) {
      if (IpAddress && IpAddress.exists && !(await IpAddress.exists(ipId))) {
        return res.status(400).json({ error: `IP address does not exist: ${ipId}` });
      }
    }

    // Check for duplicate name (except for this id) - use direct query
    const duplicate = await Device.findByName
      ? await Device.findByName(updateFields.name)
      : null;
    if (duplicate && String(duplicate.id) !== String(id)) {
      return res.status(409).json({ error: 'Device already exists with this name' });
    }

    // Update device
    await Device.update(id, updateFields);
    // Set IPs, tags, contacts if provided
    if (has('ip_addresses')) await Device.setIpAddresses(id, ip_addresses);
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
