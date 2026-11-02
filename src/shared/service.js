// Input normalization and validation shared by the services.
import Configuration from '../modules/administrator/configuration.model.js';
import { ValidationError } from './errors.js';

// IDs from a form (string / string[]) or the API (number[], or {id, ...}
// objects as returned by GET endpoints, so they round-trip unchanged).
export function toIdArray(value) {
  if (value === undefined || value === null || value === '') return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map(item => (item && typeof item === 'object') ? Number(item.id) : Number(item))
    .filter(x => Number.isInteger(x));
}

// "a, b" or ['a', 'b'] -> ['a', 'b']
export function toStringList(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map(s => String(s).trim()).filter(Boolean);
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

// Trimmed string or null
export const toNullableString = (value) => (typeof value === 'string' ? value.trim() || null : null);

export const hasKey = (input, key) => Object.prototype.hasOwnProperty.call(input, key);

// Option list stored in the configuration table as [{value, label}],
// returned as {id, text} (the shape the views and Select2 use).
export async function loadOptions(configKey) {
  try {
    const config = await Configuration.findById(configKey);
    const parsed = config && config.value ? JSON.parse(config.value) : null;
    if (Array.isArray(parsed)) {
      return parsed.map(item => (typeof item === 'object'
        ? { id: String(item.value), text: String(item.label ?? item.value) }
        : { id: String(item), text: String(item) }));
    }
  } catch (e) { /* unreadable value: no options */ }
  return [];
}

// {id, text} options as the REST config endpoints return them: [{value, label}]
export const toValueLabel = (options) => options.map((o) => ({ value: o.id, label: o.text }));

// Value must be one of the configured options; no options configured = no restriction.
export async function assertOption(configKey, value, label) {
  if (value === undefined || value === null || value === '') return;
  const options = await loadOptions(configKey);
  if (options.length && !options.some(o => o.id === String(value))) {
    throw new ValidationError(`Invalid ${label}: ${value}`);
  }
}

// Throws listing every id for which existsFn resolves false.
export async function assertIdsExist(ids, existsFn, label) {
  const invalid = [];
  for (const id of ids) {
    if (!(await existsFn(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid ${label} IDs: ${invalid.join(', ')}`);
}

// Many-to-many links of a record, declared once per service:
//   const RELATIONS = {
//     contacts: { label: 'contact', exists: id => Contact.exists(id), save: (id, ids, c) => System.setContacts(id, ids, c) },
//   };
// resolveRelations validates the submitted ids ({ partial: true }: only the
// keys present in input, for has-key updates); saveRelations replaces them.
export async function resolveRelations(input, relations, { partial = false } = {}) {
  const resolved = {};
  for (const [key, { label, exists }] of Object.entries(relations)) {
    if (partial && !hasKey(input, key)) continue;
    const ids = toIdArray(input[key]);
    if (ids.length) await assertIdsExist(ids, exists, label);
    resolved[key] = ids;
  }
  return resolved;
}

export async function saveRelations(id, resolved, relations, client) {
  for (const [key, ids] of Object.entries(resolved)) {
    await relations[key].save(id, ids, client);
  }
}
