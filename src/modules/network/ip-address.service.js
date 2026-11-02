// IP addresses: validation and persistence shared by the web pages and the REST API.
import IpAddress from './ip-address.model.js';
import Tag from '../organize/tag.model.js';
import Contact from '../organize/contact.model.js';
import System from '../system/system.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { dropComponentIpsOutsideSystem } from '../system/system-ip-links.js';
import { hasKey, loadOptions, assertOption, resolveRelations, saveRelations, toStringList } from '../../shared/service.js';

// Octet-bounded IPv4
export const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

const RELATIONS = {
  tags: { label: 'tag', exists: (id) => Tag.exists(id), save: (id, ids, c) => IpAddress.setTags(id, ids, c) },
  contacts: { label: 'contact', exists: (id) => Contact.exists(id), save: (id, ids, c) => IpAddress.setContacts(id, ids, c) },
  systems: { label: 'system', exists: (id) => System.exists(id), save: (id, ids, c) => IpAddress.setSystems(id, ids, c) },
};

// ===== Options ({id, text}) =====
export const getIpStatusOptions = () => loadOptions('ip_address_status');

// ===== Queries =====
export async function listIpAddresses(filter) {
  const [items, totalCount] = await Promise.all([IpAddress.findFilteredList(filter), IpAddress.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getIpAddress(id) {
  const ip = await IpAddress.findByIdWithDetails(id);
  if (!ip) throw new NotFoundError('IP address not found');
  return ip;
}

export async function getIpAddressByAddress(address) {
  const ip = await IpAddress.findByAddressWithDetails(address);
  if (!ip) throw new NotFoundError('IP address not found');
  return ip;
}

// ===== Commands =====
const text = (v) => (typeof v === 'string' ? v.trim() : v ?? null);
const statusOf = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// input: {address, description, status, tags?, contacts?, systems?, updated_by}
export async function createIpAddress(input, client) {
  return (await createIpAddresses({ ...input, addresses: [input.address] }, client))[0];
}

// Several addresses with the same details, all or none (the web form takes "a, b, c").
export async function createIpAddresses(input, client) {
  const addresses = toStringList(input.addresses);
  if (!addresses.length) throw new ValidationError('IP address is required');
  const invalid = addresses.filter((a) => !IPV4_REGEX.test(a));
  if (invalid.length) throw new ValidationError('Invalid IPv4 address: {list}').withParams({ list: invalid.join(', ') });
  if (new Set(addresses).size < addresses.length) throw new ValidationError('Duplicate IP address in the list');
  for (const a of addresses) {
    if (await IpAddress.findByAddress(a)) throw new ConflictError('IP address already exists: {address}').withParams({ address: a });
  }
  const status = statusOf(input.status);
  await assertOption('ip_address_status', status, 'status');
  const relations = await resolveRelations(input, RELATIONS);

  try {
    const ids = await withTransaction(client, async (c) => {
      const created = [];
      for (const address of addresses) {
        const ip = await IpAddress.create({ address, description: text(input.description), status, updated_by: input.updated_by }, c);
        await saveRelations(ip.id, relations, RELATIONS, c);
        created.push(ip.id);
      }
      return created;
    });
    return Promise.all(ids.map((id) => IpAddress.findByIdWithDetails(id)));
  } catch (err) {
    if (err.code === '23505') throw new ConflictError('IP address already exists');
    throw err;
  }
}

// Partial update: missing keys keep their value; a blank status clears it.
// tags/contacts/systems: a present key (even []) replaces the links.
export async function updateIpAddress(id, input, client) {
  const current = await IpAddress.findById(id);
  if (!current) throw new NotFoundError('IP address not found');
  const description = hasKey(input, 'description') ? text(input.description) : current.description;
  const status = hasKey(input, 'status') ? statusOf(input.status) : current.status;
  if (hasKey(input, 'status')) await assertOption('ip_address_status', status, 'status', current.status);
  const relations = await resolveRelations(input, RELATIONS, { partial: true });

  await withTransaction(client, async (c) => {
    await IpAddress.update(id, { description, status, updated_by: input.updated_by }, c);
    await saveRelations(id, relations, RELATIONS, c);
    // a system taken off the IP takes the IP off that system's components too
    if (relations.systems) await dropComponentIpsOutsideSystem({ ipId: Number(id) }, c);
  });
  return IpAddress.findByIdWithDetails(id);
}

// An IP still used by a server or device, a service mapping or a cluster cannot be deleted.
export async function deleteIpAddress(id, client) {
  if (!(await IpAddress.exists(id))) throw new NotFoundError('IP address not found');
  const { devices, servers } = await IpAddress.getOwners(id, client);
  if (devices.length || servers.length) {
    const owners = [...servers.map((s) => `server "${s.name}"`), ...devices.map((d) => `device "${d.name}"`)];
    throw new ConflictError('Cannot delete IP address: it is assigned to {owners}').withParams({ owners: owners.join(', ') });
  }
  const mappings = await IpAddress.getServiceMappings(id, client);
  if (mappings.length) {
    throw new ConflictError('Cannot delete IP address: it is used by service mapping {names}. Remove it from the mapping first.')
      .withParams({ names: mappings.map((m) => `"${m.name}"`).join(', ') });
  }
  const clusters = await IpAddress.getClusters(id, client);
  if (clusters.length) {
    throw new ConflictError('Cannot delete IP address: it is a member of cluster {names}. Remove it from the cluster first.')
      .withParams({ names: clusters.map((c) => `"${c.name}"`).join(', ') });
  }
  await IpAddress.remove(id, client);
}
