import Tag from '../models/Tag.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';

export async function listTags({ search, page, pageSize }) {
  const [items, totalCount] = await Promise.all([
    Tag.findPage(page, pageSize, search || ''),
    Tag.countAll(search || '')
  ]);
  return { items, totalCount };
}

export async function getAllTags() {
  return Tag.findAll();
}

export async function getTag(id) {
  const tag = await Tag.findById(id);
  if (!tag) throw new NotFoundError('Tag not found');
  return tag;
}

export async function findTagsByName(name) {
  return Tag.findByNameExact(name);
}

export async function assertNameAvailable(name, excludeId) {
  const existing = await Tag.findByNameExact(name);
  const conflict = existing.find(t => excludeId == null || String(t.id) !== String(excludeId));
  if (conflict) throw new ConflictError('Tag with this name already exists');
}

// input: {name, description?}
export async function createTag(input) {
  const name = (input.name || '').trim();
  if (!name) throw new ValidationError('Tag name is required');
  const description = (input.description || '').trim() || null;

  await assertNameAvailable(name);
  try {
    return await Tag.create({ name, description });
  } catch (err) {
    if (err.code === '23505') throw new ConflictError('Tag with this name already exists');
    throw err;
  }
}

// Partial update (has-key semantics) — at least one of name/description must
// be provided. A name-only-case-change is not treated as a conflict.
export async function updateTag(id, input) {
  const current = await Tag.findById(id);
  if (!current) throw new NotFoundError('Tag not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  if (!has('name') && !has('description')) {
    throw new ValidationError('At least one field (name or description) must be provided');
  }

  const name = has('name') ? String(input.name || '').trim() : current.name;
  if (has('name') && !name) throw new ValidationError('Tag name must not be empty if provided');
  const description = has('description')
    ? (input.description !== undefined && input.description !== null ? String(input.description).trim() || null : null)
    : current.description;

  if (has('name') && name.toLowerCase() !== current.name.toLowerCase()) {
    await assertNameAvailable(name, id);
  }

  try {
    return await Tag.update(id, { name, description });
  } catch (err) {
    if (err.code === '23505') throw new ConflictError('Tag with this name already exists');
    throw err;
  }
}

export async function deleteTag(id) {
  const exists = await Tag.exists(id);
  if (!exists) throw new NotFoundError('Tag not found');
  try {
    await Tag.delete(id);
  } catch (err) {
    if (err.code === '23503') throw new ConflictError('Cannot delete tag as it is being used by other objects');
    throw err;
  }
}
