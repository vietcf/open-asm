import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import User from '../models/User.js';
import Permission from '../models/Permission.js';
import { UnauthorizedError, ForbiddenError, ServiceUnavailableError } from './errors.js';
import { authenticateLdap, LdapUnavailableError } from './ldapService.js';

// Looks up user by username, then dispatches to bcrypt or LDAP bind depending
// on the account's auth_source. Used by the web login flow, which offers
// both methods. Returns the raw user row (including twofa_enabled/twofa_secret/
// require_twofa/must_change_password) on success.
export async function verifyCredentials(username, password) {
  const user = await User.findByUsername(username);
  if (!user) {
    throw new UnauthorizedError('Invalid username or password');
  }
  if (user.auth_source === 'ldap') {
    let ok;
    try {
      ok = await authenticateLdap(user.username, password);
    } catch (err) {
      if (err instanceof LdapUnavailableError) {
        throw new ServiceUnavailableError('Authentication server is temporarily unavailable. Please try again later.');
      }
      throw err;
    }
    if (!ok) {
      throw new UnauthorizedError('Invalid username or password');
    }
  } else if (!(await bcrypt.compare(password, user.password_hash))) {
    throw new UnauthorizedError('Invalid username or password');
  }
  if (!user.is_active) {
    throw new ForbiddenError('Account is inactive');
  }
  return user;
}

// Local-only variant for the API (/api/v1/auth/login): LDAP-authenticated
// accounts are always rejected here, per policy that API access requires a
// local password regardless of the account's web login method.
export async function verifyLocalCredentials(username, password) {
  const user = await User.findByUsername(username);
  if (!user || user.auth_source !== 'local' || !(await bcrypt.compare(password, user.password_hash))) {
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
