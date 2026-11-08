import ServiceMapping from './service-mapping.model.js';
import IpAddress from './ip-address.model.js';
import Domain from './domain.model.js';
import System from '../system/system.model.js';
import { IPV4_REGEX } from './ip-address.service.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { hasKey, loadOptions } from '../../shared/service.js';

const PROTOCOL_OPTIONS = ['HTTP', 'HTTPS', 'TCP', 'UDP'];
const DIRECTION_OPTIONS = ['inbound', 'outbound'];
const SCOPE_OPTIONS = ['public', 'private', 'internal']; // internal: inbound only (internal exposure)
const ACCESS_OPTIONS = ['full', 'limited'];
const STATUS_OPTIONS = ['active', 'inactive'];

async function assertNameAvailable(name, excludeId = null) {
  const existing = await ServiceMapping.findByNameExact(name);
  if (existing.some((v) => String(v.id) !== String(excludeId))) throw new ConflictError('Service Mapping name already exists: {name}').withParams({ name });
}

// IPs and domains come from the inventories. Form selects send an existing record's id
// or a newly typed value; Excel import and API callers send addresses / names. Values
// not in the inventory yet are created in the caller's transaction (c).
function inventoryResolver(c, updatedBy) {
  const ips = new Map();
  const domains = new Map();
  return {
    // -> {id, address} or null when blank
    async ip(value) {
      const v = String(value ?? '').trim();
      if (!v) return null;
      if (!ips.has(v)) {
        let ip;
        if (/^\d+$/.test(v)) {
          ip = await IpAddress.findById(Number(v), c);
          if (!ip) throw new NotFoundError('IP address not found');
        } else {
          if (!IPV4_REGEX.test(v)) throw new ValidationError('Invalid IPv4 address: {list}').withParams({ list: v });
          ip = await IpAddress.findByAddress(v, c)
            || await IpAddress.create({ address: v, description: 'Created from service mapping', updated_by: updatedBy }, c);
        }
        ips.set(v, { id: ip.id, address: ip.ip_address });
      }
      return ips.get(v);
    },
    // -> {id, name} or null when blank
    async domain(value) {
      const v = String(value ?? '').trim();
      if (!v) return null;
      if (!domains.has(v)) {
        let d;
        if (/^\d+$/.test(v)) {
          d = await Domain.findById(Number(v), c);
          if (!d) throw new NotFoundError('Domain not found');
        } else {
          d = await Domain.findByDomain(v, c)
            || await Domain.create({ domain: v, description: 'Created from service mapping', record_type: 'A' }, c);
        }
        domains.set(v, { id: d.id, name: d.domain });
      }
      return domains.get(v);
    },
  };
}

// Parallel member_ip[] (IP id or address) / member_port[] / member_protocol[] / member_status[]
// -> [{ip_address_id, port, protocol, status}] (first occurrence of an IP:port wins; the same IP may
// appear on different ports)
async function resolveMembers(raw, resolver) {
  const values = [].concat(raw.member_ip ?? []);
  const ports = [].concat(raw.member_port ?? []);
  const protocols = [].concat(raw.member_protocol ?? []);
  const statuses = [].concat(raw.member_status ?? []);
  const seen = new Set();
  const members = [];
  for (const [i, value] of values.entries()) {
    const ip = await resolver.ip(value);
    const port = Number(ports[i]) || null;
    if (!ip || seen.has(`${ip.id}:${port}`)) continue;
    seen.add(`${ip.id}:${port}`);
    const protocol = String(protocols[i] ?? '').trim().toUpperCase() || null;
    if (protocol && !PROTOCOL_OPTIONS.includes(protocol)) throw new ValidationError('Invalid backend protocol: {protocol}').withParams({ protocol });
    members.push({ ip_address_id: ip.id, port, protocol, status: STATUS_OPTIONS.includes(statuses[i]) ? statuses[i] : 'active' });
  }
  return members;
}

const str = (v) => (typeof v === 'string' ? v.trim() || null : null);

function pick(value, options, fallback, label) {
  const v = (value || fallback).toLowerCase();
  if (!options.includes(v)) throw new ValidationError(`Invalid ${label}: {value}`).withParams({ value });
  return v;
}


// Partner IPs ([{address, partner}]: the allowed sources of flows 1 / 2, the
// destinations of flows 3 / 4) from any input shape, or null when none is given.
// Single IPv4 addresses only, no CIDR: they are the partner's hosts, kept apart
// from the subnet inventory (internal ranges). A CIDR the mapping already had
// (from the older "allowed IPs") is kept until it is replaced.
//
//   partner_ips  [{address, partner, port, protocol, domain}] or ["ip:port/protocol@domain[partner]"]  (API)
//   partner_ip[] / partner_name[] / partner_port[] / partner_protocol[] / partner_domain[]         (form rows)
//   allowed_ips  "ip:port/protocol@domain[partner], ip, ..." or an array                             (import, older API clients)
// withPorts (outbound): every row needs its port and protocol; withDomain (internet
// connectivity): a row may have a domain. Otherwise they are dropped.
async function partnerRows(input, current = null, { withPorts = false, withDomain = false } = {}) {
  const kept = new Set((current?.partner_ips || []).map((p) => p.address));
  let rows;
  if (hasKey(input, 'partner_ips')) {
    rows = [].concat(input.partner_ips ?? []).map((r) => (r && typeof r === 'object' ? { address: r.address, partner: r.partner, port: r.port, protocol: r.protocol, domain: r.domain } : partnerCell(r)));
  } else if (hasKey(input, 'partner_ip')) {
    const names = [].concat(input.partner_name ?? []);
    const ports = [].concat(input.partner_port ?? []);
    const protocols = [].concat(input.partner_protocol ?? []);
    const domains = [].concat(input.partner_domain ?? []);
    rows = [].concat(input.partner_ip ?? []).map((address, i) => ({ address, partner: names[i], port: ports[i], protocol: protocols[i], domain: domains[i] }));
  } else if (hasKey(input, 'allowed_ips')) {
    rows = [].concat(input.allowed_ips ?? []).flatMap((v) => String(v).split(/[,;\n]+/)).map(partnerCell);
  } else {
    return null;
  }
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const address = String(r.address ?? '').trim();
    if (!address) continue;
    if (!IPV4_REGEX.test(address) && !kept.has(address)) {
      throw new ValidationError(address.includes('/') ? 'Partner IPs are single IP addresses, not ranges (CIDR): {ips}' : 'Invalid partner IP: {ips}').withParams({ ips: address });
    }
    const partner = await configuredOption('service_mapping_partner', str(r.partner), 'partner');
    let port = null;
    let protocol = null;
    if (withPorts) {
      port = Number(String(r.port ?? '').trim());
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ValidationError('Partner IP {ip}: port 1-65535 is required').withParams({ ip: address });
      protocol = String(r.protocol || '').trim().toUpperCase();
      if (!PROTOCOL_OPTIONS.includes(protocol)) throw new ValidationError('Partner IP {ip}: protocol {protocol} is not valid').withParams({ ip: address, protocol: protocol || '—' });
    }
    const domain = withDomain ? str(r.domain)?.toLowerCase() || null : null;
    if (domain && !DOMAIN_REGEX.test(domain)) throw new ValidationError('Partner IP {ip}: invalid domain {domain}').withParams({ ip: address, domain });
    const key = `${address}|${partner || ''}|${port || ''}|${protocol || ''}|${domain || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ address, partner, port, protocol, domain });
  }
  return out;
}

// "203.0.113.10:443/HTTPS@api.bank.com[Bank A]" (port, protocol, domain and partner optional)
// -> { address, port, protocol, domain, partner }
function partnerCell(value) {
  const m = String(value ?? '').trim().match(/^([^:@\[\s]+)(?::(\d+)(?:\/(\w+))?)?(?:@([^\[\s]+))?\s*(?:\[(.*)\])?$/);
  if (!m) return { address: String(value ?? '').trim(), partner: null };
  return { address: m[1], port: m[2] || null, protocol: m[3] || null, domain: m[4] || null, partner: m[5] ? m[5].trim() : null };
}
const DOMAIN_REGEX = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

async function assertRefs(input) {
  if (input.system_id && !(await System.exists(input.system_id))) throw new NotFoundError('System not found');
}

// ===== Queries =====
export async function listServiceMappings(filter) {
  const [items, totalCount] = await Promise.all([ServiceMapping.findFilteredList(filter), ServiceMapping.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getServiceMapping(id) {
  const vs = await ServiceMapping.findByIdWithRelations(id);
  if (!vs) throw new NotFoundError('Service Mapping not found');
  return vs;
}

export const getProviderOptions = () => ServiceMapping.getDistinctProviders();
export const getProtocolOptions = () => ServiceMapping.getDistinctProtocols();
export const getServiceMappingsForDevice = (deviceId) => ServiceMapping.findByDeviceId(deviceId);
export const getServiceMappingsForServer = (serverId) => ServiceMapping.findByServerId(serverId);

// Port / protocol the provider (CDN, WAF, VPN...) listens on: both optional,
// cleared when there is no provider. -> {provider, provider_port, provider_protocol}
function providerFields(provider, rawPort, rawProtocol) {
  if (!provider) return { provider: null, provider_port: null, provider_protocol: null };
  const portText = String(rawPort ?? '').trim();
  const port = portText ? Number(portText) : null;
  if (port !== null && !(Number.isInteger(port) && port >= 1 && port <= 65535)) {
    throw new ValidationError('Invalid provider port: {port}').withParams({ port: portText });
  }
  const protocol = String(rawProtocol ?? '').trim().toUpperCase() || null;
  if (protocol && !PROTOCOL_OPTIONS.includes(protocol)) throw new ValidationError('Invalid provider protocol: {protocol}').withParams({ protocol });
  return { provider, provider_port: port, provider_protocol: protocol };
}

// Provider / channel (service_mapping_provider) and partner (service_mapping_partner):
// a value of the System Configuration list (matched case-insensitively, stored as
// configured); a retired value is refused unless the record already has it. An
// empty list accepts any value.
async function configuredOption(key, value, label, current = null) {
  if (!value) return null;
  if (current && value.toLowerCase() === current.toLowerCase()) return current;
  const options = await loadOptions(key);
  if (!options.length) return value;
  const found = options.find((o) => o.id.toLowerCase() === value.toLowerCase());
  if (!found) throw new ValidationError(`Invalid ${label}: {value}. Configure it in System Configuration > Network`).withParams({ value });
  if (found.inactive) throw new ValidationError('{value} is no longer in use for {label}').withParams({ value: found.id, label });
  return found.id;
}
const configuredProvider = (value, current = null) => configuredOption('service_mapping_provider', value, 'provider', current);

// The four flows (direction-scope) and what each one keeps
const FLOWS = {
  // the public IP sits on the FW / LB device (shown through the asset mapping); partner IPs are limited on the CDN
  // channel: the provider may be set; providerPort: it has its own port / protocol (a CDN listens on
  // its own port; a VPN / lease line only carries the traffic to the NAT IP:port)
  'inbound-public': { ipRequired: 'Public IP is required', accessChoice: true, channel: true, providerPort: true, domain: true },
  // the partner reaches one NAT service IP:port
  'inbound-private': { ipRequired: 'NAT service IP is required', access: 'limited', channel: true },
  // internal IPs -> one NAT IP -> each partner IP with its own port / protocol (no mapping port)
  'outbound-private': { ipRequired: 'NAT IP is required', partnersRequired: 'At least one partner IP is required', partnerPorts: true, access: 'full', channel: true },
  // internal users -> domain (optional) -> VIP IP:port on its LB -> backends: no CDN, channel or partner IPs
  'inbound-internal': { ipRequired: 'VIP is required', access: 'full', domain: true, noPartners: true },
  // internal IPs -> one egress public IP -> each destination IP with its own domain (optional), port / protocol
  'outbound-public': { ipRequired: 'Egress public IP is required', partnersRequired: 'At least one destination IP is required', partnerPorts: true, partnerDomain: true, access: 'full' },
};

// Provider fields kept by the flow (see FLOWS)
function providerForFlow(flow, providerData, current) {
  const merged = { provider: current?.provider ?? null, provider_port: current?.provider_port ?? null, provider_protocol: current?.provider_protocol ?? null, ...providerData };
  if (!flow.channel) return { provider: null, provider_port: null, provider_protocol: null };
  if (!flow.providerPort) return { ...merged, provider_port: null, provider_protocol: null };
  return merged;
}

// Flow fields of a mapping: the input over the current values (update), checked
// for its flow. -> { data (virtual_servers columns), partners ([{address, partner}]) }
async function flowData(input, current, resolve, domain) {
  const has = (k) => !current || hasKey(input, k);
  const direction = has('direction') ? pick(input.direction, DIRECTION_OPTIONS, 'inbound', 'direction') : current.direction;
  const scope = has('scope') ? pick(input.scope, SCOPE_OPTIONS, 'public', 'scope') : current.scope;
  const flow = FLOWS[`${direction}-${scope}`];
  if (!flow) throw new ValidationError('Invalid flow: {direction} {scope}').withParams({ direction, scope });
  const keep = (id, address) => (id ? { id, address } : null);
  let ip = hasKey(input, 'ip_address') ? await resolve.ip(input.ip_address) : keep(current?.ip_address_id, current?.ip_address);
  let partners = await partnerRows(input, current, { withPorts: Boolean(flow.partnerPorts), withDomain: Boolean(flow.partnerDomain) });
  if (partners === null) {
    partners = (current?.partner_ips || []).map((p) => ({ address: p.address, partner: p.partner,
      port: flow.partnerPorts ? p.port : null, protocol: flow.partnerPorts ? p.protocol : null, domain: flow.partnerDomain ? p.domain : null }));
    if (flow.partnerPorts && partners.some((p) => !p.port || !p.protocol)) throw new ValidationError('Every partner IP needs its port and protocol');
  }

  // partner connectivity: the ports are the partner IPs'; other flows: one port / protocol for the mapping
  let port = null;
  let protocol = null;
  if (!flow.partnerPorts) {
    port = has('port') || current?.port == null ? Number(input.port) : current.port;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ValidationError(input.port ? 'Invalid port: {port}' : 'Port is required').withParams({ port: input.port });
    protocol = has('protocol') || !current?.protocol ? String(input.protocol || 'HTTPS').toUpperCase() : current.protocol;
    if (!PROTOCOL_OPTIONS.includes(protocol)) throw new ValidationError('Invalid protocol: {protocol}').withParams({ protocol });
  }

  const access_mode = flow.accessChoice ? (has('access_mode') ? pick(input.access_mode, ACCESS_OPTIONS, 'full', 'access mode') : current.access_mode) : flow.access;
  if ((flow.accessChoice && access_mode === 'full') || flow.noPartners) partners = []; // open to everyone / no partners: no partner list
  if (flow.ipRequired && !ip) throw new ValidationError(flow.ipRequired);
  if (flow.partnersRequired && !partners.length) throw new ValidationError(flow.partnersRequired);
  return {
    data: { direction, scope, access_mode, port, protocol, ip_address_id: ip?.id ?? null },
    partners, firstAddress: partners[0]?.domain || ip?.address || partners[0]?.address || null, firstPort: port || partners[0]?.port || null, flow,
  };
}

// ===== Commands =====
// ip_address / domain: id or address / name (new ones are created in
// the inventories); partner IPs: see partnerRows; members: member_ip[] /
// member_port[] / member_status[] (outbound sources have no port); provider_port /
// provider_protocol: where the provider listens (optional). The flow
// (direction-scope) decides which of them are kept and required (FLOWS).
export async function createServiceMapping(input, client) {
  const providerData = providerFields(await configuredProvider(str(input.provider)), input.provider_port, input.provider_protocol);
  await assertRefs(input);
  const id = await withTransaction(client, async (c) => {
    const resolve = inventoryResolver(c, input.updated_by);
    let domain = await resolve.domain(input.domain);
    const { data, partners, firstAddress, firstPort, flow } = await flowData(input, null, resolve, domain);
    if (!flow.domain) domain = null;
    const name = str(input.name) || `${domain ? domain.name : firstAddress}:${firstPort}`;
    await assertNameAvailable(name);
    const created = await ServiceMapping.create({
      name, domain_id: domain?.id ?? null, ...providerForFlow(flow, providerData, null), ...data,
      system_id: input.system_id || null, description: str(input.description),
      updated_by: input.updated_by || 'admin',
    }, c);
    await ServiceMapping.setPartnerIps(created.id, partners, c);
    await ServiceMapping.setMembers(created.id, sourcesWithoutPort(data.direction, await resolveMembers(input, resolve)), c);
    return created.id;
  });
  return ServiceMapping.findByIdWithRelations(id, client);
}

// Partial update: the keys sent change; the flow is checked as a whole
export async function updateServiceMapping(id, input, client) {
  const current = await ServiceMapping.findByIdWithRelations(id, client);
  if (!current) throw new NotFoundError('Service Mapping not found');
  const name = hasKey(input, 'name') ? (str(input.name) || current.name) : current.name;
  if (name.toLowerCase() !== current.name.toLowerCase()) await assertNameAvailable(name, id);
  const providerData = ['provider', 'provider_port', 'provider_protocol'].some((k) => hasKey(input, k))
    ? providerFields(hasKey(input, 'provider') ? await configuredProvider(str(input.provider), current.provider) : current.provider,
      hasKey(input, 'provider_port') ? input.provider_port : current.provider_port,
      hasKey(input, 'provider_protocol') ? input.provider_protocol : current.provider_protocol)
    : {};
  await assertRefs(input);
  await withTransaction(client, async (c) => {
    const resolve = inventoryResolver(c, input.updated_by);
    let domain = hasKey(input, 'domain') ? await resolve.domain(input.domain) : (current.domain_id ? { id: current.domain_id, name: current.domain } : null);
    const { data, partners, flow } = await flowData(input, current, resolve, domain);
    if (!flow.domain) domain = null;
    await ServiceMapping.update(id, {
      name, domain_id: domain?.id ?? null, ...providerForFlow(flow, providerData, current), ...data,
      system_id: hasKey(input, 'system_id') ? (input.system_id || null) : undefined,
      description: hasKey(input, 'description') ? str(input.description) : undefined,
      updated_by: input.updated_by || 'admin',
    }, c);
    await ServiceMapping.setPartnerIps(id, partners, c);
    if (hasKey(input, 'member_ip')) await ServiceMapping.setMembers(id, sourcesWithoutPort(data.direction, await resolveMembers(input, resolve)), c);
    else if (data.direction === 'outbound' && current.direction !== 'outbound') {
      await ServiceMapping.setMembers(id, sourcesWithoutPort('outbound', (current.members || []).map((m) => ({ ip_address_id: m.ip_address_id, port: m.port, protocol: m.protocol, status: m.status }))), c);
    }
  });
  return ServiceMapping.findByIdWithRelations(id, client);
}

export const getPartnerOptions = () => ServiceMapping.getDistinctPartners();

// Outbound sources open the connection: no port (an ephemeral one) nor protocol
function sourcesWithoutPort(direction, members) {
  return direction === 'outbound' ? members.map((m) => ({ ...m, port: null, protocol: null })) : members;
}

export async function deleteServiceMapping(id) {
  if (!(await ServiceMapping.exists(id))) throw new NotFoundError('Service Mapping not found');
  await ServiceMapping.delete(id);
}
