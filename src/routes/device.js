import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import deviceController from '../controllers/deviceController.js';
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

// Device Management
router.get('/device', requirePermission('device.read'), deviceController.listDevice);
router.post('/device', requirePermission('device.create'), deviceController.createDevice);
router.put('/device/:id', requirePermission('device.update'), deviceController.updateDevice);
router.delete('/device/:id', requirePermission('device.delete'), deviceController.deleteDevice);

// Device Form Routes (optional, for add/edit forms)
router.get('/device/add', requirePermission('device.create'), deviceController.addDeviceForm);
router.get('/device/edit/:id', requirePermission('device.update'), deviceController.editDeviceForm);
router.get('/device/export', deviceController.exportDeviceList);
// Device import/export
router.get('/device/template', requirePermission('device.create'), deviceController.downloadDeviceTemplate);
router.post('/device/validate-import', requirePermission('device.create'), upload.single('file'), deviceController.validateImportDevices);
router.post('/device/import', requirePermission('device.create'), upload.single('file'), deviceController.importDevices);
router.get('/download/device-validation/:filename', requirePermission('device.read'), deviceController.downloadDeviceValidationFile);

// Platform Management
router.get('/platform', requirePermission('platform.read'), deviceController.listPlatform);
router.post('/platform', requirePermission('platform.create'), deviceController.createPlatform);
router.put('/platform/:id', requirePermission('platform.update'), deviceController.updatePlatform);
router.delete('/platform/:id', requirePermission('platform.delete'), deviceController.deletePlatform);

// Device Type Management
router.get('/type', requirePermission('device_type.read'), deviceController.listDeviceType);
router.post('/type', requirePermission('device_type.create'), deviceController.createDeviceType);
router.put('/type/:id', requirePermission('device_type.update'), deviceController.updateDeviceType);
router.delete('/type/:id', requirePermission('device_type.delete'), deviceController.deleteDeviceType);

// API Routes
router.get('/api/platform', deviceController.apiPlatformSearch);
router.get('/api/device-type', deviceController.apiDeviceTypeSearch);
router.get('/api/device', deviceController.apiDeviceSearch);
router.get('/api/manufacturers', deviceController.apiManufacturers);
router.get('/api/device-roles', deviceController.apiDeviceRoles);

export default router;
