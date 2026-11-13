// Web pages: /customer (list, export, import, add, edit, delete), file view, select2 lookups.
import Customer from './customer.model.js';
import Unit from '../organize/unit.model.js';
import Device from '../device/device.model.js';
import IpAddress from '../network/ip-address.model.js';
import FileUpload from '../file/file-upload.model.js';
import * as customerService from './customer.service.js';
import { attachTmpUploads, removeObjectFiles } from '../file/file.service.js';
import { excelImport, splitList } from '../../shared/excelImport.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, actorId, runAndRedirect, page, lookup, lookupByIds } from '../../shared/web.js';
import { activeFields, attributeText } from '../../shared/customFields.js';
import { sendExcel } from '../../utils/excelExport.js';
import { serveFileInline } from '../../utils/fileServe.js';
import { optionLabel } from '../../utils/viewHelpers.js';

const LIST_URL = '/customer';

// ?type=&status=&channel=&unit_id=&device_id=&attr_<key>= (select custom fields shown on the list)
function listFilter(query, defs = []) {
  const attr = {};
  for (const d of activeFields(defs)) if (d.type === 'select' && d.list) attr[d.key] = queryValue(query, `attr_${d.key}`);
  return {
    type: queryList(query, 'type'), status: queryList(query, 'status'), channel: queryList(query, 'channel'),
    unit_id: queryValue(query, 'unit_id'), device_id: queryValue(query, 'device_id'), attr,
  };
}

// Parallel arrays of the form rows (empty selects post '' so the rows stay aligned)
const rows = (b, prefix, keys) => {
  const cols = Object.fromEntries(keys.map((k) => [k, [].concat(b[`${prefix}_${k}`] ?? [])]));
  const n = Math.max(0, ...Object.values(cols).map((c) => c.length));
  return Array.from({ length: n }, (_, i) => Object.fromEntries(keys.map((k) => [k, cols[k][i] ?? ''])));
};

const CONNECTION_KEYS = ['id', 'name', 'channel', 'role', 'device_id', 'local_ip_id',
  'status', 'start_date', 'end_date', 'description', 'networks'];

const formInput = (req) => {
  const b = req.body;
  return {
    name: b.name, code: b.code, type: b.type, status: b.status, unit_id: b.unit_id, description: b.description,
    attributes: b.attr || {}, wholeAttributes: true,
    owner_ids: b.owner_ids ?? [],
    contacts: rows(b, 'contact', ['name', 'role', 'email', 'phone']),
    connections: rows(b, 'conn', CONNECTION_KEYS),
    updated_by: actorName(req),
  };
};

// "10.1.0.0/24 Core servers" lines of a connection (form textarea, exports)
const networksText = (networks, sep = '\n') => (networks || []).map((n) => (n.description ? `${n.network} ${n.description}` : n.network)).join(sep);

async function formOptions() {
  const [typeOptions, statusOptions, channelOptions, units, customFields] = await Promise.all([
    customerService.getTypeOptions(), customerService.getStatusOptions(), customerService.getChannelOptions(),
    Unit.findLeaves(), customerService.getCustomFields(),
  ]);
  return { typeOptions, statusOptions, channelOptions, unitOptions: units.map((u) => ({ id: String(u.id), text: u.name })), customFields };
}

async function renderForm(res, mode, customer = {}) {
  res.render('pages/customer/customer_form', {
    mode, customer, ...(await formOptions()), networksText,
    connectionRoles: customerService.CONNECTION_ROLES, connectionStatuses: customerService.CONNECTION_STATUSES,
    title: mode === 'edit' ? 'Edit Customer' : 'Add Customer', activeMenu: 'customer',
  });
}

// Files of the form: new uploads, and on edit the removed ones
const formFiles = (req, edit) => async (customerId, c) => {
  await attachTmpUploads('customer', customerId, edit ? req.body.uploaded_docs_edit : req.body.uploaded_docs, actorId(req), c);
  return edit ? removeObjectFiles('customer', customerId, req.body.delete_files, c) : [];
};

// "sla_level=Gold; contract_no=HD-01" -> {sla_level: 'Gold', contract_no: 'HD-01'}
function parseAttributes(text) {
  const out = {};
  for (const part of String(text || '').split(';')) {
    const s = part.trim();
    if (!s) continue;
    const i = s.indexOf('=');
    if (i < 1) throw new Error(`Custom fields: use key=value separated by ";" (${s})`);
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return out;
}

// One row per connection; rows with the same customer name make one customer, created only
// when every row of it is valid. IPs / networks: "10.1.0.0/24 Core, 10.2.0.5" (comma or new line).
export const customerImport = excelImport({
  name: 'customer',
  columns: [
    { header: 'Customer Name (Require)', key: 'name' },
    { header: 'Code (Optional)', key: 'code' },
    { header: 'Type (Optional)', key: 'type' },
    { header: 'Status (Optional)', key: 'status' },
    { header: 'Unit in charge (Optional)', key: 'unit' },
    { header: 'Description (Optional)', key: 'description' },
    { header: 'Custom fields (Optional, key=value; key=value)', key: 'attributes' },
    { header: 'Connection Name (Optional, one row per connection)', key: 'conn_name' },
    { header: 'Channel (Require with a connection)', key: 'conn_channel' },
    { header: 'Role (Optional: primary / backup)', key: 'conn_role' },
    { header: 'Our Device (Optional, exact name)', key: 'conn_device' },
    { header: 'Our IP (Optional, must exist in the IP inventory)', key: 'conn_local_ip' },
    { header: 'Start Date (Optional, YYYY-MM-DD)', key: 'conn_start_date' },
    { header: 'End Date (Optional, YYYY-MM-DD)', key: 'conn_end_date' },
    { header: 'Customer IPs / Networks (Optional, comma-separated: IP or CIDR, then a description)', key: 'conn_networks' },
  ],
  sample: async () => [
    { name: 'Bank A', code: 'BANKA', type: 'Customer', status: 'active', unit: '', description: 'Payment partner', attributes: '',
      conn_name: 'VPN HCM', conn_channel: 'VPN site-to-site', conn_role: 'primary',
      conn_device: '', conn_local_ip: '', conn_start_date: '2026-01-01', conn_end_date: '', conn_networks: '10.20.0.0/24 Core servers, 10.20.1.5 API gateway, 203.0.113.10 VPN peer' },
    { name: 'Bank A', conn_name: 'Internet', conn_channel: 'Internet whitelist', conn_networks: '198.51.100.7 Office NAT' },
  ],
  prepare: async (req) => ({ username: actorName(req) || 'admin' }),
  async check(row) {
    const errors = [];
    if (!row.name) errors.push('Customer Name is required');
    try { row._attributes = parseAttributes(row.attributes); } catch (e) { errors.push(e.message); }
    if (row.unit) {
      row._unitId = (await Unit.findByName(row.unit))?.id;
      if (!row._unitId) errors.push(`Unit not found: ${row.unit}`);
    }
    if (row.conn_name) {
      if (row.conn_device) {
        row._deviceId = (await Device.findByName(row.conn_device))?.id;
        if (!row._deviceId) errors.push(`Device not found: ${row.conn_device}`);
      }
      if (row.conn_local_ip) {
        row._localIpId = (await IpAddress.findByAddress(row.conn_local_ip))?.id;
        if (!row._localIpId) errors.push(`IP address not found: ${row.conn_local_ip}. Please create it first.`);
      }
      try { customerService.parseNetworks(splitList(row.conn_networks.replace(/\n/g, ','))); } catch (e) { errors.push(e.message); }
    } else if (row.conn_channel || row.conn_networks) {
      errors.push('Connection Name is required with a channel or networks');
    }
    return { errors };
  },
  groupBy: (row) => row.name.toLowerCase(),
  async checkGroup(groupRows) {
    const errors = [];
    if (groupRows[0].name && (await Customer.findByNameExact(groupRows[0].name)).length) errors.push(`Customer name already exists: ${groupRows[0].name}`);
    for (const key of ['code', 'type', 'status', 'unit', 'description', 'attributes']) {
      if (new Set(groupRows.map((r) => r[key]).filter(Boolean)).size > 1) errors.push(`Inconsistent ${key} across rows of this customer - fill it on one row only`);
    }
    return errors;
  },
  save: (groupRows, client, ctx) => {
    const first = (key) => groupRows.map((r) => r[key]).find(Boolean) || null;
    return customerService.createCustomer({
      name: groupRows[0].name, code: first('code'), type: first('type'), status: first('status'),
      unit_id: groupRows.map((r) => r._unitId).find(Boolean) || null, description: first('description'),
      attributes: groupRows.map((r) => r._attributes).find((a) => a && Object.keys(a).length) || {},
      connections: groupRows.filter((r) => r.conn_name).map((r) => ({
        name: r.conn_name, channel: r.conn_channel, role: r.conn_role, device_id: r._deviceId, local_ip_id: r._localIpId,
        start_date: r.conn_start_date, end_date: r.conn_end_date, networks: splitList(r.conn_networks.replace(/\n/g, ',')),
      })),
      updated_by: ctx.username,
    }, client);
  },
  resultUrl: (file) => `/customer/download/customer-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const options = await formOptions();
    const filter = listFilter(req.query, options.customFields);
    const { items, totalCount } = await customerService.listCustomers({ search, page: pageNo, pageSize, ...filter });
    res.render('pages/customer/customer_list', {
      customerList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, ...options, ...takeFlash(req), title: 'Customers', activeMenu: 'customer',
    });
  }),

  // One row per connection (a customer without connection: one row)
  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const options = await formOptions();
    const { items } = await customerService.listCustomers({ search, page: 1, pageSize: 10000, ...listFilter(req.query, options.customFields) });
    const fields = activeFields(options.customFields);
    const label = (opts, v) => optionLabel(opts, v, req.t);
    const exportRows = items.flatMap((c) => (c.connections.length ? c.connections : [{}]).map((x) => ({ c, x })));
    await sendExcel(res, {
      filename: 'customer-list', sheet: 'Customers',
      columns: [
        { header: req.t('Customer Name'), value: (r) => r.c.name, width: 28 },
        { header: req.t('Code'), value: (r) => r.c.code, width: 12 },
        { header: req.t('Type'), value: (r) => label(options.typeOptions, r.c.type), width: 14 },
        { header: req.t('Status'), value: (r) => label(options.statusOptions, r.c.status), width: 12 },
        { header: req.t('Unit in charge'), value: (r) => r.c.unit?.name, width: 22 },
        { header: req.t('Our contacts'), value: (r) => r.c.owners.map((o) => o.email || o.name), width: 28 },
        { header: req.t('Customer contacts'), value: (r) => r.c.contacts.map((p) => [p.name, p.role && `(${p.role})`, p.email, p.phone].filter(Boolean).join(' ')), width: 36 },
        ...fields.map((d) => ({ header: d.label, value: (r) => attributeText(d, r.c.attributes?.[d.key], req.t), width: 16 })),
        { header: req.t('Connection'), value: (r) => r.x.name, width: 22 },
        { header: req.t('Channel'), value: (r) => r.x.channel && label(options.channelOptions, r.x.channel), width: 18 },
        { header: req.t('Role'), value: (r) => r.x.role && req.t(r.x.role === 'primary' ? 'Primary' : 'Backup'), width: 10 },
        { header: req.t('Our Device'), value: (r) => r.x.device_name, width: 20 },
        { header: req.t('Our IP'), value: (r) => r.x.local_ip, width: 16 },
        { header: req.t('Connection Status'), value: (r) => r.x.status && req.t(r.x.status === 'active' ? 'Active' : 'Inactive'), width: 12 },
        { header: req.t('Start Date'), value: (r) => r.x.start_date, width: 12 },
        { header: req.t('End Date'), value: (r) => r.x.end_date, width: 12 },
        { header: req.t('Customer IPs / Networks'), value: (r) => networksText(r.x.networks, ', '), width: 40 },
        { header: req.t('Description'), value: (r) => r.c.description, width: 36 },
        { header: req.t('Updated'), value: (r) => r.c.updated_at && new Date(r.c.updated_at), width: 20 },
        { header: req.t('Updated by'), value: (r) => r.c.updated_by, width: 16 },
      ],
      rows: exportRows,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await customerService.getCustomer(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => customerService.createCustomer(formInput(req), null, formFiles(req, false)),
    'Customer added successfully', '/customer/add'),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, () => customerService.updateCustomer(req.params.id, formInput(req), null, formFiles(req, true)),
    'Customer updated successfully', `/customer/${req.params.id}/edit`),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => customerService.deleteCustomer(req.params.id), 'Customer deleted successfully'),

  // Attachment opened inline in a new tab (safe types only, see fileServe.js)
  viewFile: page(async (req, res) => {
    const file = Number(req.params.id) ? await FileUpload.findById(req.params.id) : null;
    if (!file || file.object_type !== 'customer') return res.status(404).send('File not found');
    if (process.env.FILE_UPLOAD_DRIVER === 's3') return res.redirect(FileUpload.getUrl(file));
    serveFileInline(res, { file, folder: 'customer' });
  }),

  // Detail modal: the customer with its files
  detail: page(async (req, res) => res.json(await customerService.getCustomer(req.params.id))),

  // ===== AJAX =====
  lookup: lookup((search) => Customer.select2Search(search)),
  lookupByIds: lookupByIds((ids) => Customer.findByIds(ids), (c) => (c.code ? `${c.name} (${c.code})` : c.name)),
};
