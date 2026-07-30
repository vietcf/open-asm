// Destroys the session if the user hasn't made a request in over the
// configured idle window, instead of relying on the cookie's own maxAge.
import { siteConfig } from '../utils/siteConfig.js';

function sessionIdleTimeout(req, res, next) {
  if (!req.session || !req.session.isLoggedIn) {
    return next();
  }

  const timeoutMinutes = siteConfig.getSessionIdleTimeoutMinutes();
  if (!timeoutMinutes || timeoutMinutes <= 0) {
    return next();
  }

  const now = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;

  if (req.session.lastActivity && now - req.session.lastActivity > timeoutMs) {
    return req.session.destroy(() => {
      res.redirect('/login?error=Session%20expired%20due%20to%20inactivity');
    });
  }

  req.session.lastActivity = now;
  next();
}

export default sessionIdleTimeout;
