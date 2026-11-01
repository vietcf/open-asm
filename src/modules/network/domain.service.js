import Domain from './domain.model.js';
import System from '../system/system.model.js';
import IpAddress from './ip-address.model.js';
import Tag from '../organize/tag.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';

const toIdArray = v => {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
};

export async function validateSystemIds(systemIds) {
  for (const id of systemIds) {
    if (!(await System.exists(id))) throw new ValidationError(`Invalid system ID: ${id}`);
  }
}

export async function validateIpId(ipId) {
  if (!(await IpAddress.exists(ipId))) throw new ValidationError('Invalid IP address ID');
}

// Tags were previously applied by the frontend with no existence check at all
// (a bad tag id would fail as a raw FK-violation error). Validated here now,
// consistent with how device/subnet/IP services already validate tags.
export async function validateTagIds(tagIds) {
  for (const id of tagIds) {
    if (!(await Tag.exists(id))) throw new ValidationError(`Tag does not exist: ${id}`);
  }
}

// Domain.update() only ever writes description/ip_id/record_type — it has no
// column for renaming. The old API controller validated an incoming `domain`
// field (400 if empty) and pretended to support renaming, but the value was
// silently dropped before reaching the model. That "capability" never
// actually worked, so it isn't carried over here rather than replicating a
// validate-then-no-op trap.
function mapUniqueViolation(err) {
  if (err.code === '23505') {
    if (err.constraint === 'domains_domain_key') throw new ConflictError('Domain already exists');
    throw new ConflictError('Duplicate value violates unique constraint');
  }
  throw err;
}

export async function listDomains(filter) {
  const [items, totalCount] = await Promise.all([
    Domain.findFilteredList(filter),
    Domain.countFiltered(filter)
  ]);
  return { items, totalCount };
}

// client is optional — pass the caller's transaction client when reading
// back a row created/updated earlier in that same not-yet-committed
// transaction, since a plain pool query can't see uncommitted writes.
export async function getDomain(id, client) {
  const domain = await Domain.findById(id, client);
  if (!domain) throw new NotFoundError('Domain not found');
  const [systems, ip] = await Promise.all([
    Domain.findSystems(id, client),
    Domain.getIp(domain.ip_id, client)
  ]);
  return { ...domain, systems, ip };
}

// input: {domain, description, ip_id, record_type, systems, tags, updated_by}
// `tags` was previously accepted and applied by the frontend but silently
// ignored by the API (no import, no field extraction, no setTags call) —
// adopted for both here so the API gains the capability it was missing.
export async function createDomain(input, client) {
  const domainName = typeof input.domain === 'string' ? input.domain.trim() : '';
  if (!domainName) throw new ValidationError('Domain name is required');

  const description = typeof input.description === 'string' ? input.description.trim() : (input.description || null);
  const recordType = typeof input.record_type === 'string' && input.record_type.trim() ? input.record_type.trim() : 'A';
  const ipId = input.ip_id && String(input.ip_id).trim() !== '' ? parseInt(input.ip_id, 10) : null;
  if (ipId) await validateIpId(ipId);

  const systems = toIdArray(input.systems);
  if (systems.length) await validateSystemIds(systems);
  const tags = toIdArray(input.tags);
  if (tags.length) await validateTagIds(tags);

  let created;
  try {
    created = await withTransaction(client, async (c) => {
      const d = await Domain.create({ domain: domainName, description, ip_id: ipId, record_type: recordType }, c);
      if (systems.length) await Domain.setSystems(d.id, systems, c);
      if (tags.length) await Domain.setTags(d.id, tags, c);
      return d;
    });
  } catch (err) {
    mapUniqueViolation(err);
  }
  return getDomain(created.id, client);
}

// Partial update. description/ip_id/record_type are written together
// (Domain.update has no partial-column form) so only-provided fields are
// merged onto the current row's values. systems/tags: key present (even as
// []) replaces the association; key absent leaves it untouched.
export async function updateDomain(id, input, client) {
  const current = await Domain.findById(id, client);
  if (!current) throw new NotFoundError('Domain not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  let ipId = current.ip_id;
  if (has('ip_id')) {
    ipId = input.ip_id && String(input.ip_id).trim() !== '' ? parseInt(input.ip_id, 10) : null;
    if (ipId) await validateIpId(ipId);
  }
  const description = has('description')
    ? (typeof input.description === 'string' ? input.description.trim() : (input.description || null))
    : current.description;
  const recordType = has('record_type')
    ? (typeof input.record_type === 'string' && input.record_type.trim() ? input.record_type.trim() : 'A')
    : current.record_type;

  let systems = null;
  if (has('systems')) {
    systems = toIdArray(input.systems);
    if (systems.length) await validateSystemIds(systems);
  }
  let tags = null;
  if (has('tags')) {
    tags = toIdArray(input.tags);
    if (tags.length) await validateTagIds(tags);
  }

  try {
    await withTransaction(client, async (c) => {
      if (has('description') || has('ip_id') || has('record_type')) {
        await Domain.update(id, { description, ip_id: ipId, record_type: recordType }, c);
      }
      if (systems) await Domain.setSystems(id, systems, c);
      if (tags) await Domain.setTags(id, tags, c);
    });
  } catch (err) {
    mapUniqueViolation(err);
  }
  return getDomain(id, client);
}

export async function deleteDomain(id) {
  const domain = await Domain.findById(id);
  if (!domain) throw new NotFoundError('Domain not found');
  // Domain isn't dependent on the systems it's linked to - Domain.delete()
  // unlinks system_domain rows itself before deleting the domain row.
  await Domain.delete(id);
}
