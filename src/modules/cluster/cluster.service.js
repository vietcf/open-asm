// Clusters (groups of IPs with a role each, serving systems): shared by the web pages and the REST API.
import Cluster from './cluster.model.js';
import System from '../system/system.model.js';
import IpAddress from '../network/ip-address.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toIdArray, hasKey, assertIdsExist } from '../../shared/service.js';

async function assertNameAvailable(name, excludeId = null) {
  const existing = await Cluster.findByNameExact(name);
  if (existing.some((c) => String(c.id) !== String(excludeId))) throw new ConflictError('Cluster name already exists: {name}').withParams({ name });
}

// Parallel member_ip_id[] / member_role[] -> [{ip_address_id, role}] (first occurrence of an IP wins)
function normalizeMembers(rawIpIds, rawRoles) {
  const ipIds = [].concat(rawIpIds ?? []);
  const roles = [].concat(rawRoles ?? []);
  const seen = new Set();
  const members = [];
  ipIds.forEach((raw, i) => {
    const ipId = Number(raw);
    if (!Number.isInteger(ipId) || ipId <= 0 || seen.has(ipId)) return;
    seen.add(ipId);
    members.push({ ip_address_id: ipId, role: String(roles[i] ?? '').trim() || null });
  });
  return members;
}

async function resolveLinks(input, partial) {
  const links = {};
  if (!partial || hasKey(input, 'member_ip_id') || hasKey(input, 'member_role')) {
    links.members = normalizeMembers(input.member_ip_id, input.member_role);
    await assertIdsExist(links.members.map((m) => m.ip_address_id), (id) => IpAddress.exists(id), 'IP address');
  }
  if (!partial || hasKey(input, 'systems')) {
    links.systems = toIdArray(input.systems);
    await assertIdsExist(links.systems, (id) => System.exists(id), 'system');
  }
  return links;
}

async function saveLinks(id, links, username, c) {
  if (links.members) await Cluster.setMembers(id, links.members.map((m) => ({ ...m, updated_by: username })), c);
  if (links.systems) await Cluster.setSystems(id, links.systems, c);
}

const description = (v) => (typeof v === 'string' ? v.trim() || null : null);

// ===== Queries =====
export async function listClusters(filter) {
  const [items, totalCount] = await Promise.all([Cluster.findFilteredList(filter), Cluster.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getCluster(id) {
  const cluster = await Cluster.findByIdWithRelations(id);
  if (!cluster) throw new NotFoundError('Cluster not found');
  return cluster;
}

export const getRoleOptions = () => Cluster.getDistinctRoles();
export const getClustersForSystem = (systemId) => Cluster.findBySystemId(systemId);

// ===== Commands =====
// input: {name, description?, member_ip_id[]?, member_role[]?, systems[]?, updated_by?}
export async function createCluster(input, client) {
  const name = String(input.name || '').trim();
  if (!name) throw new ValidationError('Cluster name is required');
  await assertNameAvailable(name);
  const links = await resolveLinks(input, false);
  const username = input.updated_by || 'admin';
  const id = await withTransaction(client, async (c) => {
    const created = await Cluster.create({ name, description: description(input.description), updated_by: username }, c);
    await saveLinks(created.id, links, username, c);
    return created.id;
  });
  return Cluster.findByIdWithRelations(id, client);
}

// Partial update: only the keys present in input change (members and systems included).
export async function updateCluster(id, input, client) {
  const current = await Cluster.findById(id);
  if (!current) throw new NotFoundError('Cluster not found');
  const name = hasKey(input, 'name') ? String(input.name || '').trim() : current.name;
  if (!name) throw new ValidationError('Cluster name is required');
  if (name.toLowerCase() !== current.name.toLowerCase()) await assertNameAvailable(name, id);
  const links = await resolveLinks(input, true);
  const username = input.updated_by || 'admin';
  await withTransaction(client, async (c) => {
    await Cluster.update(id, { name, description: hasKey(input, 'description') ? description(input.description) : current.description, updated_by: username }, c);
    await saveLinks(id, links, username, c);
  });
  return Cluster.findByIdWithRelations(id, client);
}

export async function deleteCluster(id) {
  if (!(await Cluster.exists(id))) throw new NotFoundError('Cluster not found');
  await Cluster.delete(id);
}
