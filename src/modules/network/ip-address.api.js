
// API Controller for IP Address (ES6)
import {
  listIpAddresses as listIpAddressesService,
  getIpAddress as getIpAddressService,
  getIpAddressByAddress as getIpAddressByAddressService,
  createIpAddress as createIpAddressService,
  updateIpAddress as updateIpAddressService,
  deleteIpAddress as deleteIpAddressService,
  getIpStatusOptions
} from './ip-address.service.js';
import { handleServiceErrorPlain } from '../../shared/api.js';

const apiIpAddressController = {};

// Get IP address configuration options
apiIpAddressController.getConfig = async (req, res) => {
  try {
    const statusOptions = await getIpStatusOptions();
    res.json({
      success: true,
      data: {
        status: statusOptions
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

apiIpAddressController.listIpAddresses = async (req, res) => {
  try {
    const { search, tags, status, systems, contacts, page = 1, pageSize = 10 } = req.query;
    const filterTags = tags ? (Array.isArray(tags) ? tags.map(Number) : [Number(tags)]) : [];
    const filterSystems = systems ? (Array.isArray(systems) ? systems.map(Number) : [Number(systems)]) : [];
    const filterContacts = contacts ? (Array.isArray(contacts) ? contacts.map(Number) : [Number(contacts)]) : [];
    const { items, totalCount } = await listIpAddressesService({
      search: search || '',
      tags: filterTags,
      status: status || '',
      systems: filterSystems,
      contacts: filterContacts,
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.max(1, Math.min(parseInt(pageSize, 10) || 10, 100))
    });
    res.json({ data: items, total: totalCount });
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Get a single IP address by id
apiIpAddressController.getIpAddress = async (req, res) => {
  try {
    const ip = await getIpAddressService(req.params.id);
    res.json(ip);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Add a new IP address
apiIpAddressController.createIpAddress = async (req, res) => {
  try {
    const ip = await createIpAddressService({ ...req.body, updated_by: req.user ? req.user.username : null });
    res.status(201).json(ip);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Edit an IP address (description, status, updated_by)
apiIpAddressController.updateIpAddress = async (req, res) => {
  try {
    const ip = await updateIpAddressService(req.params.id, { ...req.body, updated_by: req.user ? req.user.username : null });
    res.json(ip);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Delete an IP address
apiIpAddressController.deleteIpAddress = async (req, res) => {
  try {
    await deleteIpAddressService(req.params.id);
    res.status(204).send();
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Find IP address by address string (exact match)
apiIpAddressController.findIpAddressByAddress = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address || typeof address !== 'string' || address.trim() === '') {
      return res.status(400).json({ error: 'Missing or invalid address parameter' });
    }
    const ip = await getIpAddressByAddressService(address.trim());
    res.json(ip);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

export default apiIpAddressController;
