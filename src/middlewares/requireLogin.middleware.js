// Middleware to require login
function requireLogin(req, res, next) {
  //console.log('[DEBUG][requireLogin] sessionID:', req.sessionID, 'session:', req.session);
  if (req.session && req.session.isLoggedIn) {
    return next();
  }
  res.redirect('/login');
}

export default requireLogin;
