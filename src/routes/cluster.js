import express from 'express';
import clusterController from '../controllers/clusterController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';

const router = express.Router();

router.get('/', requirePermission('cluster.read'), clusterController.listClusters);

router.get('/add', requirePermission('cluster.create'), clusterController.addClusterForm);
router.post('/add', requirePermission('cluster.create'), clusterController.addCluster);

router.get('/:id/edit', requirePermission('cluster.update'), clusterController.editClusterForm);
router.post('/:id/edit', requirePermission('cluster.update'), clusterController.updateCluster);

router.post('/:id/delete', requirePermission('cluster.delete'), clusterController.deleteCluster);

router.get('/api/roles', requirePermission('cluster.read'), clusterController.apiRoleOptions);
router.get('/api/by-system', requirePermission('cluster.read'), clusterController.apiClustersBySystem);

export default router;
