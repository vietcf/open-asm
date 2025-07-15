// src/middlewares/permissions.middleware.js
// Middleware to load permissions for the current user (by role_id) and attach to req.permissions
// Uses in-memory cache for role-permissions mapping with expiration and better cache management

import Permission from '../models/Permission.js';

// Cache with expiration (role_id -> {permissions: [], timestamp: Date, loading: Promise})
const rolePermissionsCache = {};
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_CACHE_SIZE = 100; // Maximum number of roles to cache

export async function loadPermissions(req, res, next) {
  try {
    if (!req.session || !req.session.user || !req.session.user.role_id) {
      req.permissions = [];
      return next();
    }
    
    const roleId = req.session.user.role_id;
    const now = Date.now();
    
    // Check cache and expiry
    if (!rolePermissionsCache[roleId] || 
        (now - rolePermissionsCache[roleId].timestamp) > CACHE_EXPIRY) {
      
      // Prevent multiple concurrent database queries for same role
      if (rolePermissionsCache[roleId]?.loading) {
        const permissions = await rolePermissionsCache[roleId].loading;
        req.permissions = permissions;
        return next();
      }
      
      // Create loading promise to prevent race conditions
      const loadingPromise = loadPermissionsFromDB(roleId);
      rolePermissionsCache[roleId] = {
        ...rolePermissionsCache[roleId],
        loading: loadingPromise
      };
      
      const permissions = await loadingPromise;
      
      // Update cache with fresh data
      rolePermissionsCache[roleId] = {
        permissions,
        timestamp: now,
        loading: null
      };
      
      // Clean up cache if it gets too large
      cleanupCache();
      
      req.permissions = permissions;
    } else {
      req.permissions = rolePermissionsCache[roleId].permissions;
    }
    
    next();
  } catch (err) {
    console.error('Error loading permissions:', err);
    req.permissions = [];
    next(); // Don't pass error to avoid breaking the request
  }
}

// Helper function to load permissions from database
async function loadPermissionsFromDB(roleId) {
  try {
    const perms = await Permission.findByRoleId(roleId);
    return perms.map(p => p.name);
  } catch (err) {
    console.error('Error loading permissions from DB:', err);
    return [];
  }
}

// Clean up cache if it gets too large (LRU-like cleanup)
function cleanupCache() {
  const cacheKeys = Object.keys(rolePermissionsCache);
  if (cacheKeys.length > MAX_CACHE_SIZE) {
    // Sort by timestamp and remove oldest entries
    const sortedEntries = cacheKeys
      .map(key => ({ key, timestamp: rolePermissionsCache[key].timestamp }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    for (let i = 0; i < toRemove; i++) {
      delete rolePermissionsCache[sortedEntries[i].key];
    }
  }
}

// Function to clear cache (call after admin updates permissions)
export function clearPermissionsCache(roleId) {
  if (roleId) {
    delete rolePermissionsCache[roleId];
  } else {
    // Clear all cache
    Object.keys(rolePermissionsCache).forEach(key => delete rolePermissionsCache[key]);
  }
}

// Function to refresh cache for a specific role
export async function refreshPermissionsCache(roleId) {
  try {
    const permissions = await loadPermissionsFromDB(roleId);
    rolePermissionsCache[roleId] = {
      permissions,
      timestamp: Date.now(),
      loading: null
    };
    return permissions;
  } catch (err) {
    console.error('Error refreshing permissions cache:', err);
    return [];
  }
}

// Function to get cache statistics (for debugging)
export function getCacheStats() {
  return {
    size: Object.keys(rolePermissionsCache).length,
    entries: Object.keys(rolePermissionsCache).map(key => ({
      roleId: key,
      timestamp: rolePermissionsCache[key].timestamp,
      expired: (Date.now() - rolePermissionsCache[key].timestamp) > CACHE_EXPIRY,
      loading: !!rolePermissionsCache[key].loading
    }))
  };
}
