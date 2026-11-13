// Custom fields: attributes an administrator declares per object type in System
// Configuration (key `<entity>_custom_fields`, type `custom_fields` in
// src/utils/configRegistry.js); records keep their values in an `attributes`
// JSONB column. Only declared fields can be set; a field removed or made
// inactive keeps the values already saved (they are only no longer edited).
//
// Definition: {key, label, type, options?, required?, list?, active?}
//   key       a-z, 0-9, _ (starts with a letter), fixed once saved
//   type      text | textarea | number | date | select | url | boolean
//   options   choices of a select
//   list      offered as a column (and a filter for a select) on the list page
import Configuration from '../modules/administrator/configuration.model.js';
import { ValidationError } from './errors.js';

export const CUSTOM_FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'url', 'boolean'];
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const MAX = { fields: 50, options: 50, label: 100, option: 100, text: 500, textarea: 5000, url: 1000 };
const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);

// Stored text -> [definition] (tolerant: unreadable items are skipped)
export function parseCustomFields(text) {
  let list;
  try { list = JSON.parse(text || '[]'); } catch { return []; }
  if (!Array.isArray(list)) return [];
  return list.filter((d) => d && typeof d === 'object' && KEY_RE.test(String(d.key || '')) && CUSTOM_FIELD_TYPES.includes(d.type)).map((d) => ({
    key: d.key, label: String(d.label || d.key), type: d.type,
    options: d.type === 'select' ? [].concat(d.options || []).map(String) : [],
    required: d.required === true, list: d.list === true, active: d.active !== false,
  }));
}

// Editor JSON -> {value} | {error, params} (the shape of configRegistry.validateField)
export function validateCustomFieldDefs(raw) {
  let items;
  try { items = JSON.parse(String(raw ?? '').trim() || '[]'); } catch { return { error: '{field} has an invalid value', params: {} }; }
  if (!Array.isArray(items)) return { error: '{field} has an invalid value', params: {} };
  if (items.length > MAX.fields) return { error: '{field}: at most {max} fields', params: { max: MAX.fields } };
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { error: '{field} has an invalid value', params: {} };
    const key = String(item.key ?? '').trim();
    const label = String(item.label ?? '').trim();
    const type = String(item.type ?? '');
    if (!KEY_RE.test(key)) return { error: '{field}: key "{value}" must start with a letter and use only a-z, 0-9 and _ (max 40)', params: { value: key } };
    if (seen.has(key)) return { error: '{field}: duplicate key "{value}"', params: { value: key } };
    seen.add(key);
    if (!label || label.length > MAX.label || CONTROL.test(label)) return { error: '{field}: field "{value}" needs a label (max 100 characters)', params: { value: key } };
    if (!CUSTOM_FIELD_TYPES.includes(type)) return { error: '{field}: field "{value}" has an invalid type', params: { value: key } };
    let options = [];
    if (type === 'select') {
      options = [...new Set([].concat(item.options || []).map((o) => String(o).trim()).filter(Boolean))];
      if (!options.length) return { error: '{field}: field "{value}" needs at least one choice', params: { value: key } };
      if (options.length > MAX.options || options.some((o) => o.length > MAX.option || CONTROL.test(o))) {
        return { error: '{field}: field "{value}" has too many or too long choices', params: { value: key } };
      }
    }
    out.push({ key, label, type, ...(type === 'select' ? { options } : {}), required: item.required === true, list: item.list === true, ...(item.active === false ? { active: false } : {}) });
  }
  return { value: JSON.stringify(out) };
}

export async function loadCustomFields(entity) {
  const row = await Configuration.findById(`${entity}_custom_fields`);
  return parseCustomFields(row?.value);
}

export const activeFields = (defs) => defs.filter((d) => d.active);

function fieldValue(def, raw, current) {
  if (def.type === 'boolean') {
    if (raw === true || raw === false) return raw;
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return undefined;
    if (['true', '1', 'yes', 'on', 'có'].includes(s)) return true;
    if (['false', '0', 'no', 'off', 'không'].includes(s)) return false;
    throw new ValidationError('{field}: choose yes or no').withParams({ field: def.label });
  }
  const s = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim();
  if (!s) return undefined;
  switch (def.type) {
    case 'number': {
      const n = Number(s.replace(',', '.'));
      if (!Number.isFinite(n)) throw new ValidationError('{field}: a number is required').withParams({ field: def.label });
      return n;
    }
    case 'date': {
      const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      const ok = d && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
      if (!ok) throw new ValidationError('{field}: a date (YYYY-MM-DD) is required').withParams({ field: def.label });
      return s;
    }
    case 'select':
      if (!def.options.includes(s) && s !== current) throw new ValidationError('{field}: "{value}" is not one of its choices').withParams({ field: def.label, value: s });
      return s;
    case 'url':
      if (s.length > MAX.url || !/^https?:\/\/[^\s<>"]+$/i.test(s)) throw new ValidationError('{field}: an http(s) URL is required').withParams({ field: def.label });
      return s;
    default: {
      const max = def.type === 'textarea' ? MAX.textarea : MAX.text;
      if (s.length > max) throw new ValidationError('{field} is too long (max {max} characters)').withParams({ field: def.label, max });
      return s;
    }
  }
}

// input: {key: value} of the active fields. Whole (form, create): a field absent
// from input is emptied; partial (API update): only the keys present change.
// Values of inactive / removed fields are kept as they are.
export function normalizeAttributes(defs, input, current = {}, { partial = false } = {}) {
  const fields = activeFields(defs);
  const known = new Set(fields.map((d) => d.key));
  const inputObj = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  for (const key of Object.keys(inputObj)) {
    if (!known.has(key)) throw new ValidationError('Unknown custom field: {key}').withParams({ key });
  }
  const out = { ...(current || {}) };
  for (const def of fields) {
    if (!has(inputObj, def.key) && partial) continue;
    const value = fieldValue(def, inputObj[def.key], current?.[def.key]);
    if (value === undefined) delete out[def.key];
    else out[def.key] = value;
  }
  for (const def of fields) {
    if (def.required && (out[def.key] === undefined || out[def.key] === '')) throw new ValidationError('{field} is required').withParams({ field: def.label });
  }
  return out;
}

// Value as text (lists, exports)
export function attributeText(def, value, t = (s) => s) {
  if (value === undefined || value === null || value === '') return '';
  if (def?.type === 'boolean') return value ? t('Yes') : t('No');
  return String(value);
}
