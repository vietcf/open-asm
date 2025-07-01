const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');

// GET /2fa/setup - generate secret and QR code
exports.setup = async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).send('Unauthorized');
  
  // Kiểm tra trạng thái 2FA từ database để đảm bảo tính chính xác
  const dbUser = await User.findById(user.id);
  if (!dbUser) return res.status(404).send('User not found');
  
  // Chỉ cho phép user chưa setup 2FA truy cập trang này
  if (dbUser.twofa_enabled === true) {
    // Redirect về dashboard với thông báo
    return res.redirect('/dashboard?error=2FA is already enabled for your account');
  }
  
  // Generate a new secret
  const secret = speakeasy.generateSecret({ name: 'ASG Project (' + user.username + ')' });
  // Store secret temporarily in session until verified
  req.session.tmp_twofa_secret = secret.base32;
  // Generate QR code
  const otpauth_url = secret.otpauth_url;
  const qr = await qrcode.toDataURL(otpauth_url);
  res.render('pages/2fa_setup', { qr, secret: secret.base32, error: null });
};

// POST /2fa/verify - verify OTP and enable 2FA
exports.verify = async (req, res) => {
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
    const otpauth_url = speakeasy.otpauthURL({ secret, label: 'ASG Project (' + user.username + ')', encoding: 'base32' });
    const qr = await qrcode.toDataURL(otpauth_url);
    return res.render('pages/2fa_setup', { qr, secret, error: 'Invalid OTP. Try again.' });
  }
  // Save secret to DB, enable 2FA
  await User.updateTwoFA(user.id, secret, true);
  req.session.user.twofa_enabled = true;
  req.session.user.twofa_secret = secret;
  delete req.session.tmp_twofa_secret;
  
  // Đảm bảo trạng thái đăng nhập đầy đủ
  req.session.is2faVerified = true;
  req.session.is2faPending = false;
  
  // Note: Permissions will be loaded by global middleware
  
  res.redirect('/dashboard');
};

// POST /2fa/disable - disable 2FA
exports.disable = async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).send('Unauthorized');
  await User.updateTwoFA(user.id, null, false);
  req.session.user.twofa_enabled = false;
  req.session.user.twofa_secret = null;
  res.redirect('/dashboard');
};
