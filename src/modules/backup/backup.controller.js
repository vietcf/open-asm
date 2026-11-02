// Web pages: /backup (list, back up now, upload, download, restore, delete).
import * as backupService from './backup.service.js';
import { ValidationError } from '../../shared/errors.js';
import { errorMessage, takeFlash, runAndRedirect, page } from '../../shared/web.js';

const LIST_URL = '/backup';

export default {
  list: page(async (req, res) => {
    res.render('pages/backup/backup_list', {
      backups: backupService.listBackups(), settings: await backupService.getSettings(), directory: backupService.backupDir(),
      busy: backupService.currentOperation(), restoreWord: backupService.RESTORE_CONFIRMATION,
      ...takeFlash(req), title: 'Backup & Restore', activeMenu: 'backup',
    });
  }),

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => backupService.createBackup('manual'), 'Backup created successfully'),

  upload: (req, res) => runAndRedirect(req, res, LIST_URL, async () => {
    if (!req.file) throw new ValidationError('Choose a backup file to upload');
    await backupService.importUpload(req.file.path, req.file.originalname);
  }, 'Backup uploaded successfully'),

  download: page(async (req, res) => {
    res.download(backupService.backupPath(req.params.name), req.params.name);
  }),

  // Replaces the whole database; the previous data is kept as a pre-restore backup
  async restore(req, res) {
    try {
      const { safety_backup: safety } = await backupService.restoreBackup(req.params.name, req.body.confirm);
      req.flash('success', req.t('Restore completed. A copy of the previous data was saved as {file}', { file: safety }));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
    }
    res.redirect(LIST_URL);
  },

  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => backupService.deleteBackup(req.params.name), 'Backup deleted successfully'),
};
