import express from 'express';
import systemController from '../controllers/systemController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';
import createUploadMiddleware from '../middlewares/fileUpload.middleware.js';
const uploadSystemDocs = createUploadMiddleware({ fieldName: 'docs[]', folder: 'system' });

const router = express.Router();

// Wrap the upload middleware so rejected file types / oversized files come
// back as a flash message on the form instead of an unhandled multer error
// (there's no global Express error handler in this app).
function safeUploadSystemDocs(redirectTo) {
  return (req, res, next) => {
    uploadSystemDocs(req, res, (err) => {
      if (err) {
        req.flash('error', err.message || 'File upload error');
        return res.redirect(redirectTo(req));
      }
      next();
    });
  };
}

// ====== SYSTEM MENU ======
// System list page (DB)
router.get('/system', requirePermission('system.read'), systemController.listSystem);
// Export system list as Excel (filtered)
router.get('/system/export', requirePermission('system.read'), systemController.exportSystemList);

// Add system
router.get('/system/add', requirePermission('system.create'), systemController.addSystemForm); //Load form add system
router.post('/system/add', requirePermission('system.create'), safeUploadSystemDocs(() => '/system/add'), systemController.addSystem); //Process form add system

// Edit system
router.get('/system/:id/edit', requirePermission('system.update'), systemController.editSystemForm); //Load form edit system
router.post('/system/:id/edit', requirePermission('system.update'), safeUploadSystemDocs(req => `/system/${req.params.id}/edit`), systemController.updateSystem); //Process form edit system

// Delete system
router.post('/system/:id/delete', requirePermission('system.delete'), systemController.deleteSystem);

// ====== SYSTEM COMPONENT MENU ======
// List components
router.get('/component', requirePermission('system.read'), systemController.listSystemComponent);
// Add component
router.get('/component/add', requirePermission('system.create'), systemController.addSystemComponentForm);
// If you want to support file upload for component, add upload middleware here
router.post('/component/add', requirePermission('system.create'), systemController.addSystemComponent);
// Edit component
router.get('/component/:id/edit', requirePermission('system.update'), systemController.editSystemComponentForm);
router.post('/component/:id/edit', requirePermission('system.update'), systemController.updateSystemComponent);
// Delete component
router.post('/component/:id/delete', requirePermission('system.delete'), systemController.deleteSystemComponent);

// ====== AJAX API ======
// API: System search for select2 ajax (system dropdown). No permission
// gate — consistent with every other cross-module select2 lookup API
// (/api/server, /api/device, /api/contact, /api/tag, ...), which are all
// reference-lookups open to any authenticated user, not just system.read.
router.get('/api/system', systemController.apiSystemSearch);
// API: Get all components of a system (for AJAX in system detail)
router.get('/api/system/:id/components', requirePermission('system.read'), systemController.apiSystemComponents);

// View an attached system file inline (opens in a new tab) instead of the
// forced download every /uploads/* file gets from the global static route.
router.get('/file/:id/view', requirePermission('system.read'), systemController.viewSystemFile);

export default router;
