// src/controllers/firewallController.js
import { config, pool } from '../../config/config.js';
import RuleFirewall from '../models/RuleFirewall.js';
import Configuration from '../models/Configuration.js';
import Unit from '../models/Unit.js';
import Contact from '../models/Contact.js';
import Tag from '../models/Tag.js';
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
    let filterUnitId = req.query.ou_id;
    if (filterUnitId && filterUnitId !== '') filterUnitId = parseInt(filterUnitId, 10);
    if (isNaN(filterUnitId)) filterUnitId = undefined;
    let filterViolationType = req.query.violation_type || '';
    if (filterViolationType === '') filterViolationType = undefined;
    let filterStatus = req.query.status || '';
    if (filterStatus === '') filterStatus = undefined;
    // Multi-select: tags, contacts
    let filterTagIds = req.query['tags[]'] || req.query.tags || [];
    if (typeof filterTagIds === 'string') filterTagIds = [filterTagIds];
    filterTagIds = Array.isArray(filterTagIds) ? filterTagIds : [];
    filterTagIds = filterTagIds.map(t => parseInt(t, 10)).filter(t => !isNaN(t));
    if (!Array.isArray(filterTagIds)) filterTagIds = [];
    if (filterTagIds.length === 0) filterTagIds = [];
    let filterContactIds = req.query['contacts[]'] || req.query.contacts || [];
    if (typeof filterContactIds === 'string') filterContactIds = [filterContactIds];
    filterContactIds = Array.isArray(filterContactIds) ? filterContactIds : [];
    filterContactIds = filterContactIds.map(c => parseInt(c, 10)).filter(c => !isNaN(c));
    if (!Array.isArray(filterContactIds)) filterContactIds = [];
    if (filterContactIds.length === 0) filterContactIds = [];
    let filterFirewallName = req.query.firewall_name || '';
    if (filterFirewallName === '') filterFirewallName = undefined;
    // Parse audit_batch filter
    let filterAuditBatch = req.query.audit_batch || '';
    if (filterAuditBatch === '') filterAuditBatch = undefined;


    // --- Call model with filters (optimized aggregation) ---
    const ruleList = await RuleFirewall.findFilteredList({
      search, page, pageSize, ou_id: filterUnitId, contacts: filterContactIds, tags: filterTagIds, violation_type: filterViolationType, status: filterStatus, firewall_name: filterFirewallName, audit_batch: filterAuditBatch
    });
    const totalCount = await RuleFirewall.countFiltered({
      search, ou_id: filterUnitId, contacts: filterContactIds, tags: filterTagIds, violation_type: filterViolationType, status: filterStatus, firewall_name: filterFirewallName, audit_batch: filterAuditBatch
    });
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    // --- Fetch display names for selected filters (for select2 persistence) ---
    // --- Prepare selected values for select2 persistence ---
    let selectedUnit = '';
    if (filterUnitId) {
      const unit = await Unit.findById(filterUnitId);
      if (unit) selectedUnit = unit.name;
    }
    let selectedTags = [];
    if (Array.isArray(filterTagIds) && filterTagIds.length > 0) {
      const tagList = await Tag.findByIds(filterTagIds);
      selectedTags = filterTagIds.map(tid => {
        const found = tagList.find(r => r.id === tid);
        return found ? found.name : '';
      });
    }
    let selectedContacts = [];
    if (Array.isArray(filterContactIds) && filterContactIds.length > 0) {
      const contactList = await Contact.findByIds(filterContactIds);
      selectedContacts = filterContactIds.map(cid => {
        const found = contactList.find(c => c.id === cid);
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
      firewall_name: filterFirewallName,
      // Pass filter values for modal persistence
      filterUnitId,
      selectedUnit,
      filterTagIds: Array.isArray(filterTagIds) ? filterTagIds : [],
      selectedTags: Array.isArray(selectedTags) ? selectedTags : [],
      filterContactIds: Array.isArray(filterContactIds) ? filterContactIds : [],
      selectedContacts: Array.isArray(selectedContacts) ? selectedContacts : [],
      violation_type: filterViolationType,
      status: filterStatus,
      audit_batch: filterAuditBatch,
      title: 'Firewall Rule',
      activeMenu: 'firewall-rule'
    });
  } catch (err) {
    res.status(500).send('Error loading firewall rules: ' + err.message);
  }
};

firewallController.addRule = async (req, res) => {
  try {
    // Extract fields from request body (similar to User.create approach)
    const {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, 'contacts[]': contactsArr, 'tags[]': tagsArr, 
      firewall_name, work_order, audit_batch
    } = req.body;

    // Normalize and trim input fields (like User.create)
    const normRulename = rulename ? rulename.trim() : '';
    const normSrcZone = src_zone ? src_zone.trim() : '';
    const normSrc = src ? src.trim() : '';
    const normSrcDetail = src_detail ? src_detail.trim() : '';
    const normDstZone = dst_zone ? dst_zone.trim() : '';
    const normDst = dst ? dst.trim() : '';
    const normDstDetail = dst_detail ? dst_detail.trim() : '';
    const normServices = services ? services.trim() : '';
    const normApplication = application ? application.trim() : '';
    const normUrl = url ? url.trim() : '';
    const normAction = action ? action.trim() : '';
    const normStatus = status ? status.trim() : '';
    const normViolationType = violation_type ? violation_type.trim() : '';
    const normViolationDetail = violation_detail ? violation_detail.trim() : '';
    const normSolutionProposal = solution_proposal ? solution_proposal.trim() : '';
    const normSolutionConfirm = solution_confirm ? solution_confirm.trim() : '';
    const normDescription = description ? description.trim() : '';
    const normFirewallName = firewall_name ? firewall_name.trim() : '';
    const normWorkOrder = work_order ? work_order.trim() : '';
    const normAuditBatch = audit_batch ? audit_batch.trim() : '';

    // Validate required fields
    if (!normRulename || !normSrc || !normDst || !normAction) {
      req.flash('error', 'Missing required fields: Rule Name, Source, Destination, Action');
      return res.redirect('/firewall/rule');
    }

    // Normalize ou_id
    const normOuId = ou_id && ou_id !== '' ? parseInt(ou_id, 10) : null;
    if (ou_id && isNaN(normOuId)) {
      req.flash('error', 'Invalid OU ID');
      return res.redirect('/firewall/rule');
    }

    // Normalize array fields
    let normContacts = Array.isArray(contactsArr) ? contactsArr : (contacts || []);
    let normTags = Array.isArray(tagsArr) ? tagsArr : (tags || []);
    
    if (!Array.isArray(normContacts)) normContacts = [normContacts];
    normContacts = normContacts
      .map(c => parseInt(c, 10))
      .filter(c => !isNaN(c));
      
    if (!Array.isArray(normTags)) normTags = [normTags];
    normTags = normTags
      .map(t => parseInt(t, 10))
      .filter(t => !isNaN(t));
    // Validate action, status, violation_type against config
    const allowedActions = firewallConfig.actionsOptions.map(a => a.value);
    if (!allowedActions.includes(normAction)) {
      req.flash('error', 'Invalid action value.');
      return res.redirect('/firewall/rule');
    }
    const allowedStatus = firewallConfig.statusOptions.map(s => s.value);
    if (normStatus && !allowedStatus.includes(normStatus)) {
      req.flash('error', 'Invalid status value.');
      return res.redirect('/firewall/rule');
    }
    const allowedViolationTypes = firewallConfig.violationTypeOptions.map(v => v.value);
    if (normViolationType && !allowedViolationTypes.includes(normViolationType)) {
      req.flash('error', 'Invalid violation type value.');
      return res.redirect('/firewall/rule');
    }
    const allowedFirewallNames = firewallConfig.firewallNameOptions.map(f => f.value);
    if (!normFirewallName || !allowedFirewallNames.includes(normFirewallName)) {
      req.flash('error', 'Invalid or missing firewall name.');
      return res.redirect('/firewall/rule');
    }

    // Process audit_batch: normalize and validate format
    let auditBatchStr = '';
    if (normAuditBatch && normAuditBatch.length > 0) {
      const batches = normAuditBatch.split(',').map(v => v.trim()).filter(v => v.length > 0);
      const valid = batches.every(batch => /^\d{4}-0[12]$/.test(batch));
      if (!valid) {
        req.flash('error', 'Each audit batch must be in the format yyyy-01 or yyyy-02, separated by commas.');
        return res.redirect('/firewall/rule');
      }
      auditBatchStr = batches.join(',');
    }

    // Compose base rule data (only basic fields, not relations)
    let baseRuleData = {
      rulename: normRulename,
      src_zone: normSrcZone || null,
      src: normSrc,
      src_detail: normSrcDetail || null,
      dst_zone: normDstZone || null,
      dst: normDst,
      dst_detail: normDstDetail || null,
      services: normServices || null,
      application: normApplication || null,
      url: normUrl || null,
      action: normAction,
      ou_id: normOuId,
      status: normStatus || null,
      violation_type: normViolationType || null,
      violation_detail: normViolationDetail || null,
      solution_proposal: normSolutionProposal || null,
      solution_confirm: normSolutionConfirm || null,
      description: normDescription || null,
      firewall_name: normFirewallName,
      work_order: normWorkOrder || null,
      audit_batch: auditBatchStr,
      updated_by: req.session && req.session.user ? req.session.user.username : null
    };
    // Data already normalized above, no need to normalize again


    // Transactional create and set relations (simple, like systemController)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const newRuleId = await RuleFirewall.create(baseRuleData, client);
      // Always set relations, even if empty (to ensure no stale relations)
      if (newRuleId) {
        await RuleFirewall.setContacts(newRuleId, normContacts, client);
        await RuleFirewall.setTags(newRuleId, normTags, client);
      }
      await client.query('COMMIT');
      req.flash('success', 'Rule added successfully!');
      return res.redirect('/firewall/rule');
    } catch (err) {
      console.error('[ERROR] Exception in addRule:', err);
      await client.query('ROLLBACK');
      req.flash('error', 'Error adding rule: ' + err.message);
      return res.redirect('/firewall/rule');
    } finally {
      client.release();
    }
  } catch (err) {
    req.flash('error', 'Error adding rule: ' + err.message);
    res.redirect('/firewall/rule');
  }
};



firewallController.editRule = async (req, res) => {
  const id = req.params.id;
  try {
    const current = await RuleFirewall.findById(id);
    if (!current) {
      req.flash('error', 'Rule not found.');
      return res.redirect('/firewall/rule');
    }
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
        req.flash('error', 'Each audit batch must be in the format yyyy-01 or yyyy-02, separated by commas.');
        return res.redirect('/firewall/rule');
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
    } else if ('ou_id' in req.body) {
      ou_id = null;
    }
    // Validate required fields
    if (!rulename || !src || !dst || !action || !firewall_name) {
      req.flash('error', 'Missing required fields: Rule Name, Source, Destination, Action, Firewall Name');
      return res.redirect('/firewall/rule');
    }
    // Validate enums
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
    if (!allowedFirewallNames.includes(firewall_name)) {
      req.flash('error', 'Invalid firewall name value.');
      return res.redirect('/firewall/rule');
    }
    // Transactional update and set relations
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await RuleFirewall.update(id, {
        firewall_name, rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
        services, application, url, action, ou_id, status, violation_type,
        violation_detail, solution_proposal, solution_confirm, description,
        work_order, audit_batch: auditBatchStr,
        updated_by: req.session && req.session.user ? req.session.user.username : current.updated_by
      }, client);
      await RuleFirewall.setContacts(id, contacts, client);
      await RuleFirewall.setTags(id, tags, client);
      await client.query('COMMIT');
      req.flash('success', 'Rule updated successfully!');
      res.redirect('/firewall/rule');
    } catch (err) {
      await client.query('ROLLBACK');
      req.flash('error', 'Failed to update rule: ' + err.message);
      res.redirect('/firewall/rule');
    } finally {
      client.release();
    }
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
        contacts: Array.isArray(rule.contacts) && rule.contacts.length > 0
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
