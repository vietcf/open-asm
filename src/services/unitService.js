import Unit from '../models/Unit.js';
import { ValidationError, NotFoundError, ConflictError } from '../shared/errors.js';

export async function listUnits({ search, page, pageSize }) {
  if (search) {
    const [items, totalCount] = await Promise.all([
      Unit.findSearchPage(search, page, pageSize),
      Unit.countSearch(search)
    ]);
    return { items, totalCount };
  }
  const [items, totalCount] = await Promise.all([
    Unit.findPage(page, pageSize),
    Unit.countAll()
  ]);
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

export async function assertNameAvailable(name, excludeId) {
  const existing = await Unit.findByName(name);
  if (existing && (excludeId == null || String(existing.id) !== String(excludeId))) {
    throw new ConflictError('Unit already exists with this name');
  }
}

// input: {name, code?, description?}
export async function createUnit(input) {
  const name = (input.name || '').trim();
  if (!name) throw new ValidationError('Unit name is required');
  const code = (input.code || '').trim();
  const description = (input.description || '').trim();

  await assertNameAvailable(name);
  return Unit.create({ name, code, description });
}

// Partial update (has-key semantics). code/description fall back to the
// current row's value when their key is absent from input — Unit.update has
// no partial-column form, so all three columns are always written together.
export async function updateUnit(id, input) {
  const current = await Unit.findById(id);
  if (!current) throw new NotFoundError('Unit not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  const name = has('name') ? (typeof input.name === 'string' ? input.name.trim() : current.name) : current.name;
  if (!name) throw new ValidationError('Unit name is required');

  const code = has('code') ? (typeof input.code === 'string' ? input.code.trim() : current.code) : current.code;
  const description = has('description') ? (typeof input.description === 'string' ? input.description.trim() : current.description) : current.description;

  await assertNameAvailable(name, id);
  return Unit.update(id, { name, code, description });
}

const USAGE_LABELS = {
  contacts: 'contact(s)',
  systems: 'system(s)',
  priv_users: 'privileged account(s)',
  rulefirewall: 'firewall rule(s)'
};

export async function deleteUnit(id) {
  const exists = await Unit.exists(id);
  if (!exists) throw new NotFoundError('Unit not found');
  // contacts.unit_id has no FK constraint at all (silent dangling reference
  // on delete) and rulefirewall.ou_id is ON DELETE SET NULL (silent data
  // loss) — neither would surface an error, so check usage explicitly
  // instead of relying on the DB to block the delete.
  const usage = await Unit.getUsageBreakdown(id);
  const parts = Object.entries(usage)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${USAGE_LABELS[key]}`);
  if (parts.length) {
    throw new ConflictError(`Cannot delete: this unit is still in use by ${parts.join(', ')}`);
  }
  await Unit.delete(id);
}
