// Middleware to force password change if must_change_password is true
module.exports = (req, res, next) => {
  if (
    req.session.user &&
    req.session.user.must_change_password &&
    req.path !== '/change-password' &&
    req.path !== '/logout' &&
    !(req.path === '/change-password' && req.method === 'POST')
  ) {
    return res.redirect('/change-password');
  }
  next();
};
