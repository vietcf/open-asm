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
const SCOPE_OPTIONS = ['public', 'private'];
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

// Parallel member_ip[] (IP id or address) / member_port[] / member_status[] -> [{ip_address_id, port, status}]
// (first occurrence of an IP:port wins; the same IP may appear on different ports)
async function resolveMembers(raw, resolver) {
  const values = [].concat(raw.member_ip ?? []);
  const ports = [].concat(raw.member_port ?? []);
  const statuses = [].concat(raw.member_status ?? []);
  const seen = new Set();
  const members = [];
  for (const [i, value] of values.entries()) {
    const ip = await resolver.ip(value);
    const port = Number(ports[i]) || null;
    if (!ip || seen.has(`${ip.id}:${port}`)) continue;
    seen.add(`${ip.id}:${port}`);
    members.push({ ip_address_id: ip.id, port, status: STATUS_OPTIONS.includes(statuses[i]) ? statuses[i] : 'active' });
  }
  return members;
}

const str = (v) => (typeof v === 'string' ? v.trim() || null : null);

function pick(value, options, fallback, label) {
  const v = (value || fallback).toLowerCase();
  if (!options.includes(v)) throw new ValidationError(`Invalid ${label}: {value}`).withParams({ value });
  return v;
}

// "1.2.3.4, 10.0.0.0/8 5.6.7.8" (comma / space / newline separated) or an array -> list of IPs / CIDRs
function parseAllowedIps(raw) {
  const list = [].concat(raw ?? []).flatMap((v) => String(v).split(/[\s,;]+/)).map((v) => v.trim()).filter(Boolean);
  const invalid = list.filter((ip) => {
    const [addr, mask] = ip.split('/');
    return !IPV4_REGEX.test(addr) || (mask !== undefined && !(/^\d{1,2}$/.test(mask) && Number(mask) <= 32));
  });
  if (invalid.length) throw new ValidationError('Invalid allowed IP: {ips}').withParams({ ips: invalid.join(', ') });
  return [...new Set(list)];
}

// Allowed IPs only make sense when access is limited; an empty list means "limited, sources not recorded"
function accessFields(accessMode, allowedRaw) {
  if (accessMode !== 'limited') return { access_mode: accessMode, allowed_ips: null };
  const ips = parseAllowedIps(allowedRaw);
  return { access_mode: accessMode, allowed_ips: ips.length ? ips : null };
}

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

// Provider / channel: one of the System Configuration list service_mapping_provider
// (matched case-insensitively, stored as configured); a retired value is refused
// unless the record already has it. An empty list accepts any value.
async function configuredProvider(value, current = null) {
  if (!value) return null;
  if (current && value.toLowerCase() === current.toLowerCase()) return current;
  const options = await loadOptions('service_mapping_provider');
  if (!options.length) return value;
  const found = options.find((o) => o.id.toLowerCase() === value.toLowerCase());
  if (!found) throw new ValidationError('Invalid provider: {value}. Configure it in System Configuration > Network').withParams({ value });
  if (found.inactive) throw new ValidationError('{value} is no longer in use for {label}').withParams({ value: found.id, label: 'provider' });
  return found.id;
}

// ===== Commands =====
// ip_address / domain: id or address / name; members: member_ip[] / member_port[] / member_status[];
// provider_port / provider_protocol: where the provider listens (optional)
export async function createServiceMapping(input, client) {
  if (!String(input.ip_address ?? '').trim()) throw new ValidationError('IP Address is required');
  if (!input.port) throw new ValidationError('Port is required');
  const protocol = (input.protocol || 'HTTPS').toUpperCase();
  if (!PROTOCOL_OPTIONS.includes(protocol)) throw new ValidationError('Invalid protocol: {protocol}').withParams({ protocol });
  const direction = pick(input.direction, DIRECTION_OPTIONS, 'inbound', 'direction');
  const scope = pick(input.scope, SCOPE_OPTIONS, 'public', 'scope');
  const access = accessFields(pick(input.access_mode, ACCESS_OPTIONS, 'full', 'access mode'), input.allowed_ips);
  const providerData = providerFields(await configuredProvider(str(input.provider)), input.provider_port, input.provider_protocol);
  await assertRefs(input);
  const id = await withTransaction(client, async (c) => {
    const resolve = inventoryResolver(c, input.updated_by);
    const ip = await resolve.ip(input.ip_address);
    const domain = await resolve.domain(input.domain);
    const name = str(input.name) || `${domain ? domain.name : ip.address}:${input.port}`;
    await assertNameAvailable(name);
    const created = await ServiceMapping.create({
      name, domain_id: domain?.id ?? null, ...providerData,
      ip_address_id: ip.id, port: Number(input.port), protocol,
      direction, scope, ...access,
      system_id: input.system_id || null, description: str(input.description),
      updated_by: input.updated_by || 'admin',
    }, c);
    await ServiceMapping.setMembers(created.id, await resolveMembers(input, resolve), c);
    return created.id;
  });
  return ServiceMapping.findByIdWithRelations(id, client);
}

export async function updateServiceMapping(id, input, client) {
  const current = await ServiceMapping.findById(id, client);
  if (!current) throw new NotFoundError('Service Mapping not found');
  const name = hasKey(input, 'name') ? (str(input.name) || current.name) : current.name;
  if (name.toLowerCase() !== current.name.toLowerCase()) await assertNameAvailable(name, id);
  if (hasKey(input, 'ip_address') && !String(input.ip_address ?? '').trim()) throw new ValidationError('IP Address is required');
  if (hasKey(input, 'protocol')) {
    const protocol = (input.protocol || '').toUpperCase();
    if (!PROTOCOL_OPTIONS.includes(protocol)) throw new ValidationError('Invalid protocol: {protocol}').withParams({ protocol });
  }
  const direction = hasKey(input, 'direction') ? pick(input.direction, DIRECTION_OPTIONS, 'inbound', 'direction') : undefined;
  const scope = hasKey(input, 'scope') ? pick(input.scope, SCOPE_OPTIONS, 'public', 'scope') : undefined;
  const access = hasKey(input, 'access_mode') || hasKey(input, 'allowed_ips')
    ? accessFields(pick(hasKey(input, 'access_mode') ? input.access_mode : current.access_mode, ACCESS_OPTIONS, 'full', 'access mode'),
      hasKey(input, 'allowed_ips') ? input.allowed_ips : current.allowed_ips)
    : {};
  const providerData = ['provider', 'provider_port', 'provider_protocol'].some((k) => hasKey(input, k))
    ? providerFields(hasKey(input, 'provider') ? await configuredProvider(str(input.provider), current.provider) : current.provider,
      hasKey(input, 'provider_port') ? input.provider_port : current.provider_port,
      hasKey(input, 'provider_protocol') ? input.provider_protocol : current.provider_protocol)
    : {};
  await assertRefs(input);
  await withTransaction(client, async (c) => {
    const resolve = inventoryResolver(c, input.updated_by);
    await ServiceMapping.update(id, {
      name,
      domain_id: hasKey(input, 'domain') ? ((await resolve.domain(input.domain))?.id ?? null) : undefined,
      ...providerData,
      ip_address_id: hasKey(input, 'ip_address') ? (await resolve.ip(input.ip_address)).id : undefined,
      port: hasKey(input, 'port') ? Number(input.port) : undefined,
      protocol: hasKey(input, 'protocol') ? (input.protocol || '').toUpperCase() : undefined,
      direction, scope, ...access,
      system_id: hasKey(input, 'system_id') ? (input.system_id || null) : undefined,
      description: hasKey(input, 'description') ? str(input.description) : undefined,
      updated_by: input.updated_by || 'admin',
    }, c);
    if (hasKey(input, 'member_ip')) await ServiceMapping.setMembers(id, await resolveMembers(input, resolve), c);
  });
  return ServiceMapping.findByIdWithRelations(id, client);
}

export async function deleteServiceMapping(id) {
  if (!(await ServiceMapping.exists(id))) throw new NotFoundError('Service Mapping not found');
  await ServiceMapping.delete(id);
}
