const RuleFirewall = require('../../models/RuleFirewall');
const firewallConfig = require('../../../config/firewallOptions');
const Unit = require('../../models/Unit');
const Contact = require('../../models/Contact');

// Controller for Firewall Rule API
exports.listRules = async (req, res) => {
  try {
    // TODO: Replace with real DB logic
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRule = async (req, res) => {
  try {
    // TODO: Replace with real DB logic
    res.json({ id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createRule = async (req, res) => {
  try {
    let {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, firewall_name
    } = req.body;
    // Normalize & trim all string fields
    [firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description
    ] = [firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description
    ].map(v => typeof v === 'string' ? v.trim() : v);
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
    if (contacts && !Array.isArray(contacts)) contacts = [contacts];
    if (tags && !Array.isArray(tags)) tags = [tags];
    contacts = (contacts || []).map(c => parseInt(c, 10)).filter(c => !isNaN(c));
    tags = (tags || []).map(t => parseInt(t, 10)).filter(t => !isNaN(t));
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
    // Compose data for model
    const data = {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, firewall_name,
      updated_by: req.user ? req.user.username : null // JWT user
    };
    // Insert rule
    const ruleId = await RuleFirewall.create(data);
    // Fetch the created rule (basic info)
    res.status(201).json({ id: ruleId, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const id = req.params.id;
    let {
      firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags
    } = req.body;
    // Normalize & trim all string fields
    [firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description
    ] = [firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description
    ].map(v => typeof v === 'string' ? v.trim() : v);
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
    if (contacts && !Array.isArray(contacts)) contacts = [contacts];
    if (tags && !Array.isArray(tags)) tags = [tags];
    contacts = (contacts || []).map(c => parseInt(c, 10)).filter(c => !isNaN(c));
    tags = (tags || []).map(t => parseInt(t, 10)).filter(t => !isNaN(t));
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
    // Compose data for model
    const data = {
      firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags,
      updated_by: req.user ? req.user.username : null
    };
    // Check if rule exists (optional, for 404)
    // You can implement a RuleFirewall.findById if needed
    // await RuleFirewall.findById(id) ...
    await RuleFirewall.update(id, data);
    res.json({ id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    const id = req.params.id;
    // Optionally check if rule exists before delete
    // await RuleFirewall.findById(id) ...
    await RuleFirewall.delete(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
