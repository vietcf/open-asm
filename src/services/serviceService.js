import Service from '../models/Service.js';
import { ValidationError, NotFoundError, ConflictError } from '../shared/errors.js';

export async function listServices({ search, page, pageSize }) {
  const [items, totalCount] = await Promise.all([
    Service.findPage(page, pageSize, search || ''),
    Service.countAll(search || '')
  ]);
  return { items, totalCount };
}

export async function getService(id) {
  const service = await Service.findById(id);
  if (!service) throw new NotFoundError('Service not found');
  return service;
}

export async function findServicesByName(name) {
  return Service.findByNameExact(name);
}

export async function assertNameAvailable(name, excludeId) {
  const matches = await Service.findByNameExact(name);
  const conflict = matches.find(s => excludeId == null || String(s.id) !== String(excludeId));
  if (conflict) throw new ConflictError('Service name already exists');
}

// input: {name, description?}
// Duplicate-name pre-check and existence checks added for both consumers —
// the frontend previously swallowed every error (including duplicate-name and
// in-use-on-delete) into a single generic message, losing the real reason.
export async function createService(input) {
  const name = (input.name || '').trim();
  if (!name) throw new ValidationError('Service name is required');
  await assertNameAvailable(name);
  const description = typeof input.description === 'string' ? (input.description.trim() || null) : (input.description ?? null);
  return Service.create({ name, description });
}

// Partial update (has-key semantics).
export async function updateService(id, input) {
  const current = await Service.findById(id);
  if (!current) throw new NotFoundError('Service not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  const updateData = {};
  if (has('name')) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new ValidationError('Service name cannot be empty');
    updateData.name = name;
  }
  if (has('description')) updateData.description = typeof input.description === 'string' ? (input.description.trim() || null) : input.description;

  if (Object.keys(updateData).length === 0) throw new ValidationError('No changes made');
  if (updateData.name) await assertNameAvailable(updateData.name, id);

  return Service.update(id, updateData);
}

export async function deleteService(id) {
  const exists = await Service.exists(id);
  if (!exists) throw new NotFoundError('Service not found');
  const inUseCount = await Service.countServersUsing(id);
  if (inUseCount > 0) {
    throw new ConflictError(`Cannot delete: this service is used by ${inUseCount} server(s)`);
  }
  await Service.delete(id);
}
