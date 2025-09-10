// Enhanced middleware for permission check - supports multiple permissions
export default function requirePermission(...permissions) {
  return (req, res, next) => {
    // Handle different parameter formats
    let permissionsToCheck = [];
    
    if (permissions.length === 2 && typeof permissions[0] === 'string' && typeof permissions[1] === 'string') {
      // Legacy format: requirePermission('read', 'user')
      const [action, resource] = permissions;
      permissionsToCheck = [`${resource}.${action}`];
    } else {
      // New format: requirePermission('user.read', 'user.create', 'system.read')
      permissionsToCheck = permissions;
    }
    
    // Check if user has ANY of the required permissions (OR logic)
    const hasAnyPermission = permissionsToCheck.some(permission => {
      return res.locals.hasPermission(permission);
    });
    
    if (!hasAnyPermission) {
      return res.status(403).send('Forbidden');
    }
    
    next();
  };
}

// Alternative function for AND logic (user must have ALL permissions)
export function requireAllPermissions(...permissions) {
  return (req, res, next) => {
    const hasAllPermissions = permissions.every(permission => {
      return res.locals.hasPermission(permission);
    });
    
    if (!hasAllPermissions) {
      return res.status(403).send('Forbidden');
    }
    
    next();
  };
}
