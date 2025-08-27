import express from 'express';
import systemController from '../controllers/systemController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';
import createUploadMiddleware from '../middlewares/fileUpload.middleware.js';
const uploadSystemDocs = createUploadMiddleware({ fieldName: 'docs[]', folder: 'system' });

const router = express.Router();

// ====== SYSTEM MENU ======
// System list page (DB)
router.get('/system', requirePermission('system.read'), systemController.listSystem);

// Add system
router.get('/system/add', requirePermission('system.create'), systemController.addSystemForm); //Load form add system
router.post('/system/add', requirePermission('system.create'), uploadSystemDocs, systemController.addSystem); //Process form add system

// Edit system 
router.get('/system/:id/edit', requirePermission('system.update'), systemController.editSystemForm); //Load form edit system
router.post('/system/:id/edit', requirePermission('system.update'), uploadSystemDocs, systemController.updateSystem); //Process form edit system 

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
// API: System search for select2 ajax (system dropdown)
router.get('/api/system', systemController.apiSystemSearch);
// API: Get all components of a system (for AJAX in system detail)
router.get('/api/system/:id/components', requirePermission('system.read'), systemController.apiSystemComponents);

export default router;
