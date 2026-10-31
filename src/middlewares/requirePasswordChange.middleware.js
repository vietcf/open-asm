// Middleware to force password change if must_change_password is true
const requirePasswordChange = (req, res, next) => {
  if (
    req.session.user &&
    req.session.user.must_change_password &&
    !req.session.is2faPending && // finish 2FA first

    req.session.user.auth_source !== 'ldap' &&
    req.path !== '/change-password' &&
    req.path !== '/logout' &&
    !(req.path === '/change-password' && req.method === 'POST')
  ) {
    return res.redirect('/change-password');
  }
  next();
};

export default requirePasswordChange;
