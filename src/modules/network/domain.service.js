// Domains: validation and persistence shared by the web pages and the REST API.
import Domain from './domain.model.js';
import System from '../system/system.model.js';
import IpAddress from './ip-address.model.js';
import Tag from '../organize/tag.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { hasKey, toNullableString, loadOptions, assertOption, resolveRelations, saveRelations } from '../../shared/service.js';

const RELATIONS = {
  systems: { label: 'system', exists: (id) => System.exists(id), save: (id, ids, c) => Domain.setSystems(id, ids, c) },
  tags: { label: 'tag', exists: (id) => Tag.exists(id), save: (id, ids, c) => Domain.setTags(id, ids, c) },
};

// ===== Options ({id, text}) =====
export const getRecordTypeOptions = () => loadOptions('network_domain_record_type');

// ===== Queries =====
export async function listDomains(filter) {
  const [items, totalCount] = await Promise.all([Domain.findFilteredList(filter), Domain.countFiltered(filter)]);
  return { items, totalCount };
}

// client: read back inside the caller's (uncommitted) transaction
export async function getDomain(id, client) {
  const domain = await Domain.findById(id, client);
  if (!domain) throw new NotFoundError('Domain not found');
  return domain;
}

// ===== Commands =====
async function ipIdOf(value) {
  const id = value && String(value).trim() !== '' ? parseInt(value, 10) : null;
  if (id && !(await IpAddress.exists(id))) throw new ValidationError('Invalid IP address ID');
  return id;
}
const recordTypeOf = (v) => (typeof v === 'string' && v.trim() ? v.trim() : 'A');

function mapUniqueViolation(err) {
  if (err.code === '23505') throw new ConflictError('Domain already exists');
  throw err;
}

// input: {domain, description, ip_id, record_type, systems, tags}
export async function createDomain(input, client) {
  const name = typeof input.domain === 'string' ? input.domain.trim() : '';
  if (!name) throw new ValidationError('Domain name is required');
  if (await Domain.findByDomain(name)) throw new ConflictError('Domain already exists');
  const ip_id = await ipIdOf(input.ip_id);
  const record_type = recordTypeOf(input.record_type);
  // a given type must be choosable; the default 'A' is not checked (as before)
  if (toNullableString(input.record_type)) await assertOption('network_domain_record_type', record_type, 'record type');
  const relations = await resolveRelations(input, RELATIONS);

  try {
    const id = await withTransaction(client, async (c) => {
      const d = await Domain.create({ domain: name, description: toNullableString(input.description), ip_id, record_type }, c);
      await saveRelations(d.id, relations, RELATIONS, c);
      return d.id;
    });
    return getDomain(id, client);
  } catch (err) {
    return mapUniqueViolation(err);
  }
}

// Partial update: missing keys keep their value. The name is immutable.
export async function updateDomain(id, input, client) {
  const current = await Domain.findById(id, client);
  if (!current) throw new NotFoundError('Domain not found');
  const ip_id = hasKey(input, 'ip_id') ? await ipIdOf(input.ip_id) : current.ip_id;
  const description = hasKey(input, 'description') ? toNullableString(input.description) : current.description;
  const record_type = hasKey(input, 'record_type') ? recordTypeOf(input.record_type) : current.record_type;
  if (hasKey(input, 'record_type')) await assertOption('network_domain_record_type', record_type, 'record type', current.record_type);
  const relations = await resolveRelations(input, RELATIONS, { partial: true });

  await withTransaction(client, async (c) => {
    await Domain.update(id, { description, ip_id, record_type }, c);
    await saveRelations(id, relations, RELATIONS, c);
  });
  return getDomain(id, client);
}

// A domain used by a service mapping cannot be deleted.
export async function deleteDomain(id) {
  if (!(await Domain.exists(id))) throw new NotFoundError('Domain not found');
  const mappings = await Domain.getServiceMappings(id);
  if (mappings.length) {
    throw new ConflictError('Cannot delete domain: it is used by service mapping {names}. Remove it from the mapping first.')
      .withParams({ names: mappings.map((m) => `"${m.name}"`).join(', ') });
  }
  await Domain.remove(id);
}
