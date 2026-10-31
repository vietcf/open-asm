import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import User from '../models/User.js';
import { siteConfig } from '../utils/siteConfig.js';

// Issuer shown in authenticator apps
const issuer = () => siteConfig.getSiteName() || 'Open ASM';

const twofaController = {};

// GET /2fa/setup - generate secret and QR code
twofaController.setup = async (req, res) => {
  const user = req.session.user;
  // if (!user) return res.status(401).send('Unauthorized');
  // Only users without a completed 2FA setup may access this page
  if (user.twofa_enabled === true && user.twofa_secret) {
    // 2FA fully set up and verified -> go to the dashboard
    if (req.session.is2faVerified) {
      return res.redirect('/dashboard?info=2FA is already enabled and verified');
    }
    // Set up but not verified yet -> go to login/2fa to verify
    return res.redirect('/login/2fa?info=Please verify your 2FA code');
  }
  // Generate a new secret
  const secret = speakeasy.generateSecret({ name: `${issuer()} (${user.username})` });
  // Store secret temporarily in session until verified
  req.session.tmp_twofa_secret = secret.base32;
  // Generate QR code
  const otpauth_url = secret.otpauth_url;
  const qr = await qrcode.toDataURL(otpauth_url);
  res.render('pages/2fa_setup', { 
    qr, 
    secret: secret.base32, 
    error: null,
    title: '2FA Setup',
    activeMenu: '2fa',
    layout: false // Render without main layout, only show QR and OTP info
  });
};

// POST /2fa/verify - verify OTP and enable 2FA
twofaController.verify = async (req, res) => {
  const user = req.session.user;
  const { token } = req.body;
  const secret = req.session.tmp_twofa_secret;
  if (!user || !secret) return res.status(400).send('Missing data');
  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token
  });
  if (!verified) {
    // regenerate QR code for the same secret
    const otpauth_url = speakeasy.otpauthURL({ secret, label: `${issuer()} (${user.username})`, encoding: 'base32' });
    const qr = await qrcode.toDataURL(otpauth_url);
    return res.render('pages/2fa_setup', { 
      qr, 
      secret, 
      error: 'Invalid OTP. Try again.',
      title: '2FA Setup',
      activeMenu: '2fa',
      layout: false // Render without main layout, only show QR and OTP info
    });
  }
  // Save secret to DB, enable 2FA
  await User.updateTwoFA(user.id, secret, true);
  req.session.user.twofa_enabled = true;
  req.session.user.twofa_secret = secret;
  delete req.session.tmp_twofa_secret;
  // Make sure the session is marked as fully logged in
  req.session.is2faVerified = true;
  req.session.is2faPending = false;
  // Note: Permissions will be loaded by global middleware
  res.redirect('/dashboard');
};

// POST /2fa/disable - disable 2FA
twofaController.disable = async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).send('Unauthorized');
  // Disabling 2FA requires a valid current code, and is not allowed when an
  // administrator requires 2FA for this account.
  if (user.require_twofa) {
    req.flash('error', 'Two-factor authentication is required for your account and cannot be disabled.');
    return res.redirect('/dashboard');
  }
  const token = String(req.body.token || '').replace(/\s+/g, '');
  if (!user.twofa_secret || !/^\d{6}$/.test(token) ||
      !speakeasy.totp.verify({ secret: user.twofa_secret, encoding: 'base32', token })) {
    req.flash('error', 'Invalid code. Please try again.');
    return res.redirect('/dashboard');
  }
  await User.updateTwoFA(user.id, null, false);
  req.session.user.twofa_enabled = false;
  req.session.user.twofa_secret = null;
  res.redirect('/dashboard');
};

export default twofaController;
