import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import networkController from '../controllers/networkController.js';
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

// ====== IPADDRESS MENU ======
router.get('/ip-address', requirePermission('ip_address.read'), networkController.listIP);
router.post('/ip-address', requirePermission('ip_address.create'), networkController.createIP);
router.put('/ip-address/:id', requirePermission('ip_address.update'), networkController.updateIP);
router.delete('/ip-address/batch', requirePermission('ip_address.delete'), networkController.batchDeleteIpAddresses);
router.delete('/ip-address/:id', requirePermission('ip_address.delete'), networkController.deleteIP);
router.get('/ip-address/export', requirePermission('ip_address.read'), networkController.exportIpAddressList);
router.get('/ip-address/template', requirePermission('ip_address.create'), networkController.downloadTemplate);
router.post('/ip-address/validate-import', requirePermission('ip_address.create'), upload.single('file'), networkController.validateImportIPs);
router.post('/ip-address/import', requirePermission('ip_address.create'), upload.single('file'), networkController.importIPs);
router.get('/download/validation/:filename', requirePermission('ip_address.read'), networkController.downloadValidationFile);

// ====== SUBNET MENU ======
router.get('/subnet-address', requirePermission('subnet.read'), networkController.listSubnet);
router.post('/subnet-address', requirePermission('subnet.create'), networkController.createSubnet);
router.put('/subnet-address/:id', requirePermission('subnet.update'), networkController.updateSubnet);
router.delete('/subnet-address/:id', requirePermission('subnet.delete'), networkController.deleteSubnet);
router.get('/subnet-address/export', requirePermission('subnet.read'), networkController.exportSubnetList);
router.get('/subnet-address/template', requirePermission('subnet.create'), networkController.downloadSubnetTemplate);
router.post('/subnet-address/validate-import', requirePermission('subnet.create'), upload.single('file'), networkController.validateImportSubnets);
router.post('/subnet-address/import', requirePermission('subnet.create'), upload.single('file'), networkController.importSubnets);
router.get('/download/subnet-validation/:filename', requirePermission('subnet.read'), networkController.downloadSubnetValidationFile);

// ====== DOMAIN MENU ======
router.get('/domain', requirePermission('domain.read'), networkController.listDomain);
router.post('/domain', requirePermission('domain.create'), networkController.createDomain);
router.put('/domain/:id', requirePermission('domain.update'), networkController.updateDomain);
router.delete('/domain/:id', requirePermission('domain.delete'), networkController.deleteDomain);


// // ====== AJAX API ======
router.get('/api/subnet-address/:id', requirePermission('subnet.read'), networkController.detailSubnet); //Get detail of subnet
router.get('/api/subnet-addresses', networkController.apiSearchSubnets); // Search subnets for existence check
router.get('/api/ip-addresses', networkController.apiSearchIPAddresses); // Search IP addresses
router.get('/api/ip-addresses/detail', networkController.apiGetIPDetail); // Get detailed IP information
router.get('/api/domain', networkController.apiDomainSearch); // Search domains
router.get('/api/ip-addresses/unassigned', networkController.apiSearchUnassignedIPAddresses); // Search unassigned IP addresses
router.get('/api/zones', networkController.apiZones); // Get zones for autocomplete
router.get('/api/environments', networkController.apiEnvironments); // Get environments for autocomplete

export default router;
