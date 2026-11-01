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

// input: {name, code?, description?}
export async function createUnit(input) {
  const name = text(input.name);
  if (!name) throw new ValidationError('Unit name is required');
  await assertNameAvailable(name);
  return Unit.create({ name, code: text(input.code), description: text(input.description) });
}

// Partial update: absent keys keep their value.
export async function updateUnit(id, input) {
  const current = await getUnit(id);
  const pick = (key) => (hasKey(input, key) ? text(input[key]) : current[key]);
  const name = pick('name');
  if (!name) throw new ValidationError('Unit name is required');
  await assertNameAvailable(name, id);
  return Unit.update(id, { name, code: pick('code'), description: pick('description') });
}

const USAGE_LABELS = { contacts: 'contact(s)', systems: 'system(s)', priv_users: 'privileged account(s)', rulefirewall: 'firewall rule(s)' };

// Refused while referenced: contacts.unit_id has no foreign key and
// rulefirewall.ou_id is ON DELETE SET NULL, so the database would not stop it.
export async function deleteUnit(id) {
  await getUnit(id);
  const usage = await Unit.getUsageBreakdown(id);
  const parts = Object.entries(usage).filter(([, n]) => n > 0).map(([key, n]) => `${n} ${USAGE_LABELS[key]}`);
  if (parts.length) throw new ConflictError('Cannot delete: this unit is still in use by {usage}').withParams({ usage: parts.join(', ') });
  await Unit.delete(id);
}
