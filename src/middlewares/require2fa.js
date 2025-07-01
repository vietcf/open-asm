// Middleware to require 2FA verification for users with 2FA enabled
module.exports = function require2fa(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  
  // Cho phép user must_change_password bypass 2FA requirement
  if (req.session.user.must_change_password) {
    return next();
  }
  
  // Check if user is required to use 2FA
  if (req.session.user.require_twofa) {
    // Case 1: 2FA required but not setup yet
    if (!req.session.user.twofa_enabled || !req.session.user.twofa_secret) {
      return res.redirect('/2fa/setup');
    }
    
    // Case 2: 2FA required and setup - check verification status
    if (req.session.user.twofa_enabled) {
      // Nếu đang trong quá trình 2FA (is2faPending = true)
      if (req.session.is2faPending) {
        return res.redirect('/login/2fa');
      }
      // Nếu đã verify 2FA thành công
      if (req.session.is2faVerified) {
        return next();
      } 
      // Nếu không trong pending và chưa verify → có vấn đề, reset login
      return res.redirect('/login');
    }
  }
  
  // If 2FA not required, proceed
  return next();
};
