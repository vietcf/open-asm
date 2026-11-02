// Controller for API authentication (JWT login)
import jwt from 'jsonwebtoken';
import { verifyLocalCredentials, getUserPermissions } from './auth.service.js';
const JWT_SECRET = process.env.JWT_SECRET || 'VcB_your_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const apiAuthController = {
  login: async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }
      // Also enforces is_active, unlike the previous inline check here — an
      // inactive user's login now correctly fails instead of issuing a token.
      // API access always requires a local (bcrypt) account, even if the user
      // also has LDAP login enabled for the web UI.
      const user = await verifyLocalCredentials(username, password);
      if (user.must_change_password) {
        return res.status(403).json({ error: 'Password change required. Please log in via the web interface to change your password before using the API.' });
      }
      const permissions = await getUserPermissions(user.role_id);
      // Build JWT payload (include permissions)
      const payload = {
        sub: user.id,
        username: user.username,
        role: user.role_name || user.role,
        role_id: user.role_id || null,
        allowed_ips: user.allowed_ips || null,
        permissions
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.json({ token });
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'FORBIDDEN') {
        return res.status(401).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  }
};

export default apiAuthController;
