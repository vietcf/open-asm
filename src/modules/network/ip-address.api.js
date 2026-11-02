// REST: /api/v1/ip-addresses (plain bodies, errors as {error})
import * as ipService from './ip-address.service.js';
import { apiHandler, apiPage, crudHandlers } from '../../shared/api.js';
import { toValueLabel } from '../../shared/service.js';

const ids = (v) => [].concat(v ?? []).map(Number).filter(Boolean);

export default {
  ...crudHandlers({ get: ipService.getIpAddress, create: ipService.createIpAddress, update: ipService.updateIpAddress, remove: ipService.deleteIpAddress }),

  listIpAddresses: apiHandler(async (req, res) => {
    const { search, page, pageSize } = apiPage(req.query);
    const q = req.query;
    const { items, totalCount } = await ipService.listIpAddresses({
      search, page, pageSize, status: q.status || [], tags: ids(q.tags), systems: ids(q.systems), contacts: ids(q.contacts),
    });
    res.json({ data: items, total: totalCount });
  }),

  // ?address= exact match
  findIpAddressByAddress: apiHandler(async (req, res) => {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : '';
    if (!address) return res.status(400).json({ error: 'Missing or invalid address parameter' });
    res.json(await ipService.getIpAddressByAddress(address));
  }),

  getConfig: apiHandler(async (req, res) => {
    res.json({ success: true, data: { status: toValueLabel(await ipService.getIpStatusOptions()) } });
  }),
};
