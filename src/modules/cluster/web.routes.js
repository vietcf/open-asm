// Web routes of the Cluster module, mounted at /cluster.
import express from 'express';
import clusters, { clusterImport } from './cluster.controller.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import excelUpload from '../../middlewares/excelUpload.middleware.js';

const router = express.Router();
const can = requirePermission;

router.get('/', can('cluster.read'), clusters.list);
router.get('/export', can('cluster.read'), clusters.export);
router.get('/template', can('cluster.create'), clusterImport.template);
router.post('/validate-import', can('cluster.create'), excelUpload, clusterImport.validate);
router.post('/import', can('cluster.create'), excelUpload, clusterImport.import);
router.get('/download/cluster-validation/:filename', can('cluster.read'), clusterImport.download);
router.get('/member-template', can('cluster.create', 'cluster.update'), clusters.memberTemplate);
router.post('/validate-members', can('cluster.create', 'cluster.update'), excelUpload, clusters.validateMembers);
router.get('/add', can('cluster.create'), clusters.addForm);
router.post('/add', can('cluster.create'), clusters.create);
router.get('/:id/edit', can('cluster.update'), clusters.editForm);
router.post('/:id/edit', can('cluster.update'), clusters.update);
router.post('/:id/delete', can('cluster.delete'), clusters.remove);
router.get('/:id/export', can('cluster.read'), clusters.exportMembers);

// AJAX
router.get('/api/roles', can('cluster.read'), clusters.roles);
router.get('/api/by-system', can('cluster.read'), clusters.bySystem);
router.get('/api/check-name', can('cluster.create', 'cluster.update'), clusters.checkName);

export default router;
