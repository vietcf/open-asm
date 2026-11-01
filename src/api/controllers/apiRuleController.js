import {
  listRules as listRulesService,
  getRule as getRuleService,
  createRule as createRuleService,
  updateRule as updateRuleService,
  deleteRule as deleteRuleService,
  getActionOptions as getActionsOptionsFromConfig,
  getStatusOptions as getStatusOptionsFromConfig,
  getViolationTypeOptions as getViolationTypeOptionsFromConfig,
  getFirewallNameOptions as getFirewallNameOptionsFromConfig
} from '../../services/ruleService.js';
import { handleServiceErrorPlain } from '../../shared/api.js';

// Controller for Firewall Rule API
const apiRuleController = {};

apiRuleController.listRules = async (req, res) => {
  try {
    // Normalize query params
    const search = req.query.search ? req.query.search.trim() : '';
    let page = parseInt(req.query.page, 10);
    let pageSize = parseInt(req.query.pageSize, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) pageSize = 20;

    // Filter parameters
    let ou_id = req.query.ou_id ? parseInt(req.query.ou_id, 10) : undefined;
    if (isNaN(ou_id)) ou_id = undefined;

    let contacts = req.query.contacts || req.query['contacts[]'] || [];
    if (typeof contacts === 'string') contacts = [contacts];
    contacts = Array.isArray(contacts) ? contacts.map(c => parseInt(c, 10)).filter(c => !isNaN(c)) : [];
    if (contacts.length === 0) contacts = undefined;

    let tags = req.query.tags || req.query['tags[]'] || [];
    if (typeof tags === 'string') tags = [tags];
    tags = Array.isArray(tags) ? tags.map(t => parseInt(t, 10)).filter(t => !isNaN(t)) : [];
    if (tags.length === 0) tags = undefined;

    let violation_type = req.query.violation_type ? req.query.violation_type.trim() : undefined;
    if (violation_type === '') violation_type = undefined;

    let status = req.query.status ? req.query.status.trim() : undefined;
    if (status === '') status = undefined;

    let firewall_name = req.query.firewall_name ? req.query.firewall_name.trim() : undefined;
    if (firewall_name === '') firewall_name = undefined;

    let audit_batch = req.query.audit_batch ? req.query.audit_batch.trim() : undefined;
    if (audit_batch === '') audit_batch = undefined;

    let work_order = req.query.work_order ? req.query.work_order.trim() : undefined;
    if (work_order === '') work_order = undefined;

    // Original contract: a bare array (RuleFirewall.findFilteredList's own
    // shape), unlike every other list endpoint in this API — preserved as-is
    // rather than silently changing the response envelope.
    const { items } = await listRulesService({
      search, page, pageSize, ou_id, contacts, tags, violation_type,
      status, firewall_name, audit_batch, work_order
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiRuleController.getRule = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }
    const rule = await getRuleService(id);
    res.json(rule);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiRuleController.createRule = async (req, res) => {
  try {
    const rule = await createRuleService({ ...req.body, updated_by: req.user ? req.user.username : null });
    res.status(201).json(rule);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiRuleController.updateRule = async (req, res) => {
  try {
    const id = req.params.id;
    const rule = await updateRuleService(id, { ...req.body, updated_by: req.user ? req.user.username : null });
    res.json(rule);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiRuleController.deleteRule = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }
    await deleteRuleService(id);
    res.status(204).send();
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Export helper functions for use in routes
export { getActionsOptionsFromConfig, getStatusOptionsFromConfig, getViolationTypeOptionsFromConfig, getFirewallNameOptionsFromConfig };

export default apiRuleController;
