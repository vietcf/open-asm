import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import User from '../models/User.js';
import Permission from '../models/Permission.js';
import { UnauthorizedError, ForbiddenError } from './errors.js';

// Looks up user by username, compares password, enforces is_active.
// Returns the raw user row (including twofa_enabled/twofa_secret/require_twofa/
// must_change_password) on success.
export async function verifyCredentials(username, password) {
  const user = await User.findByUsername(username);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new UnauthorizedError('Invalid username or password');
  }
  if (!user.is_active) {
    throw new ForbiddenError('Account is inactive');
  }
  return user;
}

// Resolves permission names for a role_id (used by both session and JWT paths).
export async function getUserPermissions(roleId) {
  if (!roleId) return [];
  const permissions = await Permission.findByRoleId(roleId);
  return permissions.map(p => p.name);
}

// Pure TOTP check, no session coupling.
export function verifyTotp(secret, token) {
  return speakeasy.totp.verify({ secret, encoding: 'base32', token });
}
