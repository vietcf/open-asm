import express from 'express';
import organizeController from '../controllers/organizeController.js';
import checkPermission from '../middlewares/requirePermission.middleware.js';

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
router.get('/tag', checkPermission('read', 'tag'), organizeController.tagList);
// Create a new tag
router.post('/tag', checkPermission('create', 'tag'), organizeController.createTag);
// Update an existing tag
router.put('/tag/:id', checkPermission('update', 'tag'), organizeController.updateTag);
// Delete a tag
router.delete('/tag/:id', checkPermission('delete', 'tag'), organizeController.deleteTag);

// ====== API AJAX SEARCH ======
router.get('/api/contact', organizeController.apiContactSearch);
router.get('/api/tag',organizeController.apiTagSearch);
router.get('/api/unit', organizeController.apiUnitSearch);
router.get('/api/contact/:id/qrcode', organizeController.apiContactQrVcard);


export default router;
