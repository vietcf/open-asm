// Web pages: /network/service-mapping (list, export, import, add, edit, delete) and lookups.
import ServiceMapping from './service-mapping.model.js';
import System from '../system/system.model.js';
import * as smService from './service-mapping.service.js';
import { IPV4_REGEX } from './ip-address.service.js';
import IpAddress from './ip-address.model.js';
import Domain from './domain.model.js';
import { excelImport, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page, lookup, duplicatePage } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';
import { loadOptions } from '../../shared/service.js';

const LIST_URL = '/network/service-mapping';
const PROTOCOL_OPTIONS = ['HTTP', 'HTTPS', 'TCP', 'UDP'];
const DIRECTION_OPTIONS = ['inbound', 'outbound'];
const SCOPE_OPTIONS = ['public', 'private', 'internal'];
const ACCESS_OPTIONS = ['full', 'limited'];
const STATUS_OPTIONS = ['active', 'inactive'];
// Flows = direction-scope (migration 0033)
export const FLOWS = [
  { id: 'inbound-public', label: 'Public Exposure', icon: 'bi-globe', path: 'User → Domain → CDN → Public IP:Port (FW) → NAT private IP (optional) → Backend' },
  { id: 'inbound-internal', label: 'Internal Exposure', icon: 'bi-house-door', path: 'Internal user → Domain → IP:Port → Backend IP:Port' },
  { id: 'inbound-private', label: 'Private Connectivity', icon: 'bi-building-lock', path: 'Partner → VPN / Lease line → NAT service IP:Port → Backend' },
  { id: 'outbound-private', label: 'Partner Connectivity', icon: 'bi-signpost-split', path: 'Internal IP → NAT IP → VPN / Lease line → each partner IP:Port' },
  { id: 'outbound-public', label: 'Internet Connectivity', icon: 'bi-cloud-arrow-up', path: 'Internal IP → Egress public IP → each internet IP (domain):Port' },
];
// "172.30.9.10:443/HTTPS@api.bank.com[Bank A]" (the import / export form of a partner IP)
const partnerText = (p) => `${p.address}${p.port ? `:${p.port}${p.protocol ? `/${p.protocol}` : ''}` : ''}${p.domain ? `@${p.domain}` : ''}${p.partner ? `[${p.partner}]` : ''}`;

function listFilter(query) {
  return {
    protocol: queryValue(query, 'protocol'),
    provider: queryValue(query, 'provider'),
    device_id: queryValue(query, 'device_id'),
    direction: queryValue(query, 'direction'),
    scope: queryValue(query, 'scope'),
    access_mode: queryValue(query, 'access_mode'),
    system_id: queryValue(query, 'system_id'),
    partner: queryValue(query, 'partner'),
  };
}

async function formInput(req) {
  const b = req.body;
  const [direction, scope] = String(b.flow || `${b.direction || ''}-${b.scope || ''}`).split('-');
  return {
    name: b.name, domain: b.domain, provider: b.provider, provider_port: b.provider_port, provider_protocol: b.provider_protocol,
    ip_address: b.ip_address, port: b.port, protocol: b.protocol, nat_ip: b.nat_ip, nat_port: b.nat_port,
    direction, scope, access_mode: b.access_mode,
    partner_ip: b.partner_ip ?? [], partner_name: b.partner_name ?? [], partner_port: b.partner_port ?? [], partner_protocol: b.partner_protocol ?? [], partner_domain: b.partner_domain ?? [],
    system_id: b.system_id || null, description: b.description,
    member_ip: b.member_ip ?? [], member_port: b.member_port ?? [], member_protocol: b.member_protocol ?? [], member_status: b.member_status ?? [],
    updated_by: actorName(req),
  };
}

const options = (rows, text = (r) => r.name) => (rows || []).map((r) => ({ id: r.id, text: text(r) }));

async function renderForm(res, mode, vs = {}, copiedFrom = null) {
  const [providerOptions, protocolOptions, configuredPartners, usedPartners] = await Promise.all([
    loadOptions('service_mapping_provider'),
    smService.getProtocolOptions(),
    loadOptions('service_mapping_partner'),
    smService.getPartnerOptions(),
  ]);
  // partner dropdown: the configured partners, the names already used and this mapping's, sorted; a new one can be typed
  const partnerOptions = [...configuredPartners];
  const seen = new Set(partnerOptions.map((o) => o.id.toLowerCase()));
  for (const name of [...usedPartners, ...(vs.partner_ips || []).map((p) => p.partner).filter(Boolean)]) {
    if (!seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); partnerOptions.push({ id: name, text: name }); }
  }
  partnerOptions.sort((a, b) => a.text.localeCompare(b.text));
  const allProtocols = [...new Set([...PROTOCOL_OPTIONS, ...protocolOptions])];
  res.render('pages/network/service_mapping_form', {
    mode, vs, copiedFrom, providerOptions, partnerOptions, flows: FLOWS, protocolOptions: allProtocols, accessOptions: ACCESS_OPTIONS, statusOptions: STATUS_OPTIONS,
    selected: {
      ip: vs.ip_address_id ? [{ id: vs.ip_address_id, text: vs.ip_address }] : [],
      natIp: vs.nat_ip_address_id ? [{ id: vs.nat_ip_address_id, text: vs.nat_ip }] : [],
      partners: vs.partner_ips || [],
      domain: vs.domain_id ? [{ id: vs.domain_id, text: vs.domain }] : [],
      system: vs.system_id ? [{ id: vs.system_id, text: vs.system_name }] : [],
      members: (vs.members || []).map((m) => ({ id: m.ip_address_id, text: m.owner_name ? `${m.ip} (${m.owner_name})` : m.ip, port: m.port, protocol: m.protocol, status: m.status })),
    },
    title: mode === 'edit' ? 'Edit Service Mapping' : 'Add Service Mapping', activeMenu: 'service-mapping',
  });
}

export const serviceMappingImport = excelImport({
  name: 'service-mapping',
  columns: [
    { header: 'Name (Optional - auto-generated if empty)', key: 'name' },
    { header: 'Domain (Optional, must exist in the domain inventory)', key: 'domain' },
    { header: 'Provider (Optional, e.g. Akamai, Cloudflare)', key: 'provider' },
    { header: 'Provider Port (Optional)', key: 'provider_port' },
    { header: 'Provider Protocol (Optional, HTTP/HTTPS/TCP/UDP)', key: 'provider_protocol' },
    { header: 'IP Address (Public / NAT service / NAT / egress IP, must exist in the IP inventory)', key: 'ip_address' },
    { header: 'Port (Require)', key: 'port' },
    { header: 'Protocol (Optional, default HTTPS)', key: 'protocol' },
    { header: 'Direction (Optional, inbound/outbound, default inbound)', key: 'direction' },
    { header: 'Scope (Optional, public/private, default public)', key: 'scope' }, // also "internal" (inbound internal exposure)
    { header: 'Access (Optional, full/limited, default full)', key: 'access_mode' },
    { header: 'Partner IPs (Optional, comma-separated, must exist in the IP inventory: IP[Partner] for inbound sources, IP:port/protocol@domain[Partner] for outbound destinations)', key: 'allowed_ips' },
    { header: 'System Name (Optional)', key: 'system' },
    { header: 'Backend IPs (Optional, ip:port comma-separated, must exist in the IP inventory)', key: 'backends' }, // ip:port/protocol accepted
    { header: 'Description (Optional)', key: 'description' },
    { header: 'NAT Private IP (Optional, public exposure: ip or ip:port, must exist in the IP inventory)', key: 'nat_ip' },
  ],
  sample: async () => [
    { name: 'Web Production', domain: 'app.example.com', provider: 'Akamai', ip_address: '203.0.113.10', port: 443,
      protocol: 'HTTPS', direction: 'inbound', scope: 'public', access_mode: 'full', allowed_ips: '', system: '',
      backends: '10.10.20.10:8080,10.10.20.11:8080', description: 'Production web frontend' },
    { name: 'Partner API', domain: 'partner.example.com', provider: 'Akamai', ip_address: '203.0.113.11', port: 443,
      protocol: 'HTTPS', direction: 'inbound', scope: 'public', access_mode: 'limited', allowed_ips: '198.51.100.10[Bank A],192.0.2.15[Bank B]', system: '',
      backends: '10.10.20.20:8080', description: 'Partner API, Akamai allow-list only' },
    { name: 'Partner over MPLS', domain: '', provider: 'MPLS', ip_address: '10.200.1.10', port: 8443,
      protocol: 'TCP', direction: 'inbound', scope: 'private', access_mode: 'limited', allowed_ips: '172.30.5.10[Bank A],172.30.5.11[Bank A]', system: '',
      backends: '10.10.20.20:8443', description: 'Partner over MPLS, NAT service IP' },
    { name: 'Bank A settlement', domain: '', provider: 'MPLS', ip_address: '10.200.2.5', port: 443,
      protocol: '', direction: 'outbound', scope: 'private', access_mode: 'full', allowed_ips: '172.30.9.10:443/HTTPS[Bank A],198.18.0.5:8443/TCP[NAPAS]', system: '',
      backends: '10.10.30.15', description: 'Outbound to the partners over MPLS through one NAT IP (port / protocol per partner IP)' },
    { name: 'Payment gateway (internet)', domain: '', provider: '', ip_address: '203.0.113.30', port: '',
      protocol: '', direction: 'outbound', scope: 'public', access_mode: 'full', allowed_ips: '52.10.20.30:443/HTTPS@api.payment.example[PayCo]', system: '',
      backends: '10.10.30.20', description: 'Outbound to the internet through one egress IP (domain / port / protocol per destination)' },
  ],
  prepare: async (req) => ({ username: actorName(req) || 'admin' }),
  async check(row) {
    const errors = [];
    // which IPs a flow requires is checked on save (service)
    if (row.ip_address && !IPV4_REGEX.test(row.ip_address)) errors.push(`Invalid IP format: ${row.ip_address}`);
    // outbound flows keep the port / protocol on each partner IP (ip:port/protocol)
    const outbound = String(row.direction || '').toLowerCase() === 'outbound';
    if (!row.port && !outbound) errors.push('Port is required');
    else if (isNaN(Number(row.port)) || Number(row.port) < 1 || Number(row.port) > 65535) errors.push(`Invalid port: ${row.port}`);
    const protocol = (row.protocol || 'HTTPS').toUpperCase();
    if (!outbound && !PROTOCOL_OPTIONS.includes(protocol)) errors.push(`Invalid protocol: ${row.protocol}. Valid: ${PROTOCOL_OPTIONS.join(', ')}`);
    row._protocol = protocol;
    for (const [key, opts, def] of [['direction', DIRECTION_OPTIONS, 'inbound'], ['scope', SCOPE_OPTIONS, 'public'], ['access_mode', ACCESS_OPTIONS, 'full']]) {
      row['_' + key] = String(row[key] || def).toLowerCase();
      if (!opts.includes(row['_' + key])) errors.push(`Invalid ${key}: ${row[key]}. Valid: ${opts.join(', ')}`);
    }

    const missing = [];
    row._systemId = null;
    if (row.system) {
      const found = (await System.findByNameExact(row.system))[0];
      if (found) row._systemId = found.id;
      else missing.push(`System: ${row.system}`);
    }

    row._members = [];
    if (row.backends) {
      for (const entry of splitList(row.backends)) {
        // ip, ip:port or ip:port/protocol
        const [ip, rest = ''] = entry.split(':').map((v) => v.trim());
        const [port, protocol] = rest.split('/').map((v) => v.trim());
        if (IPV4_REGEX.test(ip)) row._members.push({ ip, port: Number(port) || null, protocol: protocol ? protocol.toUpperCase() : null, status: 'active' });
        else errors.push(`Invalid backend IP: ${ip}`);
      }
    }
    // IPs and the domain are never created by the import: they must already exist
    if (row.ip_address && IPV4_REGEX.test(row.ip_address) && !(await IpAddress.findByAddress(row.ip_address))) missing.push(`IP address: ${row.ip_address}`);
    for (const m of row._members) if (!(await IpAddress.findByAddress(m.ip))) missing.push(`IP address: ${m.ip}`);
    if (row.domain && !(await Domain.findByDomain(row.domain))) missing.push(`Domain: ${row.domain}`);
    const [natIp, natPort] = String(row.nat_ip || '').split(':').map((v) => v.trim());
    row._natIp = natIp || null;
    row._natPort = natPort || null;
    if (row._natIp && !IPV4_REGEX.test(row._natIp)) errors.push(`Invalid NAT private IP: ${row._natIp}`);
    else if (row._natIp && !(await IpAddress.findByAddress(row._natIp))) missing.push(`IP address: ${row._natIp}`);
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);

    // default name: domain:port, or the first destination "ip:port" of an outbound mapping
    const firstDest = (splitList(row.allowed_ips)[0] || '').replace(/\[.*$/, '').replace(/@.*$/, '').replace(/\/\w+$/, '');
    row._name = row.name || (outbound ? firstDest || 'mapping' : `${row.domain || row.ip_address || 'mapping'}:${row.port}`);
    let skip;
    if ((await ServiceMapping.findByNameExact(row._name)).length) skip = 'Service Mapping name already exists';
    return { errors, skip };
  },
  duplicateKeys: (row) => ['n:' + String(row._name).toLowerCase()],
  async save(row, client, ctx) {
    await smService.createServiceMapping({
      name: row._name, domain: row.domain || null, provider: row.provider || null,
      provider_port: row.provider_port || null, provider_protocol: row.provider_protocol || null,
      ip_address: row.ip_address || null, port: Number(row.port), protocol: row._protocol, nat_ip: row._natIp, nat_port: row._natPort,
      direction: row._direction, scope: row._scope, access_mode: row._access_mode, allowed_ips: row.allowed_ips || '',
      system_id: row._systemId, description: row.description || null,
      member_ip: row._members.map((m) => m.ip),
      member_port: row._members.map((m) => m.port),
      member_protocol: row._members.map((m) => m.protocol || ''),
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
    const [{ items, totalCount }, providerOptions, partnerOptions] = await Promise.all([
      smService.listServiceMappings({ search, page: pageNo, pageSize, ...filter }),
      smService.getProviderOptions(),
      smService.getPartnerOptions(),
    ]);
    res.render('pages/network/service_mapping_list', {
      vsList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, protocolOptions: PROTOCOL_OPTIONS, directionOptions: DIRECTION_OPTIONS, scopeOptions: SCOPE_OPTIONS, providerOptions, partnerOptions, flows: FLOWS,
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
        { header: req.t('Provider port'), value: (r) => r.vs.provider_port, width: 10 },
        { header: req.t('Provider protocol'), value: (r) => r.vs.provider_protocol, width: 10 },
        { header: req.t('IP Address'), value: (r) => r.vs.ip_address, width: 16 },
        { header: req.t('Port'), value: (r) => r.vs.port, width: 8 },
        { header: req.t('Protocol'), value: (r) => r.vs.protocol, width: 10 },
        { header: req.t('Flow'), value: (r) => req.t(FLOWS.find((f) => f.id === `${r.vs.direction}-${r.vs.scope}`)?.label || ''), width: 22 },
        { header: req.t('Direction'), value: (r) => r.vs.direction, width: 10 },
        { header: req.t('Scope'), value: (r) => r.vs.scope, width: 10 },
        { header: req.t('Access'), value: (r) => r.vs.access_mode, width: 10 },
        { header: req.t('Partner IPs'), value: (r) => (r.vs.partner_ips || []).map(partnerText).join(', '), width: 36 },
        { header: req.t('System'), value: (r) => r.vs.system_name, width: 20 },
        { header: req.t('IP owner'), value: (r) => r.vs.ip_owner_name, width: 20 },
        { header: req.t('NAT private IP'), value: (r) => (r.vs.nat_ip ? `${r.vs.nat_ip}${r.vs.nat_port ? `:${r.vs.nat_port}` : ''}` : ''), width: 18 },
        { header: req.t('Backend IP'), value: (r) => r.ip, width: 16 },
        { header: req.t('Backend Port'), value: (r) => r.port, width: 12 },
        { header: req.t('Backend Protocol'), value: (r) => r.protocol, width: 12 },
        { header: req.t('Server/Device'), value: (r) => r.owner_name, width: 24 },
        { header: req.t('Status'), value: (r) => r.status, width: 10 },
        { header: req.t('Description'), value: (r) => r.vs.description, width: 40 },
        { header: req.t('Updated'), value: (r) => r.vs.updated_at && new Date(r.vs.updated_at), width: 20 },
      ],
      rows,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  // Another port of the same domain, etc.: name and port are cleared so the copy gets its own listener
  duplicateForm: duplicatePage(LIST_URL, smService.getServiceMapping, ({ name, port, ...rest }) => rest,
    (res, vs, source) => renderForm(res, 'add', vs, source)),

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
};
