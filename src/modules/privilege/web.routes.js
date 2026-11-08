// Web routes of the Privileged Account module, mounted at /priv-account.
import express from 'express';
import accounts from './priv-user.controller.js';
import { rolePages, permissionPages, pickers } from './priv-role.controller.js';
import matrix from './priv-matrix.controller.js';
import multer from 'multer';
import os from 'os';
import requirePermission from '../../middlewares/requirePermission.middleware.js';

const router = express.Router();
const can = requirePermission;

function mountPages(path, pages, permission) {
  router.get(path, can(`${permission}.read`), pages.list);
  router.get(`${path}/export`, can(`${permission}.read`), pages.export);
  router.get(`${path}/add`, can(`${permission}.create`), pages.addForm);
  router.post(`${path}/add`, can(`${permission}.create`), pages.create);
  router.get(`${path}/:id/edit`, can(`${permission}.update`), pages.editForm);
  router.post(`${path}/:id/edit`, can(`${permission}.update`), pages.update);
  router.post(`${path}/:id/delete`, can(`${permission}.delete`), pages.remove);
}

mountPages('/account', accounts, 'priv_account');
mountPages('/role', rolePages, 'priv_role');
mountPages('/permission', permissionPages, 'priv_permission');

// Permission matrix: versions (Word to sign) and their signed PDF
const signedPdf = multer({ dest: os.tmpdir(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } }).single('file');
const withSignedPdf = (req, res, next) => signedPdf(req, res, (err) => {
  if (!err) return next();
  req.flash('error', err.code === 'LIMIT_FILE_SIZE' ? req.t('The file is too large') : req.t('File upload error'));
  res.redirect(`/priv-account/matrix?system_id=${encodeURIComponent(req.body?.system_id || '')}`);
});
router.get('/matrix', can('priv_role.read'), matrix.page);
router.post('/matrix/versions', can('priv_role.update'), matrix.create);
router.get('/matrix/version/:id/word', can('priv_role.read'), matrix.word);
router.post('/matrix/version/:id/signed', can('priv_role.update'), withSignedPdf, matrix.uploadSigned);
router.get('/matrix/version/:id/signed', can('priv_role.read'), matrix.signed);
router.post('/matrix/version/:id/delete', can('priv_role.update'), matrix.remove);

// AJAX pickers of the account / role forms
router.get('/api/systems', can('priv_account.create', 'priv_account.update', 'priv_role.read', 'priv_role.create', 'priv_role.update', 'priv_permission.create', 'priv_permission.update'), pickers.systems);
router.get('/api/roles', can('priv_account.create', 'priv_account.update', 'priv_role.read'), pickers.roles);
router.get('/api/permissions', can('priv_role.create', 'priv_role.update', 'priv_permission.read'), pickers.permissions);

export default router;
