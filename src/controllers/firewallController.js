// src/controllers/firewallController.js
import { config, pool } from '../../config/config.js';
import RuleFirewall from '../models/RuleFirewall.js';
import Configuration from '../models/Configuration.js';
import Unit from '../models/Unit.js';
import Contact from '../models/Contact.js';
import Tag from '../models/Tag.js';
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to sanitize string input
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

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
    options = [
      { value: 'ALLOW', label: 'Allow' },
      { value: 'DENY', label: 'Deny' }
    ];
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
  // Return empty array if no config found instead of fallback options
  return options;
}

async function getViolationTypeOptionsFromConfig() {
  let options = [];
  try {
    const config = await Configuration.findById('firewall_rule_violation_type');
    if (config && config.value) {
      let parsed;
      try { 
        // Fix single quotes to double quotes for valid JSON
        const fixedValue = config.value.replace(/'/g, '"');
        parsed = JSON.parse(fixedValue); 
      } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        options = parsed.map(item => {
          if (typeof item === 'object' && item !== null && item.value && item.label) {
            return item; // Keep as is if it's already a proper object
          } else {
            return { value: String(item), label: String(item) };
          }
        });
      }
    }
  } catch (e) { options = []; }
  // Return empty array if no config found instead of fallback options
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
  actionsOptions: await getActionsOptionsFromConfig(),
  statusOptions: await getStatusOptionsFromConfig(),
  violationTypeOptions: await getViolationTypeOptionsFromConfig(),
  firewallNameOptions: await getFirewallNameOptionsFromConfig(),
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
    if (!normRulename || !normSrc || !normDst || !normAction || !normAuditBatch) {
      req.flash('error', 'Missing required fields: Rule Name, Source, Destination, Action, Audit Batch');
      return res.redirect('/firewall/rule');
    }

    // Validate audit batch format (YYYY-MM)
    const auditBatchPattern = /^\d{4}-\d{2}$/;
    if (!auditBatchPattern.test(normAuditBatch)) {
      req.flash('error', 'Audit Batch must be in format YYYY-MM (e.g., 2024-01)');
      return res.redirect('/firewall/rule');
    }

    // Additional validation for valid month (01-12)
    const parts = normAuditBatch.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    if (month < 1 || month > 12) {
      req.flash('error', 'Audit Batch month must be between 01 and 12');
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
  const allowedActions = (await getActionsOptionsFromConfig()).map(a => a.value);
    if (!allowedActions.includes(normAction)) {
      req.flash('error', 'Invalid action value.');
      return res.redirect('/firewall/rule');
    }
  const allowedStatus = (await getStatusOptionsFromConfig()).map(s => s.value);
    if (normStatus && !allowedStatus.includes(normStatus)) {
      req.flash('error', 'Invalid status value.');
      return res.redirect('/firewall/rule');
    }
  const allowedViolationTypes = (await getViolationTypeOptionsFromConfig()).map(v => v.value);
    if (normViolationType && !allowedViolationTypes.includes(normViolationType)) {
      req.flash('error', 'Invalid violation type value.');
      return res.redirect('/firewall/rule');
    }
  const allowedFirewallNames = (await getFirewallNameOptionsFromConfig()).map(f => f.value);
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
    // Normalize and validate audit_batch
    let auditBatchStr = '';
    if (typeof audit_batch === 'string' && audit_batch.length > 0) {
      auditBatchStr = audit_batch.trim();
      // Validate audit batch format (YYYY-MM)
      const auditBatchPattern = /^\d{4}-\d{2}$/;
      if (!auditBatchPattern.test(auditBatchStr)) {
        req.flash('error', 'Audit Batch must be in format YYYY-MM (e.g., 2024-01)');
        return res.redirect('/firewall/rule');
      }
      // Additional validation for valid month (01-12)
      const parts = auditBatchStr.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      if (month < 1 || month > 12) {
        req.flash('error', 'Audit Batch month must be between 01 and 12');
        return res.redirect('/firewall/rule');
      }
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
  const allowedActions = (await getActionsOptionsFromConfig()).map(a => a.value);
    if (!allowedActions.includes(action)) {
      req.flash('error', 'Invalid action value.');
      return res.redirect('/firewall/rule');
    }
  const allowedStatus = (await getStatusOptionsFromConfig()).map(s => s.value);
    if (status && !allowedStatus.includes(status)) {
      req.flash('error', 'Invalid status value.');
      return res.redirect('/firewall/rule');
    }
  const allowedViolationTypes = (await getViolationTypeOptionsFromConfig()).map(v => v.value);
    if (violation_type && !allowedViolationTypes.includes(violation_type)) {
      req.flash('error', 'Invalid violation type value.');
      return res.redirect('/firewall/rule');
    }
  const allowedFirewallNames = (await getFirewallNameOptionsFromConfig()).map(f => f.value);
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
    
    // Parse firewall_name and audit_batch filters
    let firewall_name = req.query.firewall_name || '';
    if (firewall_name === '') firewall_name = undefined;
    let audit_batch = req.query.audit_batch || '';
    if (audit_batch === '') audit_batch = undefined;

    // Get all filtered rules (no pagination)
    const ruleList = await RuleFirewall.findFilteredList({
      search, page: 1, pageSize: 10000, ou_id, contacts, tags, violation_type, status, firewall_name, audit_batch
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
    
    // Write to buffer first, then send
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Export error: ' + err.message);
  }
};

// Batch update work_order for selected rules
firewallController.batchUpdateWorkOrder = async (req, res) => {
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

// Download firewall rule template
firewallController.downloadRuleTemplate = async (req, res) => {
  try {
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Firewall Rule Template');
    
    // Add headers with descriptions
    worksheet.addRow([
      'Audit Batch (Required)',
      'Firewall Name (Required)',
      'Rule Name (Required)',
      'Source Zone',
      'Source (Required)',
      'Source Detail',
      'Destination Zone',
      'Destination (Required)',
      'Destination Detail',
      'Services',
      'Application',
      'URL',
      'Action (Required)',
      'Violation Type',
      'Violation Detail',
      'OU Name',
      'Contacts (comma-separated emails)',
      'Solution Proposal',
      'Solution Confirm',
      'Work Order',
      'Status',
      'Description',
      'Tags (comma-separated IDs)'
    ]);
    
    // Add sample data
    worksheet.addRow([
      '2024-01',
      'FW-001',
      'Rule-001',
      'DMZ',
      '192.168.1.0/24',
      'DMZ Network',
      'LAN',
      '10.0.0.0/8',
      'Internal Network',
      'HTTP,HTTPS',
      'Web Browser',
      'https://company.com',
      'ALLOW',
      'POLICY',
      'Standard web traffic',
      'IT Department',
      'admin@company.com, support@company.com',
      'Allow web traffic from DMZ to LAN',
      'Approved by IT Manager',
      'WO-001',
      'Active',
      'Allow DMZ to LAN HTTP/HTTPS traffic for web applications',
      'web, dmz, lan'
    ]);
    
    // Add another sample
    worksheet.addRow([
      '2024-02',
      'FW-002',
      'Rule-002',
      'LAN',
      '10.0.0.0/8',
      'Internal Network',
      'DMZ',
      '192.168.1.0/24',
      'DMZ Network',
      'HTTPS',
      'Web Browser',
      'https://secure.company.com',
      'ALLOW',
      'CONFIG',
      'Secure web access',
      'Security Team',
      'security@company.com, admin',
      'Allow secure web access from LAN to DMZ',
      'Approved by Security Team',
      'WO-002',
      'Active',
      'Allow LAN to DMZ HTTPS traffic for secure web applications',
      'secure, lan, dmz'
    ]);
    
    // Add sample with violation
    worksheet.addRow([
      '2024-03',
      'FW-003',
      'Rule-003',
      'Internet',
      '0.0.0.0/0',
      'Public Internet',
      'DMZ',
      '192.168.1.100',
      'DMZ Server',
      'SSH',
      'SSH Client',
      '',
      'DENY',
      'POLICY',
      'Direct SSH access from Internet',
      'Network Security Team',
      'security@company.com, network@company.com',
      'Block direct SSH access from Internet',
      'Security policy violation - direct SSH access',
      'WO-003',
      'Inactive',
      'Block direct SSH access from Internet to DMZ server',
      'security, internet, ssh'
    ]);
    
    // Set column widths
    worksheet.columns = [
      { width: 12 },  // Audit Batch
      { width: 18 },  // Firewall Name
      { width: 25 },  // Rule Name
      { width: 15 },  // Source Zone
      { width: 18 },  // Source
      { width: 18 },  // Source Detail
      { width: 15 },  // Destination Zone
      { width: 18 },  // Destination
      { width: 18 },  // Destination Detail
      { width: 15 },  // Services
      { width: 15 },  // Application
      { width: 20 },  // URL
      { width: 10 },  // Action
      { width: 15 },  // Violation Type
      { width: 25 },  // Violation Detail
      { width: 20 },  // OU Name
      { width: 30 },  // Contacts
      { width: 25 },  // Solution Proposal
      { width: 25 },  // Solution Confirm
      { width: 15 },  // Work Order
      { width: 10 },  // Status
      { width: 30 },  // Description
      { width: 20 }   // Tags
    ];
    
    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    
    // Create temp directory if not exists
    const uploadsDir = process.env.UPLOADS_DIR || 'uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, 'temp_firewall_rule_template.xlsx');
    
    try {
    await workbook.xlsx.writeFile(tempPath);
    } catch (writeError) {
      console.error('Error writing Excel file:', writeError);
      return res.status(500).json({ error: 'Error creating template file: ' + writeError.message });
    }
    
    // Check if file exists and get size
    if (fs.existsSync(tempPath)) {
      const stats = fs.statSync(tempPath);
      console.log('Template file created successfully:', tempPath, 'Size:', stats.size, 'bytes');
      
      // Set response headers for Excel file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="firewall_rule_template.xlsx"');
      res.setHeader('Content-Length', stats.size);
      
      // Send file directly as buffer
      const fileBuffer = fs.readFileSync(tempPath);
      res.send(fileBuffer);
        
        // Clean up template file after download
        setTimeout(() => {
          try {
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
          } catch (cleanupErr) {
            console.error('Error cleaning up template file:', cleanupErr);
          }
        }, 5000); // 5 seconds delay
    } else {
      res.status(500).json({ error: 'Template file could not be created' });
    }
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Error creating template: ' + err.message });
  }
};


// Validate firewall rule import file
firewallController.validateImportRules = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select a file to validate.' });
    }

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    let rows = [];
    

    // Parse file based on extension
    const ext = path.extname(originalFileName).toLowerCase();
    let headers = [];
    
    try {
    if (ext === '.csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          return res.status(400).json({ error: 'No worksheet found in Excel file. Please download the template and use the correct format.' });
        }
        
        
        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        headers = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers.push(cell.value || '');
        });
        
        if (headers.length === 0) {
          return res.status(400).json({ error: 'No headers found in Excel file. Please download the template and use the correct format.' });
        }
        
        // Get data rows
        let rowCount = 0;
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber > 1) { // Skip header row
            const rowData = {};
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
              const header = headers[colNumber - 1];
              if (header) {
                rowData[header] = cell.value || '';
              }
            });
            rows.push(rowData);
            rowCount++;
          }
        });
        
        
        if (rowCount === 0) {
          return res.status(400).json({ error: 'File must contain at least one data row. Please download the template and add your data.' });
        }
        
    } else {
        return res.status(400).json({ error: 'Unsupported file format. Please use Excel (.xlsx) or CSV files. Download the template for the correct format.' });
      }
    } catch (parseError) {
      console.error('Error parsing file:', parseError);
      return res.status(400).json({ error: 'Error parsing file: ' + parseError.message + '. Please download the template and use the correct format.' });
    }

    // Validate file format - check required columns
    const requiredColumnMapping = {
      'audit_batch': 'Audit Batch (Required)',
      'firewall_name': 'Firewall Name (Required)', 
      'rulename': 'Rule Name (Required)',
      'src': 'Source (Required)',
      'dst': 'Destination (Required)',
      'action': 'Action (Required)'
    };
    
    const missingColumns = [];
    for (const [shortName, longName] of Object.entries(requiredColumnMapping)) {
      if (!headers.includes(longName)) {
        missingColumns.push(longName);
      }
    }
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}. Please download the template and fill in all required information.`,
        details: {
          type: 'missing_columns',
          missingColumns: missingColumns,
          suggestion: 'Please download a new template using the "Download Template" button and use the correct format.'
        }
      });
    }



    // Check for extra columns (using full Excel header names)
    const allowedColumnMapping = {
      'Audit Batch (Required)': 'audit_batch',
      'Firewall Name (Required)': 'firewall_name',
      'Rule Name (Required)': 'rulename',
      'Source Zone': 'src_zone',
      'Source (Required)': 'src',
      'Source Detail': 'src_detail',
      'Destination Zone': 'dst_zone',
      'Destination (Required)': 'dst',
      'Destination Detail': 'dst_detail',
      'Services': 'services',
      'Application': 'application',
      'URL': 'url',
      'Action (Required)': 'action',
      'Violation Type': 'violation_type',
      'Violation Detail': 'violation_detail',
      'OU Name': 'ou_name',
      'Contacts (comma-separated emails)': 'contacts',
      'Solution Proposal': 'solution_proposal',
      'Solution Confirm': 'solution_confirm',
      'Work Order': 'work_order',
      'Status': 'status',
      'Description': 'description',
      'Tags (comma-separated IDs)': 'tags'
    };
    
    const allowedHeaders = Object.keys(allowedColumnMapping);
    const extraColumns = headers.filter(col => !allowedHeaders.includes(col));
    if (extraColumns.length > 0) {
      return res.status(400).json({ 
        error: `Extra columns not allowed: ${extraColumns.join(', ')}. Please use the correct template.`,
        details: {
          type: 'extra_columns',
          extraColumns: extraColumns,
          suggestion: 'Please download a new template using the "Download Template" button and only fill in the existing columns.'
        }
      });
    }
    
    // Check column order (must match template order)
    const expectedOrder = [
      'Audit Batch (Required)',
      'Firewall Name (Required)',
      'Rule Name (Required)',
      'Source Zone',
      'Source (Required)',
      'Source Detail',
      'Destination Zone',
      'Destination (Required)',
      'Destination Detail',
      'Services',
      'Application',
      'URL',
      'Action (Required)',
      'Violation Type',
      'Violation Detail',
      'OU Name',
      'Contacts (comma-separated emails)',
      'Solution Proposal',
      'Solution Confirm',
      'Work Order',
      'Status',
      'Description',
      'Tags (comma-separated IDs)'
    ];
    
    // Check if headers match expected order
    const orderMismatch = [];
    for (let i = 0; i < Math.min(headers.length, expectedOrder.length); i++) {
      if (headers[i] !== expectedOrder[i]) {
        orderMismatch.push({
          position: i + 1,
          expected: expectedOrder[i],
          actual: headers[i]
        });
      }
    }
    
    if (orderMismatch.length > 0) {
      const firstMismatch = orderMismatch[0];
      return res.status(400).json({
        error: `Column order is incorrect. Column ${firstMismatch.position} should be "${firstMismatch.expected}" but found "${firstMismatch.actual}".`,
        details: {
          type: 'column_order_mismatch',
          orderMismatch: orderMismatch,
          suggestion: 'Please download a new template using the "Download Template" button and do not change the column order.'
        }
      });
    }

    // Get configuration options for validation
    console.log('Loading configuration options...');
    let actionsOptions, statusOptions, violationTypeOptions, firewallNameOptions;
    try {
      [actionsOptions, statusOptions, violationTypeOptions, firewallNameOptions] = await Promise.all([
      getActionsOptionsFromConfig(),
      getStatusOptionsFromConfig(),
      getViolationTypeOptionsFromConfig(),
      getFirewallNameOptionsFromConfig()
    ]);
      console.log('Configuration options loaded:', {
        actions: actionsOptions?.length || 0,
        status: statusOptions?.length || 0,
        violationType: violationTypeOptions?.length || 0,
        firewallName: firewallNameOptions?.length || 0
      });
    } catch (configError) {
      console.error('Error loading configuration options:', configError);
      return res.status(400).json({ error: 'Error loading configuration options: ' + configError.message });
    }

    // Models are already imported at the top of the file
    console.log('Using imported Unit and Contact models');

    // Ensure all options are arrays
    const safeActionsOptions = Array.isArray(actionsOptions) ? actionsOptions : [];
    const safeStatusOptions = Array.isArray(statusOptions) ? statusOptions : [];
    const safeViolationTypeOptions = Array.isArray(violationTypeOptions) ? violationTypeOptions : [];
    const safeFirewallNameOptions = Array.isArray(firewallNameOptions) ? firewallNameOptions : [];

    const allowedActions = safeActionsOptions.map(a => a.value);
    const allowedStatus = safeStatusOptions.map(s => s.value);
    const allowedViolationTypes = safeViolationTypeOptions.map(v => v.value);
    const allowedFirewallNames = safeFirewallNameOptions.map(f => f.value);

    // Validate each row
    const validationResults = [];
    try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 2, // +2 because we start from row 2 (after header)
        audit_batch: row['Audit Batch (Required)'] || '',
        firewall_name: row['Firewall Name (Required)'] || '',
        rulename: row['Rule Name (Required)'] || '',
        src: row['Source (Required)'] || '',
        dst: row['Destination (Required)'] || '',
        action: row['Action (Required)'] || '',
        status: row['Status'] || '',
        violation_type: row['Violation Type'] || '',
        ou_name: row['OU Name'] || '',
        contacts: row['Contacts (comma-separated emails)'] || '',
        validation_status: 'PASS',
        validation_reason: ''
      };

      // Validate required fields
      if (!result.audit_batch) {
        result.validation_status = 'FAIL';
        result.validation_reason = 'Audit Batch is required';
      } else {
        // Validate audit batch format (YYYY-MM)
        const auditBatchPattern = /^\d{4}-\d{2}$/;
        if (!auditBatchPattern.test(result.audit_batch)) {
          result.validation_status = 'FAIL';
          result.validation_reason = `Invalid Audit Batch: ${result.audit_batch}`;
        } else {
          // Additional validation for valid month (01-12)
          const parts = result.audit_batch.split('-');
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          if (month < 1 || month > 12) {
            result.validation_status = 'FAIL';
            result.validation_reason = `Invalid Audit Batch: ${result.audit_batch}`;
          }
        }
      }

      // Validate all required fields regardless of previous validation status
      const validationErrors = [];
      
      // Collect all validation errors
      if (!result.firewall_name) {
        validationErrors.push('Firewall Name is required');
      }
      if (!result.rulename) {
        validationErrors.push('Rule Name is required');
      }
      if (!result.src) {
        validationErrors.push('Source is required');
      }
      if (!result.dst) {
        validationErrors.push('Destination is required');
      }
      if (!result.action) {
        validationErrors.push('Action is required');
      }
      
      // Set validation status and reason based on all errors
      if (validationErrors.length > 0) {
        result.validation_status = 'FAIL';
        result.validation_reason = validationErrors.join('; ');
      }

        // Validate firewall name against allowed values
        if (allowedFirewallNames.length > 0 && result.firewall_name && !allowedFirewallNames.includes(result.firewall_name)) {
          if (result.validation_status === 'PASS') {
            result.validation_status = 'FAIL';
            result.validation_reason = `Invalid Firewall Name: ${result.firewall_name}`;
          } else {
            result.validation_reason += `; Invalid Firewall Name: ${result.firewall_name}`;
          }
        }

        // Validate action against allowed values
        if (allowedActions.length > 0 && result.action && !allowedActions.includes(result.action)) {
          if (result.validation_status === 'PASS') {
            result.validation_status = 'FAIL';
            result.validation_reason = `Invalid Action: ${result.action}`;
          } else {
            result.validation_reason += `; Invalid Action: ${result.action}`;
          }
        }

        // Validate OU Name
        if (result.ou_name) {
          try {
            const unit = await Unit.findByName(result.ou_name);
            if (!unit) {
              if (result.validation_status === 'PASS') {
                result.validation_status = 'FAIL';
                result.validation_reason = `Invalid OU Name: ${result.ou_name}`;
              } else {
                result.validation_reason += `; Invalid OU Name: ${result.ou_name}`;
              }
            } else {
            }
          } catch (err) {
            console.error('OU validation error:', err);
            if (result.validation_status === 'PASS') {
              result.validation_status = 'FAIL';
              result.validation_reason = `Error validating OU: ${err.message}`;
            } else {
              result.validation_reason += `; Error validating OU: ${err.message}`;
            }
          }
        }

        // Validate Contacts
        if (result.contacts) {
          try {
            const contactEmails = result.contacts.split(',').map(email => email.trim()).filter(email => email);
            const contactErrors = [];
            for (const email of contactEmails) {
              const contacts = await Contact.findByEmailSearch(email);
              if (!contacts || contacts.length === 0) {
                contactErrors.push(`Contact not found: ${email}`);
              } else {
              }
            }
            if (contactErrors.length > 0) {
              if (result.validation_status === 'PASS') {
                result.validation_status = 'FAIL';
                result.validation_reason = contactErrors.map(error => error.replace('Contact not found:', 'Invalid Contact:')).join('; ');
              } else {
                result.validation_reason += `; ${contactErrors.map(error => error.replace('Contact not found:', 'Invalid Contact:')).join('; ')}`;
              }
            }
          } catch (err) {
            console.error('Contact validation error:', err);
            if (result.validation_status === 'PASS') {
              result.validation_status = 'FAIL';
              result.validation_reason = `Error validating contacts: ${err.message}`;
            } else {
              result.validation_reason += `; Error validating contacts: ${err.message}`;
            }
          }
      }

      if (result.status && allowedStatus.length > 0 && !allowedStatus.includes(result.status)) {
        if (result.validation_status === 'PASS') {
          result.validation_status = 'FAIL';
          result.validation_reason = `Invalid Status: ${result.status}`;
        } else {
          result.validation_reason += `; Invalid Status: ${result.status}`;
        }
      }

      if (result.violation_type && allowedViolationTypes.length > 0 && !allowedViolationTypes.includes(result.violation_type)) {
        if (result.validation_status === 'PASS') {
          result.validation_status = 'FAIL';
          result.validation_reason = `Invalid Violation Type: ${result.violation_type}`;
        } else {
          result.validation_reason += `; Invalid Violation Type: ${result.violation_type}`;
        }
      }



      validationResults.push(result);
    }
    } catch (validationError) {
      console.error('Error during validation:', validationError);
      return res.status(400).json({ error: 'Error during validation: ' + validationError.message });
    }

    // Return Excel file with validation results
    const totalRows = validationResults.length;
    const passedRows = validationResults.filter(r => r.validation_status === 'PASS').length;
    const failedRows = validationResults.filter(r => r.validation_status === 'FAIL').length;
    const allPassed = failedRows === 0;
    

    // Create Excel file with validation results
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Validation Results');
    
    // Add headers
    worksheet.addRow([
      'Row Number',
      'Audit Batch',
      'Firewall Name', 
      'Rule Name',
      'Source',
      'Destination',
      'Action',
      'Status',
      'Violation Type',
      'OU Name',
      'Contacts',
      'Validation Status',
      'Validation Reason'
    ]);
    
    // Add validation results
    validationResults.forEach(result => {
      worksheet.addRow([
        result.row_number,
        result.audit_batch,
        result.firewall_name,
        result.rulename,
        result.src,
        result.dst,
        result.action,
        result.status,
        result.violation_type,
        result.ou_name,
        result.contacts,
        result.validation_status,
        result.validation_reason
      ]);
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    
    // Set column widths
    worksheet.columns = [
      { width: 12 }, // Row Number
      { width: 15 }, // Audit Batch
      { width: 20 }, // Firewall Name
      { width: 20 }, // Rule Name
      { width: 20 }, // Source
      { width: 20 }, // Destination
      { width: 15 }, // Action
      { width: 15 }, // Status
      { width: 20 }, // Violation Type
      { width: 20 }, // OU Name
      { width: 30 }, // Contacts
      { width: 18 }, // Validation Status
      { width: 50 }  // Validation Reason
    ];
    
    // Create temp file
    const uploadsDir = process.env.UPLOADS_DIR || 'uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, `validation_results_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(tempPath);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="firewall_rule_validation_results.xlsx"');
    res.setHeader('X-Validation-Summary', JSON.stringify({
      totalCount: totalRows,
      passedCount: passedRows,
      failCount: failedRows,
      allPassed
    }));
    
    // Send file directly as buffer
    const fileBuffer = fs.readFileSync(tempPath);
    res.send(fileBuffer);
    
    // Clean up file after download
    setTimeout(() => {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up validation file:', cleanupErr);
      }
    }, 5000);

  } catch (err) {
    console.error('Error validating firewall rule import file:', err);
    console.error('Error stack:', err.stack);
    console.error('Error details:', {
      message: err.message,
      name: err.name,
      code: err.code,
      stack: err.stack
    });
    
    // Clean up uploaded file if it exists
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('Cleaned up uploaded file:', req.file.path);
      }
    } catch (cleanupErr) {
      console.error('Error cleaning up uploaded file:', cleanupErr);
    }
    
    if (!res.headersSent) {
      console.log('Sending error response...');
      res.status(500).json({ 
        error: 'Error validating import file: ' + (err.message || err.toString() || 'Unknown error'),
        details: {
          name: err.name,
          code: err.code,
          stack: err.stack
        }
      });
    }
  }
};

// Import firewall rules
firewallController.importRules = async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select a file to validate.' });
    }

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    let rows = [];

    // Parse file (same logic as validation)
    const ext = path.extname(originalFileName).toLowerCase();
    let headers = [];
    
    if (ext === '.csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        return res.status(400).json({ error: 'File must contain at least a header row and one data row' });
      }
      
      headers = jsonData[0];
      for (let i = 1; i < jsonData.length; i++) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = jsonData[i][index] || '';
        });
        rows.push(row);
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Please use Excel (.xlsx) or CSV files. Download the template for the correct format.' });
    }

    // Validate file format - check required columns
    const requiredColumnMapping = {
      'audit_batch': 'Audit Batch (Required)',
      'firewall_name': 'Firewall Name (Required)', 
      'rulename': 'Rule Name (Required)',
      'src': 'Source (Required)',
      'dst': 'Destination (Required)',
      'action': 'Action (Required)'
    };
    
    const missingColumns = [];
    for (const [shortName, longName] of Object.entries(requiredColumnMapping)) {
      if (!headers.includes(longName)) {
        missingColumns.push(longName);
      }
    }
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}. Please download the template and fill in all required information.`,
        details: {
          type: 'missing_columns',
          missingColumns: missingColumns,
          suggestion: 'Please download a new template using the "Download Template" button and use the correct format.'
        }
      });
    }

    // Check for extra columns (using full Excel header names)
    const allowedColumnMapping = {
      'Audit Batch (Required)': 'audit_batch',
      'Firewall Name (Required)': 'firewall_name',
      'Rule Name (Required)': 'rulename',
      'Source Zone': 'src_zone',
      'Source (Required)': 'src',
      'Source Detail': 'src_detail',
      'Destination Zone': 'dst_zone',
      'Destination (Required)': 'dst',
      'Destination Detail': 'dst_detail',
      'Services': 'services',
      'Application': 'application',
      'URL': 'url',
      'Action (Required)': 'action',
      'Violation Type': 'violation_type',
      'Violation Detail': 'violation_detail',
      'OU Name': 'ou_name',
      'Contacts (comma-separated emails)': 'contacts',
      'Solution Proposal': 'solution_proposal',
      'Solution Confirm': 'solution_confirm',
      'Work Order': 'work_order',
      'Status': 'status',
      'Description': 'description',
      'Tags (comma-separated IDs)': 'tags'
    };
    
    const allowedHeaders = Object.keys(allowedColumnMapping);
    const extraColumns = headers.filter(col => !allowedHeaders.includes(col));
    if (extraColumns.length > 0) {
      return res.status(400).json({ 
        error: `Extra columns not allowed: ${extraColumns.join(', ')}. Please use the correct template.`,
        details: {
          type: 'extra_columns',
          extraColumns: extraColumns,
          suggestion: 'Please download a new template using the "Download Template" button and only fill in the existing columns.'
        }
      });
    }
    
    // Check column order (must match template order)
    const expectedOrder = [
      'Audit Batch (Required)',
      'Firewall Name (Required)',
      'Rule Name (Required)',
      'Source Zone',
      'Source (Required)',
      'Source Detail',
      'Destination Zone',
      'Destination (Required)',
      'Destination Detail',
      'Services',
      'Application',
      'URL',
      'Action (Required)',
      'Violation Type',
      'Violation Detail',
      'OU Name',
      'Contacts (comma-separated emails)',
      'Solution Proposal',
      'Solution Confirm',
      'Work Order',
      'Status',
      'Description',
      'Tags (comma-separated IDs)'
    ];
    
    // Check if headers match expected order
    const orderMismatch = [];
    for (let i = 0; i < Math.min(headers.length, expectedOrder.length); i++) {
      if (headers[i] !== expectedOrder[i]) {
        orderMismatch.push({
          position: i + 1,
          expected: expectedOrder[i],
          actual: headers[i]
        });
      }
    }
    
    if (orderMismatch.length > 0) {
      const firstMismatch = orderMismatch[0];
      return res.status(400).json({
        error: `Column order is incorrect. Column ${firstMismatch.position} should be "${firstMismatch.expected}" but found "${firstMismatch.actual}".`,
        details: {
          type: 'column_order_mismatch',
          orderMismatch: orderMismatch,
          suggestion: 'Please download a new template using the "Download Template" button and do not change the column order.'
        }
      });
    }

    await client.query('BEGIN');

    const importResults = [];
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 2,
        firewall_name: sanitizeString(row.firewall_name || ''),
        rulename: sanitizeString(row.rulename || ''),
        src_zone: sanitizeString(row.src_zone || ''),
        src: sanitizeString(row.src || ''),
        src_detail: sanitizeString(row.src_detail || ''),
        dst_zone: sanitizeString(row.dst_zone || ''),
        dst: sanitizeString(row.dst || ''),
        dst_detail: sanitizeString(row.dst_detail || ''),
        services: sanitizeString(row.services || ''),
        application: sanitizeString(row.application || ''),
        url: sanitizeString(row.url || ''),
        action: sanitizeString(row.action || ''),
        ou_name: sanitizeString(row.ou_name || ''),
        status: sanitizeString(row.status || ''),
        violation_type: sanitizeString(row.violation_type || ''),
        violation_detail: sanitizeString(row.violation_detail || ''),
        solution_proposal: sanitizeString(row.solution_proposal || ''),
        solution_confirm: sanitizeString(row.solution_confirm || ''),
        description: sanitizeString(row.description || ''),
        audit_batch: sanitizeString(row.audit_batch || ''),
        work_order: sanitizeString(row.work_order || ''),
        contacts: sanitizeString(row.contacts || ''),
        tags: sanitizeString(row.tags || ''),
        import_status: 'SUCCESS',
        import_reason: ''
      };

      try {
        // Validate required fields
        if (!result.audit_batch || !result.firewall_name || !result.rulename || !result.src || !result.dst || !result.action) {
          throw new Error('Missing required fields: audit_batch, firewall_name, rulename, src, dst, action');
        }

        // Validate audit batch format (YYYY-MM)
        const auditBatchPattern = /^\d{4}-\d{2}$/;
        if (!auditBatchPattern.test(result.audit_batch)) {
          throw new Error('Audit Batch must be in format YYYY-MM (e.g., 2024-01)');
        } else {
          // Additional validation for valid month (01-12)
          const parts = result.audit_batch.split('-');
          const month = parseInt(parts[1]);
          if (month < 1 || month > 12) {
            throw new Error('Audit Batch month must be between 01 and 12');
          }
        }

        // Check if rule already exists in the same audit batch
        const auditBatch = result.audit_batch || 'default';
        const existingRule = await RuleFirewall.findByFirewallRuleNameAndAuditBatch(result.firewall_name, result.rulename, auditBatch, client);
        if (existingRule) {
          result.import_status = 'FAILED';
          result.import_reason = `Rule already exists in audit batch ${auditBatch}: ${result.firewall_name} - ${result.rulename}`;
        } else {
          // Resolve OU ID from OU name
          let ouId = null;
          if (result.ou_name) {
            const Unit = (await import('../models/Unit.js')).default;
            const ou = await Unit.findByName(result.ou_name.trim());
            if (ou) {
              ouId = ou.id;
            } else {
              throw new Error(`OU not found: ${result.ou_name}`);
            }
          }

          // Prepare rule data
          const ruleData = {
            firewall_name: result.firewall_name,
            rulename: result.rulename,
            src_zone: result.src_zone || null,
            src: result.src,
            src_detail: result.src_detail || null,
            dst_zone: result.dst_zone || null,
            dst: result.dst,
            dst_detail: result.dst_detail || null,
            services: result.services || null,
            application: result.application || null,
            url: result.url || null,
            action: result.action,
            ou_id: ouId,
            status: result.status || null,
            violation_type: result.violation_type || null,
            violation_detail: result.violation_detail || null,
            solution_proposal: result.solution_proposal || null,
            solution_confirm: result.solution_confirm || null,
            description: result.description || null,
            audit_batch: auditBatch, // Use the audit batch we determined above
            work_order: result.work_order || null,
            updated_by: username
          };

          // Create rule
          const ruleId = await RuleFirewall.create(ruleData, client);

          // Handle contacts if provided
          if (result.contacts) {
            const Contact = (await import('../models/Contact.js')).default;
            const contactEmails = result.contacts.split(',').map(email => email.trim()).filter(email => email);
            const contactIds = [];
            
            for (const email of contactEmails) {
              const contacts = await Contact.findByEmailSearch(email);
              if (contacts.length > 0) {
                contactIds.push(contacts[0].id); // Use first match
              } else {
                throw new Error(`Contact not found: ${email}`);
              }
            }
            
            if (contactIds.length > 0) {
              await RuleFirewall.setContacts(ruleId, contactIds, client);
            }
          }

          // Handle tags if provided
          if (result.tags) {
            const tagIds = result.tags.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
            if (tagIds.length > 0) {
              await RuleFirewall.setTags(ruleId, tagIds, client);
            }
          }
        }

      } catch (err) {
        result.import_status = 'FAILED';
        result.import_reason = err.message;
        errorCount++;
      }

      importResults.push(result);
    }

    await client.query('COMMIT');

    // Count import results
    const successCount = importResults.filter(r => r.import_status === 'SUCCESS').length;
    const errorCount = importResults.filter(r => r.import_status === 'FAILED').length;

    // Create Excel file with import results
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import Results');
    
    worksheet.columns = [
      { header: 'Row Number', key: 'row_number', width: 12 },
      { header: 'Firewall Name', key: 'firewall_name', width: 18 },
      { header: 'Rule Name', key: 'rulename', width: 25 },
      { header: 'Source', key: 'src', width: 18 },
      { header: 'Destination', key: 'dst', width: 18 },
      { header: 'Action', key: 'action', width: 10 },
      { header: 'Import Status', key: 'import_status', width: 15 },
      { header: 'Import Reason', key: 'import_reason', width: 50 }
    ];

    importResults.forEach(result => {
      worksheet.addRow(result);
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Style import status column
    importResults.forEach((result, index) => {
      const row = worksheet.getRow(index + 2);
      if (result.import_status === 'FAILED') {
        row.getCell('import_status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' }
        };
      } else {
        row.getCell('import_status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFCCFFCC' }
        };
      }
    });

    // Save Excel file
    const excelFileName = `firewall_rule_import_${Date.now()}.xlsx`;
    const excelFilePath = path.join(__dirname, '../../uploads', excelFileName);
    await workbook.xlsx.writeFile(excelFilePath);

    // Send Excel file directly
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
    res.setHeader('Content-Length', fs.statSync(excelFilePath).size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const fileBuffer = fs.readFileSync(excelFilePath);
    res.send(fileBuffer);

    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    // Clean up temp Excel file after a delay
    setTimeout(() => {
      try {
        if (fs.existsSync(excelFilePath)) {
          fs.unlinkSync(excelFilePath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up import file:', cleanupErr);
      }
    }, 10000); // 10 seconds delay

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing firewall rules:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error importing firewall rules: ' + err.message });
    }
  } finally {
    client.release();
  }
};

// Download firewall rule validation file
firewallController.downloadRuleValidationFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, filename);
  } catch (err) {
    console.error('Error downloading validation file:', err);
    res.status(500).json({ error: 'Error downloading file: ' + err.message });
  }
};

export default firewallController;
