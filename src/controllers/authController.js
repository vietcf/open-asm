
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import { writeLog } from '../utils/logHelper.js';
import { config } from '../../config/config.js';

// Helper function to build user session object (no permissions)
function buildSessionUser(user) {
  return {
    id: user.id,
    username: user.username,
    fullname: user.fullname,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
    twofa_enabled: user.twofa_enabled,
    twofa_secret: user.twofa_secret,
    require_twofa: user.require_twofa,
    must_change_password: user.must_change_password
  };
}

export const getLoginPage = (req, res) => {
  const errorMessage = req.query.error || null;
  res.render('pages/login', {
    errorMessage,
    layout: false // Disable layout for login page
  });
}

export const postLogin = async (req, res) => {
  // Normalize username only
  let { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    await writeLog({ action: 'login', description: 'Login failed: invalid input', status: 'failed', req });
    return res.redirect('/login?error=Invalid%20input');
  }
  username = username.trim().toLowerCase();
  try {
    const user = await User.findByUsername(username);
    if (!user) {
      await writeLog({ action: 'login', description: 'Login failed: invalid username or password', status: 'failed', req });
      return res.redirect('/login?error=Invalid%20username%20or%20password');
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (match) {
      req.session.isLoggedIn = true; // Logined username and password successfully
      req.session.user = buildSessionUser(user); // Only store user info, not permissions


      // Set default 2FA state
      req.session.is2faVerified = true; //Mac dinh da duoc verify 2FA
      req.session.is2faPending = false; //Mac dinh khong pending 2FA Verify


      // If required, check must_change_password
      if (user.must_change_password) {
        return res.redirect('/change-password');
      }

      // 1. 2FA required but not setup
      if (user.require_twofa && !user.twofa_enabled) {
        req.session.is2faPending = true;
        req.session.is2faVerified = false; // Override default
        return res.redirect('/2fa/setup');
      }

      // 2. 2FA required and enabled (OTP required)
      if (user.require_twofa && user.twofa_enabled && user.twofa_secret) {
        req.session.is2faPending = true;   // Override default
        req.session.is2faVerified = false; // Override default
        return res.redirect('/login/2fa');
      }

      // 3. No 2FA required - permissions loaded by global middleware
      await writeLog({ action: 'login', description: 'Login successful', status: 'success', req });
      return res.redirect('/dashboard');
    }
    await writeLog({ action: 'login', description: 'Login failed: invalid username or password', status: 'failed', req });
    res.redirect('/login?error=Invalid%20username%20or%20password');
  } catch (err) {
    console.error('Login error:', err);
    await writeLog({ action: 'login', description: 'Login failed: server error', status: 'failed', req });
    res.redirect('/login?error=Server%20error');
  }
};

// GET /login/2fa - render OTP entry page
export const get2fa = (req, res) => {
  if (!req.session.is2faPending || !req.session.user || !req.session.user.twofa_enabled) {
    return res.redirect('/login');
  }
  res.render('pages/2fa_login', { error: null, layout: false }); // Disable layout for 2FA page
};

// POST /login/2fa - verify OTP
export const post2fa = async (req, res) => {
  if (!req.session.is2faPending || !req.session.user || !req.session.user.twofa_enabled) {
    // Đảm bảo khi xác thực OTP thành công, session phải được set lại đúng trạng thái đăng nhập
    req.session.isLoggedIn = false;
    req.session.is2faVerified = false;
    req.session.is2faPending = false;
    return res.redirect('/login');
  }
  const { token } = req.body;
  const secret = req.session.user.twofa_secret;
  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token
  });
  if (!verified) {
    return res.render('pages/2fa_login', { error: 'Invalid code. Please try again.', layout: false }); // Disable layout for 2FA page
  }
  // 2FA success: set session as fully logged in
  req.session.isLoggedIn = true;
  req.session.is2faVerified = true;
  req.session.is2faPending = false;
  
  // Note: Permissions will be loaded by global middleware
  
  // Always check must_change_password after 2FA
  if (req.session.user.must_change_password) {
    return res.redirect('/change-password');
  }
  await writeLog({ action: '2fa', description: '2FA login successful', status: 'success', req });
  return res.redirect('/dashboard');
};

export const logout = async (req, res) => {
  // Lấy thông tin user trước khi xóa session
  const user = req.session && req.session.user ? req.session.user : null;
  await writeLog({
    action: 'logout',
    description: 'Logout',
    status: 'success',
    req
  });
  req.session.destroy(() => {
    res.redirect('/login');
  });
};