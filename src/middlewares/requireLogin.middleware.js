// Middleware to require login
function requireLogin(req, res, next) {
  if (req.session && req.session.isLoggedIn) {
    return next();
  }
  res.redirect('/login');
}

export default requireLogin;
