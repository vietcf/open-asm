// REST: /api/v1/units
import * as unitService from './unit.service.js';
import { apiHandler, apiPage, handleServiceError } from '../../shared/api.js';

export default {
  listUnits: apiHandler(async (req, res) => {
    const { search, page, pageSize } = apiPage({ pageSize: 20, ...req.query });
    const q = (k) => (typeof req.query[k] === 'string' ? req.query[k].trim() : '');
    const { items, totalCount } = await unitService.listUnits({ search, page, pageSize, parent_id: q('parent_id'), level: q('level') });
    res.json({ totalCount, page, pageSize, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)), units: items });
  }),

  // ?name= exact (case-insensitive) match
  findUnits: apiHandler(async (req, res) => {
    const name = String(req.query.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: "Search term 'name' is required" });
    const data = await unitService.findUnitsByName(name);
    res.json({ success: true, data, count: data.length });
  }, handleServiceError),

  getUnit: apiHandler(async (req, res) => res.json(await unitService.getUnit(req.params.id))),
  createUnit: apiHandler(async (req, res) => res.status(201).json(await unitService.createUnit(req.body || {}))),
  updateUnit: apiHandler(async (req, res) => res.json(await unitService.updateUnit(req.params.id, req.body || {}))),
  deleteUnit: apiHandler(async (req, res) => { await unitService.deleteUnit(req.params.id); res.status(204).send(); }),
};
