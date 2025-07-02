const bcrypt = require('bcrypt');
const User = require('../models/User');

// GET change password page
exports.getChangePassword = (req, res) => {
  res.render('layouts/layout', {
    cssPath: req.app.get('cssPath') || '/css/',
    jsPath: req.app.get('jsPath') || '/js/',
    imgPath: req.app.get('imgPath') || '/images/',
    title: 'Change Password',
    user: req.session.user,
    body: require('ejs').render(
      require('fs').readFileSync(require('path').join(__dirname, '../../public/html/pages/change_password.ejs'), 'utf8'),
      {
        error: null,
        success: null,
        user: req.session.user
      }
    ),
    activeMenu: '', // Fix for sidebar.ejs expecting activeMenu
    permissions: req.session.permissions || [], // Fix for sidebar.ejs expecting permissions
    siteName: typeof req.app.locals.siteName !== 'undefined' ? req.app.locals.siteName : ''
  });
};

// POST change password
exports.postChangePassword = async (req, res) => {
  const userId = req.session.user && req.session.user.id;
  if (!userId) {
    return res.redirect('/login');
  }
  const { currentPassword, newPassword, confirmPassword } = req.body;
  let error = null;
  let success = null;
  // Password validation rules
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!currentPassword || !newPassword || !confirmPassword) {
    error = 'Please enter all required information.';
  } else if (newPassword !== confirmPassword) {
    error = 'The new password and confirmation do not match.';
  } else if (newPassword === currentPassword) {
    error = 'The new password must not be the same as the current password.';
  } else if (!passwordRegex.test(newPassword)) {
    error = 'The new password must be at least 8 characters and include uppercase, lowercase, and a number.';
  }
  if (!error) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.redirect('/login');
      }
      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) {
        error = 'The current password is incorrect.';
      } else {
        // Prevent new password from being the same as the old password (hash check)
        const isSameHash = await bcrypt.compare(newPassword, user.password_hash);
        if (isSameHash) {
          error = 'The new password must not be the same as the current password.';
        } else {
          const newHash = await bcrypt.hash(newPassword, 10);
          await User.updatePassword(userId, newHash);
          success = 'Password changed successfully!';
          // If user was required to change password, clear the flag after success
          if (user.must_change_password) {
            await User.updateMustChangePassword(userId, false);
            req.session.user.must_change_password = false;
          }
          // Logout user after password change and require re-login
          req.session.destroy(() => {
            res.redirect('/login?success=Password%20changed%20successfully.%20Please%20login%20again.');
          });
          return;
        }
      }
    } catch (err) {
      error = 'An error occurred. Please try again.';
    }
  }
  res.render('layouts/layout', {
    cssPath: req.app.get('cssPath') || '/css/',
    jsPath: req.app.get('jsPath') || '/js/',
    imgPath: req.app.get('imgPath') || '/images/',
    title: 'Change Password',
    user: req.session.user,
    body: require('ejs').render(
      require('fs').readFileSync(require('path').join(__dirname, '../../public/html/pages/change_password.ejs'), 'utf8'),
      {
        error,
        success,
        user: req.session.user
      }
    ),
    activeMenu: '', // Fix for sidebar.ejs expecting activeMenu
    permissions: req.session.permissions || [], // Fix for sidebar.ejs expecting permissions
    siteName: typeof req.app.locals.siteName !== 'undefined' ? req.app.locals.siteName : ''
  });
};
