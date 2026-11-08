// Middleware for JWT authentication and role/permission authorization
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../shared/secrets.js';
import User from '../modules/administrator/user.model.js';
import { getUserPermissions } from '../modules/auth/auth.service.js';

// Authenticate: verify JWT and attach user info to req.user
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  // The token only names the user: the account must still be active, and its
  // role and permissions are the current ones (a deactivated or downgraded
  // user loses API access at once, not when the token expires).
  User.findById(Number(decoded.sub) || 0)
    .then(async (user) => {
      if (!user || !user.is_active || user.auth_source !== 'local' || user.username !== decoded.username) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      req.user = { sub: user.id, username: user.username, role: user.role_name, role_id: user.role_id, permissions: await getUserPermissions(user.role_id) };
      next();
    })
    .catch(() => res.status(500).json({ error: 'Authentication failed' }));
}

// Authorize by role (string or array)
export function authorizeRoleJWT(roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (Array.isArray(roles)) {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      if (req.user.role !== roles) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    next();
  };
}

// Authorize by permission (if you store permissions in JWT)
export function authorizePermissionJWT(permission) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

