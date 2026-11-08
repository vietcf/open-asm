// Application roles and permissions. The built-in roles (superadmin, admin,
// viewer) are fixed: superadmin always holds every permission; none of them
// can be edited or deleted. A role still assigned to users cannot be deleted.
import Role, { SUPERADMIN, isBuiltinRole } from './role.model.js';
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

// No privilege escalation: someone who is not superadmin can only give a role
// permissions they hold themselves (actor = {role_name, permissions})
async function assertGrantable(actor, permissionIds) {
  if (!actor || actor.role_name === SUPERADMIN || !permissionIds.length) return;
  const own = new Set(actor.permissions || []);
  const names = (await Permission.findAll()).filter((p) => permissionIds.includes(p.id)).map((p) => p.name);
  const extra = names.filter((n) => !own.has(n));
  if (extra.length) throw new ForbiddenError('You cannot grant permissions you do not have: {list}').withParams({ list: extra.join(', ') });
}

async function normalizeRole(input, id = null) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) throw new ValidationError('Role name is required');
  if (isBuiltinRole(name)) throw new ValidationError('{name} is a built-in role name').withParams({ name });
  const existing = await Role.findByName(name);
  if (existing && String(existing.id) !== String(id)) throw new ConflictError('Role name already exists');
  return { name, description: toNullableString(input.description), permissions: toIdArray(input.permissions) };
}

export const assertEditable = (role) => {
  if (isBuiltinRole(role.name)) throw new ForbiddenError('Built-in roles (superadmin, admin, viewer) cannot be changed or deleted');
};

// Edit form: built-in roles are not offered
export async function getEditableRole(id) {
  const role = await getRole(id);
  assertEditable(role);
  return role;
}

export async function createRole(input, actor = null) {
  const { permissions, ...data } = await normalizeRole(input);
  await assertGrantable(actor, permissions);
  const id = await withTransaction(null, async (c) => {
    const role = await Role.create(data, c);
    await Role.setPermissions(role.id, permissions, c);
    return role.id;
  });
  return Role.findById(id);
}

export async function updateRole(id, input, actor = null) {
  assertEditable(await getRole(id));
  const { permissions, ...data } = await normalizeRole(input, id);
  await assertGrantable(actor, permissions);
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
