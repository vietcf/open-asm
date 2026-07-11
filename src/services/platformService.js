import Platform from '../models/Platform.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';

const UPDATABLE_FIELDS = ['name', 'description'];

export async function listPlatforms({ search, page, pageSize }) {
  if (search) {
    const [items, totalCount] = await Promise.all([
      Platform.searchPage(search, page, pageSize),
      Platform.searchCount(search)
    ]);
    return { items, totalCount };
  }
  const [items, totalCount] = await Promise.all([
    Platform.findPage(page, pageSize),
    Platform.countAll()
  ]);
  return { items, totalCount };
}

export async function getPlatform(id) {
  const platform = await Platform.findById(id);
  if (!platform) throw new NotFoundError('Platform not found');
  return platform;
}

export async function findPlatformsByName(name) {
  return Platform.findByNameExact(name);
}

export async function assertNameAvailable(name, excludeId) {
  const exists = await Platform.checkNameExists(name, excludeId ?? null);
  if (exists) throw new ConflictError('Platform name already exists');
}

// input: {name, description?}
export async function createPlatform(input) {
  const name = (input.name || '').trim();
  if (!name) throw new ValidationError('Platform name is required');
  const description = typeof input.description === 'string' ? (input.description.trim() || null) : (input.description ?? null);

  await assertNameAvailable(name);
  try {
    return await Platform.create({ name, description });
  } catch (err) {
    // Model.create() also throws this same plain Error as a belt-and-suspenders
    // check — the old frontend's `err.code === '23505' || message.includes('unique')`
    // catch never matched it (wrong message, no code), so duplicates fell through
    // to a confusing generic error. Mapping to ConflictError here fixes that.
    if (err.message === 'Platform name already exists') throw new ConflictError(err.message);
    throw err;
  }
}

// Partial update with a strict field allow-list (matches the API's existing
// stricter behavior). `name` stays editable here even though the frontend
// form never sends it (comment there: "Only description is editable") — that
// convenience restriction is a UI choice, not something the service enforces.
export async function updatePlatform(id, input) {
  const current = await Platform.findById(id);
  if (!current) throw new NotFoundError('Platform not found');

  const invalidFields = Object.keys(input).filter(k => !UPDATABLE_FIELDS.includes(k));
  if (invalidFields.length > 0) {
    throw new ValidationError(`Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${UPDATABLE_FIELDS.join(', ')}`);
  }

  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  const updateFields = {};
  if (has('name')) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new ValidationError('Platform name cannot be empty');
    updateFields.name = name;
  }
  if (has('description')) {
    updateFields.description = typeof input.description === 'string' ? input.description.trim() : input.description;
  }

  if (Object.keys(updateFields).length === 0) {
    throw new ValidationError('No valid update data provided');
  }
  if (updateFields.name) {
    await assertNameAvailable(updateFields.name, id);
  }

  try {
    return await Platform.update(id, updateFields);
  } catch (err) {
    if (err.message === 'Platform name already exists') throw new ConflictError(err.message);
    throw err;
  }
}

export async function deletePlatform(id) {
  const exists = await Platform.exists(id);
  if (!exists) throw new NotFoundError('Platform not found');
  const inUseCount = await Platform.countDevicesUsing(id);
  if (inUseCount > 0) {
    throw new ConflictError(`Cannot delete: this platform is used by ${inUseCount} device(s)`);
  }
  await Platform.remove(id);
}
