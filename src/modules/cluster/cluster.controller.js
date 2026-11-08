// Web pages: /cluster (list, import, add, edit, delete, members export) and AJAX.
import fs from 'fs';
import XLSX from 'xlsx';
import Cluster from './cluster.model.js';
import System from '../system/system.model.js';
import IpAddress from '../network/ip-address.model.js';
import * as clusterService from './cluster.service.js';
import { excelImport, sendTemplate, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryList, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/cluster';
const listFilter = (query) => ({ role: queryList(query, 'role'), system_id: queryList(query, 'system_id') });

// System rows: parallel system_id[] / system_namespace[]
const formInput = (req) => {
  const b = req.body;
  const namespaces = [].concat(b.system_namespace ?? []);
  const systems = [].concat(b.system_id ?? []).map((id, i) => ({ system_id: id, namespace: namespaces[i] }));
  return { name: b.name, description: b.description, member_ip_id: b.member_ip_id ?? [], member_role: b.member_role ?? [], systems, updated_by: actorName(req) };
};

// "System 001[ns-payment]" -> { name: 'System 001', namespace: 'ns-payment' }
function parseSystemCell(value) {
  const m = String(value).match(/^(.+?)\s*\[(.*)\]$/);
  return m ? { name: m[1].trim(), namespace: m[2].trim() } : { name: String(value).trim(), namespace: '' };
}

// "System 001 (ns-payment)" for exports
const systemLabel = (s) => (s.namespace ? `${s.name} (${s.namespace})` : s.name);

async function renderForm(res, mode, cluster = {}) {
  res.render('pages/cluster/cluster_form', {
    mode, cluster, roleOptions: await clusterService.getRoleOptions(),
    systemRows: (cluster.systems || []).map((s) => ({ id: s.id, text: s.name, namespace: s.namespace || '' })),
    title: mode === 'edit' ? 'Edit Cluster' : 'Add Cluster', activeMenu: 'cluster',
  });
}

// One row per member; rows with the same cluster name make one cluster,
// created only when every row of it is valid.
export const clusterImport = excelImport({
  name: 'cluster',
  columns: [
    { header: 'Cluster Name (Require)', key: 'name' },
    { header: 'Description (Optional)', key: 'description' },
    { header: 'IP Address (Require, one row per member)', key: 'ip' },
    { header: 'Role (Optional)', key: 'role' },
    { header: 'System Name (Optional, comma-separated if multiple)', key: 'systems' },
  ],
  sample: async () => [
    { name: 'OpenShift Production', description: 'Production OpenShift cluster', ip: '10.10.10.11', role: 'master', systems: 'System 001[ns-system-001], System 002' },
    { name: 'OpenShift Production', description: '', ip: '10.10.10.12', role: 'worker', systems: '' },
  ],
  prepare: async (req) => ({ username: actorName(req) || 'admin' }),
  async check(row) {
    const errors = [];
    if (!row.name) errors.push('Cluster Name is required');
    if (!row.ip) errors.push('IP Address is required');
    else {
      row.ipId = (await IpAddress.findByAddress(row.ip))?.id;
      if (!row.ipId) errors.push(`IP address not found: ${row.ip}. Please create it first.`);
    }
    const missing = [];
    const cells = splitList(row.systems).map(parseSystemCell);
    const ids = await resolveNames(cells.map((c) => c.name), (n) => System.findByNameExact(n), 'System', missing);
    row.systemRows = ids.length === cells.length ? cells.map((c, i) => ({ system_id: ids[i], namespace: c.namespace })) : [];
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);
    return { errors };
  },
  groupBy: (row) => row.name.toLowerCase(),
  async checkGroup(rows) {
    const errors = [];
    if (rows[0].name && (await Cluster.findByNameExact(rows[0].name)).length) errors.push(`Cluster name already exists: ${rows[0].name}`);
    if (new Set(rows.map((r) => r.description).filter(Boolean)).size > 1) errors.push('Inconsistent Description across rows for this cluster - leave it blank on all but one row');
    const ips = rows.map((r) => r.ip.toLowerCase()).filter(Boolean);
    if (new Set(ips).size < ips.length) errors.push('Duplicate IP for this cluster within the file');
    return errors;
  },
  save: (rows, client, ctx) => clusterService.createCluster({
    name: rows[0].name,
    description: rows.map((r) => r.description).find(Boolean) || null,
    member_ip_id: rows.map((r) => r.ipId),
    member_role: rows.map((r) => r.role),
    systems: rows.flatMap((r) => r.systemRows), // the first namespace given for a system wins
    updated_by: ctx.username,
  }, client),
  resultUrl: (file) => `/cluster/download/cluster-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, roleOptions] = await Promise.all([
      clusterService.listClusters({ search, page: pageNo, pageSize, ...filter }),
      clusterService.getRoleOptions(),
    ]);
    res.render('pages/cluster/cluster_list', {
      clusterList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, roleOptions, ...takeFlash(req), title: 'Cluster Management', activeMenu: 'cluster',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await clusterService.listClusters({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    const rows = items.flatMap((c) => (c.members.length ? c.members : [{}]).map((m) => ({ ...m, cluster: c })));
    await sendExcel(res, {
      filename: 'cluster-list', sheet: 'Clusters',
      columns: [
        { header: req.t('Cluster Name'), value: (r) => r.cluster.name, width: 28 },
        { header: req.t('Description'), value: (r) => r.cluster.description, width: 36 },
        { header: req.t('Systems'), value: (r) => r.cluster.systems.map(systemLabel) },
        { header: req.t('IP Address'), value: (r) => r.ip, width: 16 },
        { header: req.t('Role'), value: (r) => r.role, width: 14 },
        { header: req.t('Server'), value: (r) => r.server_name, width: 22 },
        { header: req.t('Device'), value: (r) => r.device_name, width: 22 },
      ],
      rows,
    });
  }),

  // Members of one cluster
  exportMembers: page(async (req, res) => {
    const cluster = await clusterService.getCluster(req.params.id);
    await sendExcel(res, {
      filename: (cluster.name || 'cluster').replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '_members', sheet: 'Cluster Members',
      columns: [
        { header: req.t('IP Address'), value: (m) => m.ip, width: 16 },
        { header: req.t('Server'), value: (m) => m.server_name, width: 24 },
        { header: req.t('Device'), value: (m) => m.device_name, width: 24 },
        { header: req.t('Role'), value: (m) => m.role, width: 16 },
      ],
      rows: cluster.members || [],
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await clusterService.getCluster(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => clusterService.createCluster(formInput(req)), 'Cluster added successfully', '/cluster/add'),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, () => clusterService.updateCluster(req.params.id, formInput(req)), 'Cluster updated successfully', `/cluster/${req.params.id}/edit`),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => clusterService.deleteCluster(req.params.id), 'Cluster deleted successfully'),

  // ===== Members file (form helper) =====
  memberTemplate: page((req, res) => sendTemplate(res, 'cluster_member', ['IP Address (Require)', 'Role (Optional)'], [['10.10.10.11', 'master'], ['10.10.10.12', 'worker']])),

  // Checks an "IP Address | Role" file against the IPs already in the form
  // (existing_ip_ids[]): { allPassed, results: [{row, ip, role, ip_address_id, error}] }. Nothing is saved.
  validateMembers: page(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const sheet = XLSX.readFile(req.file.path);
      const data = XLSX.utils.sheet_to_json(sheet.Sheets[sheet.SheetNames[0]], { header: 1 });
      const headers = (data[0] || []).map((h) => String(h ?? '').trim());
      if (headers[0] !== 'IP Address (Require)' || headers[1] !== 'Role (Optional)') {
        return res.status(400).json({ error: 'Invalid file format. Expected columns: "IP Address (Require)", "Role (Optional)"' });
      }
      const taken = new Set(queryList(req.body, 'existing_ip_ids').map(Number));
      const results = [];
      for (const [i, cells] of data.slice(1).entries()) {
        const ip = String(cells[0] ?? '').trim();
        const role = String(cells[1] ?? '').trim();
        if (!ip && !role) continue;
        const result = { row: i + 2, ip, role, ip_address_id: null, error: null };
        const record = ip ? await IpAddress.findByAddress(ip) : null;
        if (!ip) result.error = 'IP Address is required';
        else if (!record) result.error = 'IP address not found. Please create it first.';
        else if (taken.has(record.id)) result.error = 'Already a member of this cluster';
        else { taken.add(record.id); result.ip_address_id = record.id; }
        results.push(result);
      }
      res.json({ allPassed: results.every((r) => !r.error), results });
    } finally {
      fs.rm(req.file.path, { force: true }, () => {});
    }
  }),

  // ===== AJAX =====
  roles: page(async (req, res) => res.json({ roles: await clusterService.getRoleOptions() })),
  bySystem: page(async (req, res) => {
    if (!Number(req.query.system_id)) return res.status(400).json({ error: 'system_id is required' });
    res.json({ clusters: await clusterService.getClustersForSystem(req.query.system_id) });
  }),
  // ?name=&exclude_id= -> { available }
  checkName: page(async (req, res) => {
    const name = String(req.query.name || '').trim();
    const existing = name ? await Cluster.findByNameExact(name) : [];
    res.json({ available: !existing.some((c) => String(c.id) !== String(req.query.exclude_id)) });
  }),
};
