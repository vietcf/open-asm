
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import firewallController from './firewall.controller.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';

// Configure multer for file uploads — same public/uploads/import location
// (and env override) as network.js/server.js/device.js, so uploaded files
// live under the volume-mounted public/uploads directory instead of a
// root-level uploads/ folder that isn't persisted across container recreates.
const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(process.cwd(), uploadsDir, 'import');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
    }
  }
});

const router = express.Router();

//----------------------------------
// ====== FIREWALL MENU ======
//----------------------------------

// ====== FIREWALL RULE MENU ======
// List firewall rules
router.get('/rule', requirePermission('rule.read'), firewallController.ruleList);
// Download firewall rule template
router.get('/rule/template', requirePermission('rule.create'), firewallController.downloadRuleTemplate);
// Export firewall rule list as Excel (filtered)
router.get('/rule/export', requirePermission('rule.read'), firewallController.exportRuleList);
// Add firewall rule
router.post('/rule', requirePermission('rule.create'), firewallController.addRule);

// ====== FIREWALL RULE IMPORT/EXPORT ======
// Validate firewall rule import
router.post('/rule/validate-import', requirePermission('rule.create'), upload.single('file'), firewallController.validateImportRules);
// Import firewall rules
router.post('/rule/import', requirePermission('rule.create'), upload.single('file'), firewallController.importRules);

// Edit firewall rule (MUST be after specific routes to avoid conflicts)
router.post('/rule/:id', requirePermission('rule.update'), firewallController.editRule);
router.put('/rule/:id', requirePermission('rule.update'), firewallController.editRule);
// Delete firewall rule
router.delete('/rule/:id', requirePermission('rule.delete'), firewallController.deleteRule);

// ====== FIREWALL BATCH MENU ======
// Batch update work order
router.post('/api/batch-update-wo', requirePermission('rule.update'), firewallController.batchUpdateWorkOrder);
// Download firewall rule validation file
router.get('/download/rule-validation/:filename', requirePermission('rule.read'), firewallController.downloadRuleValidationFile);

export default router;
