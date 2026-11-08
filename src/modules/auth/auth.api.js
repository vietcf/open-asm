// Controller for API authentication (JWT login)
import jwt from 'jsonwebtoken';
import { verifyLocalCredentials, verifyTotp } from './auth.service.js';
import { JWT_SECRET } from '../../shared/secrets.js';
import { isLocked, recordFailure, recordSuccess } from '../../utils/loginThrottle.js';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const apiAuthController = {
  // {username, password, otp?}: an account with 2FA must send its current code
  // (otp); one that must enrol 2FA first does it in the web UI. Failed attempts
  // count towards the same lock-out as the web login.
  login: async (req, res) => {
    const { username, password, otp } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const throttleKey = `${req.ip}|${username.trim().toLowerCase()}`;
    if (isLocked(throttleKey)) return res.status(429).json({ error: 'Too many failed login attempts. Please try again later.' });
    try {
      // Also enforces is_active. API access always requires a local (bcrypt)
      // account, even if the user also has LDAP login enabled for the web UI.
      const user = await verifyLocalCredentials(username.trim(), password);
      if (user.require_twofa && !(user.twofa_enabled && user.twofa_secret)) {
        return res.status(403).json({ error: 'Two-factor authentication must be set up in the web interface before using the API.' });
      }
      if (user.twofa_enabled && user.twofa_secret) {
        const code = String(otp ?? '').replace(/\s+/g, '');
        if (!/^\d{6}$/.test(code) || !verifyTotp(user.twofa_secret, code)) {
          recordFailure(throttleKey);
          return res.status(401).json({ error: 'A valid two-factor code (otp) is required' });
        }
      }
      if (user.must_change_password) {
        return res.status(403).json({ error: 'Password change required. Please log in via the web interface to change your password before using the API.' });
      }
      recordSuccess(throttleKey);
      // The token only names the user: role and permissions are read again on
      // every request (jwtAuth.middleware.js)
      const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN });
      res.json({ token });
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'FORBIDDEN') {
        recordFailure(throttleKey);
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      console.error('API login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

export default apiAuthController;
