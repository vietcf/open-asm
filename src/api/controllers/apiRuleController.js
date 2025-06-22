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
      contacts, tags
    } = req.body;
    // Validate required fields
    if (!rulename || !src || !dst || !action) {
      return res.status(400).json({ error: 'Missing required fields: rulename, src, dst, action' });
    }
    if (!['ALLOW', 'DENY'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action value' });
    }
    // Normalize array fields
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
    // Fake rule object (replace with DB logic later)
    const rule = {
      id: Math.floor(Math.random() * 100000),
      rulename,
      src_zone,
      src,
      src_detail,
      dst_zone,
      dst,
      dst_detail,
      services,
      application,
      url,
      action,
      ou_id,
      status,
      violation_type,
      violation_detail,
      solution_proposal,
      solution_confirm,
      description,
      contacts,
      tags,
      created_at: new Date().toISOString()
    };
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRule = async (req, res) => {
  try {
    // TODO: Replace with real DB logic
    res.json({ message: 'Rule updated', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    // TODO: Replace with real DB logic
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
