// Web pages: /network/ip-address (list, import, add, edit, delete) and the IP pickers.
import IpAddress from './ip-address.model.js';
import Subnet from './subnet.model.js';
import Tag from '../organize/tag.model.js';
import Contact from '../organize/contact.model.js';
import System from '../system/system.model.js';
import * as ipService from './ip-address.service.js';
import { IPV4_REGEX } from './ip-address.service.js';
import { excelImport, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page, lookupByIds, duplicatePage } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/network/ip-address';
const listFilter = (query) => ({
  status: queryList(query, 'status'), tags: queryList(query, 'tags'), systems: queryList(query, 'systems'),
  contacts: queryList(query, 'contacts'), zone: queryValue(query, 'zone'), environment: queryValue(query, 'environment'),
  subnet_id: parseInt(queryValue(query, 'subnet_id'), 10) || null,
});

// Small lists are rendered with the page; systems / contacts load via AJAX
const linkOptions = async () => {
  const [statusOptions, tagOptions] = await Promise.all([ipService.getIpStatusOptions(), Tag.options()]);
  return { statusOptions, tagOptions };
};

const formInput = (req) => {
  const b = req.body;
  return { description: b.description, status: b.status ?? '', tags: b.tags ?? [], contacts: b.contacts ?? [], systems: b.systems ?? [], updated_by: actorName(req) };
};

async function renderForm(res, mode, ip = {}, copiedFrom = null) {
  res.render('pages/network/ip_address_form', {
    mode, ip, copiedFrom, ...(await linkOptions()),
    title: mode === 'edit' ? 'Edit IP Address' : 'Add IP Address', activeMenu: 'ip-address',
  });
}

const IMPORT_COLUMNS = [
  { header: 'IPAddress (Require, one per row)', key: 'address' },
  { header: 'Description (Optional)', key: 'description' },
  { header: 'Status (Optional)', key: 'status' },
  { header: 'Tag (Optional, comma-separated if multiple)', key: 'tags' },
  { header: 'Contact (Optional, Email or Email prefix, comma-separated if multiple)', key: 'contacts' },
  { header: 'System Name (Optional, comma-separated if multiple)', key: 'systems' },
];

export const ipImport = excelImport({
  name: 'ip_address',
  columns: IMPORT_COLUMNS,
  sample: async () => [
    { address: '192.168.1.10', description: 'Web server', status: 'assigned', tags: 'Production', contacts: 'admin@company.com', systems: 'System 001' },
    { address: '192.168.1.11', description: '', status: 'reserved', tags: '', contacts: '', systems: '' },
  ],
  async prepare(req) {
    return { statuses: (await ipService.getIpStatusOptions()).map((o) => o.id), username: actorName(req) || 'admin' };
  },
  async check(row, ctx) {
    const errors = [];
    if (!row.address) errors.push('IP Address is required');
    else if (!IPV4_REGEX.test(row.address)) errors.push(`Invalid IP format: ${row.address}`);
    if (row.status && ctx.statuses.length && !ctx.statuses.includes(row.status)) errors.push(`Invalid status: ${row.status}. Valid values: ${ctx.statuses.join(', ')}`);
    const missing = [];
    row.tagIds = await resolveNames(splitList(row.tags), (n) => Tag.findByNameExact(n), 'Tag', missing);
    row.contactIds = await resolveNames(splitList(row.contacts), (n) => Contact.findByEmailSearch(n), 'Contact', missing);
    row.systemIds = await resolveNames(splitList(row.systems), (n) => System.findByNameExact(n), 'System', missing);
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);
    const skip = row.address && await IpAddress.findByAddress(row.address) ? 'IP address already exists' : undefined;
    return { errors, skip };
  },
  duplicateKeys: (row) => [row.address],
  save: (row, client, ctx) => ipService.createIpAddress({
    address: row.address, description: row.description || null, status: row.status || null,
    tags: row.tagIds, contacts: row.contactIds, systems: row.systemIds, updated_by: ctx.username,
  }, client),
  resultUrl: (file) => `/network/download/validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, options, zoneOptions, environmentOptions, subnetFilter] = await Promise.all([
      ipService.listIpAddresses({ search, page: pageNo, pageSize, ...filter }),
      linkOptions(), Subnet.distinctValues('zone'), Subnet.distinctValues('environment'), filter.subnet_id ? Subnet.findById(filter.subnet_id) : null,
    ]);
    res.render('pages/network/ip_address_list', {
      ipList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, ...options, zoneOptions, environmentOptions, subnetFilter, ...takeFlash(req), title: 'IP Address', activeMenu: 'ip-address',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await ipService.listIpAddresses({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    const names = (list) => list.map((x) => x.name);
    await sendExcel(res, {
      filename: 'ip_address_list', sheet: 'IP Address List',
      columns: [
        { header: req.t('IP Address'), value: (ip) => ip.ip_address, width: 16 },
        { header: req.t('Description'), value: (ip) => ip.description, width: 36 },
        { header: req.t('Status'), value: (ip) => ip.status, width: 12 },
        { header: req.t('Server'), value: (ip) => names(ip.servers), width: 22 },
        { header: req.t('Device'), value: (ip) => names(ip.devices), width: 22 },
        { header: req.t('Tags'), value: (ip) => names(ip.tags) },
        { header: req.t('Systems'), value: (ip) => names(ip.systems) },
        { header: req.t('Contacts'), value: (ip) => ip.contacts.map((c) => c.email || c.name) },
        { header: req.t('Updated'), value: (ip) => ip.updated_at, width: 20 },
        { header: req.t('Updated By'), value: (ip) => ip.updated_by, width: 16 },
      ],
      rows: items,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),
  // The address is left empty; an "assigned" status belongs to the source's owner
  duplicateForm: duplicatePage(LIST_URL, ipService.getIpAddress,
    ({ ip_address, status, ...rest }) => ({ ...rest, status: status === 'assigned' ? null : status }),
    (res, ip, source) => renderForm(res, 'add', ip, source)),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await ipService.getIpAddress(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  // "a, b, c": one record per address, all or none
  create: (req, res) => runAndRedirect(req, res, LIST_URL,
    () => ipService.createIpAddresses({ ...formInput(req), addresses: req.body.address }), 'IP address added successfully', `${LIST_URL}/add`),
  update: (req, res) => runAndRedirect(req, res, LIST_URL,
    () => ipService.updateIpAddress(req.params.id, formInput(req)), 'IP address updated successfully', `${LIST_URL}/${req.params.id}/edit`),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => ipService.deleteIpAddress(req.params.id), 'IP address deleted successfully'),

  // ===== Pickers (AJAX: the IP table is too large to render into a page) =====
  // ?search= (or ?ids[]= to restore selected values) -> [{id, text}]
  search: page(async (req, res) => {
    if (req.query.ids || req.query['ids[]']) return lookupByIds((ids) => IpAddress.findByIds(ids), (ip) => ip.ip_address)(req, res);
    const rows = await IpAddress.search(String(req.query.search || '').trim(), Math.min(parseInt(req.query.limit, 10) || 20, 100));
    res.json(rows.map((ip) => ({ id: ip.id, text: ip.ip_address })));
  }),
  // Not yet assigned (server / device "add")
  searchUnassigned: page(async (req, res) => {
    const rows = await IpAddress.findUnassignIP({ search: String(req.query.search || '').trim() });
    res.json(rows.map((ip) => ({ id: ip.id, text: ip.ip_address })));
  }),
  // Assigned or not (VIP picker; ?subnet=CIDR for the subnet gateway picker)
  searchAll: page(async (req, res) => {
    const subnet = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(req.query.subnet || '') ? req.query.subnet : undefined;
    const rows = await IpAddress.searchAllForVip({
      search: String(req.query.search || '').trim(), subnet,
      excludeDeviceId: req.query.exclude_device_id || undefined, excludeServerId: req.query.exclude_server_id || undefined,
    });
    const byAddress = req.query.value === 'address';
    res.json(rows.map((ip) => ({ id: byAddress ? ip.ip_address : ip.id, text: ip.owner_label ? `${ip.ip_address} (${req.t('assigned: {owner}', { owner: ip.owner_label })})` : ip.ip_address })));
  }),
  // IP tooltip shown on every page (detail-view.js): ?search=<address> -> [detail] or []
  // Add form, on leaving the address field: ?addresses=a,b ->
  // [{address, state: 'invalid' | 'duplicate' | 'exists' | 'ok', id?, owner?}] (nothing saved)
  check: page(async (req, res) => {
    const list = String(req.query.addresses || '').split(',').map((a) => a.trim()).filter(Boolean).slice(0, 200);
    const existing = new Map((await IpAddress.findExisting(list.filter((a) => IPV4_REGEX.test(a)))).map((r) => [r.ip_address, r]));
    const seen = new Set();
    res.json(list.map((address) => {
      if (!IPV4_REGEX.test(address)) return { address, state: 'invalid' };
      if (seen.has(address)) return { address, state: 'duplicate' };
      seen.add(address);
      const found = existing.get(address);
      return found ? { address, state: 'exists', id: found.id, owner: found.owner_label } : { address, state: 'ok' };
    }));
  }),

  detail: page(async (req, res) => {
    const address = String(req.query.search || req.query.ip || '').trim();
    if (!address) return res.status(400).json({ error: 'Search term or IP address is required' });
    const ip = await IpAddress.findByAddressWithDetails(address);
    if (!ip) return res.json([]);
    res.json([{
      id: ip.id, ip_address: ip.ip_address, ip: ip.ip_address, description: ip.description, status: ip.status, ip_type: ip.ip_type,
      server_name: ip.server_name, device_name: ip.device_name, devices: ip.devices, servers: ip.servers,
      tags: ip.tags.map((x) => x.name), contacts: ip.contacts.map((x) => x.name), systems: ip.systems.map((x) => x.name),
      subnet: ip.subnet, updated_at: ip.updated_at, updated_by: ip.updated_by,
    }]);
  }),
};
