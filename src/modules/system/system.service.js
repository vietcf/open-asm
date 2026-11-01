// Systems: validation and persistence shared by the web pages and the REST API.
import System from './system.model.js';
import SystemComponent from './component.model.js';
import Unit from '../../models/Unit.js';
import Contact from '../../models/Contact.js';
import IpAddress from '../../models/IpAddress.js';
import Domain from '../../models/Domain.js';
import Tag from '../../models/Tag.js';
import FileUpload from '../../models/FileUpload.js';
import PentestRound from '../../models/PentestRound.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toStringList, hasKey, loadOptions, assertIdsExist, resolveRelations, saveRelations } from '../../shared/service.js';

const RELATIONS = {
  contacts: { label: 'contact', exists: (id) => Contact.exists(id), save: (id, ids, c) => System.setContacts(id, ids, c) },
  ip_addresses: { label: 'IP address', exists: (id) => IpAddress.exists(id), save: (id, ids, c) => System.setIPs(id, ids, c) },
  domains: { label: 'domain', exists: (id) => Domain.exists(id), save: (id, ids, c) => System.setDomains(id, ids, c) },
  tags: { label: 'tag', exists: (id) => Tag.exists(id), save: (id, ids, c) => System.setTags(id, ids, c) },
};
const FIELDS = ['system_id', 'name', 'level', 'department_id', 'ops_department_id', 'alias', 'description', 'fqdn', 'scopes', 'architecture'];

// ===== Options ({id, text}) =====
export async function getLevelOptions() {
  const options = await loadOptions('system_level');
  return options.length ? options : [1, 2, 3, 4, 5].map((v) => ({ id: String(v), text: String(v) }));
}
export const getScopeOptions = () => loadOptions('system_user_scope');
export const getArchitectureOptions = () => loadOptions('system_arch');

export async function getFormOptions() {
  const [levelOptions, scopeOptions, architectureOptions] = await Promise.all([getLevelOptions(), getScopeOptions(), getArchitectureOptions()]);
  return { levelOptions, scopeOptions, architectureOptions };
}

// ===== Queries =====
export async function listSystems(filter) {
  const [items, totalCount] = await Promise.all([System.findFilteredList(filter), System.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getSystem(id) {
  const system = await System.findById(id);
  if (!system) throw new NotFoundError('System not found');
  return system;
}

// System with its documents, plus the current links as {id, text} for the form's selects
export async function getSystemForEdit(id) {
  const system = await getSystem(id);
  const [links, files] = await Promise.all([System.findLinkOptions(id), FileUpload.findByObject('system', id)]);
  system.docs = files.map((f) => ({ id: f.id, name: f.original_name || f.name, url: FileUpload.getUrl(f) }));
  const unit = (uid, name) => (uid ? [{ id: uid, text: name }] : []);
  return {
    system,
    selected: { ...links, department: unit(system.department_id, system.department_name), ops_department: unit(system.ops_department_id, system.ops_department_name) },
  };
}

// ===== Validation =====
const blankToNull = (v) => (v === undefined || v === null || v === '' ? null : v);

async function assertLevel(level) {
  if (level === null) return;
  const options = await getLevelOptions();
  if (!options.some((o) => o.id === String(level))) throw new ValidationError(`Invalid level: ${level}`);
}
async function assertDepartment(id) {
  if (id !== null) await assertIdsExist([id], (x) => Unit.exists(x), 'department (unit)');
}
// Scopes / architecture outside the configured options are dropped, not rejected.
async function keepConfigured(values, loader) {
  const list = toStringList(values);
  if (!list.length) return null;
  const allowed = (await loader()).map((o) => o.id);
  const valid = list.filter((v) => allowed.includes(v));
  return valid.length ? valid : null;
}
export async function assertSystemIdAvailable(systemId, excludeId = null) {
  if (await System.existsBySystemId(systemId, excludeId)) throw new ConflictError("System ID '{id}' already exists").withParams({ id: systemId });
}
export async function assertNameAvailable(name, excludeId = null) {
  if (await System.existsByName(name, excludeId)) throw new ConflictError("System name '{name}' already exists").withParams({ name });
}

// Normalized column values; `current` = stored row for a partial update (absent keys keep it)
async function normalize(input, current = null) {
  const pick = (key, fn) => (current && !hasKey(input, key) ? current[key] : fn(input[key]));
  const data = {
    system_id: pick('system_id', (v) => String(v ?? '').trim()),
    name: pick('name', (v) => String(v ?? '').trim()),
    level: pick('level', blankToNull),
    department_id: pick('department_id', blankToNull),
    ops_department_id: pick('ops_department_id', blankToNull),
    alias: pick('alias', (v) => toStringList(v)),
    description: pick('description', (v) => (v === undefined ? null : v)),
    fqdn: pick('fqdn', (v) => toStringList(v)),
    scopes: current && !hasKey(input, 'scopes') ? current.scopes : await keepConfigured(input.scopes, getScopeOptions),
    architecture: current && !hasKey(input, 'architecture') ? current.architecture : await keepConfigured(input.architecture, getArchitectureOptions),
  };
  if (Array.isArray(data.alias) && !data.alias.length) data.alias = null;

  const changed = (key) => !current || (hasKey(input, key) && String(data[key] ?? '') !== String(current[key] ?? ''));
  if (!data.system_id) throw new ValidationError('System ID is required');
  if (!data.name) throw new ValidationError('System name is required');
  if (changed('system_id')) await assertSystemIdAvailable(data.system_id, current?.id ?? null);
  if (changed('name')) await assertNameAvailable(data.name, current?.id ?? null);
  if (changed('level')) await assertLevel(data.level);
  if (changed('department_id')) await assertDepartment(data.department_id);
  if (changed('ops_department_id')) await assertDepartment(data.ops_department_id);
  return data;
}

// ===== Commands =====
// input: {system_id, name, level?, department_id? (L3), ops_department_id? (L2), alias?, description?,
//         fqdn?, scopes?, architecture?, contacts?, ip_addresses?, domains?, tags?, updated_by?}
export async function createSystem(input, client) {
  const data = await normalize(input);
  const links = await resolveRelations(input, RELATIONS);
  return withTransaction(client, async (c) => {
    const created = await System.create({ ...data, updated_by: input.updated_by || 'admin' }, c);
    await saveRelations(created.id, links, RELATIONS, c);
    return System.findById(created.id, c);
  });
}

// Partial update: only the keys present in input change (links included),
// so the web form always sends every link field, even empty.
export async function updateSystem(id, input, client) {
  const current = await getSystem(id);
  const unknown = Object.keys(input).filter((k) => !FIELDS.includes(k) && !RELATIONS[k] && k !== 'updated_by');
  if (unknown.length) throw new ValidationError(`Invalid field(s): ${unknown.join(', ')}`);

  const data = await normalize(input, current);
  const links = await resolveRelations(input, RELATIONS, { partial: true });
  return withTransaction(client, async (c) => {
    await System.update(id, { ...data, updated_by: input.updated_by || 'admin' }, c);
    await saveRelations(id, links, RELATIONS, c);
    return System.findById(id, c);
  });
}

// Links without a foreign key (tags, files, pentest rounds) are removed here.
export async function deleteSystem(id) {
  await getSystem(id);
  if (await SystemComponent.countBySystemId(id)) {
    throw new ConflictError('You must delete all components of this system before deleting the system. Please remove all components first.');
  }
  await withTransaction(null, async (c) => {
    await saveRelations(id, { contacts: [], ip_addresses: [], domains: [], tags: [] }, RELATIONS, c);
    await FileUpload.deleteByObject('system', id);
    await PentestRound.deleteByObject('system', id, c);
    await System.delete(id, c);
  });
}
