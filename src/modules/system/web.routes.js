// Web routes of the System module, mounted at /system.
import express from 'express';
import systems from './system.controller.js';
import components from './component.controller.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import createUploadMiddleware from '../../middlewares/fileUpload.middleware.js';

const router = express.Router();
const can = requirePermission;

// Rejected file types / sizes come back as a flash message on the form.
const uploadDocs = createUploadMiddleware({ fieldName: 'docs[]', folder: 'system' });
const withUploads = (backTo) => (req, res, next) => uploadDocs(req, res, (err) => {
  if (!err) return next();
  req.flash('error', err.message || 'File upload error');
  res.redirect(backTo(req));
});

// Systems
router.get('/system', can('system.read'), systems.list);
router.get('/system/export', can('system.read'), systems.export);
router.get('/system/add', can('system.create'), systems.addForm);
router.post('/system/add', can('system.create'), withUploads(() => '/system/system/add'), systems.create);
router.get('/system/:id/edit', can('system.update'), systems.editForm);
router.post('/system/:id/edit', can('system.update'), withUploads((req) => `/system/system/${req.params.id}/edit`), systems.update);
router.post('/system/:id/delete', can('system.delete'), systems.remove);
router.get('/file/:id/view', can('system.read'), systems.viewFile);

// Components
router.get('/component', can('system.read'), components.list);
router.get('/component/export', can('system.read'), components.export);
router.get('/component/add', can('system.create'), components.addForm);
router.post('/component/add', can('system.create'), components.create);
router.get('/component/:id/edit', can('system.update'), components.editForm);
router.post('/component/:id/edit', can('system.update'), components.update);
router.post('/component/:id/delete', can('system.delete'), components.remove);

// AJAX. Select2 lookups are open to any signed-in user, like the other modules'.
router.get('/api/system', systems.lookup);
router.get('/api/component', components.lookup);
router.get('/api/system/:id/components', can('system.read'), systems.components);

export default router;
