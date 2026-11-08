// Web routes of the Backup module, mounted at /backup.
import express from 'express';
import multer from 'multer';
import os from 'os';
import backups from './backup.controller.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import { errorMessage } from '../../shared/web.js';

const router = express.Router();
const can = requirePermission;

const MAX_UPLOAD = 2 * 1024 * 1024 * 1024; // 2 GB
const receive = multer({ dest: os.tmpdir(), limits: { fileSize: MAX_UPLOAD } }).single('file');
const withUpload = (req, res, next) => receive(req, res, (err) => {
  if (!err) return next();
  req.flash('error', err.code === 'LIMIT_FILE_SIZE' ? req.t('The file is too large') : errorMessage(req, err));
  res.redirect('/backup');
});

router.get('/', can('backup.read'), backups.list);
router.post('/create', can('backup.create'), backups.create);
router.get('/:name/download', can('backup.read'), backups.download);
router.post('/restore', can('backup.restore'), withUpload, backups.restore);
router.post('/:name/delete', can('backup.delete'), backups.remove);

export default router;
