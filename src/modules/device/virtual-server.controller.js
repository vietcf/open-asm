// Web pages: /device/virtual-server (list, export, import, add, edit, delete) and lookups.
import VirtualServer from './virtual-server.model.js';
import Device from './device.model.js';
import Server from '../server/server.model.js';
import * as vsService from './virtual-server.service.js';
import { IPV4_REGEX } from '../network/ip-address.service.js';
import { excelImport, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page, lookup } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/device/virtual-server';
const PROTOCOL_OPTIONS = ['HTTP', 'HTTPS', 'TCP', 'UDP'];
const STATUS_OPTIONS = ['active', 'standby', 'disabled'];

function listFilter(query) {
  return {
    protocol: queryValue(query, 'protocol'),
    provider: queryValue(query, 'provider'),
    device_id: queryValue(query, 'device_id'),
  };
}

async function formInput(req) {
  const b = req.body;
  return {
    name: b.name, domain: b.domain, provider: b.provider,
    ip_address: b.ip_address, port: b.port, protocol: b.protocol,
    device_id: b.device_id || null, description: b.description,
    server_id: b.server_id ?? [], member_port: b.member_port ?? [],
    member_weight: b.member_weight ?? [], member_status: b.member_status ?? [],
    updated_by: actorName(req),
  };
}

const options = (rows, text = (r) => r.name) => (rows || []).map((r) => ({ id: r.id, text: text(r) }));

async function renderForm(res, mode, vs = {}) {
  const [providerOptions, protocolOptions] = await Promise.all([
    vsService.getProviderOptions(),
    vsService.getProtocolOptions(),
  ]);
  const allProtocols = [...new Set([...PROTOCOL_OPTIONS, ...protocolOptions])];
  res.render('pages/device/virtual_server_form', {
    mode, vs, providerOptions, protocolOptions: allProtocols, statusOptions: STATUS_OPTIONS,
    selected: {
      device: vs.device_id ? [{ id: vs.device_id, text: vs.device_name }] : [],
      members: (vs.members || []).map((m) => ({ id: m.server_id, text: m.server_name, port: m.port, weight: m.weight, status: m.status })),
    },
    title: mode === 'edit' ? 'Edit Virtual Server' : 'Add Virtual Server', activeMenu: 'virtual-server',
  });
}

export const virtualServerImport = excelImport({
  name: 'virtual-server',
  columns: [
    { header: 'Name (Optional - auto-generated if empty)', key: 'name' },
    { header: 'Domain (Optional)', key: 'domain' },
    { header: 'Provider (Optional, e.g. Akamai, Cloudflare)', key: 'provider' },
    { header: 'IP Address (Require)', key: 'ip_address' },
    { header: 'Port (Require)', key: 'port' },
    { header: 'Protocol (Optional, default HTTPS)', key: 'protocol' },
    { header: 'Device Name (Optional, LB device)', key: 'device' },
    { header: 'Backend Servers (Optional, server_name:port comma-separated)', key: 'backends' },
    { header: 'Description (Optional)', key: 'description' },
  ],
  sample: async () => [
    { name: 'Web Production', domain: 'app.example.com', provider: 'Akamai', ip_address: '203.0.113.10', port: 443,
      protocol: 'HTTPS', device: 'F5-01', backends: 'web-srv-01:8080,web-srv-02:8080', description: 'Production web frontend' },
    { name: '', domain: 'api.example.com', provider: '', ip_address: '203.0.113.11', port: 443,
      protocol: 'HTTPS', device: '', backends: 'api-srv-01:8080', description: 'API endpoint' },
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

    const missing = [];
    row._deviceId = null;
    if (row.device) {
      const found = await Device.findByName(row.device);
      if (found) row._deviceId = found.id;
      else missing.push(`Device: ${row.device}`);
    }

    row._members = [];
    if (row.backends) {
      for (const entry of splitList(row.backends)) {
        const [sName, sPort] = entry.includes(':') ? [entry.slice(0, entry.lastIndexOf(':')), entry.slice(entry.lastIndexOf(':') + 1)] : [entry, null];
        const server = await Server.findByName(sName.trim());
        if (server) row._members.push({ server_id: server.id, port: Number(sPort) || null, weight: 1, status: 'active' });
        else missing.push(`Server: ${sName.trim()}`);
      }
    }
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);

    row._name = row.name || (row.domain ? `${row.domain}:${row.port}` : `${row.ip_address}:${row.port}`);
    let skip;
    if ((await VirtualServer.findByNameExact(row._name)).length) skip = 'Virtual Server name already exists';
    return { errors, skip };
  },
  duplicateKeys: (row) => ['n:' + String(row._name).toLowerCase()],
  async save(row, client, ctx) {
    await vsService.createVirtualServer({
      name: row._name, domain: row.domain || null, provider: row.provider || null,
      ip_address: row.ip_address, port: Number(row.port), protocol: row._protocol,
      device_id: row._deviceId, description: row.description || null,
      server_id: row._members.map((m) => m.server_id),
      member_port: row._members.map((m) => m.port),
      member_weight: row._members.map((m) => m.weight),
      member_status: row._members.map((m) => m.status),
      updated_by: ctx.username,
    }, client);
  },
  resultUrl: (file) => `/device/download/virtual-server-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, providerOptions] = await Promise.all([
      vsService.listVirtualServers({ search, page: pageNo, pageSize, ...filter }),
      vsService.getProviderOptions(),
    ]);
    res.render('pages/device/virtual_server_list', {
      vsList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, protocolOptions: PROTOCOL_OPTIONS, providerOptions,
      ...takeFlash(req), title: 'Virtual Server', activeMenu: 'virtual-server',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await vsService.listVirtualServers({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    const rows = items.flatMap((vs) => (vs.members.length ? vs.members : [{}]).map((m) => ({ ...m, vs })));
    await sendExcel(res, {
      filename: 'virtual-server-list', sheet: 'Virtual Servers',
      columns: [
        { header: req.t('Name'), value: (r) => r.vs.name, width: 28 },
        { header: req.t('Domain'), value: (r) => r.vs.domain, width: 28 },
        { header: req.t('Provider'), value: (r) => r.vs.provider, width: 14 },
        { header: req.t('IP Address'), value: (r) => r.vs.ip_address, width: 16 },
        { header: req.t('Port'), value: (r) => r.vs.port, width: 8 },
        { header: req.t('Protocol'), value: (r) => r.vs.protocol, width: 10 },
        { header: req.t('Device'), value: (r) => r.vs.device_name, width: 20 },
        { header: req.t('Backend Server'), value: (r) => r.server_name, width: 24 },
        { header: req.t('Backend Port'), value: (r) => r.port, width: 12 },
        { header: req.t('Weight'), value: (r) => r.weight, width: 8 },
        { header: req.t('Status'), value: (r) => r.status, width: 10 },
        { header: req.t('Description'), value: (r) => r.vs.description, width: 40 },
        { header: req.t('Updated'), value: (r) => r.vs.updated_at && new Date(r.vs.updated_at), width: 20 },
      ],
      rows,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await vsService.getVirtualServer(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, async () => vsService.createVirtualServer(await formInput(req)), 'Virtual Server added successfully!'),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, async () => vsService.updateVirtualServer(req.params.id, await formInput(req)), 'Virtual Server updated successfully!'),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => vsService.deleteVirtualServer(req.params.id), 'Virtual Server deleted successfully!'),

  // ===== AJAX =====
  lookup: lookup((search) => VirtualServer.select2Search(search)),
  providers: lookup(async (search) => {
    const all = await VirtualServer.getDistinctProviders();
    const q = (search || '').toLowerCase();
    return all.filter((p) => p.toLowerCase().includes(q)).map((p) => ({ id: p, text: p }));
  }),
};
