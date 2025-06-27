// API Controller for IP Address
const IpAddress = require('../../models/IpAddress');
const Contact = require('../../models/Contact');
const System = require('../../models/System');
const Tag = require('../../models/Tag');
const ipAddressOptions = require('../../../config/ipAddressOptions');

// List all IP addresses (with optional filters)
exports.listIpAddresses = async (req, res) => {
  try {
    const { search, tags, status, systems, contacts, page = 1, pageSize = 10 } = req.query;
    // Parse arrays from query if needed
    const filterTags = tags ? (Array.isArray(tags) ? tags.map(Number) : [Number(tags)]) : [];
    const filterSystems = systems ? (Array.isArray(systems) ? systems.map(Number) : [Number(systems)]) : [];
    const filterContacts = contacts ? (Array.isArray(contacts) ? contacts.map(Number) : [Number(contacts)]) : [];
    const filterStatus = status || '';
    const filterSearch = search || '';
    const ipList = await IpAddress.filterList({
      search: filterSearch,
      tags: filterTags,
      status: filterStatus,
      systems: filterSystems,
      contacts: filterContacts,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 10
    });
    const total = await IpAddress.filterCount({
      search: filterSearch,
      tags: filterTags,
      status: filterStatus,
      systems: filterSystems,
      contacts: filterContacts
    });
    res.json({ data: ipList, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single IP address by id
exports.getIpAddress = async (req, res) => {
  try {
    const ip = await IpAddress.findById(req.params.id);
    if (!ip) return res.status(404).json({ error: 'IP address not found' });
    res.json(ip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a new IP address
exports.createIpAddress = async (req, res) => {
  try {
    let { address, description, status, tags, contacts, systems } = req.body;
    address = typeof address === 'string' ? address.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    status = typeof status === 'string' ? status.trim() : '';

    // --- Validation block start ---
    // Validate required fields
    if (!address) return res.status(400).json({ error: 'IP address is required' });
    // Validate IPv4 format
    const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
    if (!ipv4Regex.test(address)) {
      return res.status(400).json({ error: 'Invalid IPv4 address format' });
    }
    // Validate status against config
    const allowedStatus = ipAddressOptions.status.map(s => s.value);
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatus.join(', ')}` });
    }
    // Normalize arrays
    if (tags && !Array.isArray(tags)) tags = [tags];
    if (contacts && !Array.isArray(contacts)) contacts = [contacts];
    if (systems && !Array.isArray(systems)) systems = [systems];
    tags = (tags || []).map(Number).filter(x => !isNaN(x));
    contacts = (contacts || []).map(Number).filter(x => !isNaN(x));
    systems = (systems || []).map(Number).filter(x => !isNaN(x));
    // Validate foreign keys
    const invalidContacts = [];
    for (const cid of contacts) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await Contact.exists(cid);
      if (!exists) invalidContacts.push(cid);
    }
    if (invalidContacts.length > 0) {
      return res.status(400).json({ error: `Invalid contact IDs: ${invalidContacts.join(', ')}` });
    }
    const invalidSystems = [];
    for (const sid of systems) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await System.exists(sid);
      if (!exists) invalidSystems.push(sid);
    }
    if (invalidSystems.length > 0) {
      return res.status(400).json({ error: `Invalid system IDs: ${invalidSystems.join(', ')}` });
    }
    const invalidTags = [];
    for (const tid of tags) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await Tag.exists(tid);
      if (!exists) invalidTags.push(tid);
    }
    if (invalidTags.length > 0) {
      return res.status(400).json({ error: `Invalid tag IDs: ${invalidTags.join(', ')}` });
    }
    // --- Validation block end ---

    // Create IP address
    const ip = await IpAddress.create({ address, description, status, updated_by: req.user ? req.user.username : null });
    // TODO: Add tags, contacts, systems relations if needed
    res.status(201).json(ip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Edit an IP address (description, status, updated_by)
exports.updateIpAddress = async (req, res) => {
  try {
    const id = req.params.id;
    let { description, status, tags, contacts, systems } = req.body;

    // Fetch current IP address
    const currentIp = await IpAddress.findById(id);
    if (!currentIp) return res.status(404).json({ error: 'IP address not found' });

    // Prepare update object
    const updateObj = {};

    // Description: only update if provided and not empty string
    if (typeof description === 'string' && description.trim() !== '') {
      updateObj.description = description.trim();
    } else {
      updateObj.description = currentIp.description;
    }

    // Status: only update if provided and not empty string
    if (typeof status === 'string' && status.trim() !== '') {
      const allowedStatus = ipAddressOptions.status.map(s => s.value);
      if (!allowedStatus.includes(status.trim())) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatus.join(', ')}` });
      }
      updateObj.status = status.trim();
    } else {
      updateObj.status = currentIp.status;
    }

    // Normalize arrays if present and validate
    if (tags !== undefined) {
      if (!Array.isArray(tags)) tags = [tags];
      tags = tags.map(Number).filter(x => !isNaN(x));
      const invalidTags = [];
      for (const tid of tags) {
        // eslint-disable-next-line no-await-in-loop
        const exists = await Tag.exists(tid);
        if (!exists) invalidTags.push(tid);
      }
      if (invalidTags.length > 0) {
        return res.status(400).json({ error: `Invalid tag IDs: ${invalidTags.join(', ')}` });
      }
    }
    if (contacts !== undefined) {
      if (!Array.isArray(contacts)) contacts = [contacts];
      contacts = contacts.map(Number).filter(x => !isNaN(x));
      const invalidContacts = [];
      for (const cid of contacts) {
        // eslint-disable-next-line no-await-in-loop
        const exists = await Contact.exists(cid);
        if (!exists) invalidContacts.push(cid);
      }
      if (invalidContacts.length > 0) {
        return res.status(400).json({ error: `Invalid contact IDs: ${invalidContacts.join(', ')}` });
      }
    }
    if (systems !== undefined) {
      if (!Array.isArray(systems)) systems = [systems];
      systems = systems.map(Number).filter(x => !isNaN(x));
      const invalidSystems = [];
      for (const sid of systems) {
        // eslint-disable-next-line no-await-in-loop
        const exists = await System.exists(sid);
        if (!exists) invalidSystems.push(sid);
      }
      if (invalidSystems.length > 0) {
        return res.status(400).json({ error: `Invalid system IDs: ${invalidSystems.join(', ')}` });
      }
    }

    updateObj.updated_by = req.user ? req.user.username : null;

    // Update IP address (chỉ update các trường chính)
    const ip = await IpAddress.update(id, updateObj);
    if (!ip) return res.status(404).json({ error: 'IP address not found' });

    // Cập nhật bảng liên kết nếu có truyền lên
    if (tags !== undefined) {
      await IpAddress.setTags(id, tags);
    }
    if (contacts !== undefined) {
      await IpAddress.setContacts(id, contacts);
    }
    if (systems !== undefined) {
      await IpAddress.setSystems(id, systems);
    }

    // Lấy lại bản ghi đã cập nhật (bao gồm liên kết nếu findById có join)
    const updatedIp = await IpAddress.findById(id);
    res.json(updatedIp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete an IP address
exports.deleteIpAddress = async (req, res) => {
  try {
    const id = req.params.id;
    await IpAddress.delete(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
