const buildAccessControl = require('../utils/accessControl');

function checkPermission(action, resource) {
  return async (req, res, next) => {
    const ac = await buildAccessControl();
    const role = req.session.user && req.session.user.role_name; // Get role_name from session
    // Check if role is valid before calling ac.can(role)
    if (!role || !ac.hasRole(role)) {
      const redirectUrl = req.get('Referrer') || '/';
      return res.status(403).render('pages/forbidden', {
        redirectUrl,
        title: 'Access Denied',
        user: req.session.user,
        cssPath: '/css/',
        jsPath: '/js/',
        imgPath: '/images/',
        activeMenu: '', // Add empty activeMenu variable to avoid sidebar error
        permissions: req.session.permissions || [], // Add permissions for sidebar
        siteName: typeof req.app.locals.siteName !== 'undefined' ? req.app.locals.siteName : ''
      });
    }
    const permission = ac.can(role)[`${action}Any`](resource);
    if (permission.granted) return next();
    // If not enough permission, render forbidden page and auto redirect
    const redirectUrl = req.get('Referrer') || '/';
    return res.status(403).render('pages/forbidden', {
      redirectUrl,
      title: 'Access Denied',
      user: req.session.user,
      cssPath: '/css/',
      jsPath: '/js/',
      imgPath: '/images/',
      activeMenu: '', // Add empty activeMenu variable to avoid sidebar error
      permissions: req.session.permissions || [], // Add permissions for sidebar
      siteName: typeof req.app.locals.siteName !== 'undefined' ? req.app.locals.siteName : ''
    });
  };
}

module.exports = checkPermission;
