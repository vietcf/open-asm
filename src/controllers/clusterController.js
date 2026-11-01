import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import System from '../modules/system/system.model.js';
import Cluster from '../models/Cluster.js';
import IpAddress from '../models/IpAddress.js';
import { ServiceError, NotFoundError } from '../shared/errors.js';
import { sanitizeExcelRow } from '../utils/excelSafe.js';
import {
  listClusters as listClustersService,
  getCluster,
  getRoleOptions,
  getClustersForSystem,
  createCluster as createClusterService,
  updateCluster as updateClusterService,
  deleteCluster as deleteClusterService
} from '../services/clusterService.js';

const clusterController = {};

const IMPORT_HEADERS = [
  'Cluster Name (Require)',
  'Description (Optional)',
  'IP Address (Require, one row per member)',
  'Role (Optional)',
  'System Name (Optional, comma-separated if multiple)'
];

// Simpler 2-column format for bulk-adding members to one cluster from the
// Add/Edit form, as opposed to IMPORT_HEADERS which creates whole clusters.
const MEMBER_FILE_HEADERS = ['IP Address (Require)', 'Role (Optional)'];

function validateHeaderOrder(headerValues, expectedHeaders) {
  if (headerValues.length !== expectedHeaders.length) {
    return `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headerValues.length}`;
  }
  for (let i = 0; i < expectedHeaders.length; i++) {
    if (headerValues[i] !== expectedHeaders[i]) {
      return `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headerValues[i]}"`;
    }
  }
  return null;
}

// Reads the uploaded workbook into {rows, error}. Shared by validate and
// import so the two never drift on parsing behavior.
async function readImportRows(filePath, expectedHeaders) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  const headers = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => { headers[colNumber] = cell.value; });

  const headerError = validateHeaderOrder(headers.slice(1), expectedHeaders);
  if (headerError) return { error: headerError };

  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rowData = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) rowData[header] = cell.value;
    });
    if (Object.keys(rowData).length > 0) rows.push(rowData);
  }
  return { rows };
}

function toRowResult(row, rowNumber) {
  return {
    row: rowNumber,
    cluster_name: (row['Cluster Name (Require)'] || '').toString().trim(),
    description: (row['Description (Optional)'] || '').toString().trim(),
    ip_address: (row['IP Address (Require, one row per member)'] || '').toString().trim(),
    role: (row['Role (Optional)'] || '').toString().trim(),
    systems: (row['System Name (Optional, comma-separated if multiple)'] || '').toString().trim()
  };
}

// Groups already-parsed row results by cluster name (case-insensitive),
// preserving each group's first-seen order. Every cluster is all-or-nothing:
// one bad row (missing IP/System, or a name collision) fails the whole group
// so nothing gets created "half done".
async function validateClusterGroups(results) {
  const groups = new Map();
  for (const r of results) {
    const key = r.cluster_name.toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { name: r.cluster_name, rows: [] });
    groups.get(key).rows.push(r);
  }

  for (const group of groups.values()) {
    const groupErrors = [];
    const existing = await Cluster.findByNameExact(group.name);
    if (existing.length > 0) groupErrors.push(`Cluster name already exists: ${group.name}`);

    // Description is a cluster-level field but repeats on every member row -
    // if rows disagree on it, that's inconsistent input rather than something
    // safe to silently pick one of.
    const distinctDescriptions = [...new Set(group.rows.map(r => r.description).filter(Boolean))];
    if (distinctDescriptions.length > 1) {
      groupErrors.push(`Inconsistent Description across rows for this cluster - found ${distinctDescriptions.length} different values, leave it blank on all but one row`);
    }

    const seenIps = new Set();
    for (const r of group.rows) {
      const rowErrors = [];
      if (!r.cluster_name) rowErrors.push('Cluster Name is required');
      if (!r.ip_address) {
        rowErrors.push('IP Address is required');
      } else {
        const ip = await IpAddress.findByAddress(r.ip_address);
        if (!ip) {
          rowErrors.push(`IP address not found: ${r.ip_address}. Please create it first.`);
        } else {
          r._ip_id = ip.id;
          const ipKey = r.ip_address.toLowerCase();
          if (seenIps.has(ipKey)) rowErrors.push(`Duplicate IP for this cluster within the file: ${r.ip_address}`);
          seenIps.add(ipKey);
        }
      }
      if (r.systems) {
        const names = r.systems.split(',').map(s => s.trim()).filter(Boolean);
        const notFound = [];
        r._system_ids = [];
        for (const name of names) {
          const systems = await System.findByNameExact(name);
          if (systems && systems.length > 0) r._system_ids.push(systems[0].id);
          else notFound.push(name);
        }
        if (notFound.length > 0) rowErrors.push(`System(s) not found: ${notFound.join(', ')}. Please create them first.`);
      }
      r._rowErrors = rowErrors;
    }

    const anyRowFailed = group.rows.some(r => r._rowErrors.length > 0);
    const groupFails = groupErrors.length > 0 || anyRowFailed;
    for (const r of group.rows) {
      const reasons = [...groupErrors, ...r._rowErrors];
      if (groupFails && reasons.length === 0) {
        reasons.push('Not created - another row for this cluster has an error');
      }
      r.validation_status = groupFails ? 'Fail' : 'Pass';
      r.validation_reason = reasons.join('; ');
    }
  }

  // Rows with no cluster name at all never joined a group above.
  for (const r of results) {
    if (!r.cluster_name) {
      r.validation_status = 'Fail';
      r.validation_reason = 'Cluster Name is required';
    }
  }

  return groups;
}

function buildResultWorkbook(sheetName, results, statusField, reasonField, statusLabel, reasonLabel) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRow([...IMPORT_HEADERS, statusLabel, reasonLabel]);
  results.forEach(r => {
    worksheet.addRow(sanitizeExcelRow([
      r.cluster_name, r.description, r.ip_address, r.role, r.systems,
      r[statusField] || '',
      r[reasonField] || ''
    ]));
  });
  worksheet.columns.forEach(col => { col.width = 24; });
  return workbook;
}

function normalizeFilterArray(val) {
  if (!val || val === 'undefined') return [];
  if (Array.isArray(val)) return val.filter(v => v && v !== 'undefined').map(String);
  if (typeof val === 'string') return [val];
  return [];
}

clusterController.listClusters = async (req, res) => {
  try {
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    let pageSize = parseInt(req.query.pageSize, 10) || pageSizeOptions[0];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    const page = parseInt(req.query.page, 10) || 1;

    const filterParams = {
      search: req.query.search ? req.query.search.trim() : '',
      role: normalizeFilterArray(req.query.role),
      system_id: normalizeFilterArray(req.query.system_id)
    };

    const [{ items: clusterList, totalCount }, roleOptions] = await Promise.all([
      listClustersService({ ...filterParams, page, pageSize }),
      getRoleOptions()
    ]);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

    let selectedSystems = [];
    if (filterParams.system_id.length) {
      selectedSystems = (await Promise.all(filterParams.system_id.map(id => System.findById(id))))
        .filter(Boolean).map(s => ({ id: s.id, text: s.name }));
    }

    const success = req.flash('success')[0];
    const error = req.flash('error')[0];

    res.render('pages/cluster/cluster_list', {
      clusterList,
      search: filterParams.search,
      page,
      pageSize,
      totalPages,
      totalCount,
      startItem,
      endItem,
      filterRole: filterParams.role,
      filterSystemId: filterParams.system_id,
      selectedSystems,
      roleOptions,
      success,
      error,
      title: 'Cluster Management',
      activeMenu: 'cluster'
    });
  } catch (err) {
    res.status(500).send('Error loading clusters: ' + err.message);
  }
};

clusterController.addClusterForm = async (req, res) => {
  const roleOptions = await getRoleOptions();
  res.render('pages/cluster/cluster_add', {
    roleOptions,
    title: 'Add Cluster',
    activeMenu: 'cluster'
  });
};

clusterController.addCluster = async (req, res) => {
  try {
    const { name, description, member_ip_id, member_role, systems } = req.body || {};
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    await createClusterService({ name, description, member_ip_id, member_role, systems, updated_by: username });
    req.flash('success', 'Cluster added successfully');
    res.redirect('/cluster');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to add cluster: ' + err.message;
    req.flash('error', message);
    res.redirect('/cluster/add');
  }
};

clusterController.editClusterForm = async (req, res) => {
  try {
    const id = req.params.id;
    const cluster = await getCluster(id);
    const roleOptions = await getRoleOptions();
    res.render('pages/cluster/cluster_edit', {
      cluster,
      roleOptions,
      title: 'Edit Cluster',
      activeMenu: 'cluster'
    });
  } catch (err) {
    req.flash('error', 'Cluster not found');
    res.redirect('/cluster');
  }
};

clusterController.updateCluster = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description, member_ip_id, member_role, systems } = req.body || {};
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    await updateClusterService(id, {
      name, description,
      member_ip_id: member_ip_id ?? [],
      member_role: member_role ?? [],
      systems: systems ?? [],
      updated_by: username
    });
    req.flash('success', 'Cluster updated successfully');
    res.redirect('/cluster');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to update cluster: ' + err.message;
    req.flash('error', message);
    res.redirect(`/cluster/${req.params.id}/edit`);
  }
};

clusterController.deleteCluster = async (req, res) => {
  try {
    await deleteClusterService(req.params.id);
    req.flash('success', 'Cluster deleted successfully');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to delete cluster: ' + err.message;
    req.flash('error', message);
  }
  res.redirect('/cluster');
};

// AJAX: clusters serving one System, for System Detail's read-only
// "Clusters" section.
clusterController.apiClustersBySystem = async (req, res) => {
  try {
    const systemId = req.query.system_id;
    if (!systemId || isNaN(Number(systemId))) {
      return res.status(400).json({ error: 'system_id is required' });
    }
    const clusters = await getClustersForSystem(systemId);
    res.json({ clusters });
  } catch (err) {
    res.status(500).json({ error: 'Error loading clusters', detail: err.message });
  }
};

clusterController.exportClusterMembers = async (req, res) => {
  try {
    const cluster = await getCluster(req.params.id);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cluster Members');
    worksheet.addRow(['IP Address', 'Server', 'Device', 'Role']);
    (cluster.members || []).forEach(m => {
      worksheet.addRow(sanitizeExcelRow([
        m.ip || '',
        m.server_name || '',
        m.device_name || '',
        m.role || ''
      ]));
    });
    worksheet.columns.forEach(col => { col.width = 24; });

    const safeName = (cluster.name || 'cluster').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_members_${timestamp}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).send('Cluster not found');
    res.status(500).send('Error exporting cluster members: ' + err.message);
  }
};

clusterController.downloadClusterTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cluster Import Template');
    worksheet.addRow(IMPORT_HEADERS);
    worksheet.addRow(['OpenShift Production', 'Production OpenShift cluster', '10.10.10.11', 'master', 'System 001']);
    worksheet.addRow(['OpenShift Production', '', '10.10.10.12', 'worker', '']);
    worksheet.columns.forEach(col => { col.width = 30; });

    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, 'temp_cluster_template.xlsx');
    await workbook.xlsx.writeFile(tempPath);
    res.download(tempPath, 'cluster_import_template.xlsx', (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Error downloading template file' });
      setTimeout(() => { try { fs.unlinkSync(tempPath); } catch (e) {} }, 5000);
    });
  } catch (err) {
    res.status(500).json({ error: 'Error creating template file', detail: err.message });
  }
};

clusterController.downloadMemberTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cluster Members Template');
    worksheet.addRow(MEMBER_FILE_HEADERS);
    worksheet.addRow(['10.10.10.11', 'master']);
    worksheet.addRow(['10.10.10.12', 'worker']);
    worksheet.columns.forEach(col => { col.width = 30; });

    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, 'temp_cluster_member_template.xlsx');
    await workbook.xlsx.writeFile(tempPath);
    res.download(tempPath, 'cluster_member_template.xlsx', (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Error downloading template file' });
      setTimeout(() => { try { fs.unlinkSync(tempPath); } catch (e) {} }, 5000);
    });
  } catch (err) {
    res.status(500).json({ error: 'Error creating template file', detail: err.message });
  }
};

// Validates an IP/Role file for the Add/Edit form's "bulk add members"
// helper - same contract as the list page's cluster import validate step:
// streams back a downloadable Excel report (Validation Status/Reason per
// row) plus an X-Validation-Summary header. Rows never get added to the
// form unless the whole file passes (X-Resolved-Members carries the
// {ip_address_id, ip, role} for each passed row, but the client is only
// meant to act on it when allPassed is true) - never writes to the DB
// itself either way, the actual save still happens on form submit.
clusterController.validateMembersFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = req.file.path;
  try {
    const { rows, error } = await readImportRows(filePath, MEMBER_FILE_HEADERS);
    if (error) return res.status(400).json({ error });

    const clusterId = req.body.cluster_id ? Number(req.body.cluster_id) : null;
    const existingIpIds = new Set(clusterId ? await Cluster.getMemberIpIds(clusterId) : []);
    // Rows already sitting in the form but not yet saved (freshly added by
    // hand, or from an earlier file in this same session) aren't in the DB
    // yet either - the client sends their IP ids along so re-uploading a
    // file that repeats one still gets caught as "already a member".
    const formIpIds = req.body.existing_ip_ids;
    (Array.isArray(formIpIds) ? formIpIds : (formIpIds ? [formIpIds] : []))
      .map(Number).filter(id => !isNaN(id)).forEach(id => existingIpIds.add(id));
    const seenInFile = new Set();

    const results = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const ip_address = (row['IP Address (Require)'] || '').toString().trim();
      const role = (row['Role (Optional)'] || '').toString().trim();
      const result = { row: rowNumber, ip_address, role, validation_status: 'Pass', validation_reason: '' };

      if (!ip_address) {
        result.validation_status = 'Fail';
        result.validation_reason = 'IP Address is required';
      } else {
        const ip = await IpAddress.findByAddress(ip_address);
        if (!ip) {
          result.validation_status = 'Fail';
          result.validation_reason = 'IP address not found. Please create it first.';
        } else if (existingIpIds.has(ip.id)) {
          result.validation_status = 'Fail';
          result.validation_reason = 'Already a member of this cluster';
        } else if (seenInFile.has(ip.id)) {
          result.validation_status = 'Fail';
          result.validation_reason = 'Duplicate IP within this file';
        } else {
          seenInFile.add(ip.id);
          result.ip_id = ip.id;
        }
      }
      results.push(result);
    }

    const passCount = results.filter(r => r.validation_status === 'Pass').length;
    const failCount = results.length - passCount;
    const allPassed = failCount === 0;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Validation Results');
    worksheet.addRow([...MEMBER_FILE_HEADERS, 'Validation Status', 'Validation Reason']);
    results.forEach(r => {
      worksheet.addRow(sanitizeExcelRow([r.ip_address, r.role, r.validation_status, r.validation_reason]));
    });
    worksheet.columns.forEach(col => { col.width = 24; });

    res.setHeader('X-Validation-Summary', JSON.stringify({ total: results.length, passed: passCount, failed: failCount, allPassed }));
    // Only meaningful when allPassed - the client only acts on this to
    // populate the member rows once the whole file has validated clean.
    // HTTP headers are Latin-1 only, so a role containing non-ASCII text
    // (Vietnamese, etc.) would otherwise throw ERR_INVALID_CHAR - percent-
    // encode the JSON payload, decodeURIComponent it back on the client.
    if (allPassed) {
      res.setHeader('X-Resolved-Members', encodeURIComponent(JSON.stringify(
        results.map(r => ({ ip_address_id: r.ip_id, ip: r.ip_address, role: r.role }))
      )));
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="cluster_member_validation.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Error validating file', detail: err.message });
  } finally {
    try { fs.unlinkSync(filePath); } catch (e) {}
  }
};

// Dry-run: parses and validates the uploaded file without creating
// anything, then streams back an Excel report (Validation Status/Reason per
// row) plus an X-Validation-Summary header the client reads for pass/fail
// counts - same contract as Network's IP import.
clusterController.validateImportClusters = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = req.file.path;
  try {
    const { rows, error } = await readImportRows(filePath, IMPORT_HEADERS);
    if (error) return res.status(400).json({ error });

    const results = rows.map((row, i) => toRowResult(row, i + 2));
    await validateClusterGroups(results);

    const workbook = buildResultWorkbook('Validation Results', results, 'validation_status', 'validation_reason', 'Validation Status', 'Validation Reason');
    const passCount = results.filter(r => r.validation_status === 'Pass').length;
    const failCount = results.length - passCount;
    res.setHeader('X-Validation-Summary', JSON.stringify({
      total: results.length, passed: passCount, failed: failCount, allPassed: failCount === 0
    }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="cluster_import_validation.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Error validating import file', detail: err.message });
  } finally {
    try { fs.unlinkSync(filePath); } catch (e) {}
  }
};

// Actually creates clusters. Each cluster-name group is created via
// createClusterService, which opens its own transaction internally, so one
// group failing never rolls back groups already committed earlier in the
// same file. A group only gets created once every row in it - and the
// cluster name itself - passed validation; partial groups are never created.
clusterController.importClusters = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = req.file.path;
  try {
    const { rows, error } = await readImportRows(filePath, IMPORT_HEADERS);
    if (error) return res.status(400).json({ error });

    const results = rows.map((row, i) => toRowResult(row, i + 2));
    const groups = await validateClusterGroups(results);
    const username = (req.session && req.session.user && req.session.user.username) || 'admin';

    for (const group of groups.values()) {
      const groupPassed = group.rows.every(r => r.validation_status === 'Pass');
      if (!groupPassed) {
        group.rows.forEach(r => {
          r.import_status = 'Failed';
          r.import_reason = r.validation_reason;
        });
        continue;
      }
      const description = group.rows.map(r => r.description).find(Boolean) || null;
      const systemIds = [...new Set(group.rows.flatMap(r => r._system_ids || []))];
      try {
        await createClusterService({
          name: group.name,
          description,
          member_ip_id: group.rows.map(r => r._ip_id),
          member_role: group.rows.map(r => r.role),
          systems: systemIds,
          updated_by: username
        });
        group.rows.forEach(r => {
          r.import_status = 'Success';
          r.import_reason = 'Cluster created successfully';
        });
      } catch (err) {
        const message = err instanceof ServiceError ? err.message : (err.message || 'Unknown error');
        group.rows.forEach(r => {
          r.import_status = 'Failed';
          r.import_reason = message;
        });
      }
    }
    // Rows that never joined a group (blank Cluster Name) already failed in
    // validateClusterGroups and were never visited by the loop above.
    results.forEach(r => {
      if (!r.import_status) {
        r.import_status = 'Failed';
        r.import_reason = r.validation_reason;
      }
    });

    const workbook = buildResultWorkbook('Import Results', results, 'import_status', 'import_reason', 'Import Status', 'Import Reason');
    const successCount = results.filter(r => r.import_status === 'Success').length;
    res.setHeader('X-Import-Summary', JSON.stringify({
      total: results.length, success: successCount, failed: results.length - successCount
    }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="cluster_import_results.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Error importing clusters', detail: err.message });
  } finally {
    try { fs.unlinkSync(filePath); } catch (e) {}
  }
};

// AJAX: role autocomplete suggestions
clusterController.apiRoleOptions = async (req, res) => {
  try {
    const roles = await getRoleOptions();
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ error: 'Error loading roles', detail: err.message });
  }
};

// AJAX: check on blur whether a cluster name is already taken, so the
// Add/Edit form can warn immediately instead of waiting for a failed submit.
// exclude_id lets Edit ignore the cluster's own current name.
clusterController.apiCheckName = async (req, res) => {
  try {
    const name = (req.query.name || '').toString().trim();
    if (!name) return res.json({ available: true });
    const excludeId = req.query.exclude_id;
    const existing = await Cluster.findByNameExact(name);
    const clash = existing.some(c => String(c.id) !== String(excludeId));
    res.json({ available: !clash });
  } catch (err) {
    res.status(500).json({ error: 'Error checking cluster name', detail: err.message });
  }
};

export default clusterController;
