import express from 'express';
import networkController from '../controllers/networkController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';

const router = express.Router();

// ====== IPADDRESS MENU ======
router.get('/ip-address', requirePermission('ip_address.read'), networkController.listIP);
router.post('/ip-address', requirePermission('ip_address.create'), networkController.createIP);
router.put('/ip-address/:id', requirePermission('ip_address.update'), networkController.updateIP);
router.delete('/ip-address/:id', requirePermission('ip_address.delete'), networkController.deleteIP);
router.get('/ip-address/export', requirePermission('ip_address.read'), networkController.exportIpAddressList);

// ====== SUBNET MENU ======
router.get('/subnet-address', requirePermission('subnet.read'), networkController.listSubnet);
router.post('/subnet-address', requirePermission('subnet.create'), networkController.createSubnet);
router.put('/subnet-address/:id', requirePermission('subnet.update'), networkController.updateSubnet);
router.delete('/subnet-address/:id', requirePermission('subnet.delete'), networkController.deleteSubnet);
router.get('/subnet-address/export', requirePermission('subnet.read'), networkController.exportSubnetList);

// ====== DOMAIN MENU ======
router.get('/domain', requirePermission('domain.read'), networkController.listDomain);
router.post('/domain', requirePermission('domain.create'), networkController.createDomain);
router.put('/domain/:id', requirePermission('domain.update'), networkController.updateDomain);
router.delete('/domain/:id', requirePermission('domain.delete'), networkController.deleteDomain);

// // ====== AJAX API ======
router.get('/api/subnet-address/:id', requirePermission('subnet.read'), networkController.detailSubnet); //Get detail of subnet
router.get('/api/ip-addresses', networkController.apiSearchIPAddresses); // Search IP addresses
router.get('/api/ip-addresses/detail', networkController.apiGetIPDetail); // Get detailed IP information
router.get('/api/domain', networkController.apiDomainSearch); // Search domains
router.get('/api/ip-addresses/unassigned', networkController.apiSearchUnassignedIPAddresses); // Search unassigned IP addresses

export default router;
