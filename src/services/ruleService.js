import RuleFirewall from '../models/RuleFirewall.js';
import Configuration from '../models/Configuration.js';
import Unit from '../models/Unit.js';
import Contact from '../models/Contact.js';
import Tag from '../models/Tag.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';
import { withTransaction } from './transaction.js';

const toIdArray = v => {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(Number).filter(x => !isNaN(x));
};
const safe = v => (v === undefined || v === '') ? null : v;

// ---- Config-driven option loaders, consolidated from 4 near-identical copies
// duplicated across firewallController.js and apiRuleController.js. ----
async function loadOptions(configKey, normalize) {
  try {
    const config = await Configuration.findById(configKey);
    if (config && config.value) {
      const parsed = JSON.parse(config.value);
      if (Array.isArray(parsed)) return parsed.map(normalize);
    }
  } catch (e) { /* fall through to empty */ }
  return [];
}
const plainOrLabeled = item => typeof item === 'object' ? item : { value: String(item), label: String(item) };

export async function getActionOptions() {
  return loadOptions('firewall_rule_action', plainOrLabeled);
}
export async function getStatusOptions() {
  return loadOptions('firewall_rule_status', plainOrLabeled);
}
export async function getViolationTypeOptions() {
  // The frontend's loader additionally fixed up single-quoted JSON in this one
  // config value before parsing; the API's did not. Keeping the API's plain
  // JSON.parse here since single-quoted "JSON" isn't valid JSON to begin with
  // — if a deployment actually has that malformed value, this now fails
  // closed (empty options) rather than silently accepting broken JSON on one
  // side only.
  return loadOptions('firewall_rule_violation_type', plainOrLabeled);
}
export async function getFirewallNameOptions() {
  return loadOptions('firewall_name', item => {
    if (typeof item !== 'object' || item === null) return { value: String(item), label: String(item) };
    if (item.key !== undefined) return { value: item.key, label: item.label };
    if (item.value !== undefined) return { value: item.value, label: item.label };
    return { value: String(item), label: String(item) };
  });
}

async function validateActionValue(action) {
  const allowed = (await getActionOptions()).map(a => a.value);
  if (!allowed.includes(action)) throw new ValidationError('Invalid action value');
}
async function validateStatusValue(status) {
  const allowed = (await getStatusOptions()).map(s => s.value);
  if (!allowed.includes(status)) throw new ValidationError('Invalid status value');
}
async function validateViolationTypeValue(violationType) {
  const allowed = (await getViolationTypeOptions()).map(v => v.value);
  if (!allowed.includes(violationType)) throw new ValidationError('Invalid violation_type value');
}
async function validateFirewallNameValue(firewallName) {
  const allowed = (await getFirewallNameOptions()).map(f => f.value);
  if (!allowed.includes(firewallName)) throw new ValidationError('Invalid firewall_name value');
}

async function validateOuId(ouId) {
  if (!(await Unit.exists(ouId))) throw new ValidationError('Invalid ou_id: unit does not exist');
}
async function validateContactIds(ids) {
  const invalid = [];
  for (const id of ids) {
    if (!(await Contact.exists(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid contact IDs: ${invalid.join(', ')}`);
}
async function validateTagIds(ids) {
  const invalid = [];
  for (const id of ids) {
    if (!(await Tag.exists(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid tag IDs: ${invalid.join(', ')}`);
}

const MAX_LENGTHS = [
  ['rulename', 255, 'Rule name'],
  ['src', 255, 'Source'],
  ['dst', 255, 'Destination'],
  ['services', 255, 'Services'],
  ['application', 255, 'Application'],
  ['url', 500, 'URL'],
  ['work_order', 255, 'Work order']
];
function validateLengths(fields) {
  for (const [key, max, label] of MAX_LENGTHS) {
    const value = fields[key];
    if (value && value.length > max) {
      throw new ValidationError(`${label} must not exceed ${max} characters`);
    }
  }
}
function validateUrlFormat(url) {
  if (!url) return;
  try {
    new URL(url);
  } catch (e) {
    throw new ValidationError('Invalid URL format');
  }
}

export async function assertRuleAvailable(firewallName, rulename, auditBatch, excludeId) {
  const existing = await RuleFirewall.findByFirewallRuleNameAndAuditBatch(firewallName, rulename, auditBatch);
  if (existing && (excludeId == null || existing.id !== Number(excludeId))) {
    throw new ConflictError(`Rule already exists: ${firewallName} - ${rulename} in audit batch ${auditBatch}`);
  }
}

export async function listRules(filter) {
  const [items, totalCount] = await Promise.all([
    RuleFirewall.findFilteredList(filter),
    RuleFirewall.countFiltered(filter)
  ]);
  return { items, totalCount };
}

export async function getRule(id) {
  const rule = await RuleFirewall.findById(id);
  if (!rule) throw new NotFoundError('Rule not found');
  return rule;
}

// input: {rulename, src, dst, action, firewall_name, audit_batch, ...optional fields, contacts?, tags?, updated_by?}
export async function createRule(input, client) {
  const rulename = (input.rulename || '').trim();
  const src = (input.src || '').trim();
  const dst = (input.dst || '').trim();
  const action = (input.action || '').trim();
  const firewall_name = (input.firewall_name || '').trim();
  const audit_batch = (input.audit_batch || '').trim();
  const status = (input.status || '').trim();
  const violation_type = (input.violation_type || '').trim();

  if (!rulename || !src || !dst || !action || !firewall_name || !audit_batch) {
    throw new ValidationError('Missing required fields: rulename, src, dst, action, firewall_name, audit_batch');
  }

  await assertRuleAvailable(firewall_name, rulename, audit_batch);

  await validateActionValue(action);
  if (status) await validateStatusValue(status);
  if (violation_type) await validateViolationTypeValue(violation_type);
  await validateFirewallNameValue(firewall_name);

  let ou_id = null;
  if (input.ou_id !== undefined && input.ou_id !== null && input.ou_id !== '') {
    ou_id = parseInt(input.ou_id, 10);
    if (isNaN(ou_id)) throw new ValidationError('Invalid OU ID');
    await validateOuId(ou_id);
  }

  const contacts = toIdArray(input.contacts);
  if (contacts.length) await validateContactIds(contacts);
  const tags = toIdArray(input.tags);
  if (tags.length) await validateTagIds(tags);

  const url = typeof input.url === 'string' ? input.url.trim() : input.url;
  validateLengths({ rulename, src, dst, services: input.services, application: input.application, url, work_order: input.work_order });
  validateUrlFormat(url);

  const data = {
    rulename, src, dst, action, firewall_name, audit_batch,
    src_zone: safe(input.src_zone), src_detail: safe(input.src_detail),
    dst_zone: safe(input.dst_zone), dst_detail: safe(input.dst_detail),
    services: safe(input.services), application: safe(input.application), url: safe(url),
    ou_id, status: status || null, violation_type: violation_type || null,
    violation_detail: safe(input.violation_detail), solution_proposal: safe(input.solution_proposal),
    solution_confirm: safe(input.solution_confirm), description: safe(input.description),
    work_order: safe(input.work_order), raw_data: safe(input.raw_data),
    updated_by: input.updated_by || null
  };

  const ruleId = await withTransaction(client, async (c) => {
    const id = await RuleFirewall.create(data, c);
    await RuleFirewall.setContacts(id, contacts, c);
    await RuleFirewall.setTags(id, tags, c);
    return id;
  });
  return RuleFirewall.findById(ruleId);
}

// Partial update (has-key semantics). Required-field checks and enum/FK/length
// validation only apply to fields actually present in `input` — matches the
// API's existing (correct) partial-update behavior. The frontend's edit form
// always submits every field anyway, so this is a no-op change for it.
export async function updateRule(id, input, client) {
  const current = await RuleFirewall.findById(id);
  if (!current) throw new NotFoundError('Rule not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  const str = key => has(key) ? (typeof input[key] === 'string' ? input[key].trim() : current[key]) : current[key];

  const firewall_name = str('firewall_name');
  const rulename = str('rulename');
  const src_zone = str('src_zone');
  const src = str('src');
  const src_detail = str('src_detail');
  const dst_zone = str('dst_zone');
  const dst = str('dst');
  const dst_detail = str('dst_detail');
  const services = str('services');
  const application = str('application');
  const url = str('url');
  const action = str('action');
  const status = str('status');
  const violation_type = str('violation_type');
  const violation_detail = str('violation_detail');
  const solution_proposal = str('solution_proposal');
  const solution_confirm = str('solution_confirm');
  const description = str('description');
  const work_order = str('work_order');
  const raw_data = str('raw_data');

  const audit_batch = (has('audit_batch') && typeof input.audit_batch === 'string' && input.audit_batch.trim())
    ? input.audit_batch.trim()
    : current.audit_batch;

  let ou_id = current.ou_id;
  if (has('ou_id')) {
    if (input.ou_id !== undefined && input.ou_id !== null && input.ou_id !== '') {
      ou_id = parseInt(input.ou_id, 10);
      if (isNaN(ou_id)) ou_id = null;
      else await validateOuId(ou_id);
    } else {
      ou_id = null;
    }
  }

  const missingFields = [];
  if (has('rulename') && !rulename) missingFields.push('rulename');
  if (has('src') && !src) missingFields.push('src');
  if (has('dst') && !dst) missingFields.push('dst');
  if (has('action') && !action) missingFields.push('action');
  if (has('firewall_name') && !firewall_name) missingFields.push('firewall_name');
  if (has('audit_batch') && !audit_batch) missingFields.push('audit_batch');
  if (missingFields.length) throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);

  if (has('rulename') || has('firewall_name') || has('audit_batch')) {
    await assertRuleAvailable(firewall_name, rulename, audit_batch, id);
  }

  if (has('action')) await validateActionValue(action);
  if (has('status') && status) await validateStatusValue(status);
  if (has('violation_type') && violation_type) await validateViolationTypeValue(violation_type);
  if (has('firewall_name')) await validateFirewallNameValue(firewall_name);

  let contacts = null;
  if (has('contacts')) {
    contacts = toIdArray(input.contacts);
    if (contacts.length) await validateContactIds(contacts);
  }
  let tags = null;
  if (has('tags')) {
    tags = toIdArray(input.tags);
    if (tags.length) await validateTagIds(tags);
  }

  validateLengths({
    rulename: has('rulename') ? rulename : undefined,
    src: has('src') ? src : undefined,
    dst: has('dst') ? dst : undefined,
    services: has('services') ? services : undefined,
    application: has('application') ? application : undefined,
    url: has('url') ? url : undefined,
    work_order: has('work_order') ? work_order : undefined
  });
  if (has('url')) validateUrlFormat(url);

  const updateData = {};
  const setIfChanged = (key, value) => { if (has(key) && value !== current[key]) updateData[key] = value; };
  setIfChanged('firewall_name', firewall_name);
  setIfChanged('rulename', rulename);
  setIfChanged('src_zone', src_zone);
  setIfChanged('src', src);
  setIfChanged('src_detail', src_detail);
  setIfChanged('dst_zone', dst_zone);
  setIfChanged('dst', dst);
  setIfChanged('dst_detail', dst_detail);
  setIfChanged('services', services);
  setIfChanged('application', application);
  setIfChanged('url', url);
  setIfChanged('action', action);
  if (has('ou_id') && ou_id !== current.ou_id) updateData.ou_id = ou_id;
  setIfChanged('status', status);
  setIfChanged('violation_type', violation_type);
  setIfChanged('violation_detail', violation_detail);
  setIfChanged('solution_proposal', solution_proposal);
  setIfChanged('solution_confirm', solution_confirm);
  setIfChanged('description', description);
  setIfChanged('work_order', work_order);
  setIfChanged('raw_data', raw_data);
  if (has('audit_batch') && audit_batch !== current.audit_batch) updateData.audit_batch = audit_batch;
  updateData.updated_by = input.updated_by || current.updated_by;

  await withTransaction(client, async (c) => {
    if (Object.keys(updateData).length > 1) {
      await RuleFirewall.update(id, updateData, c);
    }
    // The API's original "only write if changed" check for contacts/tags
    // compared full {id,name,email} objects against plain id numbers, so it
    // was always true whenever the key was present — never actually skipped
    // a write. Simplified here to match that real (not intended) behavior:
    // always replace when the key is present.
    if (contacts !== null) await RuleFirewall.setContacts(id, contacts, c);
    if (tags !== null) await RuleFirewall.setTags(id, tags, c);
  });

  return RuleFirewall.findById(id);
}

export async function deleteRule(id) {
  const exists = await RuleFirewall.exists(id);
  if (!exists) throw new NotFoundError('Rule not found');
  await RuleFirewall.delete(id);
}
