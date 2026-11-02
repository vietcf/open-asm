// Application users: validation and persistence of the user admin pages.
// Rules that keep the app manageable: nobody deletes, deactivates or changes the
// role of their own account, and at least one active superadmin always remains.
// Changes that affect access end the user's sessions so they apply at once.
import bcrypt from 'bcrypt';
import User from './user.model.js';
import Role, { SUPERADMIN } from './role.model.js';
import Configuration from './configuration.model.js';
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toNullableString } from '../../shared/service.js';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../../shared/password.js';

// Letters, digits, dot, dash, underscore: no spaces or lookalike characters
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,50}$/;
const flag = (v) => v === true || v === 'on' || v === 'true' || v === '1';

// ===== Queries =====
export async function listUsers(filter) {
  const [items, totalCount] = await Promise.all([User.findFilteredList(filter), User.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getUser(id) {
  const user = await User.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

// ===== Commands =====
async function twofaDeadline() {
  const days = parseInt((await Configuration.findByKey('otp_deadline_time'))?.value, 10);
  return new Date(Date.now() + (Number.isInteger(days) ? days : 3) * 24 * 60 * 60 * 1000);
}

// The last active superadmin must stay an active superadmin
async function assertSuperadminRemains(current, next) {
  const losing = current.role_name === SUPERADMIN && current.is_active && (next === null || !next.is_active || next.role_name !== SUPERADMIN);
  if (losing && (await User.countActiveWithRole(SUPERADMIN, current.id)) === 0) {
    throw new ConflictError('At least one active superadmin account must remain');
  }
}

// input: {username, email, fullname, role_id, auth_source, password, repeat_password, require_twofa, must_change_password, is_active}
async function normalize(input, current = null) {
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const email = toNullableString(input.email);
  if (!username || !email) throw new ValidationError('Username and email are required');
  if (!USERNAME_REGEX.test(username)) {
    throw new ValidationError('Username must be 3-50 characters and contain only letters, numbers, dots, hyphens, and underscores (no spaces).');
  }
  const conflict = await User.findConflict({ username, email }, current?.id);
  if (conflict) throw new ConflictError(conflict.username.toLowerCase() === username.toLowerCase() ? 'Username already exists' : 'Email already exists');

  const role = await Role.findById(parseInt(input.role_id, 10) || 0);
  if (!role) throw new ValidationError('Role is required');

  const auth_source = input.auth_source === 'ldap' ? 'ldap' : 'local';
  const data = {
    username, email, fullname: toNullableString(input.fullname), role_id: role.id, auth_source,
    require_twofa: flag(input.require_twofa),
    // AD owns LDAP passwords
    must_change_password: auth_source === 'local' && flag(input.must_change_password),
    is_active: current ? flag(input.is_active) : true,
  };

  const password = typeof input.password === 'string' ? input.password : '';
  if (auth_source === 'ldap') {
    data.password_hash = null;
  } else if (password) {
    if (current && password !== input.repeat_password) throw new ValidationError('Passwords do not match');
    if (!isStrongPassword(password)) throw new ValidationError(PASSWORD_RULE_MESSAGE);
    data.password_hash = await bcrypt.hash(password, 10);
  } else if (!current || current.auth_source === 'ldap') {
    throw new ValidationError('A password is required for local accounts');
  }

  // 2FA: newly required -> enrolment deadline; no longer required -> enrolment cleared
  if (data.require_twofa && !(current?.twofa_enabled && current?.twofa_secret)) {
    if (!current?.require_twofa || !current.twofa_setup_deadline) data.twofa_setup_deadline = await twofaDeadline();
  } else if (!data.require_twofa) {
    data.twofa_setup_deadline = null;
    if (current?.require_twofa) Object.assign(data, { twofa_secret: null, twofa_enabled: false });
  }
  return { data, role };
}

export async function createUser(input, client) {
  const { data } = await normalize(input);
  const user = await User.create(data, client);
  return User.findById(user.id);
}

// actor: the signed-in admin ({id})
export async function updateUser(id, input, actor, client) {
  const current = await getUser(id);
  const { data, role } = await normalize(input, current);
  const self = String(actor?.id) === String(current.id);
  if (self && !data.is_active) throw new ForbiddenError('You cannot deactivate your own account');
  if (self && data.role_id !== current.role_id) throw new ForbiddenError('You cannot change the role of your own account');
  await assertSuperadminRemains(current, { is_active: data.is_active, role_name: role.name });

  const accessChanged = !data.is_active || data.role_id !== current.role_id || data.username !== current.username
    || data.auth_source !== current.auth_source || data.password_hash !== undefined && data.password_hash !== current.password_hash
    || data.twofa_secret !== undefined;
  await withTransaction(client, async (c) => {
    await User.update(id, data, c);
    if (accessChanged && !self) await User.endSessions(current.id, c);
  });
  return User.findById(id);
}

export async function deleteUser(id, actor) {
  const current = await getUser(id);
  if (String(actor?.id) === String(current.id)) throw new ForbiddenError('You cannot delete your own account');
  await assertSuperadminRemains(current, null);
  await withTransaction(null, async (c) => {
    await User.endSessions(current.id, c);
    await User.remove(current.id, c);
  });
}
