// Organization units (departments): shared by the web pages and the REST API.
import Unit from './unit.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { hasKey } from '../../shared/service.js';

export async function listUnits(filter) {
  const [items, totalCount] = await Promise.all([Unit.findFilteredList(filter), Unit.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getUnit(id) {
  const unit = await Unit.findById(id);
  if (!unit) throw new NotFoundError('Unit not found');
  return unit;
}

export async function findUnitsByName(name) {
  const unit = await Unit.findByName(name);
  return unit ? [unit] : [];
}

async function assertNameAvailable(name, excludeId = null) {
  const existing = await Unit.findByName(name);
  if (existing && String(existing.id) !== String(excludeId)) throw new ConflictError('Unit already exists with this name');
}

const text = (v) => (typeof v === 'string' ? v.trim() : '');

// parent_id: '' / null = top level; must exist and not be the unit itself or one of its sub-units
async function parentOf(input, id = null) {
  const raw = input.parent_id;
  if (raw === undefined || raw === null || raw === '') return null;
  const parentId = Number(raw);
  if (!Number.isInteger(parentId) || parentId <= 0 || !(await Unit.exists(parentId))) throw new ValidationError('Parent unit not found');
  if (id !== null && (parentId === Number(id) || (await Unit.descendantIds(id)).includes(parentId))) {
    throw new ValidationError('A unit cannot be placed under itself or one of its sub-units');
  }
  return parentId;
}

// input: {name, code?, description?, parent_id?}
export async function createUnit(input) {
  const name = text(input.name);
  if (!name) throw new ValidationError('Unit name is required');
  await assertNameAvailable(name);
  return Unit.create({ name, code: text(input.code), description: text(input.description), parent_id: await parentOf(input) });
}

// Partial update: absent keys keep their value.
export async function updateUnit(id, input) {
  const current = await getUnit(id);
  const pick = (key) => (hasKey(input, key) ? text(input[key]) : current[key]);
  const name = pick('name');
  if (!name) throw new ValidationError('Unit name is required');
  await assertNameAvailable(name, id);
  const parent_id = hasKey(input, 'parent_id') ? await parentOf(input, id) : current.parent_id;
  return Unit.update(id, { name, code: pick('code'), description: pick('description'), parent_id });
}

const USAGE_LABELS = { contacts: 'contact(s)', systems: 'system(s)', priv_users: 'privileged account(s)', rulefirewall: 'firewall rule(s)', users: 'user(s)' };

// Refused while referenced: contacts.unit_id has no foreign key and
// rulefirewall.ou_id is ON DELETE SET NULL, so the database would not stop it.
export async function deleteUnit(id) {
  const unit = await getUnit(id);
  if (unit.children_count) throw new ConflictError('Cannot delete: this unit still has {count} sub-unit(s)').withParams({ count: unit.children_count });
  const usage = await Unit.getUsageBreakdown(id);
  const parts = Object.entries(usage).filter(([, n]) => n > 0).map(([key, n]) => `${n} ${USAGE_LABELS[key]}`);
  if (parts.length) throw new ConflictError('Cannot delete: this unit is still in use by {usage}').withParams({ usage: parts.join(', ') });
  await Unit.delete(id);
}
