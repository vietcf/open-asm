// Web routes of the Organize module (contacts, units, tags), mounted at /organize.
import express from 'express';
import contacts, { contactImport } from './contact.controller.js';
import units from './unit.controller.js';
import tags from './tag.controller.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import excelUpload from '../../middlewares/excelUpload.middleware.js';

const router = express.Router();
const can = requirePermission;

// Contacts
router.get('/contact', can('contact.read'), contacts.list);
router.get('/contact/export', can('contact.read'), contacts.export);
router.get('/contact/template', can('contact.create'), contactImport.template);
router.post('/contact/validate-import', can('contact.create'), excelUpload, contactImport.validate);
router.post('/contact/import', can('contact.create'), excelUpload, contactImport.import);
router.get('/download/contact-validation/:filename', can('contact.read'), contactImport.download);
router.get('/contact/add', can('contact.create'), contacts.addForm);
router.post('/contact/add', can('contact.create'), contacts.create);
router.get('/contact/:id/edit', can('contact.update'), contacts.editForm);
router.post('/contact/:id/edit', can('contact.update'), contacts.update);
router.post('/contact/:id/delete', can('contact.delete'), contacts.remove);

// Units
router.get('/unit', can('unit.read'), units.list);
router.get('/unit/export', can('unit.read'), units.export);
router.get('/unit/add', can('unit.create'), units.addForm);
router.post('/unit/add', can('unit.create'), units.create);
router.get('/unit/:id/edit', can('unit.update'), units.editForm);
router.post('/unit/:id/edit', can('unit.update'), units.update);
router.post('/unit/:id/delete', can('unit.delete'), units.remove);

// Tags
router.get('/tag', can('tag.read'), tags.list);
router.get('/tag/export', can('tag.read'), tags.export);
router.get('/tag/add', can('tag.create'), tags.addForm);
router.post('/tag/add', can('tag.create'), tags.create);
router.get('/tag/:id/edit', can('tag.update'), tags.editForm);
router.post('/tag/:id/edit', can('tag.update'), tags.update);
router.post('/tag/:id/delete', can('tag.delete'), tags.remove);

// AJAX lookups, open to any signed-in user (pickers on other modules' forms)
router.get('/api/contact', contacts.lookup);
router.get('/api/contact/ids', contacts.lookupByIds);
router.get('/api/contact/:id/qrcode', contacts.qrcode);
router.get('/api/unit', units.lookup);
router.get('/api/unit/ids', units.lookupByIds);
router.get('/api/unit/:id/detail', units.detail);
router.get('/api/tag', tags.lookup);
router.get('/api/tag/ids', tags.lookupByIds);

export default router;
