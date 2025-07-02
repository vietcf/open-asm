const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const config = require('../../config/config');
const systemController = require('../controllers/systemController');
const checkPermission = require('../middlewares/checkPermission');
const createUploadMiddleware = require('../middlewares/fileUpload');
const uploadSystemDocs = createUploadMiddleware({ fieldName: 'docs[]', folder: 'system' });
const requireLogin = require('../middlewares/requireLogin');
const require2fa = require('../middlewares/require2fa');

// ====== SYSTEM MENU ======
// System list page (DB)
router.get('/system', checkPermission('read', 'system'), systemController.listSystem);

// Add system
router.get('/system/add', checkPermission('create', 'system'), systemController.addSystemForm);
router.post('/system/add', checkPermission('create', 'system'), uploadSystemDocs, systemController.addSystem);

// Edit system 
router.get('/system/:id/edit', checkPermission('update', 'system'), systemController.editSystemForm);
router.post('/system/:id/edit', checkPermission('update', 'system'), uploadSystemDocs, systemController.updateSystem);

// Delete system
router.post('/system/:id/delete', checkPermission('delete', 'system'), systemController.deleteSystem);

// ====== AJAX API ======

// AJAX API for select2 System(s) dropdown in Privileged Account List
// Used by /public/html/pages/privilege/priv_account_list.ejs
// Example request: /system/api/system?search=abc
// (Ensure this returns [{id, text}] for select2)
// API: System search for select2 ajax (system dropdown)
// Call from select2 in IPaddress add/edit 
router.get('/api/system', systemController.apiSystemSearch);

// ...add more system management routes as needed...

module.exports = router;
