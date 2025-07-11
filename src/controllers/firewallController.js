// src/controllers/firewallController.js
import { config } from '../../config/config.js';
import RuleFirewall from '../models/RuleFirewall.js';
import Configuration from '../models/Configuration.js';
import firewallConfig from '../../config/firewallOptions.js';
import ExcelJS from 'exceljs';

const firewallController = {};

firewallController.ruleList = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    let page = parseInt(req.query.page, 10);
    let pageSize = parseInt(req.query.pageSize, 10);
    if (isNaN(page) || page < 1) page = 1;

    // Load page size options from res.locals (set in app.js)
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    let configPageSize = res.locals.defaultPageSize || 10;
    if (!pageSize || !pageSizeOptions.includes(pageSize)) pageSize = configPageSize;

    // --- Parse and normalize filter params ---
    let ou_id = req.query.ou_id;
    if (ou_id && ou_id !== '') ou_id = parseInt(ou_id, 10);
    if (isNaN(ou_id)) ou_id = undefined;
    let violation_type = req.query.violation_type || '';
    if (violation_type === '') violation_type = undefined;
    let status = req.query.status || '';
    if (status === '') status = undefined;
    // Multi-select: tags, contacts
    let tags = req.query['tags[]'] || req.query.tags || [];
    if (typeof tags === 'string') tags = [tags];
    tags = tags.map(t => parseInt(t, 10)).filter(t => !isNaN(t));
    if (tags.length === 0) tags = undefined;
    let contacts = req.query['contacts[]'] || req.query.contacts || [];
    if (typeof contacts === 'string') contacts = [contacts];
    contacts = contacts.map(c => parseInt(c, 10)).filter(c => !isNaN(c));
    if (contacts.length === 0) contacts = undefined;
    let firewall_name = req.query.firewall_name || '';
    if (firewall_name === '') firewall_name = undefined;
    // Parse audit_batch filter
    let audit_batch = req.query.audit_batch || '';
    if (audit_batch === '') audit_batch = undefined;

    // --- Call model with filters ---
    const { rules: ruleList, totalCount, totalPages } = await RuleFirewall.findAll({
      search, page, pageSize, ou_id, contacts, tags, violation_type, status, firewall_name, audit_batch
    });

    // --- Fetch display names for selected filters (for select2 persistence) ---
    let ou_name = '';
    if (ou_id) {
      const ouRes = await pool.query('SELECT name FROM units WHERE id = $1', [ou_id]);
      if (ouRes.rows.length > 0) ou_name = ouRes.rows[0].name;
    }
    let tagNames = [];
    if (tags && tags.length > 0) {
      const tagRes = await pool.query('SELECT id, name FROM tags WHERE id = ANY($1)', [tags]);
      tagNames = tags.map(tid => {
        const found = tagRes.rows.find(r => r.id === tid);
        return found ? found.name : '';
      });
    }
    let contactNames = [];
    if (contacts && contacts.length > 0) {
      const contactRes = await pool.query('SELECT id, name, email FROM contacts WHERE id = ANY($1)', [contacts]);
      contactNames = contacts.map(cid => {
        const found = contactRes.rows.find(r => r.id === cid);
        return found ? (found.name + (found.email ? ' (' + found.email + ')' : '')) : '';
      });
    }

    const success = req.flash ? req.flash('success')[0] : undefined;
    const error = req.flash ? req.flash('error')[0] : undefined;
    res.render('pages/firewall/rule_list', {
      ruleList, 
      page, 
      pageSize, 
      totalPages, 
      totalCount, 
      search, 
      success, 
      error, 
      allowedPageSizes: pageSizeOptions,
      actionsOptions: firewallConfig.actionsOptions,
      statusOptions: firewallConfig.statusOptions,
      violationTypeOptions: firewallConfig.violationTypeOptions,
      firewallNameOptions: firewallConfig.firewallNameOptions,
      firewall_name, // giữ lại giá trị filter khi render lại view
      // Pass filter values for modal persistence
      ou_id, 
      ou_name, 
      tags, 
      tagNames, 
      contacts, 
      contactNames, 
      violation_type, 
      status,
      audit_batch, // persist audit_batch filter value
      title: 'Firewall Rule',
      activeMenu: 'firewall-rule'
    });
  } catch (err) {
    res.status(500).send('Error loading firewall rules: ' + err.message);
  }
};

firewallController.addRule = async (req, res) => {
  try {
    // Extract fields directly from request body
    let {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, 'contacts[]': contactsArr, 'tags[]': tagsArr, firewall_name, work_order, audit_batch
    } = req.body;
    // Normalize & trim all string fields
    [rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description
    ] = [rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description
    ].map(v => typeof v === 'string' ? v.trim() : v);
    // Normalize array fields
    contacts = Array.isArray(contactsArr) ? contactsArr : (contacts || []);
    tags = Array.isArray(tagsArr) ? tagsArr : (tags || []);
    // Normalize ou_id
    ou_id = ou_id && ou_id !== '' ? parseInt(ou_id.id !== undefined ? ou_id.id : ou_id, 10) : null;
    if (isNaN(ou_id)) ou_id = null;
    // Normalize contacts and tags to arrays of integers
    if (!Array.isArray(contacts)) contacts = [contacts];
    contacts = contacts
      .map(c => (typeof c === 'object' && c.id !== undefined ? c.id : c))
      .map(c => parseInt(c, 10))
      .filter(c => !isNaN(c));
    if (!Array.isArray(tags)) tags = [tags];
    tags = tags
      .map(t => (typeof t === 'object' && t.id !== undefined ? t.id : t))
      .map(t => parseInt(t, 10))
      .filter(t => !isNaN(t));
    // Validate required fields
    if (!rulename || !src || !dst || !action) {
      req.flash('error', 'Missing required fields: Rule Name, Source, Destination, Action');
      return res.redirect('/firewall/rule');
    }
    // Validate action, status, violation_type against config
    const allowedActions = firewallConfig.actionsOptions.map(a => a.value);
    if (!allowedActions.includes(action)) {
      req.flash('error', 'Invalid action value.');
      return res.redirect('/firewall/rule');
    }
    const allowedStatus = firewallConfig.statusOptions.map(s => s.value);
    if (status && !allowedStatus.includes(status)) {
      req.flash('error', 'Invalid status value.');
      return res.redirect('/firewall/rule');
    }
    const allowedViolationTypes = firewallConfig.violationTypeOptions.map(v => v.value);
    if (violation_type && !allowedViolationTypes.includes(violation_type)) {
      req.flash('error', 'Invalid violation type value.');
      return res.redirect('/firewall/rule');
    }
    const allowedFirewallNames = firewallConfig.firewallNameOptions.map(f => f.value);
    if (!firewall_name || !allowedFirewallNames.includes(firewall_name)) {
      req.flash('error', 'Invalid or missing firewall name.');
      return res.redirect('/firewall/rule');
    }
    // Xử lý audit_batch: chuẩn hóa, validate định dạng, lưu dạng chuỗi TEXT
    if (typeof audit_batch === 'string') audit_batch = audit_batch.trim();
    let auditBatchStr = '';
    if (audit_batch && audit_batch.length > 0) {
      const batches = audit_batch.split(',').map(v => v.trim()).filter(v => v.length > 0);
      const valid = batches.every(batch => /^\d{4}-0[12]$/.test(batch));
      if (!valid) {
        req.flash('error', 'Each audit batch must be in the format yyyy-01 or yyyy-02, separated by commas.');
        return res.redirect('/firewall/rule');
      }
      auditBatchStr = batches.join(',');
    }
    // Compose normalized body
    const body = {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, firewall_name, work_order,
      audit_batch: auditBatchStr,
      updated_by: req.session && req.session.user ? req.session.user.username : null
    };
    // created_at and updated_at are set to NOW() in the model SQL
    await RuleFirewall.create(body);
    req.flash('success', 'Rule added successfully!');
    res.redirect('/firewall/rule');
  } catch (err) {
    req.flash('error', 'Error adding rule: ' + err.message);
    res.redirect('/firewall/rule');
  }
};

firewallController.editRule = async (req, res) => {
  const id = req.params.id;
  try {
    // Extract fields directly from request body
    let {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, 'contacts[]': contactsArr, 'tags[]': tagsArr, firewall_name, work_order, audit_batch
    } = req.body;
    // Normalize & trim all string fields
    [rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description
    ] = [rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description
    ].map(v => typeof v === 'string' ? v.trim() : v);
    // Normalize array fields, always initialize to [] if empty
    // Ensure both contacts and tags can handle multiple values
    contacts = Array.isArray(contactsArr) ? contactsArr : (contacts !== undefined ? contacts : []);
    tags = Array.isArray(tagsArr) ? tagsArr : (tags !== undefined ? tags : []);
    if (!Array.isArray(contacts)) contacts = contacts ? [contacts] : [];
    if (!Array.isArray(tags)) tags = tags ? [tags] : [];
    // Normalize ou_id
    ou_id = ou_id && ou_id !== '' ? parseInt(ou_id.id !== undefined ? ou_id.id : ou_id, 10) : null;
    if (isNaN(ou_id)) ou_id = null;
    // Normalize contacts and tags to arrays of integers
    contacts = contacts
      .map(c => (typeof c === 'object' && c.id !== undefined ? c.id : c))
      .map(c => parseInt(c, 10))
      .filter(c => !isNaN(c));
    tags = tags
      .map(t => (typeof t === 'object' && t.id !== undefined ? t.id : t))
      .map(t => parseInt(t, 10))
      .filter(t => !isNaN(t));
    // Validate required fields
    if (!rulename || !src || !dst || !action) {
      req.flash('error', 'Missing required fields: Rule Name, Source, Destination, Action');
      return res.redirect('/firewall/rule');
    }
    // Validate action, status, violation_type against config
    const allowedActions = firewallConfig.actionsOptions.map(a => a.value);
    if (!allowedActions.includes(action)) {
      req.flash('error', 'Invalid action value.');
      return res.redirect('/firewall/rule');
    }
    const allowedStatus = firewallConfig.statusOptions.map(s => s.value);
    if (status && !allowedStatus.includes(status)) {
      req.flash('error', 'Invalid status value.');
      return res.redirect('/firewall/rule');
    }
    const allowedViolationTypes = firewallConfig.violationTypeOptions.map(v => v.value);
    if (violation_type && !allowedViolationTypes.includes(violation_type)) {
      req.flash('error', 'Invalid violation type value.');
      return res.redirect('/firewall/rule');
    }
    const allowedFirewallNames = firewallConfig.firewallNameOptions.map(f => f.value);
    if (!firewall_name || !allowedFirewallNames.includes(firewall_name)) {
      req.flash('error', 'Invalid or missing firewall name.');
      return res.redirect('/firewall/rule');
    }
    // Audit batch normalization and validation (same as addRule)
    if (typeof audit_batch === 'string') audit_batch = audit_batch.trim();
    let auditBatchStr = '';
    if (audit_batch && audit_batch.length > 0) {
      const batches = audit_batch.split(',').map(v => v.trim()).filter(v => v.length > 0);
      const valid = batches.every(batch => /^\d{4}-0[12]$/.test(batch));
      if (!valid) {
        req.flash('error', 'Each audit batch must be in the format yyyy-01 or yyyy-02, separated by commas.');
        return res.redirect('/firewall/rule');
      }
      auditBatchStr = batches.join(',');
    }
    // Compose normalized data
    const data = {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, firewall_name, work_order,
      audit_batch: auditBatchStr,
      updated_by: req.session && req.session.user ? req.session.user.username : null
    };
    await RuleFirewall.update(id, data);
    req.flash('success', 'Rule updated successfully!');
    res.redirect('/firewall/rule');
  } catch (err) {
    req.flash('error', 'Failed to update rule: ' + err.message);
    res.redirect('/firewall/rule');
  }
};

firewallController.deleteRule = async (req, res) => {
  const id = req.params.id;
  try {
    await RuleFirewall.delete(id);
    req.flash('success', 'Rule deleted successfully!');
    res.redirect('/firewall/rule');
  } catch (err) {
    let errorMessage = err.message || 'Delete failed.';
    if (errorMessage.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete: This rule is in use.';
    }
    req.flash('error', errorMessage);
    res.redirect('/firewall/rule');
  }
};

firewallController.exportRuleList = async (req, res) => {
  try {
    // Parse filters (reuse logic from ruleList)
    const search = req.query.search ? req.query.search.trim() : '';
    let ou_id = req.query.ou_id;
    if (ou_id && ou_id !== '') ou_id = parseInt(ou_id, 10);
    if (isNaN(ou_id)) ou_id = undefined;
    let violation_type = req.query.violation_type || '';
    if (violation_type === '') violation_type = undefined;
    let status = req.query.status || '';
    if (status === '') status = undefined;
    let tags = req.query['tags[]'] || req.query.tags || [];
    if (typeof tags === 'string') tags = [tags];
    tags = tags.map(t => parseInt(t, 10)).filter(t => !isNaN(t));
    if (tags.length === 0) tags = undefined;
    let contacts = req.query['contacts[]'] || req.query.contacts || [];
    if (typeof contacts === 'string') contacts = [contacts];
    contacts = contacts.map(c => parseInt(c, 10)).filter(c => !isNaN(c));
    if (contacts.length === 0) contacts = undefined;

    // Get all filtered rules (no pagination)
    const { rules: ruleList } = await RuleFirewall.findAll({
      search, page: 1, pageSize: 10000, ou_id, contacts, tags, violation_type, status
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Firewall Rules');
    worksheet.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: 'Firewall Name', key: 'firewall_name', width: 18 },
      { header: 'Rule Name', key: 'rulename', width: 25 },
      { header: 'Source Zone', key: 'src_zone', width: 18 },
      { header: 'Source', key: 'src', width: 18 },
      { header: 'Source Detail', key: 'src_detail', width: 22 },
      { header: 'Destination Zone', key: 'dst_zone', width: 18 },
      { header: 'Destination', key: 'dst', width: 18 },
      { header: 'Destination Detail', key: 'dst_detail', width: 22 },
      { header: 'Service', key: 'services', width: 14 },
      { header: 'Application', key: 'application', width: 16 },
      { header: 'URL', key: 'url', width: 20 },
      { header: 'Action', key: 'action', width: 10 },
      { header: 'OU (Unit)', key: 'ou_name', width: 18 },
      { header: 'Contacts', key: 'contacts', width: 28 },
      { header: 'Violation Type', key: 'violation_type', width: 22 },
      { header: 'Violation Detail', key: 'violation_detail', width: 28 },
      { header: 'Solution Proposal', key: 'solution_proposal', width: 28 },
      { header: 'Solution Confirm', key: 'solution_confirm', width: 28 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Work Order', key: 'work_order', width: 18 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Tags', key: 'tags', width: 24 },
      { header: 'Created At', key: 'created_at', width: 20 },
      { header: 'Updated At', key: 'updated_at', width: 20 },
      { header: 'Updated By', key: 'updated_by', width: 16 }
    ];
    ruleList.forEach((rule, idx) => {
      worksheet.addRow({
        idx: idx + 1,
        firewall_name: rule.firewall_name || '',
        rulename: rule.rulename,
        src_zone: rule.src_zone || '',
        src: rule.src,
        src_detail: rule.src_detail || '',
        dst_zone: rule.dst_zone || '',
        dst: rule.dst,
        dst_detail: rule.dst_detail || '',
        services: rule.services || '',
        application: rule.application || '',
        url: rule.url || '',
        action: rule.action || '',
        ou_name: rule.ou_name || '',
        contacts: (rule.contacts && rule.contacts.length > 0)
          ? rule.contacts.map(c => c.name + (c.email ? ' (' + c.email + ')' : '')).join(', ') : '',
        violation_type: rule.violation_type || '',
        violation_detail: rule.violation_detail || '',
        solution_proposal: rule.solution_proposal || '',
        solution_confirm: rule.solution_confirm || '',
        status: rule.status || '',
        work_order: rule.work_order || '',
        description: rule.description || '',
        tags: (rule.tagNames && rule.tagNames.length > 0) ? rule.tagNames.join(', ') : '',
        created_at: rule.created_at ? (rule.created_at.toLocaleString ? rule.created_at.toLocaleString() : rule.created_at) : '',
        updated_at: rule.updated_at ? (rule.updated_at.toLocaleString ? rule.updated_at.toLocaleString() : rule.updated_at) : '',
        updated_by: rule.updated_by || ''
      });
    });
    worksheet.getRow(1).font = { bold: true };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="firewall_rules_export.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).send('Export error: ' + err.message);
  }
};

// Batch update work_order for selected rules
firewallController.batchUpdateWorkOrder = async (req, res) => {
  //console.log("xxxx");
  try {
    
    const { ids, work_order } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No rules selected.' });
    }
    if (!work_order || typeof work_order !== 'string' || !work_order.trim()) {
      return res.status(400).json({ error: 'Work Order is required.' });
    }
    const updated_by = req.session && req.session.user ? req.session.user.username : null;
    const updatedCount = await RuleFirewall.updateManyWorkOrder(ids, work_order.trim(), updated_by);
    if (updatedCount > 0) {

      //console.log('Batch update WO for IDs:', ids, 'Work Order:', work_order, 'Updated By:', updated_by);
      return res.json({ success: true, message: 'Work Order updated successfully!' });
    } else {
      return res.status(400).json({ error: 'No rules were updated. Please check your selection.' });
    }

  } catch (err) {
    //console.error('Batch update WO error:', err);
    // Notify user of failure
    return res.status(500).json({ error: 'Failed to update Work Order. Please try again.' });
  }
};

export default firewallController;
