// Web routes of the Firewall module, mounted at /firewall.
import express from 'express';
import rules, { ruleImport } from './rule.controller.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import excelUpload from '../../middlewares/excelUpload.middleware.js';

const router = express.Router();
const can = requirePermission;

router.get('/rule', can('rule.read'), rules.list);
router.get('/rule/export', can('rule.read'), rules.export);
router.get('/rule/template', can('rule.create'), ruleImport.template);
router.post('/rule/validate-import', can('rule.create'), excelUpload, ruleImport.validate);
router.post('/rule/import', can('rule.create'), excelUpload, ruleImport.import);
router.get('/download/rule-validation/:filename', can('rule.read'), ruleImport.download);
router.get('/rule/add', can('rule.create'), rules.addForm);
router.post('/rule/add', can('rule.create'), rules.create);
router.get('/rule/:id/edit', can('rule.update'), rules.editForm);
router.post('/rule/:id/edit', can('rule.update'), rules.update);
router.post('/rule/:id/delete', can('rule.delete'), rules.remove);

export default router;
