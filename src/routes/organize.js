const express = require('express');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const config = require('../../config/config');
const organizeController = require('../controllers/organizeController');
const checkPermission = require('../middlewares/checkPermission');
const requireLogin = require('../middlewares/requireLogin');
const require2fa = require('../middlewares/require2fa');

const router = express.Router();


// ====== CONTAC MENU ======
// Contact List page
router.get('/contact', checkPermission('read', 'contact'), organizeController.contactList);
// Create a new contact
router.post('/contact', checkPermission('create', 'contact'), organizeController.createContact);
// Update an existing contact
router.put('/contact/:id', checkPermission('update', 'contact'), organizeController.updateContact);
// Delete a contact
router.delete('/contact/:id', checkPermission('delete', 'contact'), organizeController.deleteContact);



// ====== UNIT MENU ======
// Organization Unit List page
router.get('/unit', checkPermission('read', 'unit'), organizeController.unitList);
// Create a new unit
router.post('/unit', checkPermission('create', 'unit'), organizeController.createUnit);
// Update an existing unit
router.put('/unit/:id', checkPermission('update', 'unit'), organizeController.updateUnit);
// Delete a unit
router.delete('/unit/:id', checkPermission('delete', 'unit'), organizeController.deleteUnit);


// ====== TAG MENU ======
// Tag List page
router.get('/tag', requireLogin, require2fa, checkPermission('read', 'tag'), organizeController.tagList);
// Create a new tag
router.post('/tag', checkPermission('create', 'tag'), organizeController.createTag);
// Update an existing tag
router.put('/tag/:id', checkPermission('update', 'tag'), organizeController.updateTag);
// Delete a tag
router.delete('/tag/:id', checkPermission('delete', 'tag'), organizeController.deleteTag);

// ====== API AJAX SEARCH ======

// API: Contact search for select2 ajax (manager dropdown)
// AJAX API for select2 Contacts dropdown in Privileged Account List
// Used by /public/html/pages/privilege/priv_account_list.ejs
// Example request: /organize/api/contact?search=abc
// (Ensure this returns [{id, text}] for select2)
router.get('/api/contact', organizeController.apiContactSearch);

// API: Serve contact image as base64 (AJAX for modal)
//router.get('/api/contact/:id/image', organizeController.apiContactImage);

// API: Tag search for select2 ajax (used in system add/edit, ip address add/edit, server add/edit)
// Permissions to access this API:
// - tag.read: View tag list (e.g. for read-only or tag selection screens)
// - system.create, system.update: When creating/updating a system, tags can be selected
// - ip_address.create, ip_address.update: When creating/updating an IP address, tags can be selected
// - server.create, server.update: When creating/updating a server, tags can be selected
router.get('/api/tag',organizeController.apiTagSearch);

// API: Unit search for select2 ajax (used in contact add/edit)
// AJAX API for select2 Organize (unit) dropdown in Privileged Account List
// Used by /public/html/pages/privilege/priv_account_list.ejs
// Example request: /organize/api/unit?search=abc
// (Ensure this returns [{id, text}] for select2)
router.get('/api/unit', organizeController.apiUnitSearch);

// API: Serve contact QR vCard as base64 PNG (AJAX for modal)
router.get('/api/contact/:id/qrcode', organizeController.apiContactQrVcard);

module.exports = router;
