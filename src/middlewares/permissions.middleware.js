// src/middlewares/permissions.middleware.js
// Middleware to load permissions for the current user (by role_id) and attach to req.permissions
// Uses in-memory cache for role-permissions mapping

import Permission from '../models/Permission.js';

// Simple in-memory cache (role_id -> permissions array)
const rolePermissionsCache = {};

export async function loadPermissions(req, res, next) {
  try {
    if (!req.session || !req.session.user || !req.session.user.role_id) {
      req.permissions = [];
      return next();
    }
    const roleId = req.session.user.role_id;
    // Check cache first
    if (!rolePermissionsCache[roleId]) {
      const perms = await Permission.findByRoleId(roleId);
      rolePermissionsCache[roleId] = perms.map(p => p.name);
    }
    req.permissions = rolePermissionsCache[roleId];
    next();
  } catch (err) {
    req.permissions = [];
    next(err);
  }
}

// Optionally: function to clear cache (call after admin updates permissions)
export function clearPermissionsCache(roleId) {
  if (roleId) {
    delete rolePermissionsCache[roleId];
  } else {
    Object.keys(rolePermissionsCache).forEach(key => delete rolePermissionsCache[key]);
  }
}
