import Cluster from './cluster.model.js';
import System from '../system/system.model.js';
import IpAddress from '../network/ip-address.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';

const toIdArray = v => {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(Number).filter(x => !isNaN(x));
};

async function validateIpAddressIds(ids) {
  const invalid = [];
  for (const id of ids) {
    if (!(await IpAddress.exists(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid IP address IDs: ${invalid.join(', ')}`);
}

async function validateSystemIds(ids) {
  const invalid = [];
  for (const id of ids) {
    if (!(await System.exists(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid system IDs: ${invalid.join(', ')}`);
}

async function assertNameAvailable(name, excludeId) {
  const existing = await Cluster.findByNameExact(name);
  const clash = existing.find(c => String(c.id) !== String(excludeId));
  if (clash) throw new ConflictError(`Cluster name already exists: ${name}`);
}

// members: [{ ip_address_id, role }]
function normalizeMembers(rawIpIds, rawRoles) {
  const ipIds = Array.isArray(rawIpIds) ? rawIpIds : (rawIpIds ? [rawIpIds] : []);
  const roles = Array.isArray(rawRoles) ? rawRoles : (rawRoles ? [rawRoles] : []);
  const members = [];
  const seen = new Set();
  for (let i = 0; i < ipIds.length; i++) {
    const ipId = Number(ipIds[i]);
    if (!ipId || isNaN(ipId) || seen.has(ipId)) continue;
    seen.add(ipId);
    const role = (roles[i] || '').toString().trim() || null;
    members.push({ ip_address_id: ipId, role });
  }
  return members;
}

export async function listClusters(filter) {
  const [items, totalCount] = await Promise.all([
    Cluster.findFilteredList(filter),
    Cluster.countFiltered(filter)
  ]);
  return { items, totalCount };
}

export async function getCluster(id) {
  const cluster = await Cluster.findByIdWithRelations(id);
  if (!cluster) throw new NotFoundError('Cluster not found');
  return cluster;
}

export async function getRoleOptions() {
  return Cluster.getDistinctRoles();
}

export async function getClustersForSystem(systemId) {
  return Cluster.findBySystemId(systemId);
}

// input: {name, description?, member_ip_id[], member_role[], systems[], updated_by?}
export async function createCluster(input) {
  const name = (input.name || '').trim();
  if (!name) throw new ValidationError('Cluster name is required');
  await assertNameAvailable(name);

  const members = normalizeMembers(input.member_ip_id, input.member_role);
  if (members.length) await validateIpAddressIds(members.map(m => m.ip_address_id));

  const systems = toIdArray(input.systems);
  if (systems.length) await validateSystemIds(systems);

  const description = typeof input.description === 'string' ? (input.description.trim() || null) : null;
  const username = input.updated_by || 'admin';

  const cluster = await withTransaction(null, async (c) => {
    const created = await Cluster.create({ name, description, updated_by: username }, c);
    await Cluster.setMembers(created.id, members.map(m => ({ ...m, updated_by: username })), c);
    await Cluster.setSystems(created.id, systems, c);
    return created;
  });
  return Cluster.findByIdWithRelations(cluster.id);
}

// Partial update (has-key semantics).
export async function updateCluster(id, input) {
  const current = await Cluster.findById(id);
  if (!current) throw new NotFoundError('Cluster not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  const name = has('name') ? (input.name || '').trim() : current.name;
  if (!name) throw new ValidationError('Cluster name is required');
  if (has('name') && name.toLowerCase() !== current.name.toLowerCase()) {
    await assertNameAvailable(name, id);
  }
  const description = has('description')
    ? (typeof input.description === 'string' ? (input.description.trim() || null) : null)
    : current.description;
  const username = input.updated_by || 'admin';

  let members;
  if (has('member_ip_id') || has('member_role')) {
    members = normalizeMembers(input.member_ip_id, input.member_role);
    if (members.length) await validateIpAddressIds(members.map(m => m.ip_address_id));
  }

  let systems;
  if (has('systems')) {
    systems = toIdArray(input.systems);
    if (systems.length) await validateSystemIds(systems);
  }

  await withTransaction(null, async (c) => {
    await Cluster.update(id, { name, description, updated_by: username }, c);
    if (members !== undefined) await Cluster.setMembers(id, members.map(m => ({ ...m, updated_by: username })), c);
    if (systems !== undefined) await Cluster.setSystems(id, systems, c);
  });
  return Cluster.findByIdWithRelations(id);
}

export async function deleteCluster(id) {
  const exists = await Cluster.exists(id);
  if (!exists) throw new NotFoundError('Cluster not found');
  await withTransaction(null, async (c) => {
    await Cluster.delete(id, c);
  });
}
