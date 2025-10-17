import express from 'express';
import organizeController from '../controllers/organizeController.js';
import requirePermission from '../middlewares/requirePermission.middleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

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

// Contact Management
router.get('/contact', requirePermission('contact.read'), organizeController.contactList);
router.post('/contact', requirePermission('contact.create'), organizeController.createContact);
router.put('/contact/:id', requirePermission('contact.update'), organizeController.updateContact);
router.delete('/contact/:id', requirePermission('contact.delete'), organizeController.deleteContact);

// Contact Import
router.get('/contact/template', requirePermission('contact.create'), organizeController.downloadContactTemplate);
router.post('/contact/validate-import', requirePermission('contact.create'), upload.single('file'), organizeController.validateImportContacts);
router.post('/contact/import', requirePermission('contact.create'), upload.single('file'), organizeController.importContacts);
router.get('/download/contact-validation/:filename', requirePermission('contact.read'), organizeController.downloadContactValidationFile);


// Organization Unit Management
router.get('/unit', requirePermission('unit.read'), organizeController.unitList);
router.post('/unit', requirePermission('unit.create'), organizeController.createUnit);
router.put('/unit/:id', requirePermission('unit.update'), organizeController.updateUnit);
router.delete('/unit/:id', requirePermission('unit.delete'), organizeController.deleteUnit);

// Tag Management
router.get('/tag', requirePermission('tag.read'), organizeController.tagList);
router.post('/tag', requirePermission('tag.create'), organizeController.createTag);
router.put('/tag/:id', requirePermission('tag.update'), organizeController.updateTag);
router.delete('/tag/:id', requirePermission('tag.delete'), organizeController.deleteTag);

// ====== API AJAX SEARCH ======
router.get('/api/contact', organizeController.apiContactSearch);
router.get('/api/contact/ids', organizeController.apiContactByIds);
router.get('/api/tag',organizeController.apiTagSearch);
router.get('/api/tag/ids', organizeController.apiTagByIds);
router.get('/api/system/ids', organizeController.apiSystemByIds);
router.get('/api/unit', organizeController.apiUnitSearch);
router.get('/api/contact/:id/qrcode', organizeController.apiContactQrVcard);



export default router;
