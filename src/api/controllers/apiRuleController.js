import RuleFirewall from '../../models/RuleFirewall.js';
import firewallConfig from '../../../config/firewallOptions.js';
import Unit from '../../models/Unit.js';
import Contact from '../../models/Contact.js';

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
    // Optional filters (for future expansion)
    // let ou_id = req.query.ou_id ? parseInt(req.query.ou_id, 10) : undefined;
    // ...other filters...
    const result = await RuleFirewall.findAll({ search, page, pageSize });
    res.json(result);
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
    const rule = await RuleFirewall.findById(id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiRuleController.createRule = async (req, res) => {
  try {
    // Extract and normalize fields
    let {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, firewall_name, audit_batch, work_order
    } = req.body;
    // Trim all string fields
    [firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description, work_order
    ] = [firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description, work_order
    ].map(v => typeof v === 'string' ? v.trim() : v);
    // Normalize audit_batch
    if (typeof audit_batch === 'string') audit_batch = audit_batch.trim();
    let auditBatchStr = '';
    if (audit_batch && audit_batch.length > 0) {
      const batches = audit_batch.split(',').map(v => v.trim()).filter(v => v.length > 0);
      const valid = batches.every(batch => /^\d{4}-0[12]$/.test(batch));
      if (!valid) {
        return res.status(400).json({ error: 'Each audit batch must be in the format yyyy-01 or yyyy-02 (e.g. 2023-01,2024-02)' });
      }
      auditBatchStr = batches.join(',');
    }
    // Validate required fields
    if (!rulename || !src || !dst || !action || !firewall_name) {
      return res.status(400).json({ error: 'Missing required fields: rulename, src, dst, action, firewall_name' });
    }
    // Validate enums
    const allowedActions = firewallConfig.actionsOptions.map(a => a.value);
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action value' });
    }
    const allowedStatus = firewallConfig.statusOptions.map(s => s.value);
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const allowedViolationTypes = firewallConfig.violationTypeOptions.map(v => v.value);
    if (violation_type && !allowedViolationTypes.includes(violation_type)) {
      return res.status(400).json({ error: 'Invalid violation_type value' });
    }
    const allowedFirewallNames = firewallConfig.firewallNameOptions.map(f => f.value);
    if (!allowedFirewallNames.includes(firewall_name)) {
      return res.status(400).json({ error: 'Invalid firewall_name value' });
    }
    // Normalize arrays
    if (contacts === undefined || contacts === null) contacts = [];
    if (!Array.isArray(contacts)) contacts = [contacts];
    contacts = contacts.map(c => parseInt(c, 10)).filter(c => !isNaN(c));
    if (tags === undefined || tags === null) tags = [];
    if (!Array.isArray(tags)) tags = [tags];
    tags = tags.map(t => parseInt(t, 10)).filter(t => !isNaN(t));
    // Normalize ou_id
    if (ou_id !== undefined && ou_id !== null && ou_id !== '') {
      ou_id = parseInt(ou_id, 10);
      if (isNaN(ou_id)) ou_id = null;
    } else {
      ou_id = null;
    }
    // Validate foreign key: ou_id
    if (ou_id) {
      const exists = await Unit.exists(ou_id);
      if (!exists) {
        return res.status(400).json({ error: 'Invalid ou_id: unit does not exist' });
      }
    }
    // Validate foreign key: contacts
    if (contacts && contacts.length > 0) {
      const invalidContacts = [];
      for (const cid of contacts) {
        // eslint-disable-next-line no-await-in-loop
        const exists = await Contact.exists(cid);
        if (!exists) invalidContacts.push(cid);
      }
      if (invalidContacts.length > 0) {
        return res.status(400).json({ error: `Invalid contact IDs: ${invalidContacts.join(', ')}` });
      }
    }
    // Compose data for model (exclude contacts/tags)
    const data = {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      firewall_name, work_order,
      audit_batch: auditBatchStr,
      updated_by: req.user ? req.user.username : null // JWT user
    };
    // Transactional insert
    const { pool } = await import('../../../config/config.js');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ruleId = await RuleFirewall.create(data, client);
      await RuleFirewall.setContacts(ruleId, contacts, client);
      await RuleFirewall.setTags(ruleId, tags, client);
      await client.query('COMMIT');
      const created = await RuleFirewall.findById(ruleId);
      res.status(201).json(created);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiRuleController.updateRule = async (req, res) => {
  try {
    const id = req.params.id;
    const current = await RuleFirewall.findById(id);
    if (!current) return res.status(404).json({ error: 'Rule not found' });
    // Only update fields provided, keep old values for others
    let firewall_name = ('firewall_name' in req.body) ? (typeof req.body.firewall_name === 'string' ? req.body.firewall_name.trim() : current.firewall_name) : current.firewall_name;
    let rulename = ('rulename' in req.body) ? (typeof req.body.rulename === 'string' ? req.body.rulename.trim() : current.rulename) : current.rulename;
    let src_zone = ('src_zone' in req.body) ? (typeof req.body.src_zone === 'string' ? req.body.src_zone.trim() : current.src_zone) : current.src_zone;
    let src = ('src' in req.body) ? (typeof req.body.src === 'string' ? req.body.src.trim() : current.src) : current.src;
    let src_detail = ('src_detail' in req.body) ? (typeof req.body.src_detail === 'string' ? req.body.src_detail.trim() : current.src_detail) : current.src_detail;
    let dst_zone = ('dst_zone' in req.body) ? (typeof req.body.dst_zone === 'string' ? req.body.dst_zone.trim() : current.dst_zone) : current.dst_zone;
    let dst = ('dst' in req.body) ? (typeof req.body.dst === 'string' ? req.body.dst.trim() : current.dst) : current.dst;
    let dst_detail = ('dst_detail' in req.body) ? (typeof req.body.dst_detail === 'string' ? req.body.dst_detail.trim() : current.dst_detail) : current.dst_detail;
    let services = ('services' in req.body) ? (typeof req.body.services === 'string' ? req.body.services.trim() : current.services) : current.services;
    let application = ('application' in req.body) ? (typeof req.body.application === 'string' ? req.body.application.trim() : current.application) : current.application;
    let url = ('url' in req.body) ? (typeof req.body.url === 'string' ? req.body.url.trim() : current.url) : current.url;
    let action = ('action' in req.body) ? (typeof req.body.action === 'string' ? req.body.action.trim() : current.action) : current.action;
    let ou_id = ('ou_id' in req.body) ? req.body.ou_id : current.ou_id;
    let status = ('status' in req.body) ? (typeof req.body.status === 'string' ? req.body.status.trim() : current.status) : current.status;
    let violation_type = ('violation_type' in req.body) ? (typeof req.body.violation_type === 'string' ? req.body.violation_type.trim() : current.violation_type) : current.violation_type;
    let violation_detail = ('violation_detail' in req.body) ? (typeof req.body.violation_detail === 'string' ? req.body.violation_detail.trim() : current.violation_detail) : current.violation_detail;
    let solution_proposal = ('solution_proposal' in req.body) ? (typeof req.body.solution_proposal === 'string' ? req.body.solution_proposal.trim() : current.solution_proposal) : current.solution_proposal;
    let solution_confirm = ('solution_confirm' in req.body) ? (typeof req.body.solution_confirm === 'string' ? req.body.solution_confirm.trim() : current.solution_confirm) : current.solution_confirm;
    let description = ('description' in req.body) ? (typeof req.body.description === 'string' ? req.body.description.trim() : current.description) : current.description;
    let work_order = ('work_order' in req.body) ? (typeof req.body.work_order === 'string' ? req.body.work_order.trim() : current.work_order) : current.work_order;
    let audit_batch = ('audit_batch' in req.body) ? req.body.audit_batch : current.audit_batch;
    // Normalize audit_batch
    let auditBatchStr = '';
    if (typeof audit_batch === 'string' && audit_batch.length > 0) {
      const batches = audit_batch.split(',').map(v => v.trim()).filter(v => v.length > 0);
      const valid = batches.every(batch => /^\d{4}-0[12]$/.test(batch));
      if (!valid) {
        return res.status(400).json({ error: 'Each audit batch must be in the format yyyy-01 or yyyy-02 (e.g. 2023-01,2024-02)' });
      }
      auditBatchStr = batches.join(',');
    } else {
      auditBatchStr = current.audit_batch;
    }
    // Normalize arrays
    let contacts = ('contacts' in req.body) ? req.body.contacts : current.contacts;
    if (contacts === undefined || contacts === null) contacts = [];
    if (!Array.isArray(contacts)) contacts = [contacts];
    contacts = contacts.map(c => parseInt(c, 10)).filter(c => !isNaN(c));
    let tags = ('tags' in req.body) ? req.body.tags : current.tags;
    if (tags === undefined || tags === null) tags = [];
    if (!Array.isArray(tags)) tags = [tags];
    tags = tags.map(t => parseInt(t, 10)).filter(t => !isNaN(t));
    // Normalize ou_id
    if ('ou_id' in req.body && ou_id !== undefined && ou_id !== null && ou_id !== '') {
      ou_id = parseInt(ou_id, 10);
      if (isNaN(ou_id)) ou_id = null;
      else {
        const exists = await Unit.exists(ou_id);
        if (!exists) {
          return res.status(400).json({ error: 'Invalid ou_id: unit does not exist' });
        }
      }
    } else if ('ou_id' in req.body) {
      ou_id = null;
    }
    // Validate required fields
    if (!rulename || !src || !dst || !action || !firewall_name) {
      return res.status(400).json({ error: 'Missing required fields: rulename, src, dst, action, firewall_name' });
    }
    // Validate enums
    const allowedActions = firewallConfig.actionsOptions.map(a => a.value);
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action value' });
    }
    const allowedStatus = firewallConfig.statusOptions.map(s => s.value);
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const allowedViolationTypes = firewallConfig.violationTypeOptions.map(v => v.value);
    if (violation_type && !allowedViolationTypes.includes(violation_type)) {
      return res.status(400).json({ error: 'Invalid violation_type value' });
    }
    const allowedFirewallNames = firewallConfig.firewallNameOptions.map(f => f.value);
    if (!allowedFirewallNames.includes(firewall_name)) {
      return res.status(400).json({ error: 'Invalid firewall_name value' });
    }
    // Validate foreign key: contacts
    if (contacts && contacts.length > 0) {
      const invalidContacts = [];
      for (const cid of contacts) {
        // eslint-disable-next-line no-await-in-loop
        const exists = await Contact.exists(cid);
        if (!exists) invalidContacts.push(cid);
      }
      if (invalidContacts.length > 0) {
        return res.status(400).json({ error: `Invalid contact IDs: ${invalidContacts.join(', ')}` });
      }
    }
    // Transactional update
    const { pool } = await import('../../../config/config.js');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await RuleFirewall.update(id, {
        firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
        services, application, url, action, ou_id, status, violation_type,
        violation_detail, solution_proposal, solution_confirm, description,
        work_order, audit_batch: auditBatchStr,
        updated_by: req.user ? req.user.username : current.updated_by
      }, client);
      await RuleFirewall.setContacts(id, contacts, client);
      await RuleFirewall.setTags(id, tags, client);
      await client.query('COMMIT');
      const updated = await RuleFirewall.findById(id);
      res.json(updated);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiRuleController.deleteRule = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }
    const ruleExists = await RuleFirewall.findById(id);
    if (!ruleExists) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    await RuleFirewall.delete(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default apiRuleController;
