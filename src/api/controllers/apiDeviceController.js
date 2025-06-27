// Controller for Device API
const Device = require('../../models/Device');
const Tag = require('../../models/Tag');
const Contact = require('../../models/Contact');
const IpAddress = require('../../models/IpAddress');
const Platform = require('../../models/Platform');
const DeviceType = require('../../models/DeviceType');

exports.listDevices = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    const { search, device_type_id, platform_id, location, tags } = req.query;
    let filterTags = tags;
    if (typeof filterTags === 'string') filterTags = [filterTags];
    if (Array.isArray(filterTags)) filterTags = filterTags.map(Number).filter(Boolean);
    const filter = {
      search,
      device_type_id: device_type_id ? Number(device_type_id) : undefined,
      platform_id: platform_id ? Number(platform_id) : undefined,
      location,
      tags: filterTags,
      page,
      pageSize
    };
    const totalCount = await Device.filterCount(filter);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const devices = await Device.filterList(filter);
    res.json({ totalCount, page, pageSize, totalPages, devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDevice = async (req, res) => {
  try {
    const id = req.params.id;
    const device = await Device.findByIdEnriched ? await Device.findByIdEnriched(id) : await Device.findById(id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createDevice = async (req, res) => {
  try {
    let {
      name, device_type_id, ip_addresses, platform_id, location, serial, management, manufacturer, description, tags, contacts
    } = req.body;
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
    // Check for duplicate name
    const existing = await Device.findByName ? await Device.findByName(name) : null;
    if (existing) {
      return res.status(409).json({ error: 'Device already exists with this name' });
    }
    // Insert device
    const device = await Device.insertDevice({
      name,
      manufacturer,
      platform_id,
      location,
      serial,
      management,
      description,
      device_type_id,
      updated_by: req.user ? req.user.username : null
    });
    // Set IPs, tags, contacts
    await Device.setIpAddresses(device.id, ip_addresses);
    if (tags) await Device.setTags(device.id, tags);
    if (contacts) await Device.setContacts(device.id, contacts);
    const result = await Device.findByIdEnriched(device.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const id = req.params.id;
    let {
      name, device_type_id, ip_addresses, platform_id, location, serial, management, manufacturer, description, tags, contacts
    } = req.body;
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
    // Check for duplicate name (except for this id)
    const existing = await Device.findByName ? await Device.findByName(name) : null;
    if (existing && String(existing.id) !== String(id)) {
      return res.status(409).json({ error: 'Device already exists with this name' });
    }
    // Update device
    await Device.update(id, {
      name,
      manufacturer,
      platform_id,
      device_type_id,
      location,
      serial_number: serial,
      management_address: management,
      description,
      updated_by: req.user ? req.user.username : null
    });
    // Set IPs, tags, contacts
    await Device.setIpAddresses(id, ip_addresses);
    if (tags) await Device.setTags(id, tags);
    if (contacts) await Device.setContacts(id, contacts);
    const result = await Device.findByIdEnriched(id);
    if (!result) return res.status(404).json({ error: 'Device not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const id = req.params.id;
    const device = await Device.findById(id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    await Device.delete(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
