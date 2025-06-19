// Middleware to require 2FA verification for users with 2FA enabled
module.exports = function require2fa(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.twofa_enabled) {
    if (req.session.is2faVerified) {
      return next();
    } else {
      return res.redirect('/login/2fa');
    }
  }
  // If 2FA not enabled, proceed
  return next();
};
