// Middleware for JWT authentication and role/permission authorization
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'VcB_your_jwt_secret';

// Authenticate: verify JWT and attach user info to req.user
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
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

