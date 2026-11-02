// IP addresses owned by servers and devices (server_ip / device_ip).
// role 'normal' = the owner's own (primary) IP, marked 'assigned' and owned by
// one server or device only; role 'vip' = shared IP that may also belong to others.
import IpAddress from './ip-address.model.js';
import { db } from '../../shared/db.js';
import { ValidationError } from '../../shared/errors.js';
import { assertIdsExist } from '../../shared/service.js';

const OWNERS = {
  server: { table: 'server_ip', column: 'server_id', label: 'server' },
  device: { table: 'device_ip', column: 'device_id', label: 'device' },
};

// Primary IPs must exist and not be assigned to another owner (excludeId = this one).
// client: the caller's transaction, so IPs it just created are visible.
export async function assertPrimaryIps(kind, ids, excludeId, client) {
  if (!ids.length) throw new ValidationError('At least one IP address is required');
  const invalid = [];
  const assigned = [];
  for (const id of ids) {
    const ip = await IpAddress.findById(id, client);
    if (!ip) invalid.push(id);
    else if (ip.status === 'assigned') {
      const owner = await IpAddress.getPrimaryOwnerIds(id, client);
      const ownerId = kind === 'server' ? owner.serverId : owner.deviceId;
      if (excludeId == null || String(ownerId) !== String(excludeId)) assigned.push(`IP ${ip.ip_address} (ID: ${id})`);
    }
  }
  if (invalid.length) throw new ValidationError(`Invalid IP address IDs: ${invalid.join(', ')}`);
  if (assigned.length) throw new ValidationError(`Cannot use already assigned IP addresses: ${assigned.join(', ')}`);
}

// VIP IPs must exist and cannot also be one of the owner's primary IPs.
export async function assertVipIps(kind, vipIds, primaryIds) {
  await assertIdsExist(vipIds, (x) => IpAddress.exists(x), 'VIP IP address');
  const primary = primaryIds.map(String);
  const overlap = vipIds.filter((x) => primary.includes(String(x)));
  if (overlap.length) throw new ValidationError(`IP(s) cannot be both a normal and a VIP IP for the same ${OWNERS[kind].label}: ${overlap.join(', ')}`);
}

// Replaces the owner's primary IPs (marked 'assigned'; dropped ones lose their status). VIP links are kept.
export async function setPrimaryIps(kind, ownerId, ipIds, client) {
  const { table, column } = OWNERS[kind];
  const ex = db(client);
  const { rows } = await ex.query(`DELETE FROM ${table} WHERE ${column} = $1 AND role = 'normal' RETURNING ip_id`, [ownerId]);
  const old = rows.map((r) => r.ip_id);
  if (old.length) await ex.query('UPDATE ip_addresses SET status = NULL WHERE id = ANY($1)', [old]);
  if (ipIds.length) {
    await ex.query(
      `INSERT INTO ${table} (${column}, ip_id, role) SELECT $1, unnest($2::int[]), 'normal'
       ON CONFLICT (${column}, ip_id) DO UPDATE SET role = 'normal'`,
      [ownerId, ipIds.map(Number)]
    );
    await ex.query("UPDATE ip_addresses SET status = 'assigned' WHERE id = ANY($1)", [ipIds.map(Number)]);
  }
}

// Replaces the owner's VIP links
export async function setVipIps(kind, ownerId, vipIds, updatedBy, client) {
  const { table, column } = OWNERS[kind];
  const ex = db(client);
  const { rows } = await ex.query(`SELECT ip_id FROM ${table} WHERE ${column} = $1 AND role = 'vip'`, [ownerId]);
  const oldIds = rows.map((r) => r.ip_id);
  const newIds = (vipIds || []).map(Number);
  for (const ipId of oldIds.filter((x) => !newIds.includes(x))) await IpAddress.removeVipLink({ ip_id: ipId, [column]: ownerId }, ex);
  for (const ipId of newIds.filter((x) => !oldIds.includes(x))) await IpAddress.addVipLink({ ip_id: ipId, [column]: ownerId, updated_by: updatedBy }, ex);
}

// The owner's IP ids, read before deleting it
export async function ownedIpIds(kind, ownerId, client) {
  const { table, column } = OWNERS[kind];
  const { rows } = await db(client).query(`SELECT ip_id FROM ${table} WHERE ${column} = $1`, [ownerId]);
  return rows.map((r) => r.ip_id);
}

// After an owner is deleted: its IPs that no other owner uses are released
// ('reserved') or, with deleteIp, deleted. IPs still referenced by a cluster
// or a service mapping are only released, never deleted.
export async function releaseIps(ipIds, { deleteIp = false } = {}, client) {
  if (!ipIds.length) return;
  const ex = db(client);
  const unused = 'id = ANY($1) AND id NOT IN (SELECT ip_id FROM device_ip UNION SELECT ip_id FROM server_ip)';
  if (deleteIp) {
    await ex.query(`DELETE FROM ip_addresses WHERE ${unused} AND id NOT IN (
      SELECT ip_address_id FROM cluster_members UNION SELECT ip_address_id FROM virtual_server_members
      UNION SELECT ip_address_id FROM virtual_servers)`, [ipIds]);
  }
  await ex.query(`UPDATE ip_addresses SET status = 'reserved' WHERE ${unused}`, [ipIds]);
}

// ===== Imports =====
// Addresses already assigned to a server or device
export async function assignedAddresses(addresses) {
  const assigned = [];
  for (const address of addresses) {
    const ip = await IpAddress.findByAddressWithDetails(address);
    if (ip && ip.status === 'assigned') assigned.push(address);
  }
  return assigned;
}

// Ids of the addresses, creating unknown ones as 'reserved' (with a note)
export async function ensureIpAddresses(addresses, note, updatedBy, client) {
  const ids = [];
  for (const address of addresses) {
    const existing = await IpAddress.findByAddress(address);
    ids.push(existing ? existing.id : (await IpAddress.create({ address, description: note, status: 'reserved', updated_by: updatedBy }, client)).id);
  }
  return ids;
}
