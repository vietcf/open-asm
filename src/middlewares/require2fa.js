// Middleware to require 2FA verification for users with 2FA enabled
// NOTE: This middleware assumes user is already logged in (requireLogin middleware)
module.exports = function require2fa(req, res, next) {
  // Bypass 2FA requirement for 2FA management routes
  // This prevents infinite loops when user needs to setup/verify 2FA
  if (req.path.startsWith('/2fa/')) {
    return next();
  }
  
  // Bypass 2FA requirement for users who must change password
  // Security: Force password change takes priority over 2FA
  if (req.session.user.must_change_password) {
    return next();
  }
  
  // If user is NOT required to use 2FA, proceed
  if (!req.session.user.require_twofa) {
    return next();
  }
  
  // From here: user IS required to use 2FA
  
  // Case 1: 2FA required but not properly setup
  // Check if 2FA is truly functional (both enabled AND has secret)
  if (!req.session.user.twofa_enabled || !req.session.user.twofa_secret) {
    return res.redirect('/2fa/setup');
  }
  
  // Case 2: 2FA is properly setup -> Check verification status
  
  // If currently in 2FA verification process
  if (req.session.is2faPending) {
    return res.redirect('/login/2fa');
  }
  
  // If 2FA verification completed successfully
  if (req.session.is2faVerified) {
    return next();
  }
  
  // If 2FA enabled but not verified and not pending -> session issue
  // This could happen if session data is corrupted or incomplete
  console.error('2FA session state error:', {
    user: req.session.user.username,
    twofa_enabled: req.session.user.twofa_enabled,
    twofa_secret: req.session.user.twofa_secret ? 'present' : 'missing',
    is2faPending: req.session.is2faPending,
    is2faVerified: req.session.is2faVerified
  });
  
  // Force re-login for security
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.redirect('/login');
  });
};
