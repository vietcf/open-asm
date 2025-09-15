import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import serverController from '../controllers/serverController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';

// Configure multer for file uploads
const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(process.cwd(), uploadsDir, 'import');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});


const router = express.Router();

// ====== SERVER MENU ======
// List servers
router.get('/server/list', requirePermission('server.read'), serverController.listServer);
// Export server list as Excel (filtered)
router.get('/server/export', requirePermission('server.read'), serverController.exportServerList);
// Add server
router.get('/server/add', requirePermission('server.create'), serverController.addServerForm);
router.post('/server/add', requirePermission('server.create'), serverController.createServer);
// Edit server
router.get('/server/:id/edit', requirePermission('server.update'), serverController.editServerForm);
router.post('/server/:id/edit', requirePermission('server.update'), serverController.updateServer);
// Delete server
router.delete('/server/:id', requirePermission('server.delete'), serverController.deleteServer);
// Server import/export
router.get('/server/template', requirePermission('server.create'), serverController.downloadServerTemplate);
router.post('/server/validate-import', requirePermission('server.create'), upload.single('file'), serverController.validateImportServers);
router.post('/server/import', requirePermission('server.create'), upload.single('file'), serverController.importServers);
router.get('/download/server-validation/:filename', requirePermission('server.read'), serverController.downloadServerValidationFile);

// ====== SERVICE MENU ======
// List services
router.get('/service/list', requirePermission('service.read'), serverController.listService);
// Add service
router.post('/service/add', requirePermission('service.create'), serverController.createService);
// Edit service
router.post('/service/:id/edit', requirePermission('service.update'), serverController.updateService);
// Delete service
router.post('/service/:id/delete', requirePermission('service.delete'), serverController.deleteService);

// ====== AGENT MENU ======
// List agents
router.get('/agent/list', requirePermission('agent.read'), serverController.listAgent);
// Add agent
router.post('/agent/add', requirePermission('agent.create'), serverController.createAgent);
// Edit agent
router.post('/agent/:id/edit', requirePermission('agent.update'), serverController.updateAgent);
// Delete agent
router.post('/agent/:id/delete', requirePermission('agent.delete'), serverController.deleteAgent);


// ====== AJAX MENU ======
// API: Get server detail by ID (for AJAX/modal)
router.get('/server/api/:id/detail', requirePermission('server.read'), serverController.detailServer);
// API: Get services for select2 ajax. Call from server edit or add form
router.get('/api/service', serverController.apiSearchService);
// API: Get agents for select2 ajax. 
// Call from server edit or add form
router.get('/api/agent',serverController.apiSearchAgent);
// API: Get servers for select2 ajax. 
// Call from system add/edit form
router.get('/api/server',serverController.apiSearchServer);

export default router;
