// Web pages: /network/service-mapping (list, export, import, add, edit, delete) and lookups.
import ServiceMapping from './service-mapping.model.js';
import Device from '../device/device.model.js';
import System from '../system/system.model.js';
import * as smService from './service-mapping.service.js';
import { IPV4_REGEX } from './ip-address.service.js';
import { excelImport, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page, lookup } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/network/service-mapping';
const PROTOCOL_OPTIONS = ['HTTP', 'HTTPS', 'TCP', 'UDP'];
const DIRECTION_OPTIONS = ['inbound', 'outbound'];
const SCOPE_OPTIONS = ['public', 'private'];
const ACCESS_OPTIONS = ['full', 'limited'];
const STATUS_OPTIONS = ['active', 'inactive'];

function listFilter(query) {
  return {
    protocol: queryValue(query, 'protocol'),
    provider: queryValue(query, 'provider'),
    device_id: queryValue(query, 'device_id'),
    direction: queryValue(query, 'direction'),
    scope: queryValue(query, 'scope'),
    access_mode: queryValue(query, 'access_mode'),
    system_id: queryValue(query, 'system_id'),
  };
}

async function formInput(req) {
  const b = req.body;
  return {
    name: b.name, domain: b.domain, provider: b.provider,
    ip_address: b.ip_address, port: b.port, protocol: b.protocol,
    direction: b.direction, scope: b.scope, access_mode: b.access_mode, allowed_ips: b.allowed_ips,
    device_id: b.device_id || null, system_id: b.system_id || null, description: b.description,
    member_ip: b.member_ip ?? [], member_port: b.member_port ?? [], member_status: b.member_status ?? [],
    updated_by: actorName(req),
  };
}

const options = (rows, text = (r) => r.name) => (rows || []).map((r) => ({ id: r.id, text: text(r) }));

async function renderForm(res, mode, vs = {}, copiedFrom = null) {
  const [providerOptions, protocolOptions] = await Promise.all([
    smService.getProviderOptions(),
    smService.getProtocolOptions(),
  ]);
  const allProtocols = [...new Set([...PROTOCOL_OPTIONS, ...protocolOptions])];
  res.render('pages/network/service_mapping_form', {
    mode, vs, copiedFrom, providerOptions, protocolOptions: allProtocols, directionOptions: DIRECTION_OPTIONS, scopeOptions: SCOPE_OPTIONS, accessOptions: ACCESS_OPTIONS, statusOptions: STATUS_OPTIONS,
    selected: {
      ip: vs.ip_address_id ? [{ id: vs.ip_address_id, text: vs.ip_address }] : [],
      domain: vs.domain_id ? [{ id: vs.domain_id, text: vs.domain }] : [],
      device: vs.device_id ? [{ id: vs.device_id, text: vs.device_name }] : [],
      system: vs.system_id ? [{ id: vs.system_id, text: vs.system_name }] : [],
      members: (vs.members || []).map((m) => ({ id: m.ip_address_id, text: m.server_name ? `${m.ip} (${m.server_name})` : m.ip, port: m.port, status: m.status })),
    },
    title: mode === 'edit' ? 'Edit Service Mapping' : 'Add Service Mapping', activeMenu: 'service-mapping',
  });
}

export const serviceMappingImport = excelImport({
  name: 'service-mapping',
  columns: [
    { header: 'Name (Optional - auto-generated if empty)', key: 'name' },
    { header: 'Domain (Optional, created if new)', key: 'domain' },
    { header: 'Provider (Optional, e.g. Akamai, Cloudflare)', key: 'provider' },
    { header: 'IP Address (Require, created if new)', key: 'ip_address' },
    { header: 'Port (Require)', key: 'port' },
    { header: 'Protocol (Optional, default HTTPS)', key: 'protocol' },
    { header: 'Direction (Optional, inbound/outbound, default inbound)', key: 'direction' },
    { header: 'Scope (Optional, public/private, default public)', key: 'scope' },
    { header: 'Access (Optional, full/limited, default full)', key: 'access_mode' },
    { header: 'Allowed IPs (Optional, only used when Access = limited, comma-separated IP/CIDR)', key: 'allowed_ips' },
    { header: 'System Name (Optional)', key: 'system' },
    { header: 'Device Name (Optional, LB device)', key: 'device' },
    { header: 'Backend IPs (Optional, ip:port comma-separated, created if new)', key: 'backends' },
    { header: 'Description (Optional)', key: 'description' },
  ],
  sample: async () => [
    { name: 'Web Production', domain: 'app.example.com', provider: 'Akamai', ip_address: '203.0.113.10', port: 443,
      protocol: 'HTTPS', direction: 'inbound', scope: 'public', access_mode: 'full', allowed_ips: '', system: '',
      device: 'F5-01', backends: '10.10.20.10:8080,10.10.20.11:8080', description: 'Production web frontend' },
    { name: 'Partner API', domain: 'partner.example.com', provider: 'Akamai', ip_address: '203.0.113.11', port: 443,
      protocol: 'HTTPS', direction: 'inbound', scope: 'public', access_mode: 'limited', allowed_ips: '198.51.100.0/24,192.0.2.15', system: '',
      device: '', backends: '10.10.20.20:8080', description: 'Partner API, Akamai allow-list only' },
    { name: 'Partner over MPLS', domain: '', provider: 'MPLS', ip_address: '10.200.1.10', port: 8443,
      protocol: 'TCP', direction: 'inbound', scope: 'private', access_mode: 'full', allowed_ips: '', system: '',
      device: '', backends: '10.10.20.20:8443', description: 'Partner over MPLS, NAT private IP' },
  ],
  prepare: async (req) => ({ username: actorName(req) || 'admin' }),
  async check(row) {
    const errors = [];
    if (!row.ip_address) errors.push('IP Address is required');
    else if (!IPV4_REGEX.test(row.ip_address)) errors.push(`Invalid IP format: ${row.ip_address}`);
    if (!row.port) errors.push('Port is required');
    else if (isNaN(Number(row.port)) || Number(row.port) < 1 || Number(row.port) > 65535) errors.push(`Invalid port: ${row.port}`);
    const protocol = (row.protocol || 'HTTPS').toUpperCase();
    if (!PROTOCOL_OPTIONS.includes(protocol)) errors.push(`Invalid protocol: ${row.protocol}. Valid: ${PROTOCOL_OPTIONS.join(', ')}`);
    row._protocol = protocol;
    for (const [key, opts, def] of [['direction', DIRECTION_OPTIONS, 'inbound'], ['scope', SCOPE_OPTIONS, 'public'], ['access_mode', ACCESS_OPTIONS, 'full']]) {
      row['_' + key] = String(row[key] || def).toLowerCase();
      if (!opts.includes(row['_' + key])) errors.push(`Invalid ${key}: ${row[key]}. Valid: ${opts.join(', ')}`);
    }

    const missing = [];
    row._deviceId = null;
    if (row.device) {
      const found = await Device.findByName(row.device);
      if (found) row._deviceId = found.id;
      else missing.push(`Device: ${row.device}`);
    }
    row._systemId = null;
    if (row.system) {
      const found = (await System.findByNameExact(row.system))[0];
      if (found) row._systemId = found.id;
      else missing.push(`System: ${row.system}`);
    }

    row._members = [];
    if (row.backends) {
      for (const entry of splitList(row.backends)) {
        const [ip, port] = entry.split(':').map((v) => v.trim());
        if (IPV4_REGEX.test(ip)) row._members.push({ ip, port: Number(port) || null, status: 'active' });
        else errors.push(`Invalid backend IP: ${ip}`);
      }
    }
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);

    row._name = row.name || (row.domain ? `${row.domain}:${row.port}` : `${row.ip_address}:${row.port}`);
    let skip;
    if ((await ServiceMapping.findByNameExact(row._name)).length) skip = 'Service Mapping name already exists';
    return { errors, skip };
  },
  duplicateKeys: (row) => ['n:' + String(row._name).toLowerCase()],
  async save(row, client, ctx) {
    await smService.createServiceMapping({
      name: row._name, domain: row.domain || null, provider: row.provider || null,
      ip_address: row.ip_address, port: Number(row.port), protocol: row._protocol,
      direction: row._direction, scope: row._scope, access_mode: row._access_mode, allowed_ips: row.allowed_ips || null,
      device_id: row._deviceId, system_id: row._systemId, description: row.description || null,
      member_ip: row._members.map((m) => m.ip),
      member_port: row._members.map((m) => m.port),
      member_status: row._members.map((m) => m.status),
      updated_by: ctx.username,
    }, client);
  },
  resultUrl: (file) => `/network/download/service-mapping-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, providerOptions] = await Promise.all([
      smService.listServiceMappings({ search, page: pageNo, pageSize, ...filter }),
      smService.getProviderOptions(),
    ]);
    res.render('pages/network/service_mapping_list', {
      vsList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, protocolOptions: PROTOCOL_OPTIONS, directionOptions: DIRECTION_OPTIONS, scopeOptions: SCOPE_OPTIONS, providerOptions,
      ...takeFlash(req), title: 'Service Mapping', activeMenu: 'service-mapping',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await smService.listServiceMappings({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    const rows = items.flatMap((vs) => (vs.members.length ? vs.members : [{}]).map((m) => ({ ...m, vs })));
    await sendExcel(res, {
      filename: 'service-mapping-list', sheet: 'Service Mappings',
      columns: [
        { header: req.t('Name'), value: (r) => r.vs.name, width: 28 },
        { header: req.t('Domain'), value: (r) => r.vs.domain, width: 28 },
        { header: req.t('Provider'), value: (r) => r.vs.provider, width: 14 },
        { header: req.t('IP Address'), value: (r) => r.vs.ip_address, width: 16 },
        { header: req.t('Port'), value: (r) => r.vs.port, width: 8 },
        { header: req.t('Protocol'), value: (r) => r.vs.protocol, width: 10 },
        { header: req.t('Direction'), value: (r) => r.vs.direction, width: 10 },
        { header: req.t('Scope'), value: (r) => r.vs.scope, width: 10 },
        { header: req.t('Access'), value: (r) => r.vs.access_mode, width: 10 },
        { header: req.t('Allowed IPs'), value: (r) => (r.vs.allowed_ips || []).join(', '), width: 30 },
        { header: req.t('System'), value: (r) => r.vs.system_name, width: 20 },
        { header: req.t('Device'), value: (r) => r.vs.device_name, width: 20 },
        { header: req.t('Backend IP'), value: (r) => r.ip, width: 16 },
        { header: req.t('Backend Port'), value: (r) => r.port, width: 12 },
        { header: req.t('Server'), value: (r) => r.server_name, width: 24 },
        { header: req.t('Status'), value: (r) => r.status, width: 10 },
        { header: req.t('Description'), value: (r) => r.vs.description, width: 40 },
        { header: req.t('Updated'), value: (r) => r.vs.updated_at && new Date(r.vs.updated_at), width: 20 },
      ],
      rows,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  // Add form prefilled from an existing mapping (another port of the same domain, etc.):
  // name and port are cleared so the copy gets its own listener.
  async duplicateForm(req, res) {
    try {
      const { id, name, port, created_at, updated_at, updated_by, ...rest } = await smService.getServiceMapping(req.params.id);
      await renderForm(res, 'add', rest, name);
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await smService.getServiceMapping(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, async () => smService.createServiceMapping(await formInput(req)), 'Service Mapping added successfully!'),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, async () => smService.updateServiceMapping(req.params.id, await formInput(req)), 'Service Mapping updated successfully!'),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => smService.deleteServiceMapping(req.params.id), 'Service Mapping deleted successfully!'),

  // ===== AJAX =====
  lookup: lookup((search) => ServiceMapping.select2Search(search)),
  providers: lookup(async (search) => {
    const all = await ServiceMapping.getDistinctProviders();
    const q = (search || '').toLowerCase();
    return all.filter((p) => p.toLowerCase().includes(q)).map((p) => ({ id: p, text: p }));
  }),
};
