// Web pages: /system/component (list, export, add, edit, delete), select2 lookup.
import SystemComponent from './component.model.js';
import * as componentService from './component.service.js';
import { parseListQuery, queryList, totalPagesOf, errorMessage, takeFlash, actorName } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';
import { pageOptions } from '../../shared/options.js';

const LIST_URL = '/system/component';

function listFilter(query) {
  return {
    filterTags: queryList(query, 'tags'),
    filterContacts: queryList(query, 'contacts'),
    filterSystemId: queryList(query, 'system_id'),
    filterAppType: queryList(query, 'app_type'),
  };
}
const serviceFilter = (f) => ({ filterTags: f.filterTags, filterContacts: f.filterContacts, system_id: f.filterSystemId, app_type: f.filterAppType });

// Multi-selects send nothing when empty: the form always replaces every link.
const formInput = (req) => {
  const b = req.body;
  return {
    system_id: b.system_id, name: b.name, app_type: b.app_type, description: b.description, fqdn: b.fqdn,
    contacts: b.contacts || [], ips: b.ips || [], tags: b.tags || [], updated_by: actorName(req),
  };
};

const toOptions = (rows, text) => (rows || []).map((r) => ({ id: r.id, text: text(r) }));

async function renderForm(res, mode, extra) {
  res.render('pages/system/component_form', {
    ...(await pageOptions('tags')),
    mode, title: mode === 'edit' ? 'Edit System Component' : 'Add System Component', activeMenu: 'system-component',
    component: {}, selected: {}, ...extra,
  });
}

export default {
  async list(req, res, next) {
    try {
      const { page, pageSize, search } = parseListQuery(req, res);
      const filter = listFilter(req.query);
      const [{ items, totalCount }, appTypeOptions] = await Promise.all([
        componentService.listComponents({ search, page, pageSize, ...serviceFilter(filter) }),
        componentService.getAppTypeOptions(),
      ]);
      res.render('pages/system/component_list', {
    ...(await pageOptions('tags')),
        componentList: items, search, page, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
        ...filter, appTypeOptions, ...takeFlash(req),
        title: 'System Component', activeMenu: 'system-component',
      });
    } catch (err) {
      next(err);
    }
  },

  async export(req, res, next) {
    try {
      const { search } = parseListQuery(req, res);
      const [{ items }, appTypes] = await Promise.all([
        componentService.listComponents({ search, page: 1, pageSize: 10000, ...serviceFilter(listFilter(req.query)) }),
        componentService.getAppTypeOptions(),
      ]);
      const appType = (v) => (appTypes.find((o) => o.id === v) || {}).text || v;
      await sendExcel(res, {
        filename: 'component-list', sheet: 'Component List',
        columns: [
          { header: req.t('Component Name'), value: (c) => c.name, width: 30 },
          { header: req.t('System'), value: (c) => c.system_name, width: 30 },
          { header: req.t('App Type'), value: (c) => (c.app_type ? appType(c.app_type) : ''), width: 16 },
          { header: req.t('Tags'), value: (c) => (c.tags || []).map((tg) => tg.name) },
          { header: req.t('Managers'), value: (c) => (c.contacts || []).map((ct) => (ct.email ? ct.email.split('@')[0] : ct.name)) },
          { header: req.t('IP Addresses'), value: (c) => (c.ips || []).map((ip) => ip.ip) },
          { header: req.t('Access URLs'), value: (c) => c.fqdn, width: 40 },
          { header: req.t('Description'), value: (c) => c.description, width: 50 },
        ],
        rows: items,
      });
    } catch (err) {
      next(err);
    }
  },

  async addForm(req, res, next) {
    try {
      await renderForm(res, 'add', { appTypeOptions: await componentService.getAppTypeOptions() });
    } catch (err) {
      next(err);
    }
  },

  async editForm(req, res) {
    try {
      const [component, appTypeOptions] = await Promise.all([componentService.getComponent(req.params.id), componentService.getAppTypeOptions()]);
      const selected = {
        system: [{ id: component.system_id, text: component.system_name }],
        contacts: toOptions(component.contacts, (c) => (c.email ? `${c.name} (${c.email})` : c.name)),
        ips: toOptions(component.ips, (ip) => ip.ip),
        tags: toOptions(component.tags, (tg) => tg.name),
      };
      await renderForm(res, 'edit', { component, selected, appTypeOptions });
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  async create(req, res) {
    try {
      await componentService.createComponent(formInput(req));
      req.flash('success', 'Component added successfully');
    } catch (err) {
      req.flash('error', errorMessage(req, err));
    }
    res.redirect(LIST_URL);
  },

  async update(req, res) {
    try {
      await componentService.updateComponent(req.params.id, formInput(req));
      req.flash('success', 'Component updated successfully');
    } catch (err) {
      req.flash('error', errorMessage(req, err));
    }
    res.redirect(LIST_URL);
  },

  async remove(req, res) {
    try {
      await componentService.deleteComponent(req.params.id);
      req.flash('success', 'Component deleted successfully');
    } catch (err) {
      req.flash('error', errorMessage(req, err));
    }
    res.redirect(LIST_URL);
  },

  // Select2 lookup (pentest target picker); ?system_id= limits it to that system's components
  async lookup(req, res, next) {
    try {
      res.json(await SystemComponent.select2Search({ search: String(req.query.search || '').trim(), systemId: Number(req.query.system_id) || null }));
    } catch (err) {
      next(err);
    }
  },
};
