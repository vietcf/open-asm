// REST: /api/v1/devices
import Device from './device.model.js';
import * as deviceService from './device.service.js';
import { apiHandler, apiPage, apiActor, handleServiceError } from '../../shared/api.js';
import { toValueLabel } from '../../shared/service.js';

const handler = (fn) => apiHandler(fn, handleServiceError);
const asOptions = (values) => values.map((v) => ({ value: v, label: v }));

export default {
  listDevices: handler(async (req, res) => {
    const { search, page, pageSize } = apiPage({ pageSize: 20, ...req.query });
    const q = req.query;
    const tags = [].concat(q.tags || []).map(Number).filter(Boolean);
    const { items, totalCount } = await deviceService.listDevices({
      search, page, pageSize, tags, device_type_id: q.device_type_id, platform_id: q.platform_id,
      location: q.location, manufacturer: q.manufacturer, device_role: q.device_role,
    });
    res.json({ success: true, data: items, pagination: { totalCount, page, pageSize, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) } });
  }),

  // ?name= and/or ?ip_address= exact match; 404 when nothing matches
  findDevices: handler(async (req, res) => {
    const criteria = {};
    if (req.query.name) criteria.name = String(req.query.name).trim();
    if (req.query.ip_address) criteria.ip_address = String(req.query.ip_address).trim();
    if (!criteria.name && !criteria.ip_address) {
      return res.status(400).json({ success: false, message: 'At least one search criteria must be provided (name or ip_address)' });
    }
    const data = await Device.findByCriteria(criteria);
    if (!data.length) return res.status(404).json({ success: false, message: 'No devices found matching the specified criteria', criteria });
    res.json({ success: true, data, total: data.length, criteria });
  }),

  // Allowed / known values of the free-text and enum fields
  getConfig: handler(async (req, res) => {
    const [locations, manufacturers, roles] = await Promise.all([
      deviceService.getLocationOptions(), Device.distinctValues('manufacturer', '', 1000), Device.distinctValues('device_role', '', 1000),
    ]);
    res.json({ success: true, data: { location: toValueLabel(locations), manufacturers: asOptions(manufacturers), device_roles: asOptions(roles) } });
  }),

  getDevice: handler(async (req, res) => res.json({ success: true, data: await deviceService.getDevice(req.params.id) })),
  createDevice: handler(async (req, res) => {
    res.status(201).json({ success: true, message: 'Device created successfully', data: await deviceService.createDevice({ ...req.body, updated_by: apiActor(req) }) });
  }),
  updateDevice: handler(async (req, res) => {
    res.json({ success: true, message: 'Device updated successfully', data: await deviceService.updateDevice(req.params.id, { ...(req.body || {}), updated_by: apiActor(req) }) });
  }),
  deleteDevice: handler(async (req, res) => {
    await deviceService.deleteDevice(req.params.id, { deleteIp: ['true', '1'].includes(String(req.query.delete_ip).toLowerCase()) });
    res.json({ success: true, message: 'Device deleted successfully' });
  }),
};
