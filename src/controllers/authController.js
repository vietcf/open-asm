const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const { writeLog } = require('../utils/logHelper');
const config = require('../../config/config');

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

exports.getLoginPage = (req, res) => {
  const errorMessage = req.query.error || null;
      res.render('pages/login', {
          cssPath: config.cssPath,
          jsPath: config.jsPath,
          imgPath: config.imgPath,
          errorMessage
      });
}

exports.postLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findByUsername(username);
    if (!user) {
      await writeLog({ action: 'login', description: 'Login failed: invalid username or password', status: 'failed', req });
      return res.redirect('/login?error=Invalid%20username%20or%20password');
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (match) {
      req.session.isLoggedIn = true;
      // Always set session user with must_change_password
      // 1. 2FA required but not setup
      if (user.require_twofa && (!user.twofa_enabled || !user.twofa_secret)) {
        req.session.is2faPending = false;
        req.session.is2faVerified = false;
        req.session.user = buildSessionUser(user);
        //if (user.must_change_password) return res.redirect('/change-password');
        return res.redirect('/2fa/setup');
      }
      // 2. 2FA required and enabled (OTP required)
      if (user.require_twofa && user.twofa_enabled && user.twofa_secret) {
        req.session.is2faPending = true;
        req.session.is2faVerified = false;
        req.session.user = buildSessionUser(user);
        if (user.must_change_password) return res.redirect('/change-password');
        return res.redirect('/login/2fa');
      }
      // 3. No 2FA required or not enabled
      req.session.isLoggedIn = true;
      req.session.is2faVerified = true;
      req.session.is2faPending = false;
      req.session.user = buildSessionUser(user);
      if (user.must_change_password) return res.redirect('/change-password');
      // Lấy danh sách permission của user dựa vào role
      const role = await Role.findById(user.role_id);
      
      let permissions = [];
      if (role) {
        // Get permissions as objects
        permissions = await Permission.findByRoleId(role.id);
        // Map to permission names for use everywhere else
        permissions = permissions.map(p => p.name);
        // Store mapped permission names for direct session access and in user object
        req.session.permissions = permissions;
        req.session.user.permissions = permissions;
      }
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
exports.get2fa = (req, res) => {
  if (!req.session.is2faPending || !req.session.user || !req.session.user.twofa_enabled) {
    return res.redirect('/login');
  }
  res.render('pages/2fa_login', { error: null });
};

// POST /login/2fa - verify OTP
exports.post2fa = async (req, res) => {
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
    return res.render('pages/2fa_login', { error: 'Invalid code. Please try again.' });
  }
  // 2FA success: set session as fully logged in
  req.session.isLoggedIn = true;
  req.session.is2faVerified = true;
  req.session.is2faPending = false;
  // Load permissions (must do BEFORE must_change_password check)
  const role = await Role.findById(req.session.user.role_id);
  let permissions = [];
  if (role) {
    permissions = await Permission.findByRoleId(role.id);
    permissions = permissions.map(p => p.name);
  }
  req.session.permissions = permissions;
  req.session.user.permissions = permissions;
  // Always check must_change_password after 2FA and after setting permissions
  if (req.session.user.must_change_password) {
    return res.redirect('/change-password');
  }
  await writeLog({ action: '2fa', description: '2FA login successful', status: 'success', req });
  return res.redirect('/dashboard');
};

exports.logout = async (req, res) => {
  console.log('Logging out user...');
  // Lấy thông tin user trước khi xóa session
  const user = req.session && req.session.user ? req.session.user : null;
  await writeLog({
    action: 'logout',
    description: 'Logout',
    status: 'success',
    username: user ? user.username : null,
    user_id: user ? user.id : null,
    req
  });
  req.session.destroy(() => {
    res.redirect('/login');
  });
};