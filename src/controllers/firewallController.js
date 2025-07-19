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
      // Create rule
      const newRule = await RuleFirewall.create(baseRuleData, client);
      // Set relations
      if (newRule && newRule.id) {
        if (normContacts && normContacts.length > 0) {
          await RuleFirewall.setContacts(newRule.id, normContacts, client);
        }
        if (normTags && normTags.length > 0) {
          await RuleFirewall.setTags(newRule.id, normTags, client);
        }
      }
      await client.query('COMMIT');
      req.flash('success', 'Rule added successfully!');
      return res.redirect('/firewall/rule');
    } catch (err) {
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
    // Extract fields from request body (same normalization as addRule)
    const {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, 'contacts[]': contactsArr, 'tags[]': tagsArr,
      firewall_name, work_order, audit_batch
    } = req.body;


    // ...existing code...
    // Remove all normalization logic and usage in editRule
    // Directly use req.body fields, assuming they are already normalized as per previous refactor
    // Compose ruleData from req.body
    let ruleData = {
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
      ou_id: ou_id && ou_id !== '' ? parseInt(ou_id, 10) : null,
      status,
      violation_type,
      violation_detail,
      solution_proposal,
      solution_confirm,
      description,
      contacts: Array.isArray(req.body['contacts[]']) ? req.body['contacts[]'].map(c => parseInt(c, 10)).filter(c => !isNaN(c)) : [],
      tags: Array.isArray(req.body['tags[]']) ? req.body['tags[]'].map(t => parseInt(t, 10)).filter(t => !isNaN(t)) : [],
      firewall_name,
      work_order,
      audit_batch,
      updated_by: req.session && req.session.user ? req.session.user.username : null
    };

    // Transactional update and set relations
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await RuleFirewall.update(id, ruleData, client);
      // Set relations
      if (id) {
        if (ruleData.contacts && ruleData.contacts.length > 0) {
          await RuleFirewall.setContacts(id, ruleData.contacts, client);
        }
        if (ruleData.tags && ruleData.tags.length > 0) {
          await RuleFirewall.setTags(id, ruleData.tags, client);
        }
      }
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
