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
  // Fallback options if no config found
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
      firewall_name, work_order, audit_batch, raw_data
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
    const normRawData = raw_data ? raw_data.trim() : '';

    // Validate required fields
    if (!normRulename || !normSrc || !normDst || !normAction || !normAuditBatch) {
      req.flash('error', 'Missing required fields: Rule Name, Source, Destination, Action, Audit Batch');
      return res.redirect('/firewall/rule');
    }

    // Audit batch is just a simple string, no format validation needed

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

    // Process audit_batch: simple string
    let auditBatchStr = normAuditBatch || '';

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
      raw_data: normRawData || null,
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
    let raw_data = ('raw_data' in req.body) ? (typeof req.body.raw_data === 'string' ? req.body.raw_data.trim() : current.raw_data) : current.raw_data;
    // Normalize audit_batch as simple string
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
        work_order, audit_batch: auditBatchStr, raw_data,
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
    
    // Add headers using long format (matching validation function)
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
      'Raw Data',
      'Tags (comma-separated IDs)'
    ]);
    
    // Add sample data based on Add Rule modal fields
    worksheet.addRow([
      '2024-01',
      'Firewall-A',
      'Allow-HTTP-Web-Server',
      'DMZ',
      '192.168.1.0/24',
      'DMZ Web Servers',
      'Internal',
      '10.0.1.100',
      'Internal Web Server',
      'TCP/80',
      'HTTP',
      'https://example.com',
      'allow',
      '',
      '',
      'IT Department',
      'admin@company.com,webadmin@company.com',
      'Allow HTTP traffic from DMZ to web server',
      'Solution confirmed by security team',
      'WO-2024-001',
      'active',
      'Allow HTTP traffic from DMZ to internal web server',
      'config firewall policy\n  edit 1\n    set srcintf "dmz"\n    set dstintf "internal"\n    set srcaddr "192.168.1.0/24"\n    set dstaddr "10.0.1.100"\n    set action accept\n    set service "HTTP"\n  next\nend',
      ''
    ]);
    
    // Add another sample
    worksheet.addRow([
      '2024-01',
      'Firewall-B',
      'Deny-SSH-External',
      'External',
      '0.0.0.0/0',
      'External Internet',
      'Internal',
      '10.0.0.0/8',
      'Internal Network',
      'TCP/22',
      'SSH',
      '',
      'deny',
      'security_violation',
      'SSH access from external networks is not allowed',
      'Security Team',
      'security@company.com',
      'Block SSH access from external networks',
      'Security team confirmed blocking',
      'WO-2024-002',
      'active',
      'Block SSH access from external networks to internal systems',
      'config firewall policy\n  edit 2\n    set srcintf "wan1"\n    set dstintf "internal"\n    set srcaddr "all"\n    set dstaddr "10.0.0.0/8"\n    set action deny\n    set service "SSH"\n  next\nend',
      ''
    ]);
    
    // Add sample with violation
    worksheet.addRow([
      '2024-01',
      'Firewall-C',
      'Allow-DNS-Query',
      'Internal',
      '10.0.0.0/8',
      'Internal Network',
      'DMZ',
      '192.168.1.10',
      'DMZ DNS Server',
      'UDP/53',
      'DNS',
      '',
      'allow',
      'compliance_violation',
      'DNS queries need to be logged for compliance',
      'Network Team',
      'network@company.com',
      'Allow DNS queries from internal to DNS server',
      'Network team confirmed DNS access',
      'WO-2024-003',
      'active',
      'Allow DNS queries from internal network to DNS server',
      'config firewall policy\n  edit 3\n    set srcintf "internal"\n    set dstintf "dmz"\n    set srcaddr "10.0.0.0/8"\n    set dstaddr "192.168.1.10"\n    set action accept\n    set service "DNS"\n    set logtraffic all\n  next\nend',
      ''
    ]);
    
    // Set column widths for template fields
    worksheet.columns = [
      { width: 18 },  // Audit Batch (Required)
      { width: 20 },  // Firewall Name (Required)
      { width: 25 },  // Rule Name (Required)
      { width: 12 },  // Source Zone
      { width: 20 },  // Source (Required)
      { width: 20 },  // Source Detail
      { width: 12 },  // Destination Zone
      { width: 20 },  // Destination (Required)
      { width: 20 },  // Destination Detail
      { width: 15 },  // Services
      { width: 15 },  // Application
      { width: 25 },  // URL
      { width: 10 },  // Action (Required)
      { width: 15 },  // Violation Type
      { width: 30 },  // Violation Detail
      { width: 15 },  // OU Name
      { width: 30 },  // Contacts (comma-separated emails)
      { width: 30 },  // Solution Proposal
      { width: 30 },  // Solution Confirm
      { width: 15 },  // Work Order
      { width: 10 },  // Status
      { width: 30 },  // Description
      { width: 40 },  // Raw Data
      { width: 25 }   // Tags (comma-separated IDs)
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

    // Strict validation - must have exactly all 24 columns with correct names
    const exactRequiredColumns = [
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
      'Raw Data',
      'Tags (comma-separated IDs)'
    ];
    
    // Check if we have exactly 24 columns
    if (headers.length !== 24) {
      return res.status(400).json({ 
        error: `File must have exactly 24 columns, but found ${headers.length} columns. Please download the template and use the correct format.`,
        details: {
          type: 'column_count_mismatch',
          expectedCount: 24,
          actualCount: headers.length,
          suggestion: 'Please download a new template using the "Download Template" button and use the exact format.'
        }
      });
    }
    
    // Check if all column names match exactly
    const missingColumns = [];
    const extraColumns = [];
    
    for (let i = 0; i < exactRequiredColumns.length; i++) {
      const expectedColumn = exactRequiredColumns[i];
      const actualColumn = headers[i];
      
      if (actualColumn !== expectedColumn) {
        if (!exactRequiredColumns.includes(actualColumn)) {
          extraColumns.push(actualColumn);
        } else {
          missingColumns.push(expectedColumn);
        }
      }
    }
    
    // Check for any columns that are in the file but not in the expected list
    headers.forEach(header => {
      if (!exactRequiredColumns.includes(header)) {
        if (!extraColumns.includes(header)) {
          extraColumns.push(header);
        }
      }
    });
    
    if (missingColumns.length > 0 || extraColumns.length > 0) {
      let errorMessage = '';
      if (missingColumns.length > 0) {
        errorMessage += `Missing or incorrect columns: ${missingColumns.join(', ')}. `;
      }
      if (extraColumns.length > 0) {
        errorMessage += `Extra or incorrect columns: ${extraColumns.join(', ')}. `;
      }
      errorMessage += 'Please download the template and use the exact format.';
      
      return res.status(400).json({ 
        error: errorMessage,
        details: {
          type: 'column_validation_failed',
          missingColumns: missingColumns,
          extraColumns: extraColumns,
          expectedColumns: exactRequiredColumns,
          actualColumns: headers,
          suggestion: 'Please download a new template using the "Download Template" button and use the exact column names and order.'
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
      'Raw Data',
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

    // Detailed validation for each row
    console.log('Starting detailed validation for', rows.length, 'rows...');
    const validationResults = [];
    let totalRows = rows.length;
    let passedRows = 0;
    let failedRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because Excel rows start from 1 and we skip header
      const result = {
        rowNumber: rowNumber,
        passed: true,
        errors: [],
        notes: []
      };

      // Validate required fields
      const requiredFields = [
        { field: 'Audit Batch', value: row['Audit Batch (Required)'] },
        { field: 'Firewall Name', value: row['Firewall Name (Required)'] },
        { field: 'Rule Name', value: row['Rule Name (Required)'] },
        { field: 'Source', value: row['Source (Required)'] },
        { field: 'Destination', value: row['Destination (Required)'] },
        { field: 'Action', value: row['Action (Required)'] }
      ];

      for (const reqField of requiredFields) {
        if (!reqField.value || reqField.value.toString().trim() === '') {
          result.passed = false;
          result.errors.push(`Missing ${reqField.field}`);
        }
      }

      // Validate Audit Batch format (YYYY-MM)
      if (row['Audit Batch (Required)']) {
        const auditBatch = row['Audit Batch (Required)'].toString().trim();
        const auditBatchPattern = /^\d{4}-\d{2}$/;
        if (!auditBatchPattern.test(auditBatch)) {
          result.passed = false;
          result.errors.push(`Invalid Audit Batch: ${auditBatch}`);
        } else {
          const parts = auditBatch.split('-');
          const month = parseInt(parts[1]);
          if (month < 1 || month > 12) {
            result.passed = false;
            result.errors.push(`Invalid Audit Batch: ${auditBatch}`);
          }
        }
      }

      // Validate Action enum (case insensitive)
      if (row['Action (Required)']) {
        const actionValue = row['Action (Required)'].toString().trim();
        const actionMatch = allowedActions.find(action => action.toLowerCase() === actionValue.toLowerCase());
        if (!actionMatch) {
          result.passed = false;
          result.errors.push(`Invalid Action: ${actionValue}`);
        }
      }

      // Validate Status enum (case insensitive)
      if (row['Status'] && row['Status'].toString().trim() !== '') {
        const statusValue = row['Status'].toString().trim();
        const statusMatch = allowedStatus.find(status => status.toLowerCase() === statusValue.toLowerCase());
        if (!statusMatch) {
          result.passed = false;
          result.errors.push(`Invalid Status: ${statusValue}`);
        }
      }

      // Validate Violation Type enum (case insensitive)
      if (row['Violation Type'] && row['Violation Type'].toString().trim() !== '') {
        const violationTypeValue = row['Violation Type'].toString().trim();
        const violationTypeMatch = allowedViolationTypes.find(violationType => violationType.toLowerCase() === violationTypeValue.toLowerCase());
        if (!violationTypeMatch) {
          result.passed = false;
          result.errors.push(`Invalid Violation Type: ${violationTypeValue}`);
        }
      }

      // Validate Firewall Name enum (case insensitive)
      if (row['Firewall Name (Required)']) {
        const firewallNameValue = row['Firewall Name (Required)'].toString().trim();
        const firewallNameMatch = allowedFirewallNames.find(firewallName => firewallName.toLowerCase() === firewallNameValue.toLowerCase());
        if (!firewallNameMatch) {
          result.passed = false;
          result.errors.push(`Invalid Firewall Name: ${firewallNameValue}`);
        }
      }

      // Validate OU Name exists in database (case insensitive)
      if (row['OU Name'] && row['OU Name'].toString().trim() !== '') {
        try {
          const ouNameValue = row['OU Name'].toString().trim();
          const unit = await Unit.findByName(ouNameValue);
          if (!unit) {
            result.passed = false;
            result.errors.push(`Invalid OU Name: ${ouNameValue}`);
          }
        } catch (dbError) {
          result.passed = false;
          result.errors.push(`Invalid OU Name: ${row['OU Name']}`);
        }
      }

      // Validate Contacts exist in database (supports both full email and email prefix)
      if (row['Contacts (comma-separated emails)'] && row['Contacts (comma-separated emails)'].toString().trim() !== '') {
        const contactsStr = row['Contacts (comma-separated emails)'].toString().trim();
        const contactEmails = contactsStr.split(',').map(email => email.trim()).filter(email => email !== '');
        const invalidContacts = [];
        
        for (const email of contactEmails) {
          try {
            // Use findByEmailSearch which supports both full email and email prefix
            const contacts = await Contact.findByEmailSearch(email);
            if (!contacts || contacts.length === 0) {
              invalidContacts.push(email);
            }
          } catch (dbError) {
            invalidContacts.push(email);
          }
        }
        
        if (invalidContacts.length > 0) {
          result.passed = false;
          result.errors.push(`Invalid Contacts: ${invalidContacts.join(', ')}`);
        }
      }

      // Validate Tags exist in database (if provided)
      if (row['Tags (comma-separated IDs)'] && row['Tags (comma-separated IDs)'].toString().trim() !== '') {
        const tagsStr = row['Tags (comma-separated IDs)'].toString().trim();
        const tagIds = tagsStr.split(',').map(id => id.trim()).filter(id => id !== '');
        const invalidTags = [];
        
        for (const tagId of tagIds) {
          const tagIdNum = parseInt(tagId, 10);
          if (isNaN(tagIdNum)) {
            invalidTags.push(tagId);
          } else {
            try {
              const tagExists = await Tag.exists(tagIdNum);
              if (!tagExists) {
                invalidTags.push(tagId);
              }
            } catch (dbError) {
              invalidTags.push(tagId);
            }
          }
        }
        
        if (invalidTags.length > 0) {
          result.passed = false;
          result.errors.push(`Invalid Tags: ${invalidTags.join(', ')}`);
        }
      }

      // Add notes for successful validations
      if (result.passed) {
        result.notes.push('All validations passed successfully');
      }

      validationResults.push(result);
      
      if (result.passed) {
        passedRows++;
      } else {
        failedRows++;
      }
    }

    console.log('Validation completed:', { totalRows, passedRows, failedRows });

    // Create Excel file with validation results
    const resultWorkbook = new ExcelJS.Workbook();
    const resultWorksheet = resultWorkbook.addWorksheet('Validation Results');

    // Add original headers plus Result and Notes columns
    const resultHeaders = [...headers, 'Result', 'Notes'];
    resultWorksheet.addRow(resultHeaders);

    // Add data rows with validation results
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validation = validationResults[i];
      
      const resultRow = [];
      headers.forEach(header => {
        resultRow.push(row[header] || '');
      });
      
      // Add Result column
      resultRow.push(validation.passed ? 'PASSED' : 'FAILED');
      
      // Add Notes column
      const notes = [];
      if (validation.errors.length > 0) {
        notes.push(...validation.errors);
      }
      if (validation.notes.length > 0) {
        notes.push(...validation.notes);
      }
      resultRow.push(notes.join('; '));
      
      resultWorksheet.addRow(resultRow);
    }

    // Style the header row
    const headerRow = resultWorksheet.getRow(1);
    headerRow.font = { bold: true };

    // Style Result column
    const resultColumnIndex = headers.length + 1; // +1 for 1-based indexing
    const notesColumnIndex = headers.length + 2;
    
    for (let i = 2; i <= rows.length + 1; i++) {
      const resultCell = resultWorksheet.getCell(i, resultColumnIndex);
      const validation = validationResults[i - 2];
      
      if (validation.passed) {
        resultCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'C6EFCE' } // Light green
        };
        resultCell.font = { color: { argb: '006100' } }; // Dark green
      } else {
        resultCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC7CE' } // Light red
        };
        resultCell.font = { color: { argb: '9C0006' } }; // Dark red
      }
    }

    // Set column widths
    resultWorksheet.columns = [
      { width: 18 },  // Audit Batch (Required)
      { width: 20 },  // Firewall Name (Required)
      { width: 25 },  // Rule Name (Required)
      { width: 12 },  // Source Zone
      { width: 20 },  // Source (Required)
      { width: 20 },  // Source Detail
      { width: 12 },  // Destination Zone
      { width: 20 },  // Destination (Required)
      { width: 20 },  // Destination Detail
      { width: 15 },  // Services
      { width: 15 },  // Application
      { width: 25 },  // URL
      { width: 10 },  // Action (Required)
      { width: 15 },  // Violation Type
      { width: 30 },  // Violation Detail
      { width: 15 },  // OU Name
      { width: 30 },  // Contacts (comma-separated emails)
      { width: 30 },  // Solution Proposal
      { width: 30 },  // Solution Confirm
      { width: 15 },  // Work Order
      { width: 10 },  // Status
      { width: 30 },  // Description
      { width: 40 },  // Raw Data
      { width: 25 },  // Tags (comma-separated IDs)
      { width: 10 },  // Result
      { width: 50 }   // Notes
    ];

    // Save validation results to temporary file
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, `validation_results_${Date.now()}.xlsx`);
    await resultWorkbook.xlsx.writeFile(tempPath);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="firewall_rule_validation_results.xlsx"');
    res.setHeader('X-Validation-Summary', JSON.stringify({
      totalCount: totalRows,
      passedCount: passedRows,
      failCount: failedRows,
      allPassed: failedRows === 0
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

    // Strict validation - must have exactly all 24 columns with correct names
    const exactRequiredColumns = [
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
      'Raw Data',
      'Tags (comma-separated IDs)'
    ];
    
    // Check if we have exactly 24 columns
    if (headers.length !== 24) {
      return res.status(400).json({ 
        error: `File must have exactly 24 columns, but found ${headers.length} columns. Please download the template and use the correct format.`,
        details: {
          type: 'column_count_mismatch',
          expectedCount: 24,
          actualCount: headers.length,
          suggestion: 'Please download a new template using the "Download Template" button and use the exact format.'
        }
      });
    }
    
    // Check if all column names match exactly
    const missingColumns = [];
    const extraColumns = [];
    
    for (let i = 0; i < exactRequiredColumns.length; i++) {
      const expectedColumn = exactRequiredColumns[i];
      const actualColumn = headers[i];
      
      if (actualColumn !== expectedColumn) {
        if (!exactRequiredColumns.includes(actualColumn)) {
          extraColumns.push(actualColumn);
        } else {
          missingColumns.push(expectedColumn);
        }
      }
    }
    
    // Check for any columns that are in the file but not in the expected list
    headers.forEach(header => {
      if (!exactRequiredColumns.includes(header)) {
        if (!extraColumns.includes(header)) {
          extraColumns.push(header);
        }
      }
    });
    
    if (missingColumns.length > 0 || extraColumns.length > 0) {
      let errorMessage = '';
      if (missingColumns.length > 0) {
        errorMessage += `Missing or incorrect columns: ${missingColumns.join(', ')}. `;
      }
      if (extraColumns.length > 0) {
        errorMessage += `Extra or incorrect columns: ${extraColumns.join(', ')}. `;
      }
      errorMessage += 'Please download the template and use the exact format.';
      
      return res.status(400).json({ 
        error: errorMessage,
        details: {
          type: 'column_validation_failed',
          missingColumns: missingColumns,
          extraColumns: extraColumns,
          expectedColumns: exactRequiredColumns,
          actualColumns: headers,
          suggestion: 'Please download a new template using the "Download Template" button and use the exact column names and order.'
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
      'Raw Data',
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

    // Ensure all options are arrays
    const safeActionsOptions = Array.isArray(actionsOptions) ? actionsOptions : [];
    const safeStatusOptions = Array.isArray(statusOptions) ? statusOptions : [];
    const safeViolationTypeOptions = Array.isArray(violationTypeOptions) ? violationTypeOptions : [];
    const safeFirewallNameOptions = Array.isArray(firewallNameOptions) ? firewallNameOptions : [];

    const allowedActions = safeActionsOptions.map(a => a.value);
    const allowedStatus = safeStatusOptions.map(s => s.value);
    const allowedViolationTypes = safeViolationTypeOptions.map(v => v.value);
    const allowedFirewallNames = safeFirewallNameOptions.map(f => f.value);

    await client.query('BEGIN');

    const importResults = [];
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        row_number: i + 2,
        firewall_name: sanitizeString(row['Firewall Name (Required)'] || ''),
        rulename: sanitizeString(row['Rule Name (Required)'] || ''),
        src_zone: sanitizeString(row['Source Zone'] || ''),
        src: sanitizeString(row['Source (Required)'] || ''),
        src_detail: sanitizeString(row['Source Detail'] || ''),
        dst_zone: sanitizeString(row['Destination Zone'] || ''),
        dst: sanitizeString(row['Destination (Required)'] || ''),
        dst_detail: sanitizeString(row['Destination Detail'] || ''),
        services: sanitizeString(row['Services'] || ''),
        application: sanitizeString(row['Application'] || ''),
        url: sanitizeString(row['URL'] || ''),
        action: sanitizeString(row['Action (Required)'] || ''),
        ou_name: sanitizeString(row['OU Name'] || ''),
        status: sanitizeString(row['Status'] || ''),
        violation_type: sanitizeString(row['Violation Type'] || ''),
        violation_detail: sanitizeString(row['Violation Detail'] || ''),
        solution_proposal: sanitizeString(row['Solution Proposal'] || ''),
        solution_confirm: sanitizeString(row['Solution Confirm'] || ''),
        description: sanitizeString(row['Description'] || ''),
        audit_batch: sanitizeString(row['Audit Batch (Required)'] || ''),
        work_order: sanitizeString(row['Work Order'] || ''),
        raw_data: sanitizeString(row['Raw Data'] || ''),
        contacts: sanitizeString(row['Contacts (comma-separated emails)'] || ''),
        tags: sanitizeString(row['Tags (comma-separated IDs)'] || ''),
        import_status: 'SUCCESS',
        import_reason: ''
      };

      try {
        // Validate required fields
        if (!result.audit_batch || !result.firewall_name || !result.rulename || !result.src || !result.dst || !result.action) {
          throw new Error('Missing required fields: audit_batch, firewall_name, rulename, src, dst, action');
        }

        // Validate Audit Batch format (YYYY-MM)
        if (result.audit_batch) {
          const auditBatch = result.audit_batch.toString().trim();
          const auditBatchPattern = /^\d{4}-\d{2}$/;
          if (!auditBatchPattern.test(auditBatch)) {
            throw new Error(`Invalid Audit Batch: ${auditBatch}`);
          } else {
            const parts = auditBatch.split('-');
            const month = parseInt(parts[1]);
            if (month < 1 || month > 12) {
              throw new Error(`Invalid Audit Batch: ${auditBatch}`);
            }
          }
        }

        // Validate Action enum (case insensitive)
        if (result.action) {
          const actionValue = result.action.toString().trim();
          const actionMatch = allowedActions.find(action => action.toLowerCase() === actionValue.toLowerCase());
          if (!actionMatch) {
            throw new Error(`Invalid Action: ${actionValue}`);
          }
        }

        // Validate Status enum (case insensitive)
        if (result.status && result.status.toString().trim() !== '') {
          const statusValue = result.status.toString().trim();
          const statusMatch = allowedStatus.find(status => status.toLowerCase() === statusValue.toLowerCase());
          if (!statusMatch) {
            throw new Error(`Invalid Status: ${statusValue}`);
          }
        }

        // Validate Violation Type enum (case insensitive)
        if (result.violation_type && result.violation_type.toString().trim() !== '') {
          const violationTypeValue = result.violation_type.toString().trim();
          const violationTypeMatch = allowedViolationTypes.find(violationType => violationType.toLowerCase() === violationTypeValue.toLowerCase());
          if (!violationTypeMatch) {
            throw new Error(`Invalid Violation Type: ${violationTypeValue}`);
          }
        }

        // Validate Firewall Name enum (case insensitive)
        if (result.firewall_name) {
          const firewallNameValue = result.firewall_name.toString().trim();
          const firewallNameMatch = allowedFirewallNames.find(firewallName => firewallName.toLowerCase() === firewallNameValue.toLowerCase());
          if (!firewallNameMatch) {
            throw new Error(`Invalid Firewall Name: ${firewallNameValue}`);
          }
        }

        // Check if rule already exists in the same audit batch
        const auditBatch = result.audit_batch || 'default';
        const existingRule = await RuleFirewall.findByFirewallRuleNameAndAuditBatch(result.firewall_name, result.rulename, auditBatch, client);
        if (existingRule) {
          result.import_status = 'FAILED';
          result.import_reason = `Rule already exists in audit batch ${auditBatch}: ${result.firewall_name} - ${result.rulename}`;
        } else {
          // Validate and resolve OU ID from OU name
          let ouId = null;
          if (result.ou_name) {
            const Unit = (await import('../models/Unit.js')).default;
            const ou = await Unit.findByName(result.ou_name.trim());
            if (ou) {
              ouId = ou.id;
            } else {
              throw new Error(`Invalid OU Name: ${result.ou_name}`);
            }
          }

          // Validate Contacts exist in database (supports both full email and email prefix)
          if (result.contacts) {
            const Contact = (await import('../models/Contact.js')).default;
            const contactEmails = result.contacts.split(',').map(email => email.trim()).filter(email => email !== '');
            const invalidContacts = [];
            
            for (const email of contactEmails) {
              const contacts = await Contact.findByEmailSearch(email);
              if (!contacts || contacts.length === 0) {
                invalidContacts.push(email);
              }
            }
            
            if (invalidContacts.length > 0) {
              throw new Error(`Invalid Contacts: ${invalidContacts.join(', ')}`);
            }
          }

          // Validate Tags exist in database
          if (result.tags) {
            const Tag = (await import('../models/Tag.js')).default;
            const tagIds = result.tags.split(',').map(id => id.trim()).filter(id => id !== '');
            const invalidTags = [];
            
            for (const tagId of tagIds) {
              const tagIdNum = parseInt(tagId, 10);
              if (isNaN(tagIdNum)) {
                invalidTags.push(tagId);
              } else {
                const tagExists = await Tag.exists(tagIdNum);
                if (!tagExists) {
                  invalidTags.push(tagId);
                }
              }
            }
            
            if (invalidTags.length > 0) {
              throw new Error(`Invalid Tags: ${invalidTags.join(', ')}`);
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
            raw_data: result.raw_data || null,
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
    errorCount = importResults.filter(r => r.import_status === 'FAILED').length;

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

    // Send Excel file with import results
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
    res.setHeader('Content-Length', fs.statSync(excelFilePath).size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Import-Summary', JSON.stringify({
      totalCount: importResults.length,
      successCount: successCount,
      errorCount: errorCount
    }));

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
