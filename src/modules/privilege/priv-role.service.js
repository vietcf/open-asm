// Privileged roles and permissions: validation and persistence.
//
// access = { scope, canGlobal } (priv-scope.js): scope limits them to the
// systems of the user's units; "all systems" ones (all_systems) need canGlobal
// (permission priv_role.global) to be created, changed or deleted.
import PrivRole from './priv-role.model.js';
import PrivPermission from './priv-permission.model.js';
import System from '../system/system.model.js';
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toIdArray, toNullableString } from '../../shared/service.js';
import { managedSystemIds } from './priv-scope.js';

const NO_LIMIT = { scope: null, canGlobal: true };
const flag = (v) => v === true || v === 'on' || v === 'true' || v === '1';

// name + system (or all systems), shared by roles and permissions
async function nameAndSystem(input, access) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) throw new ValidationError('Name is required');
  const all_systems = flag(input.all_systems);
  if (all_systems) {
    if (!access.canGlobal) throw new ForbiddenError('Only administrators can use "All systems"');
    return { name, system_id: null, all_systems, description: toNullableString(input.description), updated_by: input.updated_by };
  }
  const system_id = parseInt(input.system_id, 10) || null;
  if (!system_id) throw new ValidationError('System is required');
  if (!(await System.exists(system_id))) throw new ValidationError('Invalid system');
  if (access.scope && !(await managedSystemIds(access.scope)).includes(system_id)) throw new ForbiddenError('You can only use systems managed by your units');
  return { name, system_id, all_systems, description: toNullableString(input.description), updated_by: input.updated_by };
}

// The record may be changed / deleted: "all systems" ones need canGlobal; others are already limited by the scope (findById)
function assertChangeable(record, access) {
  if (record.all_systems && !access.canGlobal) throw new ForbiddenError('Only administrators can change "All systems" roles and permissions');
}

// List rows: can_edit tells the page whether to offer Edit / Delete
const markEditable = (rows, access) => rows.map((r) => ({ ...r, can_edit: !r.all_systems || access.canGlobal }));

// ===== Roles =====
export async function listRoles(filter, access = NO_LIMIT) {
  const [items, totalCount] = await Promise.all([PrivRole.findFilteredList({ ...filter, scope: access.scope }), PrivRole.countFiltered({ ...filter, scope: access.scope })]);
  return { items: markEditable(items, access), totalCount };
}

export async function getRole(id, access = NO_LIMIT) {
  const role = await PrivRole.findById(id, access.scope);
  if (!role) throw new NotFoundError('Privileged role not found');
  return role;
}

// input: {name, description, system_id | all_systems, permissions[], updated_by}; permissions must be ones the role may hold
async function normalizeRole(input, access, id = null) {
  const data = await nameAndSystem(input, access);
  const existing = await PrivRole.findByName(data.name, data.system_id, data.all_systems);
  if (existing && String(existing.id) !== String(id)) {
    throw new ConflictError(data.all_systems ? 'An "All systems" role with this name already exists' : 'A role with this name already exists for the selected system');
  }
  const permissions = toIdArray(input.permissions);
  if ((await PrivPermission.foreignIds(permissions, data.system_id, data.all_systems)).length) {
    throw new ValidationError('Permissions must belong to the selected system or to all systems');
  }
  return { data, permissions };
}

export async function createRole(input, client, access = NO_LIMIT) {
  const { data, permissions } = await normalizeRole(input, access);
  const id = await withTransaction(client, async (c) => {
    const role = await PrivRole.create(data, c);
    await PrivRole.setPermissions(role.id, permissions, c);
    return role.id;
  });
  return PrivRole.findById(id);
}

export async function updateRole(id, input, client, access = NO_LIMIT) {
  assertChangeable(await getRole(id, access), access);
  const { data, permissions } = await normalizeRole(input, access, id);
  await withTransaction(client, async (c) => {
    await PrivRole.update(id, data, c);
    await PrivRole.setPermissions(id, permissions, c);
  });
  return PrivRole.findById(id);
}

export async function deleteRole(id, access = NO_LIMIT) {
  const role = await getRole(id, access);
  assertChangeable(role, access);
  if (role.account_count) throw new ConflictError('Cannot delete this role because it is assigned to {count} account(s). Reassign them first.').withParams({ count: role.account_count });
  await PrivRole.remove(id);
}

// ===== Permissions =====
export async function listPermissions(filter, access = NO_LIMIT) {
  const [items, totalCount] = await Promise.all([PrivPermission.findFilteredList({ ...filter, scope: access.scope }), PrivPermission.countFiltered({ ...filter, scope: access.scope })]);
  return { items: markEditable(items, access), totalCount };
}

export async function getPermission(id, access = NO_LIMIT) {
  const permission = await PrivPermission.findById(id, access.scope);
  if (!permission) throw new NotFoundError('Privileged permission not found');
  return permission;
}

const duplicatePermission = (err) => {
  if (err.code === '23505') throw new ConflictError('A permission with this name already exists for the selected system');
  throw err;
};

export async function createPermission(input, client, access = NO_LIMIT) {
  const data = await nameAndSystem(input, access);
  const created = await PrivPermission.create(data, client).catch(duplicatePermission);
  return PrivPermission.findById(created.id);
}

// A permission used by roles keeps its system (roles only hold their system's
// permissions); it may still be opened to all systems.
export async function updatePermission(id, input, client, access = NO_LIMIT) {
  const current = await getPermission(id, access);
  assertChangeable(current, access);
  const data = await nameAndSystem(input, access);
  const narrowed = current.all_systems ? !data.all_systems : !data.all_systems && data.system_id !== current.system_id;
  if (current.role_count && narrowed) throw new ValidationError('This permission is used by roles; its system cannot change');
  await PrivPermission.update(id, data, client).catch(duplicatePermission);
  return PrivPermission.findById(id);
}

export async function deletePermission(id, access = NO_LIMIT) {
  assertChangeable(await getPermission(id, access), access);
  await PrivPermission.remove(id);
}
