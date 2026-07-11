import SystemComponent from '../models/SystemComponent.js';
import System from '../models/System.js';
import Contact from '../models/Contact.js';
import IpAddress from '../models/IpAddress.js';
import Tag from '../models/Tag.js';
import Configuration from '../models/Configuration.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';
import { withTransaction } from './transaction.js';

const toIdArray = v => {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(Number).filter(x => !isNaN(x));
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
export async function getAppTypeOptions() {
  return loadOptions('system_app_type');
}

// The API's original validateAppType rejected any non-empty value whenever
// no options were configured (allowedAppTypes.includes() on an empty list is
// always false) — inconsistent with the "no options configured = no
// restriction" rule used everywhere else in this refactor (rule/server/device).
// Fixed here for both consumers.
async function validateAppType(appType) {
  if (!appType) return;
  const options = await getAppTypeOptions();
  if (!options.length) return;
  if (!options.some(o => o.value === appType)) {
    throw new ValidationError(`Invalid app_type: ${appType}`);
  }
}
async function validateSystemId(system_id) {
  if (!(await System.exists(system_id))) throw new ValidationError(`Invalid system_id: ${system_id}`);
}
// Component names only need to be unique within their own system — the same
// name can be reused across different systems.
async function assertNameAvailable(system_id, name, excludeId) {
  if (await SystemComponent.existsByName(system_id, name, excludeId)) {
    throw new ConflictError(`Component name '${name}' already exists in this system`);
  }
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
const validateTagIds = ids => validateIds(ids, id => Tag.exists(id), 'tag');

// Best-effort: any IP newly assigned to a component that isn't yet linked to
// the component's parent system gets added there too. Mirrors the existing
// (duplicated) behavior in both consumers — failures here are logged, not
// fatal, since the component's own IP assignment already succeeded.
async function syncIpsToParentSystem(system_id, ipIds, client) {
  if (!system_id || !ipIds || ipIds.length === 0) return;
  try {
    const systemIpIds = await System.getIpIdsBySystemId(system_id);
    const toAdd = ipIds.filter(ip => !systemIpIds.includes(ip));
    if (toAdd.length > 0) await System.addIPs(system_id, toAdd, client);
  } catch (e) {
    console.error('Error syncing IPs to parent system:', e);
  }
}

export async function listComponents(filter) {
  const [items, totalCount] = await Promise.all([
    SystemComponent.findFilteredList(filter),
    SystemComponent.countFiltered(filter)
  ]);
  return { items, totalCount };
}

export async function getComponent(id) {
  const component = await SystemComponent.findByIdWithRelations(id);
  if (!component) throw new NotFoundError('Component not found');
  return component;
}

// input: {system_id, name, app_type?, description?, fqdn?, contacts?, ips?, tags?, updated_by?}
// A component only makes sense attached to a system (the whole UI is
// organized system -> components), so system_id is required on both create
// and update here — the API previously allowed omitting it on create, and
// the frontend only enforced it on update, letting the API create orphan
// components with no parent. Existence validation on contacts/ips/tags was
// previously API-only on create (the frontend's addSystemComponent skipped
// all three) — adopted for both.
export async function createComponent(input, client) {
  const name = (input.name || '').trim();
  if (!name) throw new ValidationError('Component name is required');
  const system_id = input.system_id;
  if (!system_id) throw new ValidationError('Component must belong to a system');
  await validateSystemId(system_id);
  await assertNameAvailable(system_id, name);

  const app_type = typeof input.app_type === 'string' ? input.app_type.trim() || null : null;
  await validateAppType(app_type);

  const contacts = toIdArray(input.contacts);
  if (contacts.length) await validateContactIds(contacts);
  const ips = toIdArray(input.ips);
  if (ips.length) await validateIpAddressIds(ips);
  const tags = toIdArray(input.tags);
  if (tags.length) await validateTagIds(tags);

  const fqdn = toStringList(input.fqdn);
  const description = typeof input.description === 'string' ? input.description : (input.description ?? null);
  const username = input.updated_by || 'admin';

  const componentId = await withTransaction(client, async (c) => {
    const created = await SystemComponent.create({ system_id, name, app_type, description, fqdn, updated_by: username }, c);
    await SystemComponent.setContacts(created.id, contacts, c);
    await SystemComponent.setIPs(created.id, ips, c);
    await SystemComponent.setTags(created.id, tags, c);
    await syncIpsToParentSystem(system_id, ips, c);
    return created.id;
  });
  return SystemComponent.findByIdWithRelations(componentId);
}

const UPDATABLE_FIELDS = ['system_id', 'name', 'app_type', 'description', 'fqdn', 'contacts', 'ips', 'tags'];

export async function updateComponent(id, input, client) {
  const current = await SystemComponent.findById(id);
  if (!current) throw new NotFoundError('Component not found');

  const invalidFields = Object.keys(input).filter(k => !UPDATABLE_FIELDS.includes(k) && k !== 'updated_by');
  if (invalidFields.length > 0) {
    throw new ValidationError(`Invalid field(s): ${invalidFields.join(', ')}`);
  }

  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  const name = has('name') ? (input.name || '').trim() : current.name;
  if (!name) throw new ValidationError('Component name is required');

  const system_id = has('system_id') ? input.system_id : current.system_id;
  if (!system_id) throw new ValidationError('Component must belong to a system');
  if (has('system_id') && system_id !== current.system_id) await validateSystemId(system_id);
  if (name !== current.name || String(system_id) !== String(current.system_id)) {
    await assertNameAvailable(system_id, name, id);
  }

  const app_type = has('app_type') ? (typeof input.app_type === 'string' ? input.app_type.trim() || null : null) : current.app_type;
  if (has('app_type')) await validateAppType(app_type);

  const normalizedArrays = {};
  if (has('contacts')) {
    const arr = toIdArray(input.contacts);
    if (arr.length) await validateContactIds(arr);
    normalizedArrays.contacts = arr;
  }
  if (has('ips')) {
    const arr = toIdArray(input.ips);
    if (arr.length) await validateIpAddressIds(arr);
    normalizedArrays.ips = arr;
  }
  if (has('tags')) {
    const arr = toIdArray(input.tags);
    if (arr.length) await validateTagIds(arr);
    normalizedArrays.tags = arr;
  }

  const fqdn = has('fqdn') ? toStringList(input.fqdn) : current.fqdn;
  const description = has('description') ? (typeof input.description === 'string' ? input.description : (input.description ?? null)) : current.description;
  const username = input.updated_by || 'admin';

  await withTransaction(client, async (c) => {
    await SystemComponent.update(id, { system_id, name, app_type, description, fqdn, updated_by: username }, c);
    if (has('contacts')) await SystemComponent.setContacts(id, normalizedArrays.contacts, c);
    if (has('ips')) {
      await SystemComponent.setIPs(id, normalizedArrays.ips, c);
      await syncIpsToParentSystem(system_id, normalizedArrays.ips, c);
    }
    if (has('tags')) await SystemComponent.setTags(id, normalizedArrays.tags, c);
  });

  return SystemComponent.findByIdWithRelations(id);
}

// Component-side association tables (system_component_contact,
// system_component_ip) cascade automatically via FK on component delete, but
// tag_object doesn't (polymorphic object_id has no FK) — neither the frontend
// nor the API cleaned it up, leaking rows on every component delete. Fixed
// here for both by clearing tags before deleting. The frontend's delete was
// also non-transactional (a crash between the system_ip cleanup and the
// component DELETE could leave the IP link removed but the component still
// present); wrapped in one transaction here, matching the API's original
// (correct) approach.
export async function deleteComponent(id) {
  const component = await SystemComponent.findById(id);
  if (!component) throw new NotFoundError('Component not found');
  const ips = await SystemComponent.getIPs(id);
  await withTransaction(null, async (c) => {
    if (component.system_id && Array.isArray(ips) && ips.length > 0) {
      for (const ip of ips) {
        await System.removeIP(component.system_id, ip.id, c);
      }
    }
    await SystemComponent.setTags(id, [], c);
    await SystemComponent.delete(id, c);
  });
}
