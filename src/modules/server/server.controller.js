// Web pages: /server/server (list, export, import, add, edit, delete), detail and lookup AJAX.
import Server from './server.model.js';
import Agent from './agent.model.js';
import Service from './service.model.js';
import IpAddress from '../network/ip-address.model.js';
import Platform from '../device/platform.model.js';
import Contact from '../organize/contact.model.js';
import Tag from '../organize/tag.model.js';
import System from '../system/system.model.js';
import * as serverService from './server.service.js';
import { IPV4_REGEX } from '../network/ip-address.service.js';
import { assignedAddresses, ensureIpAddresses } from '../network/ip-ownership.js';
import { excelImport, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page, lookup } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';
import { pageOptions } from '../../shared/options.js';

const LIST_URL = '/server/server';

function listFilter(query) {
  return {
    status: queryValue(query, 'status'),
    type: queryValue(query, 'type'),
    location: queryValue(query, 'location'),
    tags: queryList(query, 'tags'),
    manager: queryList(query, 'contacts'),
    systems: queryList(query, 'systems'),
    services: queryList(query, 'services'),
    os: queryList(query, 'os'),
  };
}

// Multi-selects send nothing when empty: the form always replaces every link.
const formInput = (req, mode) => {
  const b = req.body;
  const input = {
    name: b.name, description: b.description, os: b.os, status: b.status, location: b.location, type: b.type,
    ip_addresses: b.ip_addresses || [], managers: b.managers || [], systems: b.systems || [], agents: b.agents || [],
    services: b.services || [], tags: b.tags || [], updated_by: actorName(req),
  };
  if (mode === 'edit') input.vip_ip_addresses = b.vip_ip_addresses || [];
  return input;
};

const options = (rows, text = (r) => r.name) => (rows || []).map((r) => ({ id: r.id, text: text(r) }));

async function renderForm(res, mode, server = {}) {
  const ips = server.ip_addresses || [];
  res.render('pages/server/server_form', {
    ...(await pageOptions('platforms', 'services', 'agents', 'tags')),
    mode, server, ...(await serverService.getFormOptions()),
    selected: {
      ips: options(ips.filter((ip) => ip.role !== 'vip'), (ip) => ip.ip_address),
      vips: options(ips.filter((ip) => ip.role === 'vip'), (ip) => ip.ip_address),
      os: server.os_id ? [{ id: server.os_id, text: server.platform_name }] : [],
      managers: options(server.managers, (c) => (c.email ? `${c.name} (${c.email})` : c.name)),
      systems: options(server.systems),
      agents: options(server.agents, (a) => (a.version ? `${a.name} (${a.version})` : a.name)),
      services: options(server.services),
      tags: options(server.tags),
    },
    title: mode === 'edit' ? 'Edit Server' : 'Add Server', activeMenu: 'server-list',
  });
}

const IMPORT_COLUMNS = [
  { header: 'Name (Optional - auto-generated if empty)', key: 'name' },
  { header: 'IPAddress (Require, comma-separated if multiple)', key: 'ips' },
  { header: 'OS (Optional)', key: 'os' },
  { header: 'Status (Optional)', key: 'status' },
  { header: 'Location (Optional)', key: 'location' },
  { header: 'Type (Optional)', key: 'type' },
  { header: 'Manager (Optional, comma-separated if multiple)', key: 'manager' },
  { header: 'System (Optional, comma-separated if multiple)', key: 'system' },
  { header: 'Agent (Optional, comma-separated if multiple)', key: 'agent' },
  { header: 'Service (Optional, comma-separated if multiple)', key: 'service' },
  { header: 'Tag (Optional, comma-separated if multiple)', key: 'tag' },
  { header: 'Description (Optional)', key: 'description' },
];

// Rows: IPs required (created as Reserved when unknown, then assigned to the
// new server); OS/managers (email)/systems/agents/services/tags by name.
// Name defaults to server_<os>_<first IP>. Existing name or assigned IP = skipped.
export const serverImport = excelImport({
  name: 'server',
  columns: IMPORT_COLUMNS,
  sample: async () => [
    { name: 'Test Server 1', ips: '192.168.1.100,192.168.1.101', os: 'Linux', status: 'ONLINE', location: 'DC', type: 'Physical',
      manager: 'admin@company.com,manager@company.com', system: 'System1,System2', agent: 'Agent1,Agent2', service: 'Service1,Service2', tag: 'Tag1,Tag2', description: 'Test server description' },
    { name: '', ips: '192.168.2.3', os: 'Windows', status: 'OFFLINE', location: 'DR', type: 'Virtual',
      manager: 'admin@company.com', system: 'System1', agent: 'Agent1', service: 'Service1', tag: 'Tag1', description: 'Auto-generated name example' },
  ],
  async prepare(req) {
    const [locations, statuses] = await Promise.all([serverService.getServerLocationOptions(), serverService.getServerStatusOptions()]);
    return { locations: locations.map((o) => o.id), statuses: statuses.map((o) => o.id), username: actorName(req) || 'admin' };
  },
  async check(row, ctx) {
    const errors = [];
    row.ipList = splitList(row.ips);
    if (!row.ipList.length) errors.push('IP addresses are required');
    row.ipList.filter((ip) => !IPV4_REGEX.test(ip)).forEach((ip) => errors.push(`Invalid IP format: ${ip}`));
    if (row.status && ctx.statuses.length && !ctx.statuses.includes(row.status)) errors.push(`Invalid status: ${row.status}. Valid values: ${ctx.statuses.join(', ')}`);
    if (row.location && ctx.locations.length && !ctx.locations.includes(row.location)) errors.push(`Invalid location: ${row.location}. Valid values: ${ctx.locations.join(', ')}`);

    const missing = [];
    row.osId = row.os ? (await resolveNames([row.os], (n) => Platform.findByNameExact(n), 'OS', missing))[0] : null;
    row.managerIds = await resolveNames(splitList(row.manager), (n) => Contact.findByEmailSearch(n), 'Manager', missing);
    row.systemIds = await resolveNames(splitList(row.system), (n) => System.findByNameExact(n), 'System', missing);
    row.agentIds = await resolveNames(splitList(row.agent), (n) => Agent.findByNameExact(n), 'Agent', missing);
    row.serviceIds = await resolveNames(splitList(row.service), (n) => Service.findByNameExact(n), 'Service', missing);
    row.tagIds = await resolveNames(splitList(row.tag), (n) => Tag.findByNameExact(n), 'Tag', missing);
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);

    row.serverName = row.name || (row.os ? `server_${row.os.replace(/\s+/g, '-').toLowerCase()}_${row.ipList[0]}` : `server_${row.ipList[0]}`);
    let skip;
    if (row.ipList.length && await Server.findByName(row.serverName)) skip = 'Server name already exists';
    const assigned = await assignedAddresses(row.ipList);
    if (assigned.length) skip = `IP already assigned to a server: ${assigned.join(', ')}`;
    return { errors, skip };
  },
  duplicateKeys: (row) => ['n:' + String(row.serverName).toLowerCase(), ...row.ipList.map((ip) => 'ip:' + ip)],
  async save(row, client, ctx) {
    const note = ['Note: This IP address was automatically created from server import feature', `Server: ${row.serverName}`,
      ...IMPORT_COLUMNS.slice(2).map((c) => `${c.header.replace(/ \(.*$/, '')}: ${row[c.key] || 'N/A'}`)].join('\n');
    const ipIds = await ensureIpAddresses(row.ipList, note, ctx.username, client);
    await serverService.createServer({
      name: row.serverName, os: row.osId, status: row.status || null, location: row.location || null, type: row.type || null,
      description: row.description || null, managers: row.managerIds, systems: row.systemIds, agents: row.agentIds,
      services: row.serviceIds, tags: row.tagIds, ip_addresses: ipIds, updated_by: ctx.username,
    }, client);
    // managers are also the IPs' contacts
    if (row.managerIds.length) for (const ipId of ipIds) await IpAddress.setContacts(ipId, row.managerIds, client);
  },
  resultUrl: (file) => `/server/download/server-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, formOptions] = await Promise.all([
      serverService.listServers({ search, page: pageNo, pageSize, ...filter }),
      serverService.getFormOptions(),
    ]);
    res.render('pages/server/server_list', {
    ...(await pageOptions('platforms', 'services', 'tags')),
      serverList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, ...formOptions, ...takeFlash(req), title: 'Server List', activeMenu: 'server-list',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await serverService.listServers({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    const names = (list) => (list || []).map((x) => x.name);
    await sendExcel(res, {
      filename: 'server-list', sheet: 'Server List',
      columns: [
        { header: req.t('Server Name'), value: (s) => s.name, width: 28 },
        { header: req.t('IP Addresses'), value: (s) => s.ip_addresses.filter((ip) => ip.role !== 'vip').map((ip) => ip.ip_address) },
        { header: req.t('VIP IP Address(es)'), value: (s) => s.ip_addresses.filter((ip) => ip.role === 'vip').map((ip) => ip.ip_address) },
        { header: req.t('Status'), value: (s) => s.status, width: 12 },
        { header: req.t('Location'), value: (s) => s.location, width: 12 },
        { header: req.t('Type'), value: (s) => s.type, width: 12 },
        { header: req.t('Platform'), value: (s) => s.platform_name, width: 16 },
        { header: req.t('Managers'), value: (s) => (s.managers || []).map((m) => m.email || m.name) },
        { header: req.t('Systems'), value: (s) => names(s.systems) },
        { header: req.t('Agents'), value: (s) => names(s.agents) },
        { header: req.t('Services'), value: (s) => names(s.services) },
        { header: req.t('Tags'), value: (s) => names(s.tags) },
        { header: req.t('Description'), value: (s) => s.description, width: 40 },
        { header: req.t('Updated'), value: (s) => s.updated_at && new Date(s.updated_at), width: 20 },
        { header: req.t('Updated By'), value: (s) => s.updated_by, width: 14 },
      ],
      rows: items,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await serverService.getServerWithLinks(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => serverService.createServer(formInput(req, 'add')), 'Server added successfully'),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, () => serverService.updateServer(req.params.id, formInput(req, 'edit')), 'Server updated successfully'),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL,
    () => serverService.deleteServer(req.params.id, { deleteIp: ['true', '1'].includes(String(req.body.delete_ip).toLowerCase()) }),
    'Server deleted successfully'),

  // ===== AJAX =====
  detail: page(async (req, res) => {
    const server = Number(req.params.id) ? await Server.findById(req.params.id) : null;
    if (!server) return res.status(404).json({ error: 'Server not found' });
    res.json(server);
  }),
  lookup: lookup(async (search) => ({ results: await Server.select2Search({ search }) })),
};
