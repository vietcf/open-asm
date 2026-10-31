
import Role from '../models/Role.js';
import { writeLog } from '../utils/logHelper.js';
import { config } from '../../config/config.js';
import { verifyCredentials, verifyTotp } from '../services/authService.js';
import { applyUserLanguage } from '../middlewares/i18n.middleware.js';
import { isLocked, recordFailure, recordSuccess } from '../utils/loginThrottle.js';

const MAX_OTP_FAILURES = 5;

// New session id on login (prevents session fixation); keeps the UI language.
function regenerateSession(req) {
  const lang = req.session.lang;
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      if (lang) req.session.lang = lang;
      resolve();
    });
  });
}

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
    must_change_password: user.must_change_password,
    auth_source: user.auth_source,
    language: user.language || null
  };
}

export const getLoginPage = (req, res) => {
  const errorMessage = req.query.error || null;
  const successMessage = req.query.success || null;
  res.render('pages/login', {
    errorMessage,
    successMessage,
    ldapEnabled: process.env.LDAP_ENABLED === 'true',
    selectedMethod: req.query.method === 'ldap' ? 'ldap' : 'local',
    layout: false // Disable layout for login page
  });
}

export const postLogin = async (req, res) => {
  // Normalize username only
  let { username, password } = req.body;
  // The LDAP/Local toggle on the login page is cosmetic (the server always
  // authenticates against the account's real auth_source), but on a failed
  // login we still redirect back to /login — without this, the toggle would
  // silently reset to "Local" even though the user picked LDAP, which reads
  // as if their choice was ignored.
  const methodSuffix = req.body.loginMethod === 'ldap' ? '&method=ldap' : '';
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password.trim()) {
    await writeLog({ action: 'login', description: 'Login failed: missing username or password', status: 'failed', req });
    return res.redirect(`/login?error=Please%20enter%20both%20username%20and%20password${methodSuffix}`);
  }
  username = username.trim().toLowerCase();
  const throttleKey = `${req.ip}|${username}`;
  if (isLocked(throttleKey)) {
    await writeLog({ action: 'login', description: 'Login blocked: too many failed attempts', status: 'failed', req });
    return res.redirect(`/login?error=Too%20many%20failed%20login%20attempts.%20Please%20try%20again%20later.${methodSuffix}`);
  }
  try {
    const user = await verifyCredentials(username, password);
    recordSuccess(throttleKey);

    await regenerateSession(req);
    req.session.isLoggedIn = true; // password accepted (2FA may still be pending)
    req.session.user = buildSessionUser(user); // Only store user info, not permissions
    await applyUserLanguage(req, user);
    req.session.is2faVerified = true;
    req.session.is2faPending = false;

    // 2FA comes first: until it is completed, requireLogin only allows the
    // 2FA pages (see requireLogin.middleware.js).
    // 1. 2FA required but not set up yet -> enrolment
    if (user.require_twofa && !(user.twofa_enabled && user.twofa_secret)) {
      req.session.is2faPending = true;
      req.session.is2faVerified = false;
      return res.redirect('/2fa/setup');
    }

    // 2. 2FA enabled -> OTP required
    if (user.twofa_enabled && user.twofa_secret) {
      req.session.is2faPending = true;
      req.session.is2faVerified = false;
      return res.redirect('/login/2fa');
    }

    // 3. Forced password change (requirePasswordChange redirects everywhere else)
    if (user.must_change_password) {
      return res.redirect('/change-password');
    }

    // 3. No 2FA required - permissions loaded by global middleware
    await writeLog({ action: 'login', description: 'Login successful', status: 'success', req });
    return res.redirect('/dashboard');
  } catch (err) {
    if (err.code === 'UNAUTHORIZED') {
      recordFailure(throttleKey);
      await writeLog({ action: 'login', description: 'Login failed: invalid username or password', status: 'failed', req });
      return res.redirect(`/login?error=Invalid%20username%20or%20password${methodSuffix}`);
    }
    if (err.code === 'FORBIDDEN') {
      await writeLog({ action: 'login', description: 'Login failed: account is inactive', status: 'failed', req });
      return res.redirect(`/login?error=Account%20is%20inactive${methodSuffix}`);
    }
    if (err.code === 'SERVICE_UNAVAILABLE') {
      // Log the real cause server-side (ECONNREFUSED, TLS failure, timeout,
      // etc.) — the user-facing message stays generic on purpose.
      console.error('LDAP authentication server unavailable:', err.details ? err.details.message : err.message);
      await writeLog({ action: 'login', description: 'Login failed: LDAP server unavailable', status: 'failed', req });
      return res.redirect(`/login?error=Authentication%20server%20is%20temporarily%20unavailable.%20Please%20try%20again%20later.${methodSuffix}`);
    }
    console.error('Login error:', err);
    await writeLog({ action: 'login', description: 'Login failed: server error', status: 'failed', req });
    res.redirect(`/login?error=Server%20error${methodSuffix}`);
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
    // Not in the OTP step: reset and require a fresh login
    req.session.isLoggedIn = false;
    req.session.is2faVerified = false;
    req.session.is2faPending = false;
    return res.redirect('/login');
  }
  const token = String(req.body.token || '').replace(/\s+/g, '');
  const secret = req.session.user.twofa_secret;
  const verified = /^\d{6}$/.test(token) && verifyTotp(secret, token);
  if (!verified) {
    req.session.otpFailures = (req.session.otpFailures || 0) + 1;
    await writeLog({ action: '2fa', description: '2FA code rejected', status: 'failed', req });
    if (req.session.otpFailures >= MAX_OTP_FAILURES) {
      return req.session.destroy(() => {
        res.redirect('/login?error=Too%20many%20invalid%20codes.%20Please%20log%20in%20again.');
      });
    }
    return res.render('pages/2fa_login', { error: 'Invalid code. Please try again.', layout: false }); // Disable layout for 2FA page
  }
  delete req.session.otpFailures;
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
  // Read the user info before destroying the session
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