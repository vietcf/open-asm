// Application roles and permissions. The superadmin role is fixed and always
// holds every permission; a role still assigned to users cannot be deleted.
import Role, { SUPERADMIN } from './role.model.js';
import Permission from './permission.model.js';
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toIdArray, toNullableString } from '../../shared/service.js';
import { clearPermissionsCache } from '../../middlewares/permissions.middleware.js';

const PERMISSION_NAME = /^[a-zA-Z0-9_]+\.(read|create|update|delete)$/;

// ===== Roles =====
export async function listRoles(filter) {
  const [items, totalCount] = await Promise.all([Role.findFilteredList(filter), Role.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getRole(id) {
  const role = await Role.findById(id);
  if (!role) throw new NotFoundError('Role not found');
  return role;
}

async function normalizeRole(input, id = null) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) throw new ValidationError('Role name is required');
  if (name.toLowerCase() === SUPERADMIN) throw new ValidationError('The superadmin role name is reserved');
  const existing = await Role.findByName(name);
  if (existing && String(existing.id) !== String(id)) throw new ConflictError('Role name already exists');
  return { name, description: toNullableString(input.description), permissions: toIdArray(input.permissions) };
}

const assertEditable = (role) => {
  if (role.name === SUPERADMIN) throw new ForbiddenError('The superadmin role cannot be changed');
};

export async function createRole(input) {
  const { permissions, ...data } = await normalizeRole(input);
  const id = await withTransaction(null, async (c) => {
    const role = await Role.create(data, c);
    await Role.setPermissions(role.id, permissions, c);
    return role.id;
  });
  return Role.findById(id);
}

export async function updateRole(id, input) {
  assertEditable(await getRole(id));
  const { permissions, ...data } = await normalizeRole(input, id);
  await withTransaction(null, async (c) => {
    await Role.update(id, data, c);
    await Role.setPermissions(id, permissions, c);
  });
  clearPermissionsCache(Number(id));
  return Role.findById(id);
}

export async function deleteRole(id) {
  const role = await getRole(id);
  assertEditable(role);
  if (role.user_count) throw new ConflictError('Cannot delete this role because it is assigned to {count} user(s). Reassign them first.').withParams({ count: role.user_count });
  await Role.remove(id);
  clearPermissionsCache(Number(id));
}

// ===== Permissions =====
export async function listPermissions(filter) {
  const [items, totalCount] = await Promise.all([Permission.findFilteredList(filter), Permission.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getPermission(id) {
  const permission = await Permission.findById(id);
  if (!permission) throw new NotFoundError('Permission not found');
  return permission;
}

// New permissions go to the superadmin role straight away
export async function createPermission(input) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!PERMISSION_NAME.test(name)) throw new ValidationError('Permission name must be in format abc.read|abc.create|abc.update|abc.delete');
  if (await Permission.findByName(name)) throw new ConflictError('Permission already exists');
  const id = await withTransaction(null, async (c) => {
    const permission = await Permission.create({ name, description: toNullableString(input.description) }, c);
    await Role.grantAllToSuperadmin(c);
    return permission.id;
  });
  clearPermissionsCache();
  return Permission.findById(id);
}

// Only the description changes: the name is what the code checks
export async function updatePermission(id, input) {
  await getPermission(id);
  await Permission.update(id, { description: toNullableString(input.description) });
  return Permission.findById(id);
}

export async function deletePermission(id) {
  await getPermission(id);
  await Permission.remove(id);
  clearPermissionsCache();
}
