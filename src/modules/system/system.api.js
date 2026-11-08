// REST: /api/v1/systems
import System from './system.model.js';
import * as systemService from './system.service.js';
import { apiHandler, apiPage, paginated, crudHandlers, handleServiceError } from '../../shared/api.js';

export default {
  getAll: apiHandler(async (req, res) => {
    const { search, page, pageSize } = apiPage(req.query);
    const { items, totalCount } = await systemService.listSystems({ search, page, pageSize });
    res.json(paginated(items, totalCount, page, pageSize));
  }),

  // ?name= exact (case-insensitive) match
  find: apiHandler(async (req, res) => {
    const name = String(req.query.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Search term "name" is required' });
    const data = await System.findByNameExact(name);
    res.json({ success: true, data, count: data.length });
  }, handleServiceError),

  ...crudHandlers({
    get: systemService.getSystem,
    create: systemService.createSystem,
    update: systemService.updateSystem,
  }),

  // ?delete_components=true also deletes the system's components
  remove: apiHandler(async (req, res) => {
    await systemService.deleteSystem(req.params.id, { deleteComponents: String(req.query.delete_components) === 'true' });
    res.status(204).end();
  }),
};
