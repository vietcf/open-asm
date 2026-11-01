// Privileged roles and permissions: validation and persistence.
import PrivRole from './priv-role.model.js';
import PrivPermission from './priv-permission.model.js';
import System from '../system/system.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toIdArray, toNullableString } from '../../shared/service.js';

// name + system, shared by roles and permissions
async function nameAndSystem(input) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) throw new ValidationError('Name is required');
  const system_id = parseInt(input.system_id, 10) || null;
  if (!system_id) throw new ValidationError('System is required');
  if (!(await System.exists(system_id))) throw new ValidationError('Invalid system');
  return { name, system_id, description: toNullableString(input.description), updated_by: input.updated_by };
}

// ===== Roles =====
export async function listRoles(filter) {
  const [items, totalCount] = await Promise.all([PrivRole.findFilteredList(filter), PrivRole.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getRole(id) {
  const role = await PrivRole.findById(id);
  if (!role) throw new NotFoundError('Privileged role not found');
  return role;
}

// input: {name, description, system_id, permissions[], updated_by}; permissions must be the system's
async function normalizeRole(input, id = null) {
  const data = await nameAndSystem(input);
  const existing = await PrivRole.findByName(data.name, data.system_id);
  if (existing && String(existing.id) !== String(id)) throw new ConflictError('A role with this name already exists for the selected system');
  const permissions = toIdArray(input.permissions);
  if ((await PrivPermission.foreignIds(permissions, data.system_id)).length) throw new ValidationError('Permissions must belong to the selected system');
  return { data, permissions };
}

export async function createRole(input, client) {
  const { data, permissions } = await normalizeRole(input);
  const id = await withTransaction(client, async (c) => {
    const role = await PrivRole.create(data, c);
    await PrivRole.setPermissions(role.id, permissions, c);
    return role.id;
  });
  return PrivRole.findById(id);
}

export async function updateRole(id, input, client) {
  if (!(await PrivRole.exists(id))) throw new NotFoundError('Privileged role not found');
  const { data, permissions } = await normalizeRole(input, id);
  await withTransaction(client, async (c) => {
    await PrivRole.update(id, data, c);
    await PrivRole.setPermissions(id, permissions, c);
  });
  return PrivRole.findById(id);
}

export async function deleteRole(id) {
  const role = await getRole(id);
  if (role.account_count) throw new ConflictError('Cannot delete this role because it is assigned to {count} account(s). Reassign them first.').withParams({ count: role.account_count });
  await PrivRole.remove(id);
}

// ===== Permissions =====
export async function listPermissions(filter) {
  const [items, totalCount] = await Promise.all([PrivPermission.findFilteredList(filter), PrivPermission.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getPermission(id) {
  const permission = await PrivPermission.findById(id);
  if (!permission) throw new NotFoundError('Privileged permission not found');
  return permission;
}

const duplicatePermission = (err) => {
  if (err.code === '23505') throw new ConflictError('A permission with this name already exists for the selected system');
  throw err;
};

export async function createPermission(input) {
  const data = await nameAndSystem(input);
  const created = await PrivPermission.create(data).catch(duplicatePermission);
  return PrivPermission.findById(created.id);
}

// A permission used by roles keeps its system (roles only hold their system's permissions)
export async function updatePermission(id, input) {
  const current = await getPermission(id);
  const data = await nameAndSystem(input);
  if (current.role_count && data.system_id !== current.system_id) throw new ValidationError('This permission is used by roles; its system cannot change');
  await PrivPermission.update(id, data).catch(duplicatePermission);
  return PrivPermission.findById(id);
}

export async function deletePermission(id) {
  await getPermission(id);
  await PrivPermission.remove(id);
}
