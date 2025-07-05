import express from 'express';
import networkController from '../controllers/networkController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';

const router = express.Router();

// ====== IPADDRESS MENU ======
router.get('/ip-address', requirePermission('read', 'ip_address'), networkController.listIP);
router.post('/ip-address', requirePermission('create', 'ip_address'), networkController.createIP);
router.put('/ip-address/:id', requirePermission('update', 'ip_address'), networkController.updateIP);
router.delete('/ip-address/:id', requirePermission('delete', 'ip_address'), networkController.deleteIP);
router.get('/ip-address/export', requirePermission('read', 'ip_address'), networkController.exportIpAddressList);

// ====== SUBNET MENU ======
router.get('/subnet-address', requirePermission('read', 'subnet'), networkController.listSubnet);
router.post('/subnet-address', requirePermission('create', 'subnet'), networkController.createSubnet);
router.put('/subnet-address/:id', requirePermission('update', 'subnet'), networkController.updateSubnet);
router.delete('/subnet-address/:id', requirePermission('delete', 'subnet'), networkController.deleteSubnet);

// ====== DOMAIN MENU ======
router.get('/domain', requirePermission('read', 'domain'), networkController.listDomain);
router.post('/domain', requirePermission('create', 'domain'), networkController.createDomain);
router.put('/domain/:id', requirePermission('update', 'domain'), networkController.updateDomain);
router.delete('/domain/:id', requirePermission('delete', 'domain'), networkController.deleteDomain);

// // ====== AJAX API ======
router.get('/api/subnet-address/:id', requirePermission('read', 'subnet'), networkController.detailSubnet); //Get detail of subnet
router.get('/api/ip-addresses', networkController.apiSearchIPAddresses); // Search IP addresses
router.get('/api/domain', networkController.apiDomainSearch); // Search domains
router.get('/api/ip-addresses/unassigned', networkController.apiSearchUnassignedIPAddresses); // Search unassigned IP addresses

export default router;
