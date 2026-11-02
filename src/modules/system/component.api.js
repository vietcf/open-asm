// REST: /api/v1/components
import * as componentService from './component.service.js';
import { apiHandler, apiPage, paginated, crudHandlers, handleServiceError } from '../../shared/api.js';

export default {
  // ?system_id= limits to one system
  getAll: apiHandler(async (req, res) => {
    const { search, page, pageSize } = apiPage(req.query);
    const filter = { search, page, pageSize, system_id: req.query.system_id || null };
    const { items, totalCount } = await componentService.listComponents(filter);
    res.json(paginated(items, totalCount, page, pageSize));
  }),

  // ?name= substring match, every hit
  find: apiHandler(async (req, res) => {
    const name = String(req.query.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Search term "name" is required' });
    const data = (await componentService.listComponents({ search: name, page: 1, pageSize: 1000 })).items;
    res.json({ success: true, data, count: data.length });
  }, handleServiceError),

  ...crudHandlers({
    get: componentService.getComponent,
    create: componentService.createComponent,
    update: componentService.updateComponent,
    remove: componentService.deleteComponent,
  }),
};
