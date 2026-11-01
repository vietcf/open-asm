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
import { ServiceError } from '../shared/errors.js';
import { sanitizeExcelObject, sanitizeExcelRow } from '../utils/excelSafe.js';
import {
  listRules as listRulesService,
  createRule as createRuleService,
  updateRule as updateRuleService,
  deleteRule as deleteRuleService,
  getActionOptions as getActionsOptionsFromConfig,
  getStatusOptions as getStatusOptionsFromConfig,
  getViolationTypeOptions as getViolationTypeOptionsFromConfig,
  getFirewallNameOptions as getFirewallNameOptionsFromConfig
} from '../services/ruleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to sanitize string input
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
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
    // Parse work_order filter
    let filterWorkOrder = req.query.work_order || '';
    if (filterWorkOrder === '') filterWorkOrder = undefined;


    // --- Call service with filters ---
    const { items: ruleList, totalCount } = await listRulesService({
      search, page, pageSize, ou_id: filterUnitId, contacts: filterContactIds, tags: filterTagIds, violation_type: filterViolationType, status: filterStatus, firewall_name: filterFirewallName, audit_batch: filterAuditBatch, work_order: filterWorkOrder
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
      work_order: filterWorkOrder,
      title: 'Firewall Rule',
      activeMenu: 'firewall-rule'
    });
  } catch (err) {
    res.status(500).send('Error loading firewall rules: ' + err.message);
  }
};

firewallController.addRule = async (req, res) => {
  try {
    const {
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts, tags, 'contacts[]': contactsArr, 'tags[]': tagsArr,
      firewall_name, work_order, audit_batch, raw_data
    } = req.body;

    await createRuleService({
      rulename, src_zone, src, src_detail, dst_zone, dst, dst_detail,
      services, application, url, action, ou_id, status, violation_type,
      violation_detail, solution_proposal, solution_confirm, description,
      contacts: Array.isArray(contactsArr) ? contactsArr : contacts,
      tags: Array.isArray(tagsArr) ? tagsArr : tags,
      firewall_name, work_order, audit_batch, raw_data,
      updated_by: req.session && req.session.user ? req.session.user.username : null
    });
    req.flash('success', 'Rule added successfully!');
    return res.redirect('/firewall/rule');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Error adding rule: ' + err.message;
    if (!(err instanceof ServiceError)) console.error('[ERROR] Exception in addRule:', err);
    req.flash('error', message);
    res.redirect('/firewall/rule');
  }
};



firewallController.editRule = async (req, res) => {
  const id = req.params.id;
  try {
    const body = req.body || {};
    const has = key => Object.prototype.hasOwnProperty.call(body, key);
    const input = { ...body };
    // The edit form always fully replaces tags/contacts on submit (browsers
    // omit multi-select fields entirely when nothing is checked) — always
    // include the keys so the service's has-key semantics clear them when
    // empty rather than leaving stale associations in place.
    input.contacts = has('contacts') ? body.contacts : [];
    input.tags = has('tags') ? body.tags : [];
    input.updated_by = req.session && req.session.user ? req.session.user.username : null;

    await updateRuleService(id, input);
    req.flash('success', 'Rule updated successfully!');
    res.redirect('/firewall/rule');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Failed to update rule: ' + err.message;
    req.flash('error', message);
    res.redirect('/firewall/rule');
  }
};

firewallController.deleteRule = async (req, res) => {
  const id = req.params.id;
  try {
    await deleteRuleService(id);
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
    
    // Parse firewall_name, audit_batch, and work_order filters
    let firewall_name = req.query.firewall_name || '';
    if (firewall_name === '') firewall_name = undefined;
    let audit_batch = req.query.audit_batch || '';
    if (audit_batch === '') audit_batch = undefined;
    let work_order = req.query.work_order || '';
    if (work_order === '') work_order = undefined;

    // Get all filtered rules (no pagination)
    const ruleList = await RuleFirewall.findFilteredList({
      search, page: 1, pageSize: 10000, ou_id, contacts, tags, violation_type, status, firewall_name, audit_batch, work_order
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Firewall Rules');
    worksheet.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: 'Rule ID', key: 'id', width: 10 },
      { header: 'Firewall Name', key: 'firewall_name', width: 18 },
      { header: 'Rule Name', key: 'rulename', width: 25 },
      { header: 'Audit Batch', key: 'audit_batch', width: 15 },
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
      worksheet.addRow(sanitizeExcelObject({
        idx: idx + 1,
        id: rule.id,
        firewall_name: rule.firewall_name || '',
        rulename: rule.rulename,
        audit_batch: rule.audit_batch || '',
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
          ? rule.contacts.map(c => {
              const emailShort = c.email ? c.email.split('@')[0] : '';
              return c.name + (emailShort ? ' (' + emailShort + ')' : '');
            }).join(', ') : '',
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
      }));
    });
    worksheet.getRow(1).font = { bold: true };
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="firewall_rules_export_${timestamp}.xlsx"`);

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
      'Source Zone (Optional)',
      'Source (Required)',
      'Source Detail (Optional)',
      'Destination Zone (Optional)',
      'Destination (Required)',
      'Destination Detail (Optional)',
      'Services (Optional)',
      'Application (Optional)',
      'URL (Optional)',
      'Action (Required)',
      'Violation Type (Optional)',
      'Violation Detail (Optional)',
      'OU Name (Optional)',
      'Contacts (Optional, comma-separated emails)',
      'Solution Proposal (Optional)',
      'Solution Confirm (Optional)',
      'Work Order (Optional)',
      'Status (Optional)',
      'Description (Optional)',
      'Raw Data (Optional)',
      'Tags (Optional, comma-separated IDs)'
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
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
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
    
    // Check if file exists
    if (fs.existsSync(tempPath)) {
      // Use res.download() for proper file download handling — same
      // approach as IP/Subnet/Server/Device templates
      res.download(tempPath, 'firewall_rule_template.xlsx', (err) => {
        if (err) {
          console.error('Error downloading template file:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error downloading template file' });
          }
        }

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
      });
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
    // Excel only — CSV import is no longer supported (multer's fileFilter
    // already rejects non-Excel uploads; this is the belt-and-suspenders
    // check for anything that reaches here another way).
    if (ext === '.xlsx' || ext === '.xls') {
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
        return res.status(400).json({ error: 'Unsupported file format. Please use an Excel (.xlsx, .xls) file. Download the template for the correct format.' });
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
      'Source Zone (Optional)',
      'Source (Required)',
      'Source Detail (Optional)',
      'Destination Zone (Optional)',
      'Destination (Required)',
      'Destination Detail (Optional)',
      'Services (Optional)',
      'Application (Optional)',
      'URL (Optional)',
      'Action (Required)',
      'Violation Type (Optional)',
      'Violation Detail (Optional)',
      'OU Name (Optional)',
      'Contacts (Optional, comma-separated emails)',
      'Solution Proposal (Optional)',
      'Solution Confirm (Optional)',
      'Work Order (Optional)',
      'Status (Optional)',
      'Description (Optional)',
      'Raw Data (Optional)',
      'Tags (Optional, comma-separated IDs)'
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
      'Source Zone (Optional)',
      'Source (Required)',
      'Source Detail (Optional)',
      'Destination Zone (Optional)',
      'Destination (Required)',
      'Destination Detail (Optional)',
      'Services (Optional)',
      'Application (Optional)',
      'URL (Optional)',
      'Action (Required)',
      'Violation Type (Optional)',
      'Violation Detail (Optional)',
      'OU Name (Optional)',
      'Contacts (Optional, comma-separated emails)',
      'Solution Proposal (Optional)',
      'Solution Confirm (Optional)',
      'Work Order (Optional)',
      'Status (Optional)',
      'Description (Optional)',
      'Raw Data (Optional)',
      'Tags (Optional, comma-separated IDs)'
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
      if (row['Status (Optional)'] && row['Status (Optional)'].toString().trim() !== '') {
        const statusValue = row['Status (Optional)'].toString().trim();
        const statusMatch = allowedStatus.find(status => status.toLowerCase() === statusValue.toLowerCase());
        if (!statusMatch) {
          result.passed = false;
          result.errors.push(`Invalid Status: ${statusValue}`);
        }
      }

      // Validate Violation Type enum (case insensitive)
      if (row['Violation Type (Optional)'] && row['Violation Type (Optional)'].toString().trim() !== '') {
        const violationTypeValue = row['Violation Type (Optional)'].toString().trim();
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
      if (row['OU Name (Optional)'] && row['OU Name (Optional)'].toString().trim() !== '') {
        try {
          const ouNameValue = row['OU Name (Optional)'].toString().trim();
          const unit = await Unit.findByName(ouNameValue);
          if (!unit) {
            result.passed = false;
            result.errors.push(`Invalid OU Name: ${ouNameValue}`);
          }
        } catch (dbError) {
          result.passed = false;
          result.errors.push(`Invalid OU Name: ${row['OU Name (Optional)']}`);
        }
      }

      // Validate Contacts exist in database (supports both full email and email prefix)
      if (row['Contacts (Optional, comma-separated emails)'] && row['Contacts (Optional, comma-separated emails)'].toString().trim() !== '') {
        const contactsStr = row['Contacts (Optional, comma-separated emails)'].toString().trim();
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
      if (row['Tags (Optional, comma-separated IDs)'] && row['Tags (Optional, comma-separated IDs)'].toString().trim() !== '') {
        const tagsStr = row['Tags (Optional, comma-separated IDs)'].toString().trim();
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

      resultWorksheet.addRow(sanitizeExcelRow(resultRow));
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

    // Save validation results to temporary file — same public/uploads/temp
    // location (and env override) used by IP/Subnet/Server/Device
    const tempDir = path.join(process.cwd(), process.env.UPLOADS_DIR || 'public/uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, `validation_results_${Date.now()}.xlsx`);
    await resultWorkbook.xlsx.writeFile(tempPath);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="firewall_rule_validation_results.xlsx"');
    // Same key names as IP/Subnet/Server/Device validation summary
    res.setHeader('X-Validation-Summary', JSON.stringify({
      total: totalRows,
      passed: passedRows,
      failed: failedRows,
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
    
    // Excel only — CSV import is no longer supported (multer's fileFilter
    // already rejects non-Excel uploads; this is the belt-and-suspenders
    // check for anything that reaches here another way).
    if (ext === '.xlsx' || ext === '.xls') {
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
      return res.status(400).json({ error: 'Unsupported file format. Please use an Excel (.xlsx, .xls) file. Download the template for the correct format.' });
    }

    // Strict validation - must have exactly all 24 columns with correct names
    const exactRequiredColumns = [
      'Audit Batch (Required)',
      'Firewall Name (Required)',
      'Rule Name (Required)',
      'Source Zone (Optional)',
      'Source (Required)',
      'Source Detail (Optional)',
      'Destination Zone (Optional)',
      'Destination (Required)',
      'Destination Detail (Optional)',
      'Services (Optional)',
      'Application (Optional)',
      'URL (Optional)',
      'Action (Required)',
      'Violation Type (Optional)',
      'Violation Detail (Optional)',
      'OU Name (Optional)',
      'Contacts (Optional, comma-separated emails)',
      'Solution Proposal (Optional)',
      'Solution Confirm (Optional)',
      'Work Order (Optional)',
      'Status (Optional)',
      'Description (Optional)',
      'Raw Data (Optional)',
      'Tags (Optional, comma-separated IDs)'
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
      'Source Zone (Optional)',
      'Source (Required)',
      'Source Detail (Optional)',
      'Destination Zone (Optional)',
      'Destination (Required)',
      'Destination Detail (Optional)',
      'Services (Optional)',
      'Application (Optional)',
      'URL (Optional)',
      'Action (Required)',
      'Violation Type (Optional)',
      'Violation Detail (Optional)',
      'OU Name (Optional)',
      'Contacts (Optional, comma-separated emails)',
      'Solution Proposal (Optional)',
      'Solution Confirm (Optional)',
      'Work Order (Optional)',
      'Status (Optional)',
      'Description (Optional)',
      'Raw Data (Optional)',
      'Tags (Optional, comma-separated IDs)'
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
        src_zone: sanitizeString(row['Source Zone (Optional)'] || ''),
        src: sanitizeString(row['Source (Required)'] || ''),
        src_detail: sanitizeString(row['Source Detail (Optional)'] || ''),
        dst_zone: sanitizeString(row['Destination Zone (Optional)'] || ''),
        dst: sanitizeString(row['Destination (Required)'] || ''),
        dst_detail: sanitizeString(row['Destination Detail (Optional)'] || ''),
        services: sanitizeString(row['Services (Optional)'] || ''),
        application: sanitizeString(row['Application (Optional)'] || ''),
        url: sanitizeString(row['URL (Optional)'] || ''),
        action: sanitizeString(row['Action (Required)'] || ''),
        ou_name: sanitizeString(row['OU Name (Optional)'] || ''),
        status: sanitizeString(row['Status (Optional)'] || ''),
        violation_type: sanitizeString(row['Violation Type (Optional)'] || ''),
        violation_detail: sanitizeString(row['Violation Detail (Optional)'] || ''),
        solution_proposal: sanitizeString(row['Solution Proposal (Optional)'] || ''),
        solution_confirm: sanitizeString(row['Solution Confirm (Optional)'] || ''),
        description: sanitizeString(row['Description (Optional)'] || ''),
        audit_batch: sanitizeString(row['Audit Batch (Required)'] || ''),
        work_order: sanitizeString(row['Work Order (Optional)'] || ''),
        raw_data: sanitizeString(row['Raw Data (Optional)'] || ''),
        contacts: sanitizeString(row['Contacts (Optional, comma-separated emails)'] || ''),
        tags: sanitizeString(row['Tags (Optional, comma-separated IDs)'] || ''),
        import_status: 'SUCCESS',
        import_reason: ''
      };

      try {
        // Validate required fields (check for empty strings too)
        const requiredFields = {
          'audit_batch': result.audit_batch,
          'firewall_name': result.firewall_name,
          'rulename': result.rulename,
          'src': result.src,
          'dst': result.dst,
          'action': result.action
        };
        
        const missingFields = [];
        for (const [field, value] of Object.entries(requiredFields)) {
          if (!value || value.toString().trim() === '') {
            missingFields.push(field);
          }
        }
        
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
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
            throw new Error(`Invalid Action: ${actionValue}. Allowed values: ${allowedActions.join(', ')}`);
          }
        }

        // Validate Status enum (case insensitive)
        if (result.status && result.status.toString().trim() !== '') {
          const statusValue = result.status.toString().trim();
          const statusMatch = allowedStatus.find(status => status.toLowerCase() === statusValue.toLowerCase());
          if (!statusMatch) {
            throw new Error(`Invalid Status: ${statusValue}. Allowed values: ${allowedStatus.join(', ')}`);
          }
        }

        // Validate Violation Type enum (case insensitive)
        if (result.violation_type && result.violation_type.toString().trim() !== '') {
          const violationTypeValue = result.violation_type.toString().trim();
          const violationTypeMatch = allowedViolationTypes.find(violationType => violationType.toLowerCase() === violationTypeValue.toLowerCase());
          if (!violationTypeMatch) {
            throw new Error(`Invalid Violation Type: ${violationTypeValue}. Allowed values: ${allowedViolationTypes.join(', ')}`);
          }
        }

        // Validate data format and length
        if (result.rulename && result.rulename.length > 255) {
          throw new Error(`Rule Name too long: ${result.rulename.length} characters (max 255)`);
        }
        
        if (result.src && result.src.length > 1000) {
          throw new Error(`Source too long: ${result.src.length} characters (max 1000)`);
        }
        
        if (result.dst && result.dst.length > 1000) {
          throw new Error(`Destination too long: ${result.dst.length} characters (max 1000)`);
        }
        
        if (result.services && result.services.length > 255) {
          throw new Error(`Services too long: ${result.services.length} characters (max 255)`);
        }
        
        if (result.application && result.application.length > 255) {
          throw new Error(`Application too long: ${result.application.length} characters (max 255)`);
        }
        
        if (result.url && result.url.length > 255) {
          throw new Error(`URL too long: ${result.url.length} characters (max 255)`);
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

          // Create rule + link contacts/tags in one savepoint: rulefirewall
          // has a real UNIQUE constraint on (rulename, firewall_name,
          // audit_batch), so a raw DB error here (or anything else in this
          // block) would otherwise abort the whole shared transaction —
          // every row after it would then fail too, and the final COMMIT
          // would silently discard the entire batch, including rows already
          // reported as SUCCESS. See importSubnets for the same rationale.
          const savepoint = `import_rule_row_${i}`;
          try {
            await client.query(`SAVEPOINT ${savepoint}`);

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

            await client.query(`RELEASE SAVEPOINT ${savepoint}`);
          } catch (writeErr) {
            await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            throw writeErr;
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
      worksheet.addRow(sanitizeExcelObject(result));
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

    // Save Excel file — same public/uploads/temp location (and env
    // override) used by IP/Subnet/Server/Device import
    const importUploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const importTempDir = path.join(process.cwd(), importUploadsDir, 'temp');
    if (!fs.existsSync(importTempDir)) {
      fs.mkdirSync(importTempDir, { recursive: true });
    }
    const excelFileName = `firewall_rule_import_${Date.now()}.xlsx`;
    const excelFilePath = path.join(importTempDir, excelFileName);
    await workbook.xlsx.writeFile(excelFilePath);

    // Send Excel file with import results
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
    res.setHeader('Content-Length', fs.statSync(excelFilePath).size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    // Same key names as IP/Subnet/Server/Device import summaries
    res.setHeader('X-Import-Summary', JSON.stringify({
      total: importResults.length,
      success: successCount,
      failed: errorCount
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
    // path.basename strips any directory components (../ or absolute
    // paths) an attacker could smuggle through the :filename route param.
    const filename = path.basename(req.params.filename || '');
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const filePath = path.join(process.cwd(), uploadsDir, 'temp', filename);

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
