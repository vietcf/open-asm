// Simple reusable middleware for permission check using res.locals.hasPermission
export default function requirePermission(action, resource) {
  return (req, res, next) => {
    if (!res.locals.hasPermission(action, resource)) {
      return res.status(403).send('Forbidden');
    }
    next();
  };
}
