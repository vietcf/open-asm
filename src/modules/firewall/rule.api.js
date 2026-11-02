// REST: /api/v1/rules (plain bodies, errors as {error})
import * as ruleService from './rule.service.js';
import { apiHandler, apiPage, crudHandlers } from '../../shared/api.js';
import { toValueLabel } from '../../shared/service.js';

const ids = (v) => [].concat(v ?? []).map(Number).filter(Boolean);
const crud = crudHandlers({ get: ruleService.getRule, create: ruleService.createRule, update: ruleService.updateRule, remove: ruleService.deleteRule });
const validId = (handler) => (req, res) => (Number.isInteger(Number(req.params.id)) ? handler(req, res) : res.status(400).json({ error: 'Invalid rule ID' }));

export default {
  getRule: validId(crud.getById),
  createRule: crud.create,
  updateRule: validId(crud.update),
  deleteRule: validId(crud.remove),

  // Array of rules (no envelope)
  listRules: apiHandler(async (req, res) => {
    const { search, page, pageSize } = apiPage({ pageSize: 20, ...req.query });
    const q = req.query;
    const { items } = await ruleService.listRules({
      search, page, pageSize, ou_id: parseInt(q.ou_id, 10) || null, contacts: ids(q.contacts ?? q['contacts[]']), tags: ids(q.tags ?? q['tags[]']),
      violation_type: q.violation_type || [], status: q.status || [], firewall_name: q.firewall_name || [], audit_batch: q.audit_batch, work_order: q.work_order,
    });
    res.json(items);
  }),

  getConfig: apiHandler(async (req, res) => {
    const options = await ruleService.getRuleOptions();
    res.json({ success: true, data: Object.fromEntries(Object.entries(options).map(([k, v]) => [k, toValueLabel(v)])) });
  }),
};
