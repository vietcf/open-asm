// Firewall rules: validation and persistence shared by the web pages, the importer and the REST API.
import RuleFirewall, { COLUMNS } from './rule.model.js';
import Unit from '../organize/unit.model.js';
import Contact from '../organize/contact.model.js';
import Tag from '../organize/tag.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { hasKey, loadOptions, resolveRelations, saveRelations } from '../../shared/service.js';

const RELATIONS = {
  contacts: { label: 'contact', exists: (id) => Contact.exists(id), save: (id, ids, c) => RuleFirewall.setContacts(id, ids, c) },
  tags: { label: 'tag', exists: (id) => Tag.exists(id), save: (id, ids, c) => RuleFirewall.setTags(id, ids, c) },
};
const REQUIRED = ['rulename', 'src', 'dst', 'action', 'firewall_name', 'audit_batch'];
const MAX_LENGTHS = { rulename: 255, firewall_name: 255, src_zone: 128, dst_zone: 128, services: 255, application: 255, url: 255, action: 32, violation_type: 128, status: 64 };

// Configured option lists ({id, text}); values are matched case-insensitively and stored as configured
export const OPTION_FIELDS = { action: 'firewall_rule_action', status: 'firewall_rule_status', violation_type: 'firewall_rule_violation_type', firewall_name: 'firewall_name' };
export async function getRuleOptions() {
  const entries = await Promise.all(Object.entries(OPTION_FIELDS).map(async ([field, key]) => [field, await loadOptions(key)]));
  return Object.fromEntries(entries);
}
export function canonical(options, value) {
  if (!value) return null;
  return options.find((o) => o.id.toLowerCase() === String(value).toLowerCase())?.id;
}

// ===== Queries =====
export async function listRules(filter) {
  const [items, totalCount] = await Promise.all([RuleFirewall.findFilteredList(filter), RuleFirewall.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getRule(id) {
  const rule = await RuleFirewall.findById(id);
  if (!rule) throw new NotFoundError('Rule not found');
  return rule;
}

// ===== Commands =====
const clean = (v) => (typeof v === 'string' ? v.trim() || null : v ?? null);

// Columns from input (only the keys present when partial), validated
async function normalize(input, current = null) {
  const data = {};
  for (const col of COLUMNS) {
    if (col === 'updated_by' || col === 'ou_id') continue;
    if (!current || hasKey(input, col)) data[col] = clean(input[col]);
  }
  const merged = { ...(current || {}), ...data };
  const missing = REQUIRED.filter((c) => !merged[c]);
  if (missing.length) throw new ValidationError('Missing required fields: {fields}').withParams({ fields: missing.join(', ') });
  for (const [col, max] of Object.entries(MAX_LENGTHS)) {
    if (data[col] && data[col].length > max) throw new ValidationError('{field} must not exceed {max} characters').withParams({ field: col, max });
  }
  if (data.url) {
    try { new URL(data.url); } catch (e) { throw new ValidationError('Invalid URL format'); }
  }
  const options = await getRuleOptions();
  for (const field of Object.keys(OPTION_FIELDS)) {
    if (!data[field]) continue;
    const value = canonical(options[field], data[field]);
    if (options[field].length && !value) throw new ValidationError('Invalid {field} value: {value}').withParams({ field, value: data[field] });
    if (value) data[field] = value;
  }
  if (!current || hasKey(input, 'ou_id')) {
    data.ou_id = parseInt(input.ou_id, 10) || null;
    if (data.ou_id && !(await Unit.exists(data.ou_id))) throw new ValidationError('Invalid ou_id: unit does not exist');
  }

  const key = { ...merged, ...data };
  const existing = await RuleFirewall.findByKey(key.firewall_name, key.rulename, key.audit_batch);
  if (existing && existing.id !== current?.id) {
    throw new ConflictError('Rule already exists: {firewall} - {rule} in audit batch {batch}').withParams({ firewall: key.firewall_name, rule: key.rulename, batch: key.audit_batch });
  }
  data.updated_by = input.updated_by || null;
  return data;
}

// input: rule columns + contacts[], tags[], updated_by
export async function createRule(input, client) {
  const data = await normalize(input);
  const relations = await resolveRelations(input, RELATIONS);
  const id = await withTransaction(client, async (c) => {
    const ruleId = await RuleFirewall.create(data, c);
    await saveRelations(ruleId, relations, RELATIONS, c);
    return ruleId;
  });
  return RuleFirewall.findById(id);
}

// Partial update: only the keys present change (contacts / tags: present = replaced)
export async function updateRule(id, input, client) {
  const current = await RuleFirewall.findById(id);
  if (!current) throw new NotFoundError('Rule not found');
  const data = await normalize(input, current);
  const relations = await resolveRelations(input, RELATIONS, { partial: true });
  await withTransaction(client, async (c) => {
    await RuleFirewall.update(id, data, c);
    await saveRelations(id, relations, RELATIONS, c);
  });
  return RuleFirewall.findById(id);
}

export async function deleteRule(id) {
  if (!(await RuleFirewall.exists(id))) throw new NotFoundError('Rule not found');
  await RuleFirewall.remove(id);
}
