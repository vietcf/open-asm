import DeviceType from '../models/DeviceType.js';
import { ValidationError, NotFoundError, ConflictError } from '../shared/errors.js';

const UPDATABLE_FIELDS = ['name', 'description'];

export async function listDeviceTypes({ search, page, pageSize }) {
  const [items, totalCount] = await Promise.all([
    DeviceType.findFilteredPage({ search: search || '', page, pageSize }),
    DeviceType.countFiltered(search || '')
  ]);
  return { items, totalCount };
}

export async function getDeviceType(id) {
  const deviceType = await DeviceType.findById(id);
  if (!deviceType) throw new NotFoundError('Device type not found');
  return deviceType;
}

export async function findDeviceTypesByName(name) {
  return DeviceType.findByNameExact(name);
}

export async function assertNameAvailable(name, excludeId) {
  const exists = await DeviceType.checkNameExists(name, excludeId ?? null);
  if (exists) throw new ConflictError('A device type with this name already exists');
}

// input: {name, description?}
// DeviceType.create() has no app-level uniqueness check (unlike Platform.create),
// relying solely on the DB unique constraint — an explicit pre-check is added
// here for both consumers so duplicates get a clean 409 instead of a raw
// constraint-violation round trip.
export async function createDeviceType(input) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) throw new ValidationError('Device type name is required and must be a non-empty string');
  const description = input.description ?? null;

  await assertNameAvailable(name);
  try {
    return await DeviceType.create({ name, description });
  } catch (err) {
    if (err.code === '23505') throw new ConflictError('A device type with this name already exists');
    throw err;
  }
}

// Partial update with a strict field allow-list (matches the API's existing
// stricter behavior).
export async function updateDeviceType(id, input) {
  const current = await DeviceType.findById(id);
  if (!current) throw new NotFoundError('Device type not found');

  const invalidFields = Object.keys(input).filter(k => !UPDATABLE_FIELDS.includes(k));
  if (invalidFields.length > 0) {
    throw new ValidationError(`Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${UPDATABLE_FIELDS.join(', ')}`);
  }
  if (Object.keys(input).length === 0) {
    throw new ValidationError('At least one field must be provided for update');
  }

  const updates = {};
  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  if (has('name')) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new ValidationError('Device type name must be a non-empty string');
    await assertNameAvailable(name, id);
    updates.name = name;
  }
  if (has('description')) {
    updates.description = input.description;
  }

  try {
    return await DeviceType.update(id, updates);
  } catch (err) {
    if (err.code === '23505') throw new ConflictError('A device type with this name already exists');
    throw err;
  }
}

export async function deleteDeviceType(id) {
  const exists = await DeviceType.exists(id);
  if (!exists) throw new NotFoundError('Device type not found');
  const inUseCount = await DeviceType.countDevicesUsing(id);
  if (inUseCount > 0) {
    throw new ConflictError(`Cannot delete: this device type is used by ${inUseCount} device(s)`);
  }
  await DeviceType.remove(id);
}
