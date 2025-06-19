const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', authController.getLoginPage); // Render login page
router.post('/login', authController.postLogin);   // Handle login submission
router.get('/login/2fa', authController.get2fa);   // Render 2FA page
router.post('/login/2fa', authController.post2fa); // Handle 2FA submission
router.get('/logout', authController.logout);

module.exports = router;
