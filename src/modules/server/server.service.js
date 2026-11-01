// Servers: validation and persistence shared by the web pages and the REST API.
import Server from './server.model.js';
import Agent from './agent.model.js';
import Service from './service.model.js';
import { assertPrimaryIps, assertVipIps, setPrimaryIps, setVipIps, ownedIpIds, releaseIps } from '../network/ip-ownership.js';
import Platform from '../device/platform.model.js';
import Contact from '../organize/contact.model.js';
import Tag from '../organize/tag.model.js';
import System from '../system/system.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toIdArray, hasKey, loadOptions, assertOption, resolveRelations, saveRelations } from '../../shared/service.js';

const RELATIONS = {
  managers: { label: 'manager (contact)', exists: (id) => Contact.exists(id), save: (id, ids, c) => Server.setManagers(id, ids, c) },
  systems: { label: 'system', exists: (id) => System.exists(id), save: (id, ids, c) => Server.setSystems(id, ids, c) },
  agents: { label: 'agent', exists: (id) => Agent.exists(id), save: (id, ids, c) => Server.setAgents(id, ids, c) },
  services: { label: 'service', exists: (id) => Service.exists(id), save: (id, ids, c) => Server.setServices(id, ids, c) },
  tags: { label: 'tag', exists: (id) => Tag.exists(id), save: (id, ids, c) => Server.setTags(id, ids, c) },
};
const FIELDS = ['name', 'description', 'os', 'status', 'type', 'location', 'ip_addresses', 'vip_ip_addresses'];

// ===== Options ({id, text}); location shares Device's list =====
export const getServerLocationOptions = () => loadOptions('device_location');
export const getServerStatusOptions = () => loadOptions('server_status');
export const getServerTypeOptions = () => loadOptions('server_type');

export async function getFormOptions() {
  const [locations, statusOptions, typesOptions] = await Promise.all([getServerLocationOptions(), getServerStatusOptions(), getServerTypeOptions()]);
  return { locations, statusOptions, typesOptions };
}

// ===== Queries =====
export async function listServers(filter) {
  const [items, totalCount] = await Promise.all([Server.findFilteredList(filter), Server.countFiltered(filter)]);
  return { items, totalCount };
}

// REST shape (os object)
export async function getServer(id) {
  const server = await Server.findByIdWithDetails(id);
  if (!server) throw new NotFoundError('Server not found');
  return server;
}

// List shape, for the detail modal and the edit form
export async function getServerWithLinks(id) {
  const server = await Server.findById(id);
  if (!server) throw new NotFoundError('Server not found');
  return server;
}

// ===== Validation =====
async function assertNameAvailable(name, excludeId = null) {
  const existing = await Server.findByName(name);
  if (existing && String(existing.id) !== String(excludeId)) throw new ConflictError('Server name already exists');
}

const trimOrNull = (v) => (typeof v === 'string' ? v.trim() || null : (v ?? null));

async function normalize(input, current = null) {
  const pick = (key, currentKey = key) => (current && !hasKey(input, key) ? current[currentKey] : trimOrNull(input[key]));
  const data = {
    name: pick('name'), description: pick('description'), os: pick('os', 'os_id'),
    status: pick('status'), type: pick('type'), location: pick('location'),
  };
  const changed = (key) => !current || hasKey(input, key);
  if (!data.name) throw new ValidationError('Server name is required');
  if (changed('name') && data.name !== current?.name) await assertNameAvailable(data.name, current?.id ?? null);
  if (changed('os') && data.os && !(await Platform.exists(data.os))) throw new ValidationError(`Invalid platform (os) ID: ${data.os}`);
  if (changed('status')) await assertOption('server_status', data.status, 'status');
  if (changed('location')) await assertOption('device_location', data.location, 'location');
  return data;
}

// ===== Commands =====
// input: {name, os?, status?, location?, type?, description?, ip_addresses,
//         managers?, systems?, agents?, services?, tags?, updated_by?}
export async function createServer(input, client) {
  const data = await normalize(input);
  const links = await resolveRelations(input, RELATIONS);
  const ipIds = toIdArray(input.ip_addresses);
  await assertPrimaryIps('server', ipIds, null, client);
  const id = await withTransaction(client, async (c) => {
    const serverId = await Server.create({ ...data, username: input.updated_by || 'admin' }, c);
    await setPrimaryIps('server', serverId, ipIds, c);
    await saveRelations(serverId, links, RELATIONS, c);
    return serverId;
  });
  return Server.findByIdWithDetails(id, client);
}

// Partial update: only the keys present in input change (links included).
// VIP IPs may belong to another server/device (shared IP) but cannot also be
// one of this server's primary IPs.
export async function updateServer(id, input, client) {
  const current = await Server.findById(id, client);
  if (!current) throw new NotFoundError('Server not found');
  const unknown = Object.keys(input).filter((k) => !FIELDS.includes(k) && !RELATIONS[k] && k !== 'updated_by');
  if (unknown.length) throw new ValidationError(`Invalid field(s): ${unknown.join(', ')}`);

  const data = await normalize(input, current);
  const links = await resolveRelations(input, RELATIONS, { partial: true });
  const ipIds = hasKey(input, 'ip_addresses') ? toIdArray(input.ip_addresses) : null;
  if (ipIds) await assertPrimaryIps('server', ipIds, id, client);
  const vipIds = hasKey(input, 'vip_ip_addresses') ? toIdArray(input.vip_ip_addresses) : null;
  if (vipIds) await assertVipIps('server', vipIds, ipIds || current.ip_addresses.filter((ip) => ip.role === 'normal').map((ip) => ip.id));

  const username = input.updated_by || 'admin';
  await withTransaction(client, async (c) => {
    await Server.update(id, { ...data, username }, c);
    if (ipIds) await setPrimaryIps('server', id, ipIds, c);
    if (vipIds) await setVipIps('server', id, vipIds, username, c);
    await saveRelations(id, links, RELATIONS, c);
  });
  return Server.findByIdWithDetails(id, client);
}

// deleteIp: false releases the server's IPs ('reserved'), true deletes them.
export async function deleteServer(id, { deleteIp = false } = {}) {
  if (!(await Server.exists(id))) throw new NotFoundError('Server not found');
  await withTransaction(null, async (c) => {
    const ipIds = await ownedIpIds('server', id, c);
    await Server.remove(id, c);
    await releaseIps(ipIds, { deleteIp }, c);
  });
}
