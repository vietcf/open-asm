import RuleFirewall from '../../models/RuleFirewall.js';
import Configuration from '../../models/Configuration.js';
import Unit from '../../models/Unit.js';
import Contact from '../../models/Contact.js';
import Tag from '../../models/Tag.js';


// Helper: load firewall options from DB config
async function getActionsOptionsFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('firewall_rule_action');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        options = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) { options = []; }
  if (!Array.isArray(options) || options.length === 0) {
    options = [];
  }
  return options;
}

async function getStatusOptionsFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('firewall_rule_status');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        options = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) { options = []; }
  if (!Array.isArray(options) || options.length === 0) {
    options = [];
  }
  return options;
}

async function getViolationTypeOptionsFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('firewall_rule_violation_type');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        options = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) { options = []; }
  if (!Array.isArray(options) || options.length === 0) {
    options = [];
  }
  return options;
}

async function getFirewallNameOptionsFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('firewall_name');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        options = parsed.map(item => {
          if (typeof item === 'object') {
            // Handle both { key, label } and { value, label } formats
            if (item.key !== undefined) {
              return { value: item.key, label: item.label };
            } else if (item.value !== undefined) {
              return { value: item.value, label: item.label };
            } else {
              return { value: String(item), label: String(item) };
            }
          } else {
            return { value: String(item), label: String(item) };
          }
        });
      }
    }
  } catch (e) { options = []; }
  // No fallback data - return empty array if no data from database
  return options;
}


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
    
    const result = await RuleFirewall.findFilteredList({ 
      search, page, pageSize, ou_id, contacts, tags, violation_type, 
      status, firewall_name, audit_batch, work_order 
    });
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
      contacts, tags, firewall_name, audit_batch, work_order, raw_data
    } = req.body;
    // Trim all string fields
    [firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description, work_order, raw_data
    ] = [firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description, work_order, raw_data
    ].map(v => typeof v === 'string' ? v.trim() : v);
    // Normalize and validate audit_batch
    if (typeof audit_batch === 'string') audit_batch = audit_batch.trim();
    let auditBatchStr = '';
    if (audit_batch && audit_batch.length > 0) {
      auditBatchStr = audit_batch;
    }
    // Validate required fields
    if (!rulename || rulename.trim() === '' || 
        !src || src.trim() === '' || 
        !dst || dst.trim() === '' || 
        !action || action.trim() === '' || 
        !firewall_name || firewall_name.trim() === '' || 
        !auditBatchStr || auditBatchStr.trim() === '') {
      return res.status(400).json({ error: 'Missing required fields: rulename, src, dst, action, firewall_name, audit_batch' });
    }
    
    // Check if rule already exists (unique constraint: rulename, firewall_name, audit_batch)
    const existingRule = await RuleFirewall.findByFirewallRuleNameAndAuditBatch(firewall_name, rulename, auditBatchStr);
    if (existingRule) {
      return res.status(409).json({ error: `Rule already exists: ${firewall_name} - ${rulename} in audit batch ${auditBatchStr}` });
    }
    // Validate enums
    const allowedActions = (await getActionsOptionsFromConfig()).map(a => a.value);
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action value' });
    }
    const allowedStatus = (await getStatusOptionsFromConfig()).map(s => s.value);
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const allowedViolationTypes = (await getViolationTypeOptionsFromConfig()).map(v => v.value);
    if (violation_type && !allowedViolationTypes.includes(violation_type)) {
      return res.status(400).json({ error: 'Invalid violation_type value' });
    }
    const allowedFirewallNames = (await getFirewallNameOptionsFromConfig()).map(f => f.value);
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
    // Validate foreign key: contacts only if provided in request body
    if ('contacts' in req.body && contacts && contacts.length > 0) {
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
    
    // Validate foreign key: tags only if provided in request body
    if ('tags' in req.body && tags && tags.length > 0) {
      const invalidTags = [];
      for (const tid of tags) {
        // eslint-disable-next-line no-await-in-loop
        const exists = await Tag.exists(tid);
        if (!exists) invalidTags.push(tid);
      }
      if (invalidTags.length > 0) {
        return res.status(400).json({ error: `Invalid tag IDs: ${invalidTags.join(', ')}` });
      }
    }
    
    // Validate field lengths
    if ('rulename' in req.body && rulename && rulename.length > 255) {
      return res.status(400).json({ error: 'Rule name must not exceed 255 characters' });
    }
    if ('src' in req.body && src && src.length > 255) {
      return res.status(400).json({ error: 'Source must not exceed 255 characters' });
    }
    if ('dst' in req.body && dst && dst.length > 255) {
      return res.status(400).json({ error: 'Destination must not exceed 255 characters' });
    }
    if ('services' in req.body && services && services.length > 255) {
      return res.status(400).json({ error: 'Services must not exceed 255 characters' });
    }
    if ('application' in req.body && application && application.length > 255) {
      return res.status(400).json({ error: 'Application must not exceed 255 characters' });
    }
    if ('url' in req.body && url && url.length > 500) {
      return res.status(400).json({ error: 'URL must not exceed 500 characters' });
    }
    if ('work_order' in req.body && work_order && work_order.length > 255) {
      return res.status(400).json({ error: 'Work order must not exceed 255 characters' });
    }
    
    // Validate URL format if provided in request body
    if ('url' in req.body && url && url.trim() !== '') {
      try {
        new URL(url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }
    
    // Compose data for model (exclude contacts/tags)
    const data = {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      firewall_name, work_order, raw_data,
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
    let raw_data = ('raw_data' in req.body) ? (typeof req.body.raw_data === 'string' ? req.body.raw_data.trim() : current.raw_data) : current.raw_data;
    let audit_batch = ('audit_batch' in req.body) ? req.body.audit_batch : current.audit_batch;
    // Normalize and validate audit_batch
    let auditBatchStr = '';
    if (typeof audit_batch === 'string' && audit_batch.length > 0) {
      auditBatchStr = audit_batch.trim();
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
    // Validate required fields only if they are provided in request body
    const missingFields = [];
    if ('rulename' in req.body && (!rulename || rulename.trim() === '')) {
      missingFields.push('rulename');
    }
    if ('src' in req.body && (!src || src.trim() === '')) {
      missingFields.push('src');
    }
    if ('dst' in req.body && (!dst || dst.trim() === '')) {
      missingFields.push('dst');
    }
    if ('action' in req.body && (!action || action.trim() === '')) {
      missingFields.push('action');
    }
    if ('firewall_name' in req.body && (!firewall_name || firewall_name.trim() === '')) {
      missingFields.push('firewall_name');
    }
    if ('audit_batch' in req.body && (!auditBatchStr || auditBatchStr.trim() === '')) {
      missingFields.push('audit_batch');
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }
    
    // Check if rule already exists (unique constraint: rulename, firewall_name, audit_batch)
    // Only check if any of the unique constraint fields are being updated
    const isUpdatingUniqueFields = ('rulename' in req.body || 'firewall_name' in req.body || 'audit_batch' in req.body);
    
    if (isUpdatingUniqueFields) {
      // Use final values (from request body or current rule)
      const finalFirewallName = ('firewall_name' in req.body) ? firewall_name : current.firewall_name;
      const finalRulename = ('rulename' in req.body) ? rulename : current.rulename;
      const finalAuditBatch = ('audit_batch' in req.body) ? auditBatchStr : current.audit_batch;
      
      const existingRule = await RuleFirewall.findByFirewallRuleNameAndAuditBatch(finalFirewallName, finalRulename, finalAuditBatch);
      
      if (existingRule && existingRule.id !== parseInt(id)) {
        return res.status(409).json({ error: `Rule already exists: ${finalFirewallName} - ${finalRulename} in audit batch ${finalAuditBatch}` });
      }
    }
    // Validate enums only if fields are provided in request body
    if ('action' in req.body) {
      const allowedActions = (await getActionsOptionsFromConfig()).map(a => a.value);
      if (!allowedActions.includes(action)) {
        return res.status(400).json({ error: 'Invalid action value' });
      }
    }
    if ('status' in req.body && status) {
      const allowedStatus = (await getStatusOptionsFromConfig()).map(s => s.value);
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
    }
    if ('violation_type' in req.body && violation_type) {
      const allowedViolationTypes = (await getViolationTypeOptionsFromConfig()).map(v => v.value);
      if (!allowedViolationTypes.includes(violation_type)) {
        return res.status(400).json({ error: 'Invalid violation_type value' });
      }
    }
    if ('firewall_name' in req.body) {
      const allowedFirewallNames = (await getFirewallNameOptionsFromConfig()).map(f => f.value);
      if (!allowedFirewallNames.includes(firewall_name)) {
        return res.status(400).json({ error: 'Invalid firewall_name value' });
      }
    }
    // Validate foreign key: contacts only if provided in request body
    if ('contacts' in req.body && contacts && contacts.length > 0) {
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
    
    // Validate foreign key: tags only if provided in request body
    if ('tags' in req.body && tags && tags.length > 0) {
      const invalidTags = [];
      for (const tid of tags) {
        // eslint-disable-next-line no-await-in-loop
        const exists = await Tag.exists(tid);
        if (!exists) invalidTags.push(tid);
      }
      if (invalidTags.length > 0) {
        return res.status(400).json({ error: `Invalid tag IDs: ${invalidTags.join(', ')}` });
      }
    }
    
    // Validate field lengths
    if ('rulename' in req.body && rulename && rulename.length > 255) {
      return res.status(400).json({ error: 'Rule name must not exceed 255 characters' });
    }
    if ('src' in req.body && src && src.length > 255) {
      return res.status(400).json({ error: 'Source must not exceed 255 characters' });
    }
    if ('dst' in req.body && dst && dst.length > 255) {
      return res.status(400).json({ error: 'Destination must not exceed 255 characters' });
    }
    if ('services' in req.body && services && services.length > 255) {
      return res.status(400).json({ error: 'Services must not exceed 255 characters' });
    }
    if ('application' in req.body && application && application.length > 255) {
      return res.status(400).json({ error: 'Application must not exceed 255 characters' });
    }
    if ('url' in req.body && url && url.length > 500) {
      return res.status(400).json({ error: 'URL must not exceed 500 characters' });
    }
    if ('work_order' in req.body && work_order && work_order.length > 255) {
      return res.status(400).json({ error: 'Work order must not exceed 255 characters' });
    }
    
    // Validate URL format if provided in request body
    if ('url' in req.body && url && url.trim() !== '') {
      try {
        new URL(url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }
    
    // Build update object with only changed fields
    const updateData = {};
    const currentUser = req.user ? req.user.username : current.updated_by;
    
    // Check each field for changes and add to updateData if changed
    if ('firewall_name' in req.body && firewall_name !== current.firewall_name) {
      updateData.firewall_name = firewall_name;
    }
    if ('rulename' in req.body && rulename !== current.rulename) {
      updateData.rulename = rulename;
    }
    if ('src_zone' in req.body && src_zone !== current.src_zone) {
      updateData.src_zone = src_zone;
    }
    if ('src' in req.body && src !== current.src) {
      updateData.src = src;
    }
    if ('src_detail' in req.body && src_detail !== current.src_detail) {
      updateData.src_detail = src_detail;
    }
    if ('dst_zone' in req.body && dst_zone !== current.dst_zone) {
      updateData.dst_zone = dst_zone;
    }
    if ('dst' in req.body && dst !== current.dst) {
      updateData.dst = dst;
    }
    if ('dst_detail' in req.body && dst_detail !== current.dst_detail) {
      updateData.dst_detail = dst_detail;
    }
    if ('services' in req.body && services !== current.services) {
      updateData.services = services;
    }
    if ('application' in req.body && application !== current.application) {
      updateData.application = application;
    }
    if ('url' in req.body && url !== current.url) {
      updateData.url = url;
    }
    if ('action' in req.body && action !== current.action) {
      updateData.action = action;
    }
    if ('ou_id' in req.body && ou_id !== current.ou_id) {
      updateData.ou_id = ou_id;
    }
    if ('status' in req.body && status !== current.status) {
      updateData.status = status;
    }
    if ('violation_type' in req.body && violation_type !== current.violation_type) {
      updateData.violation_type = violation_type;
    }
    if ('violation_detail' in req.body && violation_detail !== current.violation_detail) {
      updateData.violation_detail = violation_detail;
    }
    if ('solution_proposal' in req.body && solution_proposal !== current.solution_proposal) {
      updateData.solution_proposal = solution_proposal;
    }
    if ('solution_confirm' in req.body && solution_confirm !== current.solution_confirm) {
      updateData.solution_confirm = solution_confirm;
    }
    if ('description' in req.body && description !== current.description) {
      updateData.description = description;
    }
    if ('work_order' in req.body && work_order !== current.work_order) {
      updateData.work_order = work_order;
    }
    if ('raw_data' in req.body && raw_data !== current.raw_data) {
      updateData.raw_data = raw_data;
    }
    if ('audit_batch' in req.body && auditBatchStr !== current.audit_batch) {
      updateData.audit_batch = auditBatchStr;
    }
    
    // Always update updated_by and updated_at
    updateData.updated_by = currentUser;
    
    // Check if contacts or tags have changed
    const contactsChanged = ('contacts' in req.body && JSON.stringify((contacts || []).sort()) !== JSON.stringify((current.contacts || []).sort()));
    const tagsChanged = ('tags' in req.body && JSON.stringify((tags || []).sort()) !== JSON.stringify((current.tags || []).sort()));
    
    // Transactional update
    const { pool } = await import('../../../config/config.js');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Only update if there are changes
      if (Object.keys(updateData).length > 1) { // More than just updated_by
        await RuleFirewall.update(id, updateData, client);
      }
      
      // Update contacts if changed
      if (contactsChanged) {
        await RuleFirewall.setContacts(id, contacts || [], client);
      }
      
      // Update tags if changed
      if (tagsChanged) {
        await RuleFirewall.setTags(id, tags || [], client);
      }
      
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

// Export helper functions for use in routes
export { getActionsOptionsFromConfig, getStatusOptionsFromConfig, getViolationTypeOptionsFromConfig, getFirewallNameOptionsFromConfig };

export default apiRuleController;
