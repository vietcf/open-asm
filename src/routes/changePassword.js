const express = require('express');
const router = express.Router();
const changePasswordController = require('../controllers/changePasswordController');

// GET /change-password - Show change password form
router.get('/', changePasswordController.getChangePassword);

// POST /change-password - Process password change
router.post('/', changePasswordController.postChangePassword);

module.exports = router;
