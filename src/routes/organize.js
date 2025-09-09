import express from 'express';
import organizeController from '../controllers/organizeController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';

const router = express.Router();

// Contact Management
router.get('/contact', requirePermission('contact.read'), organizeController.contactList);
router.post('/contact', requirePermission('contact.create'), organizeController.createContact);
router.put('/contact/:id', requirePermission('contact.update'), organizeController.updateContact);
router.delete('/contact/:id', requirePermission('contact.delete'), organizeController.deleteContact);

// Organization Unit Management
router.get('/unit', requirePermission('unit.read'), organizeController.unitList);
router.post('/unit', requirePermission('unit.create'), organizeController.createUnit);
router.put('/unit/:id', requirePermission('unit.update'), organizeController.updateUnit);
router.delete('/unit/:id', requirePermission('unit.delete'), organizeController.deleteUnit);

// Tag Management
router.get('/tag', requirePermission('tag.read'), organizeController.tagList);
router.post('/tag', requirePermission('tag.create'), organizeController.createTag);
router.put('/tag/:id', requirePermission('tag.update'), organizeController.updateTag);
router.delete('/tag/:id', requirePermission('tag.delete'), organizeController.deleteTag);

// ====== API AJAX SEARCH ======
router.get('/api/contact', organizeController.apiContactSearch);
router.get('/api/contact/ids', organizeController.apiContactByIds);
router.get('/api/tag',organizeController.apiTagSearch);
router.get('/api/tag/ids', organizeController.apiTagByIds);
router.get('/api/unit', organizeController.apiUnitSearch);
router.get('/api/contact/:id/qrcode', organizeController.apiContactQrVcard);



export default router;
