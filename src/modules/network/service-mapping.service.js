import ServiceMapping from './service-mapping.model.js';
import Server from '../server/server.model.js';
import Device from '../device/device.model.js';
import System from '../system/system.model.js';
import { IPV4_REGEX } from './ip-address.service.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { hasKey, assertIdsExist } from '../../shared/service.js';

const PROTOCOL_OPTIONS = ['HTTP', 'HTTPS', 'TCP', 'UDP'];
const DIRECTION_OPTIONS = ['inbound', 'outbound'];
const SCOPE_OPTIONS = ['public', 'private'];
const ACCESS_OPTIONS = ['full', 'limited'];
const STATUS_OPTIONS = ['active', 'inactive'];

async function assertNameAvailable(name, excludeId = null) {
  const existing = await ServiceMapping.findByNameExact(name);
  if (existing.some((v) => String(v.id) !== String(excludeId))) throw new ConflictError('Service Mapping name already exists: {name}').withParams({ name });
}

// Parallel server_id[] / member_port[] / member_status[] -> [{server_id, port, status}]
function normalizeMembers(raw) {
  const serverIds = [].concat(raw.server_id ?? []);
  const ports = [].concat(raw.member_port ?? []);
  const statuses = [].concat(raw.member_status ?? []);
  const seen = new Set();
  const members = [];
  serverIds.forEach((id, i) => {
    const sId = Number(id);
    if (!Number.isInteger(sId) || sId <= 0 || seen.has(sId)) return;
    seen.add(sId);
    members.push({
      server_id: sId,
      port: Number(ports[i]) || null,
      status: STATUS_OPTIONS.includes(statuses[i]) ? statuses[i] : 'active',
    });
  });
  return members;
}

async function resolveLinks(input, partial) {
  const links = {};
  if (!partial || hasKey(input, 'server_id')) {
    links.members = normalizeMembers(input);
    await assertIdsExist(links.members.map((m) => m.server_id), (id) => Server.exists(id), 'server');
  }
  return links;
}

async function saveLinks(id, links, c) {
  if (links.members) await ServiceMapping.setMembers(id, links.members, c);
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

// Allowed IPs only make sense when access is limited
function accessFields(accessMode, allowedRaw) {
  if (accessMode !== 'limited') return { access_mode: accessMode, allowed_ips: null };
  const ips = parseAllowedIps(allowedRaw);
  if (!ips.length) throw new ValidationError('Allowed IPs are required when access is limited');
  return { access_mode: accessMode, allowed_ips: ips };
}

async function assertRefs(input) {
  if (input.device_id && !(await Device.exists(input.device_id))) throw new NotFoundError('Device not found');
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

// ===== Commands =====
export async function createServiceMapping(input, client) {
  const name = str(input.name) || (input.domain ? `${input.domain}:${input.port}` : `${input.ip_address}:${input.port}`);
  if (!input.ip_address) throw new ValidationError('IP Address is required');
  if (!input.port) throw new ValidationError('Port is required');
  const protocol = (input.protocol || 'HTTPS').toUpperCase();
  if (!PROTOCOL_OPTIONS.includes(protocol)) throw new ValidationError('Invalid protocol: {protocol}').withParams({ protocol });
  const direction = pick(input.direction, DIRECTION_OPTIONS, 'inbound', 'direction');
  const scope = pick(input.scope, SCOPE_OPTIONS, 'public', 'scope');
  const access = accessFields(pick(input.access_mode, ACCESS_OPTIONS, 'full', 'access mode'), input.allowed_ips);
  await assertRefs(input);
  await assertNameAvailable(name);
  const links = await resolveLinks(input, false);
  const id = await withTransaction(client, async (c) => {
    const created = await ServiceMapping.create({
      name, domain: str(input.domain), provider: str(input.provider),
      ip_address: input.ip_address, port: Number(input.port), protocol,
      direction, scope, ...access,
      device_id: input.device_id || null, system_id: input.system_id || null, description: str(input.description),
      updated_by: input.updated_by || 'admin',
    }, c);
    await saveLinks(created.id, links, c);
    return created.id;
  });
  return ServiceMapping.findByIdWithRelations(id, client);
}

export async function updateServiceMapping(id, input, client) {
  const current = await ServiceMapping.findById(id);
  if (!current) throw new NotFoundError('Service Mapping not found');
  const name = hasKey(input, 'name') ? (str(input.name) || current.name) : current.name;
  if (name.toLowerCase() !== current.name.toLowerCase()) await assertNameAvailable(name, id);
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
  await assertRefs(input);
  const links = await resolveLinks(input, true);
  await withTransaction(client, async (c) => {
    await ServiceMapping.update(id, {
      name,
      domain: hasKey(input, 'domain') ? str(input.domain) : undefined,
      provider: hasKey(input, 'provider') ? str(input.provider) : undefined,
      ip_address: hasKey(input, 'ip_address') ? input.ip_address : undefined,
      port: hasKey(input, 'port') ? Number(input.port) : undefined,
      protocol: hasKey(input, 'protocol') ? (input.protocol || '').toUpperCase() : undefined,
      direction, scope, ...access,
      device_id: hasKey(input, 'device_id') ? (input.device_id || null) : undefined,
      system_id: hasKey(input, 'system_id') ? (input.system_id || null) : undefined,
      description: hasKey(input, 'description') ? str(input.description) : undefined,
      updated_by: input.updated_by || 'admin',
    }, c);
    await saveLinks(id, links, c);
  });
  return ServiceMapping.findByIdWithRelations(id, client);
}

export async function deleteServiceMapping(id) {
  if (!(await ServiceMapping.exists(id))) throw new NotFoundError('Service Mapping not found');
  await ServiceMapping.delete(id);
}
