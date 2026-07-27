import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import clusterController from '../controllers/clusterController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';

// Configure multer for file uploads (same pattern as network.js/organize.js)
const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(process.cwd(), uploadsDir, 'import');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + path.basename(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.get('/', requirePermission('cluster.read'), clusterController.listClusters);

router.get('/:id/export', requirePermission('cluster.read'), clusterController.exportClusterMembers);

router.get('/template', requirePermission('cluster.create'), clusterController.downloadClusterTemplate);
router.post('/validate-import', requirePermission('cluster.create'), upload.single('file'), clusterController.validateImportClusters);
router.post('/import', requirePermission('cluster.create'), upload.single('file'), clusterController.importClusters);

// Bulk-add-members helper used by the Add/Edit form (not full cluster
// import) - gated by create OR update since both forms use it.
router.get('/member-template', requirePermission('cluster.create', 'cluster.update'), clusterController.downloadMemberTemplate);
router.post('/validate-members', requirePermission('cluster.create', 'cluster.update'), upload.single('file'), clusterController.validateMembersFile);

router.get('/add', requirePermission('cluster.create'), clusterController.addClusterForm);
router.post('/add', requirePermission('cluster.create'), clusterController.addCluster);

router.get('/:id/edit', requirePermission('cluster.update'), clusterController.editClusterForm);
router.post('/:id/edit', requirePermission('cluster.update'), clusterController.updateCluster);

router.post('/:id/delete', requirePermission('cluster.delete'), clusterController.deleteCluster);

router.get('/api/roles', requirePermission('cluster.read'), clusterController.apiRoleOptions);
router.get('/api/by-system', requirePermission('cluster.read'), clusterController.apiClustersBySystem);
router.get('/api/check-name', requirePermission('cluster.create', 'cluster.update'), clusterController.apiCheckName);
router.get('/api/search', requirePermission('cluster.read'), clusterController.apiClusterSearch);

export default router;
