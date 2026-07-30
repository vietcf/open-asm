import Agent from '../models/Agent.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';

export async function listAgents({ search, page, pageSize }) {
  const [items, totalCount] = await Promise.all([
    Agent.findFilteredList({ search: search || '', page, pageSize }),
    Agent.countFiltered({ search: search || '' })
  ]);
  return { items, totalCount };
}

export async function getAgent(id) {
  const agent = await Agent.findById(id);
  if (!agent) throw new NotFoundError('Agent not found');
  return agent;
}

export async function findAgentsByName(name) {
  return Agent.findByNameExact(name);
}

export async function assertNameAvailable(name, excludeId) {
  const matches = await Agent.findByNameExact(name);
  const conflict = matches.find(a => excludeId == null || String(a.id) !== String(excludeId));
  if (conflict) throw new ConflictError('Agent name already exists');
}

// input: {name, version?, description?}
// Duplicate-name pre-check added for both consumers — the frontend previously
// relied solely on catching a 23505 error, which worked but gave a less
// precise failure point than an explicit check.
export async function createAgent(input) {
  const name = (input.name || '').trim();
  if (!name) throw new ValidationError('Agent name is required');
  await assertNameAvailable(name);
  const version = typeof input.version === 'string' ? (input.version.trim() || null) : (input.version ?? null);
  const description = typeof input.description === 'string' ? (input.description.trim() || null) : (input.description ?? null);
  return Agent.create({ name, version, description });
}

// Partial update (has-key semantics).
export async function updateAgent(id, input) {
  const current = await Agent.findById(id);
  if (!current) throw new NotFoundError('Agent not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  const updateData = {};
  if (has('name')) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new ValidationError('Agent name cannot be empty');
    updateData.name = name;
  }
  if (has('version')) updateData.version = typeof input.version === 'string' ? (input.version.trim() || null) : input.version;
  if (has('description')) updateData.description = typeof input.description === 'string' ? (input.description.trim() || null) : input.description;

  if (Object.keys(updateData).length === 0) throw new ValidationError('No changes made');
  if (updateData.name) await assertNameAvailable(updateData.name, id);

  return Agent.update(id, updateData);
}

export async function deleteAgent(id) {
  const exists = await Agent.exists(id);
  if (!exists) throw new NotFoundError('Agent not found');
  const inUseCount = await Agent.countServersUsing(id);
  if (inUseCount > 0) {
    throw new ConflictError(`Cannot delete: this agent is used by ${inUseCount} server(s)`);
  }
  await Agent.delete(id);
}
