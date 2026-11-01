// REST: /api/v1/domains (plain bodies, errors as {error})
import Domain from './domain.model.js';
import * as domainService from './domain.service.js';
import { apiHandler, apiPage, crudHandlers } from '../../shared/api.js';

export default {
  ...crudHandlers({ get: domainService.getDomain, create: domainService.createDomain, update: domainService.updateDomain, remove: domainService.deleteDomain }),

  getAll: apiHandler(async (req, res) => {
    const { search, page, pageSize } = apiPage({ pageSize: 20, ...req.query });
    const { items, totalCount } = await domainService.listDomains({ search, page, pageSize });
    res.json({ totalCount, page, pageSize, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)), domains: items });
  }),

  // ?name= exact match
  findDomains: apiHandler(async (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!name) return res.status(400).json({ success: false, message: 'Search term "name" is required' });
    const data = await Domain.findByNameWithLinks(name);
    res.json({ success: true, data, count: data.length });
  }),
};
