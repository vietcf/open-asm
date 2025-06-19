const buildAccessControl = require('../utils/accessControl');

function checkPermission(action, resource) {
  return async (req, res, next) => {
    const ac = await buildAccessControl();
    const role = req.session.user && req.session.user.role_name; // Get role_name from session
    // Check if role is valid before calling ac.can(role)
    if (!role || !ac.hasRole(role)) {
      const redirectUrl = req.get('Referrer') || '/';
      const ejs = require('ejs');
      const path = require('path');
      const forbiddenPath = path.join(__dirname, '../../public/html/pages/forbidden.ejs');
      return ejs.renderFile(forbiddenPath, { redirectUrl }, (err, forbiddenHtml) => {
        if (err) return res.status(500).send('Error rendering forbidden page');
        return res.status(403).render('layouts/layout', {
          body: forbiddenHtml,
          title: 'Access Denied',
          user: req.session.user,
          cssPath: '/css/',
          jsPath: '/js/',
          imgPath: '/images/',
          activeMenu: '' // Add empty activeMenu variable to avoid sidebar error
        });
      });
    }
    const permission = ac.can(role)[`${action}Any`](resource);
    if (permission.granted) return next();
    // If not enough permission, render forbidden page and auto redirect
    const redirectUrl = req.get('Referrer') || '/';
    const ejs = require('ejs');
    const path = require('path');
    const forbiddenPath = path.join(__dirname, '../../public/html/pages/forbidden.ejs');
    ejs.renderFile(forbiddenPath, { redirectUrl }, (err, forbiddenHtml) => {
      if (err) return res.status(500).send('Error rendering forbidden page');
      return res.status(403).render('layouts/layout', {
        body: forbiddenHtml,
        title: 'Access Denied',
        user: req.session.user,
        cssPath: '/css/',
        jsPath: '/js/',
        imgPath: '/images/',
        activeMenu: '' // Add empty activeMenu variable to avoid sidebar error
      });
    });
  };
}

module.exports = checkPermission;
