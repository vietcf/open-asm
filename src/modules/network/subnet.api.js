// REST: /api/v1/subnets (plain bodies, errors as {error})
import Subnet from './subnet.model.js';
import * as subnetService from './subnet.service.js';
import { apiHandler, apiPage, crudHandlers } from '../../shared/api.js';

const asOptions = (values) => values.map((v) => ({ value: v, label: v }));

export default {
  ...crudHandlers({ get: subnetService.getSubnet, create: subnetService.createSubnet, update: subnetService.updateSubnet, remove: subnetService.deleteSubnet }),

  listSubnets: apiHandler(async (req, res) => {
    const { search, page, pageSize } = apiPage({ pageSize: 20, ...req.query });
    const { items, totalCount } = await subnetService.listSubnets({ search, page, pageSize });
    res.json({ totalCount, page, pageSize, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)), subnets: items });
  }),

  // ?address= exact CIDR
  findSubnet: apiHandler(async (req, res) => {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : '';
    if (!address) return res.status(400).json({ error: 'Address parameter is required' });
    const subnet = await Subnet.findByAddressWithDetails(address);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });
    res.json(subnet);
  }),

  getConfig: apiHandler(async (req, res) => {
    const [zones, environments] = await Promise.all([Subnet.distinctValues('zone'), Subnet.distinctValues('environment')]);
    res.json({ success: true, data: { zones: asOptions(zones), environments: asOptions(environments) } });
  }),
};
