// Requires a logged-in session.
// While 2FA is pending (password accepted, second factor not done yet) the
// session only grants access to the 2FA pages:
//   - OTP step (2FA already enrolled)  -> /login/2fa only
//   - enrolment step (2FA required)    -> /2fa/setup and /2fa/verify only
function requireLogin(req, res, next) {
  if (!req.session || !req.session.isLoggedIn || !req.session.user) {
    if (req.xhr || req.accepts(['html', 'json']) === 'json') {
      return res.status(401).json({ error: 'Not logged in' });
    }
    return res.redirect('/login');
  }
  if (req.session.is2faPending) {
    const user = req.session.user;
    if (user.twofa_enabled && user.twofa_secret) {
      return res.redirect('/login/2fa');
    }
    const enrolmentPath = req.baseUrl === '/2fa' && (req.path === '/setup' || req.path === '/verify');
    if (!enrolmentPath) return res.redirect('/2fa/setup');
  }
  next();
}

export default requireLogin;
