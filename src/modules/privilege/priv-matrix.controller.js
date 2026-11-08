// Web pages: /priv-account/matrix (permission matrix of a system, its
// versions: Word to sign, signed PDF).
import System from '../system/system.model.js';
import * as matrixService from './priv-matrix.service.js';
import { errorMessage, takeFlash, actorName, page } from '../../shared/web.js';
import { contentDisposition } from '../../utils/filename.js';
import { privAccess, privScope } from './priv-scope.js';

const PAGE_URL = '/priv-account/matrix';
const back = (systemId, extra = '') => `${PAGE_URL}?system_id=${encodeURIComponent(systemId || '')}${extra}`;

export default {
  // ?system_id= (&download=<version id> right after a version was made)
  page: page(async (req, res) => {
    const { scope, scopeUnits } = await privAccess(req, res);
    const systemId = parseInt(req.query.system_id, 10) || null;
    let data = null;
    let error = null;
    if (systemId) {
      try { data = await matrixService.getMatrixPage(systemId, scope); } catch (err) { error = errorMessage(req, err); }
    }
    const system = data?.matrix.system || (systemId && !error ? await System.findById(systemId) : null);
    res.render('pages/privilege/priv_matrix', {
      systemId, system, data, scopeUnits, download: parseInt(req.query.download, 10) || null,
      ...takeFlash(req), ...(error ? { errorMessage: error } : {}), title: 'Permission Matrix', activeMenu: 'priv-matrix',
    });
  }),

  // New version (snapshot) of the system, then its Word document is downloaded
  async create(req, res) {
    const systemId = parseInt(req.body.system_id, 10) || null;
    try {
      const created = await matrixService.createVersion(systemId, { note: req.body.note, createdBy: actorName(req) }, await privScope(req, res));
      req.flash('success', req.t('Version v{1} created. Sign its Word document, then upload the signed PDF.', { 1: created.version }));
      return res.redirect(back(systemId, `&download=${created.id}`));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      return res.redirect(back(systemId));
    }
  },

  async word(req, res) {
    try {
      const { buffer, fileName } = await matrixService.versionDocument(req.params.id, req.t, await privScope(req, res));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', contentDisposition('attachment', fileName));
      res.send(buffer);
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(PAGE_URL);
    }
  },

  async uploadSigned(req, res) {
    const systemId = parseInt(req.body.system_id, 10) || null;
    try {
      await matrixService.attachSigned(req.params.id, req.file, { signedAt: req.body.signed_at, note: req.body.note, uploadedBy: actorName(req) }, await privScope(req, res));
      req.flash('success', req.t('Signed copy saved'));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
    }
    res.redirect(back(systemId));
  },

  async signed(req, res) {
    try {
      const file = await matrixService.signedFile(req.params.id, await privScope(req, res));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', contentDisposition(req.query.inline ? 'inline' : 'attachment', file.name));
      res.sendFile(file.path);
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(PAGE_URL);
    }
  },

  async remove(req, res) {
    const systemId = parseInt(req.body.system_id, 10) || null;
    try {
      await matrixService.deleteVersion(req.params.id, { scope: await privScope(req, res), superadmin: req.session.user?.role_name === 'superadmin' });
      req.flash('success', req.t('Version deleted'));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
    }
    res.redirect(back(systemId));
  },
};
