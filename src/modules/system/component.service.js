// System components: validation and persistence shared by the web pages and the REST API.
import SystemComponent from './component.model.js';
import System from './system.model.js';
import Contact from '../../models/Contact.js';
import IpAddress from '../../models/IpAddress.js';
import Tag from '../../models/Tag.js';
import PentestRound from '../../models/PentestRound.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toStringList, toNullableString, hasKey, loadOptions, assertOption, resolveRelations, saveRelations } from '../../shared/service.js';

const RELATIONS = {
  contacts: { label: 'contact', exists: (id) => Contact.exists(id), save: (id, ids, c) => SystemComponent.setContacts(id, ids, c) },
  ips: { label: 'IP address', exists: (id) => IpAddress.exists(id), save: (id, ids, c) => SystemComponent.setIPs(id, ids, c) },
  tags: { label: 'tag', exists: (id) => Tag.exists(id), save: (id, ids, c) => SystemComponent.setTags(id, ids, c) },
};
const FIELDS = ['system_id', 'name', 'app_type', 'description', 'fqdn'];

export const getAppTypeOptions = () => loadOptions('system_app_type');

// ===== Queries =====
export async function listComponents(filter) {
  const [items, totalCount] = await Promise.all([SystemComponent.findFilteredList(filter), SystemComponent.countFiltered(filter)]);
  return { items, totalCount };
}

// Every component of one system (system detail modal)
export const listBySystem = (systemId) => SystemComponent.findFilteredList({ system_id: systemId, pageSize: 1000 });

export async function getComponent(id) {
  const component = await SystemComponent.findByIdWithRelations(id);
  if (!component) throw new NotFoundError('Component not found');
  return component;
}

// ===== Validation =====
async function normalize(input, current = null) {
  const pick = (key, fn) => (current && !hasKey(input, key) ? current[key] : fn(input[key]));
  const data = {
    system_id: pick('system_id', (v) => (v === '' || v === undefined ? null : Number(v))),
    name: pick('name', (v) => String(v ?? '').trim()),
    app_type: pick('app_type', toNullableString),
    description: pick('description', (v) => (v === undefined ? null : v)),
    fqdn: pick('fqdn', (v) => toStringList(v)),
  };
  if (!data.name) throw new ValidationError('Component name is required');
  // A component always belongs to a system
  if (!data.system_id) throw new ValidationError('Component must belong to a system');
  if (!current || String(data.system_id) !== String(current.system_id)) {
    if (!(await System.exists(data.system_id))) throw new ValidationError(`Invalid system_id: ${data.system_id}`);
  }
  if (!current || data.name !== current.name || String(data.system_id) !== String(current.system_id)) {
    if (await SystemComponent.existsByName(data.system_id, data.name, current?.id ?? null)) {
      throw new ConflictError("Component name '{name}' already exists in this system").withParams({ name: data.name });
    }
  }
  if (!current || hasKey(input, 'app_type')) await assertOption('system_app_type', data.app_type, 'app_type');
  return data;
}

// IPs given to a component are also linked to its system.
async function linkIpsToSystem(systemId, ipIds, client) {
  if (ipIds && ipIds.length) await System.addIPs(systemId, ipIds, client);
}

// ===== Commands =====
// input: {system_id, name, app_type?, description?, fqdn?, contacts?, ips?, tags?, updated_by?}
export async function createComponent(input, client) {
  const data = await normalize(input);
  const links = await resolveRelations(input, RELATIONS);
  const id = await withTransaction(client, async (c) => {
    const created = await SystemComponent.create({ ...data, updated_by: input.updated_by || 'admin' }, c);
    await saveRelations(created.id, links, RELATIONS, c);
    await linkIpsToSystem(data.system_id, links.ips, c);
    return created.id;
  });
  return SystemComponent.findByIdWithRelations(id);
}

// Partial update: only the keys present in input change (links included).
export async function updateComponent(id, input, client) {
  const current = await SystemComponent.findById(id);
  if (!current) throw new NotFoundError('Component not found');
  const unknown = Object.keys(input).filter((k) => !FIELDS.includes(k) && !RELATIONS[k] && k !== 'updated_by');
  if (unknown.length) throw new ValidationError(`Invalid field(s): ${unknown.join(', ')}`);

  const data = await normalize(input, current);
  const links = await resolveRelations(input, RELATIONS, { partial: true });
  await withTransaction(client, async (c) => {
    await SystemComponent.update(id, { ...data, updated_by: input.updated_by || 'admin' }, c);
    await saveRelations(id, links, RELATIONS, c);
    await linkIpsToSystem(data.system_id, links.ips, c);
  });
  return SystemComponent.findByIdWithRelations(id);
}

// The component's IPs are unlinked from its system too; tags and pentest
// rounds have no foreign key and are removed here.
export async function deleteComponent(id) {
  const component = await SystemComponent.findById(id);
  if (!component) throw new NotFoundError('Component not found');
  const ipIds = await SystemComponent.getIpIds(id);
  await withTransaction(null, async (c) => {
    for (const ipId of ipIds) await System.removeIP(component.system_id, ipId, c);
    await SystemComponent.setTags(id, [], c);
    await PentestRound.deleteByObject('system_component', id, c);
    await SystemComponent.delete(id, c);
  });
}
