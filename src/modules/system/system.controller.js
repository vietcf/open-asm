// Web pages: /system/system (list, export, add, edit, delete), file view, select2 lookup.
import System from './system.model.js';
import Unit from '../organize/unit.model.js';
import FileUpload from '../file/file-upload.model.js';
import * as systemService from './system.service.js';
import * as componentService from './component.service.js';
import { attachTmpUploads, removeObjectFiles } from '../file/file.service.js';
import { withTransaction } from '../../shared/transaction.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, actorId, lookupByIds } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';
import { serveFileInline } from '../../utils/fileServe.js';
import { pageOptions } from '../../shared/options.js';

const LIST_URL = '/system/system';

function listFilter(query) {
  return {
    filterTags: queryList(query, 'tags'),
    filterContacts: queryList(query, 'contacts'),
    filterScopes: queryList(query, 'scopes'),
    filterArchitecture: queryList(query, 'architectures'),
    filterLevel: queryValue(query, 'level'),
    filterDepartment: queryValue(query, 'department_id'),
  };
}

// Multi-selects send nothing when empty: the form always replaces every link.
const formInput = (req) => {
  const b = req.body;
  return {
    system_id: b.system_id, name: b.name, level: b.level, department_id: b.department_id, ops_department_id: b.ops_department_id,
    alias: b.alias, description: b.description, fqdn: b.fqdn, scopes: b.scopes || [], architecture: b.architecture || [],
    contacts: b.contacts || [], ip_addresses: b.ip_addresses || [], domains: b.domains || [], tags: b.tags || [],
    updated_by: actorName(req),
  };
};

async function renderForm(res, mode, extra) {
  res.render('pages/system/system_form', {
    ...(await pageOptions('tags', 'units')),
    mode, title: mode === 'edit' ? 'Edit System' : 'Add System', activeMenu: 'system', system: {}, selected: {}, ...extra,
  });
}

export default {
  async list(req, res, next) {
    try {
      const { page, pageSize, search } = parseListQuery(req, res);
      const filter = listFilter(req.query);
      const [{ items, totalCount }, options, departments] = await Promise.all([
        systemService.listSystems({ search, page, pageSize, ...filter }),
        systemService.getFormOptions(),
        Unit.findAll(),
      ]);
      res.render('pages/system/system_list', {
    ...(await pageOptions('tags')),
        systemList: items, search, page, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
        ...filter, ...options, departments, ...takeFlash(req),
        title: 'System Management', activeMenu: 'system',
      });
    } catch (err) {
      next(err);
    }
  },

  async export(req, res, next) {
    try {
      const { search } = parseListQuery(req, res);
      const [{ items }, options] = await Promise.all([
        systemService.listSystems({ search, page: 1, pageSize: 10000, ...listFilter(req.query) }),
        systemService.getFormOptions(),
      ]);
      const label = (list, v) => (list.find((o) => o.id === String(v)) || {}).text || v;
      await sendExcel(res, {
        filename: 'system-list', sheet: 'System List',
        columns: [
          { header: req.t('System Code'), value: (s) => s.system_id, width: 16 },
          { header: req.t('System Name'), value: (s) => s.name, width: 30 },
          { header: req.t('Level'), value: (s) => (s.level ? label(options.levelOptions, s.level) : ''), width: 12 },
          { header: req.t('Operations department (L2)'), value: (s) => s.ops_department_name, width: 24 },
          { header: req.t('Development department (L3)'), value: (s) => s.department_name, width: 24 },
          { header: req.t('Alias'), value: (s) => s.alias },
          { header: req.t('Tags'), value: (s) => (s.tags || []).map((tg) => tg.name) },
          { header: req.t('Managers'), value: (s) => (s.contacts || []).map((c) => (c.email ? c.email.split('@')[0] : c.name)) },
          { header: req.t('Scope user access'), value: (s) => (s.scopes || []).map((v) => label(options.scopeOptions, v)) },
          { header: req.t('Architecture'), value: (s) => (s.architecture || []).map((v) => label(options.architectureOptions, v)) },
          { header: req.t('Access URLs'), value: (s) => s.fqdn, width: 40 },
          { header: req.t('IP Addresses'), value: (s) => (s.ip_addresses || []).map((ip) => ip.ip) },
          { header: req.t('Description'), value: (s) => s.description, width: 50 },
        ],
        rows: items,
      });
    } catch (err) {
      next(err);
    }
  },

  async addForm(req, res, next) {
    try {
      await renderForm(res, 'add', await systemService.getFormOptions());
    } catch (err) {
      next(err);
    }
  },

  async editForm(req, res, next) {
    try {
      const [{ system, selected }, options] = await Promise.all([systemService.getSystemForEdit(req.params.id), systemService.getFormOptions()]);
      await renderForm(res, 'edit', { system, selected, ...options });
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  async create(req, res) {
    try {
      await withTransaction(null, async (c) => {
        const system = await systemService.createSystem(formInput(req), c);
        await attachTmpUploads('system', system.id, req.body.uploaded_docs, actorId(req), c);
      });
      req.flash('success', 'System added successfully');
    } catch (err) {
      req.flash('error', errorMessage(req, err));
    }
    res.redirect(LIST_URL);
  },

  async update(req, res) {
    const { id } = req.params;
    try {
      const removed = await withTransaction(null, async (c) => {
        await systemService.updateSystem(id, formInput(req), c);
        await attachTmpUploads('system', id, req.body.uploaded_docs_edit, actorId(req), c);
        return removeObjectFiles('system', id, req.body.delete_files, c);
      });
      FileUpload.unlinkFiles(removed);
      req.flash('success', 'System updated successfully');
    } catch (err) {
      req.flash('error', errorMessage(req, err));
    }
    res.redirect(LIST_URL);
  },

  async remove(req, res) {
    try {
      await systemService.deleteSystem(req.params.id);
      req.flash('success', 'System deleted successfully');
    } catch (err) {
      req.flash('error', errorMessage(req, err));
    }
    res.redirect(LIST_URL);
  },

  // Attachment opened inline in a new tab (safe types only, see fileServe.js)
  async viewFile(req, res, next) {
    try {
      const file = Number(req.params.id) ? await FileUpload.findById(req.params.id) : null;
      if (!file || file.object_type !== 'system') return res.status(404).send('File not found');
      if (process.env.FILE_UPLOAD_DRIVER === 's3') return res.redirect(FileUpload.getUrl(file));
      serveFileInline(res, { file, folder: 'system' });
    } catch (err) {
      next(err);
    }
  },

  // ===== AJAX =====
  async lookup(req, res, next) {
    try {
      res.json(await System.select2Search({ search: String(req.query.search || '').trim() }));
    } catch (err) {
      next(err);
    }
  },

  // Select2 restore: ?ids[]= -> [{id, text}]
  lookupByIds: lookupByIds((ids) => System.findByIds(ids), (s) => s.name),

  async components(req, res, next) {
    try {
      res.json({ components: await componentService.listBySystem(req.params.id) });
    } catch (err) {
      next(err);
    }
  },
};
