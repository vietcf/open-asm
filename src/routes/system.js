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


// ====== AJAX API ======
// API: System search for select2 ajax (system dropdown)
router.get('/api/system', systemController.apiSystemSearch);


export default router;
