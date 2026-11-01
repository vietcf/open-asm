// REST: /api/v1/servers
import Server from './server.model.js';
import * as serverService from './server.service.js';
import { apiHandler, apiPage, apiActor, handleServiceError } from '../../shared/api.js';
import { toValueLabel } from '../../shared/service.js';

const handler = (fn) => apiHandler(fn, handleServiceError);
const list = (v) => [].concat(v || []).map(String).filter(Boolean);

export default {
  // Allowed values of the enum fields
  getConfig: handler(async (req, res) => {
    const { statusOptions, typesOptions, locations } = await serverService.getFormOptions();
    res.json({ success: true, data: { status: toValueLabel(statusOptions), type: toValueLabel(typesOptions), location: toValueLabel(locations) } });
  }),

  listServers: handler(async (req, res) => {
    const { search, page, pageSize } = apiPage(req.query);
    const q = req.query;
    const { items, totalCount } = await serverService.listServers({
      search, page, pageSize, status: q.status, type: q.type, location: q.location,
      tags: list(q.tags), ip: list(q.ip), manager: list(q.manager), systems: list(q.systems), services: list(q.services), os: list(q.os),
    });
    res.json({ success: true, data: items, count: items.length, total: totalCount });
  }),

  // ?name= and/or ?ip_address= exact match; 404 when nothing matches
  findServers: handler(async (req, res) => {
    const criteria = {};
    if (req.query.name) criteria.name = String(req.query.name).trim();
    if (req.query.ip_address) criteria.ip_address = String(req.query.ip_address).trim();
    if (!criteria.name && !criteria.ip_address) {
      return res.status(400).json({ success: false, message: 'At least one search criteria must be provided (name or ip_address)' });
    }
    const data = await Server.findByCriteria(criteria);
    if (!data.length) return res.status(404).json({ success: false, message: 'No servers found matching the specified criteria', criteria });
    res.json({ success: true, data, count: data.length, criteria });
  }),

  getServer: handler(async (req, res) => res.json({ success: true, data: await serverService.getServer(req.params.id) })),
  createServer: handler(async (req, res) => res.status(201).json(await serverService.createServer({ ...req.body, updated_by: apiActor(req) }))),
  updateServer: handler(async (req, res) => {
    res.json({ success: true, message: 'Server updated successfully', data: await serverService.updateServer(req.params.id, { ...req.body, updated_by: apiActor(req) }) });
  }),
  deleteServer: handler(async (req, res) => {
    await serverService.deleteServer(req.params.id, { deleteIp: ['true', '1'].includes(String(req.query.delete_ip).toLowerCase()) });
    res.json({ success: true, message: 'Server deleted successfully' });
  }),
};
