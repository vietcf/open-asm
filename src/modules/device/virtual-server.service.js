import VirtualServer from './virtual-server.model.js';
import Server from '../server/server.model.js';
import Device from './device.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { hasKey, assertIdsExist } from '../../shared/service.js';

const PROTOCOL_OPTIONS = ['HTTP', 'HTTPS', 'TCP', 'UDP'];
const STATUS_OPTIONS = ['active', 'standby', 'disabled'];

async function assertNameAvailable(name, excludeId = null) {
  const existing = await VirtualServer.findByNameExact(name);
  if (existing.some((v) => String(v.id) !== String(excludeId))) throw new ConflictError('Virtual Server name already exists: {name}').withParams({ name });
}

// Parallel server_id[] / member_port[] / member_weight[] / member_status[] -> [{server_id, port, weight, status}]
function normalizeMembers(raw) {
  const serverIds = [].concat(raw.server_id ?? []);
  const ports = [].concat(raw.member_port ?? []);
  const weights = [].concat(raw.member_weight ?? []);
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
      weight: Number(weights[i]) || 1,
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
  if (links.members) await VirtualServer.setMembers(id, links.members, c);
}

const str = (v) => (typeof v === 'string' ? v.trim() || null : null);

// ===== Queries =====
export async function listVirtualServers(filter) {
  const [items, totalCount] = await Promise.all([VirtualServer.findFilteredList(filter), VirtualServer.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getVirtualServer(id) {
  const vs = await VirtualServer.findByIdWithRelations(id);
  if (!vs) throw new NotFoundError('Virtual Server not found');
  return vs;
}

export const getProviderOptions = () => VirtualServer.getDistinctProviders();
export const getProtocolOptions = () => VirtualServer.getDistinctProtocols();
export const getVirtualServersForDevice = (deviceId) => VirtualServer.findByDeviceId(deviceId);
export const getVirtualServersForServer = (serverId) => VirtualServer.findByServerId(serverId);

// ===== Commands =====
export async function createVirtualServer(input, client) {
  const name = str(input.name) || (input.domain ? `${input.domain}:${input.port}` : `${input.ip_address}:${input.port}`);
  if (!input.ip_address) throw new ValidationError('IP Address is required');
  if (!input.port) throw new ValidationError('Port is required');
  const protocol = (input.protocol || 'HTTPS').toUpperCase();
  if (!PROTOCOL_OPTIONS.includes(protocol)) throw new ValidationError('Invalid protocol: {protocol}').withParams({ protocol });
  if (input.device_id && !(await Device.exists(input.device_id))) throw new NotFoundError('Device not found');
  await assertNameAvailable(name);
  const links = await resolveLinks(input, false);
  const id = await withTransaction(client, async (c) => {
    const created = await VirtualServer.create({
      name, domain: str(input.domain), provider: str(input.provider),
      ip_address: input.ip_address, port: Number(input.port), protocol,
      device_id: input.device_id || null, description: str(input.description),
      updated_by: input.updated_by || 'admin',
    }, c);
    await saveLinks(created.id, links, c);
    return created.id;
  });
  return VirtualServer.findByIdWithRelations(id, client);
}

export async function updateVirtualServer(id, input, client) {
  const current = await VirtualServer.findById(id);
  if (!current) throw new NotFoundError('Virtual Server not found');
  const name = hasKey(input, 'name') ? (str(input.name) || current.name) : current.name;
  if (name.toLowerCase() !== current.name.toLowerCase()) await assertNameAvailable(name, id);
  if (hasKey(input, 'protocol')) {
    const protocol = (input.protocol || '').toUpperCase();
    if (!PROTOCOL_OPTIONS.includes(protocol)) throw new ValidationError('Invalid protocol: {protocol}').withParams({ protocol });
  }
  if (hasKey(input, 'device_id') && input.device_id && !(await Device.exists(input.device_id))) throw new NotFoundError('Device not found');
  const links = await resolveLinks(input, true);
  await withTransaction(client, async (c) => {
    await VirtualServer.update(id, {
      name,
      domain: hasKey(input, 'domain') ? str(input.domain) : undefined,
      provider: hasKey(input, 'provider') ? str(input.provider) : undefined,
      ip_address: hasKey(input, 'ip_address') ? input.ip_address : undefined,
      port: hasKey(input, 'port') ? Number(input.port) : undefined,
      protocol: hasKey(input, 'protocol') ? (input.protocol || '').toUpperCase() : undefined,
      device_id: hasKey(input, 'device_id') ? (input.device_id || null) : undefined,
      description: hasKey(input, 'description') ? str(input.description) : undefined,
      updated_by: input.updated_by || 'admin',
    }, c);
    await saveLinks(id, links, c);
  });
  return VirtualServer.findByIdWithRelations(id, client);
}

export async function deleteVirtualServer(id) {
  if (!(await VirtualServer.exists(id))) throw new NotFoundError('Virtual Server not found');
  await VirtualServer.delete(id);
}
