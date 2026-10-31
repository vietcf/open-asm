import System from '../models/System.js';
import SystemComponent from '../models/SystemComponent.js';
import Unit from '../models/Unit.js';
import Contact from '../models/Contact.js';
import IpAddress from '../models/IpAddress.js';
import Domain from '../models/Domain.js';
import Tag from '../models/Tag.js';
import FileUpload from '../models/FileUpload.js';
import PentestRound from '../models/PentestRound.js';
import Configuration from '../models/Configuration.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';
import { withTransaction } from './transaction.js';

// Accepts either plain IDs or {id, ...} objects, so the {id, name, email}
// shape GET /systems (list) returns for `contacts` round-trips straight
// back into create/update without the caller pre-flattening it.
const toIdArray = v => {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr
    .map(item => (item && typeof item === 'object') ? Number(item.id) : Number(item))
    .filter(x => !isNaN(x));
};
const toStringList = v => {
  if (v === undefined || v === null || v === '') return [];
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
};

async function loadOptions(configKey) {
  try {
    const config = await Configuration.findById(configKey);
    if (config && config.value) {
      const parsed = JSON.parse(config.value);
      if (Array.isArray(parsed)) {
        return parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) { /* fall through to empty */ }
  return [];
}

// {id, text} — the shape Select2 (used by every consuming EJS view: add,
// edit, and the list page's filter modal) expects natively, not the
// {value, label} shape used by other services in this refactor.
const toIdText = options => options.map(o => ({ id: o.value, text: o.label }));

export async function getLevelOptions() {
  const options = await loadOptions('system_level');
  if (options.length) return toIdText(options);
  return [1, 2, 3, 4, 5].map(v => ({ id: String(v), text: String(v) }));
}
export async function getScopeOptions() {
  return toIdText(await loadOptions('system_user_scope'));
}
export async function getArchitectureOptions() {
  return toIdText(await loadOptions('system_arch'));
}

async function validateLevel(level) {
  if (level === undefined || level === null || level === '') return;
  const options = await getLevelOptions();
  if (!options.some(o => o.id === String(level))) {
    throw new ValidationError(`Invalid level: ${level}`);
  }
}
async function validateDepartmentId(id) {
  if (id === undefined || id === null || id === '') return;
  if (!(await Unit.exists(id))) throw new ValidationError(`Invalid department (unit) ID: ${id}`);
}
async function validateIds(ids, existsFn, label) {
  const invalid = [];
  for (const id of ids) {
    if (!(await existsFn(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid ${label} IDs: ${invalid.join(', ')}`);
}
const validateContactIds = ids => validateIds(ids, id => Contact.exists(id), 'contact');
const validateIpAddressIds = ids => validateIds(ids, id => IpAddress.exists(id), 'IP address');
const validateDomainIds = ids => validateIds(ids, id => Domain.exists(id), 'domain');
const validateTagIds = ids => validateIds(ids, id => Tag.exists(id), 'tag');

// Scopes/architecture are sanitized rather than rejected on an invalid value
// (silently drop anything not in the configured option list) — this is the
// pre-existing behavior in both the frontend and the API, kept as-is here
// since it's consistent between the two, not a divergence to resolve.
async function sanitizeScopes(scopes) {
  if (!scopes || scopes.length === 0) return null;
  const options = await getScopeOptions();
  const allowed = options.map(o => o.id);
  const valid = scopes.filter(s => allowed.includes(s));
  return valid.length > 0 ? valid : null;
}
async function sanitizeArchitecture(architecture) {
  if (!architecture || architecture.length === 0) return null;
  const options = await getArchitectureOptions();
  const allowed = options.map(o => o.id);
  const valid = architecture.filter(a => allowed.includes(a));
  return valid.length > 0 ? valid : null;
}

export async function assertSystemIdAvailable(system_id, excludeId) {
  const clash = excludeId == null
    ? await System.existsBySystemId(system_id)
    : await System.existsBySystemIdExcluding(system_id, excludeId);
  if (clash) throw new ConflictError(`System ID '${system_id}' already exists`);
}
export async function assertNameAvailable(name, excludeId) {
  const clash = excludeId == null
    ? await System.existsByName(name)
    : await System.existsByNameExcluding(name, excludeId);
  if (clash) throw new ConflictError(`System name '${name}' already exists`);
}

export async function listSystems(filter) {
  const [items, totalCount] = await Promise.all([
    System.findFilteredList(filter),
    System.countFiltered(filter)
  ]);
  return { items, totalCount };
}

export async function getSystem(id) {
  const system = await System.findById(id);
  if (!system) throw new NotFoundError('System not found');
  return system;
}

// input: {system_id, name, level?, department_id?, alias?, description?, fqdn?,
//         contacts?, ip_addresses?, domains?, tags?, scopes?, architecture?, updated_by?}
// Existence/uniqueness validation here was previously API-only (the frontend
// only caught the system_id unique-constraint error, mislabeling name
// conflicts as "System ID already exists" since it never checked err.constraint) —
// adopted for both consumers.
export async function createSystem(input, client) {
  const system_id = (input.system_id || '').trim();
  if (!system_id) throw new ValidationError('System ID is required');
  const name = (input.name || '').trim();
  if (!name) throw new ValidationError('System name is required');
  await assertSystemIdAvailable(system_id);
  await assertNameAvailable(name);

  const level = input.level === undefined || input.level === null || input.level === '' ? null : input.level;
  await validateLevel(level);
  const department_id = input.department_id === undefined || input.department_id === null || input.department_id === '' ? null : input.department_id;
  await validateDepartmentId(department_id);

  const contacts = toIdArray(input.contacts);
  if (contacts.length) await validateContactIds(contacts);
  const ip_addresses = toIdArray(input.ip_addresses);
  if (ip_addresses.length) await validateIpAddressIds(ip_addresses);
  const domains = toIdArray(input.domains);
  if (domains.length) await validateDomainIds(domains);
  const tags = toIdArray(input.tags);
  if (tags.length) await validateTagIds(tags);

  const alias = toStringList(input.alias);
  const fqdn = toStringList(input.fqdn);
  const scopes = await sanitizeScopes(toStringList(input.scopes));
  const architecture = await sanitizeArchitecture(toStringList(input.architecture));
  const description = typeof input.description === 'string' ? input.description : (input.description ?? null);
  const username = input.updated_by || 'admin';

  return withTransaction(client, async (c) => {
    const created = await System.create({
      system_id, name, level, department_id,
      alias: alias.length ? alias : null,
      description, fqdn, scopes, architecture, updated_by: username
    }, c);
    await System.setContacts(created.id, contacts, c);
    await System.setIPs(created.id, ip_addresses, c);
    await System.setDomains(created.id, domains, c);
    await System.setTags(created.id, tags, c);
    return System.findById(created.id, c);
  });
}

const UPDATABLE_FIELDS = [
  'system_id', 'name', 'level', 'department_id', 'alias', 'description', 'fqdn',
  'scopes', 'architecture', 'contacts', 'ip_addresses', 'domains', 'tags'
];

// Partial update (has-key semantics), matching the API's original design —
// the frontend's version of this looked like it preserved untouched
// associations when a field was omitted, but System.findById() (used to load
// "current" values) never selects contacts/ip_addresses/domains, so that
// fallback silently resolved to [] and cleared them on every submit that
// omitted the field. Callers that want the classic "edit form always fully
// replaces associations" UX should pass contacts/ip_addresses/domains/tags
// explicitly (even as []), same as the Server precedent.
export async function updateSystem(id, input, client) {
  const current = await System.findById(id);
  if (!current) throw new NotFoundError('System not found');

  const invalidFields = Object.keys(input).filter(k => !UPDATABLE_FIELDS.includes(k) && k !== 'updated_by');
  if (invalidFields.length > 0) {
    throw new ValidationError(`Invalid field(s): ${invalidFields.join(', ')}`);
  }

  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  const system_id = has('system_id') ? String(input.system_id || '').trim() : current.system_id;
  const name = has('name') ? String(input.name || '').trim() : current.name;
  const level = has('level') ? (input.level === '' ? null : input.level) : current.level;
  const department_id = has('department_id') ? (input.department_id === '' ? null : input.department_id) : current.department_id;

  if (has('system_id')) {
    if (!system_id) throw new ValidationError('System ID cannot be empty');
    if (system_id !== current.system_id) await assertSystemIdAvailable(system_id, id);
  }
  if (has('name')) {
    if (!name) throw new ValidationError('System name cannot be empty');
    if (name !== current.name) await assertNameAvailable(name, id);
  }
  if (has('level')) await validateLevel(level);
  if (has('department_id')) await validateDepartmentId(department_id);

  const normalizedArrays = {};
  if (has('contacts')) {
    const arr = toIdArray(input.contacts);
    if (arr.length) await validateContactIds(arr);
    normalizedArrays.contacts = arr;
  }
  if (has('ip_addresses')) {
    const arr = toIdArray(input.ip_addresses);
    if (arr.length) await validateIpAddressIds(arr);
    normalizedArrays.ip_addresses = arr;
  }
  if (has('domains')) {
    const arr = toIdArray(input.domains);
    if (arr.length) await validateDomainIds(arr);
    normalizedArrays.domains = arr;
  }
  if (has('tags')) {
    const arr = toIdArray(input.tags);
    if (arr.length) await validateTagIds(arr);
    normalizedArrays.tags = arr;
  }

  const alias = has('alias') ? toStringList(input.alias) : current.alias;
  const fqdn = has('fqdn') ? toStringList(input.fqdn) : current.fqdn;
  const scopes = has('scopes') ? await sanitizeScopes(toStringList(input.scopes)) : current.scopes;
  const architecture = has('architecture') ? await sanitizeArchitecture(toStringList(input.architecture)) : current.architecture;
  const description = has('description') ? (typeof input.description === 'string' ? input.description : (input.description ?? null)) : current.description;
  const username = input.updated_by || 'admin';

  return withTransaction(client, async (c) => {
    await System.update(id, {
      system_id, name, level, department_id,
      alias: (Array.isArray(alias) && alias.length) ? alias : null,
      description, fqdn, scopes, architecture, updated_by: username
    }, c);
    if (has('contacts')) await System.setContacts(id, normalizedArrays.contacts, c);
    if (has('ip_addresses')) await System.setIPs(id, normalizedArrays.ip_addresses, c);
    if (has('domains')) await System.setDomains(id, normalizedArrays.domains, c);
    if (has('tags')) await System.setTags(id, normalizedArrays.tags, c);
    return System.findById(id, c);
  });
}

// The API's original delete skipped every association/file cleanup step the
// frontend did (no transaction, no tag/ip/contact/domain deletion, no
// FileUpload cleanup) — relying only on FK cascade, which doesn't cover
// tag_object (polymorphic, no FK on object_id) or uploaded files on disk.
// Adopted the frontend's fuller cleanup, wrapped in one transaction, for both.
export async function deleteSystem(id) {
  const system = await System.findById(id);
  if (!system) throw new NotFoundError('System not found');
  const componentCount = await SystemComponent.countBySystemId(id);
  if (componentCount > 0) {
    throw new ConflictError('You must delete all components of this system before deleting the system. Please remove all components first.');
  }
  await withTransaction(null, async (c) => {
    await System.deleteTags(id, c);
    await System.deleteIPs(id, c);
    await System.deleteContacts(id, c);
    await System.deleteDomains(id, c);
    await FileUpload.deleteByObject('system', id);
    await PentestRound.deleteByObject('system', id, c);
    await System.delete(id, c);
  });
}
