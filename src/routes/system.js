
import express from 'express';
import systemController from '../controllers/systemController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';
import createUploadMiddleware from '../middlewares/fileUpload.middleware.js';
const uploadSystemDocs = createUploadMiddleware({ fieldName: 'docs[]', folder: 'system' });

const router = express.Router();


// ====== SYSTEM MENU ======
// System list page (DB)
router.get('/system', requirePermission('read', 'system'), systemController.listSystem);

// Add system
router.get('/system/add', requirePermission('create', 'system'), systemController.addSystemForm);
router.post('/system/add', requirePermission('create', 'system'), uploadSystemDocs, systemController.addSystem);

// Edit system 
router.get('/system/:id/edit', requirePermission('update', 'system'), systemController.editSystemForm);
router.post('/system/:id/edit', requirePermission('update', 'system'), uploadSystemDocs, systemController.updateSystem);

// Delete system
router.post('/system/:id/delete', requirePermission('delete', 'system'), systemController.deleteSystem);


// ====== AJAX API ======
// API: System search for select2 ajax (system dropdown)
router.get('/api/system', systemController.apiSystemSearch);


export default router;
