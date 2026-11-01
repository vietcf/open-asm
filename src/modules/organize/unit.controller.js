// Web pages: /organize/unit (list, export, add, edit, delete), lookups.
import Unit from './unit.model.js';
import * as unitService from './unit.service.js';
import { parseListQuery, totalPagesOf, errorMessage, takeFlash, runAndRedirect, page, lookup, lookupByIds } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/organize/unit';
const formInput = ({ name, code, description }) => ({ name, code, description });
const renderForm = (res, mode, unit) => res.render('pages/organize/unit_form', {
  mode, unit, title: mode === 'edit' ? 'Edit Unit' : 'Add Unit', activeMenu: 'unit',
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const { items, totalCount } = await unitService.listUnits({ search, page: pageNo, pageSize });
    res.render('pages/organize/unit_list', {
      unitList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize), ...takeFlash(req),
      title: 'Organization Unit', activeMenu: 'unit',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await unitService.listUnits({ search, page: 1, pageSize: 10000 });
    await sendExcel(res, {
      filename: 'unit-list', sheet: 'Units',
      columns: [
        { header: req.t('Unit Name'), value: (u) => u.name, width: 30 },
        { header: req.t('Code'), value: (u) => u.code, width: 14 },
        { header: req.t('Description'), value: (u) => u.description, width: 40 },
        { header: req.t('Contacts'), value: (u) => u.contacts_count, width: 10 },
        { header: req.t('Systems'), value: (u) => u.systems_count, width: 10 },
      ],
      rows: items,
    });
  }),

  addForm: (req, res) => renderForm(res, 'add', {}),

  async editForm(req, res) {
    try {
      renderForm(res, 'edit', await unitService.getUnit(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => unitService.createUnit(formInput(req.body)), 'Unit added successfully'),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, () => unitService.updateUnit(req.params.id, formInput(req.body)), 'Unit updated successfully'),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => unitService.deleteUnit(req.params.id), 'Unit deleted successfully'),

  // ===== AJAX =====
  lookup: lookup((search) => Unit.select2Search(search)),
  lookupByIds: lookupByIds((ids) => Unit.findByIds(ids), (u) => u.name),

  // name / code / description for hover tooltips
  detail: page(async (req, res) => {
    const unit = Number(req.params.id) ? await Unit.findById(req.params.id) : null;
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    res.json({ id: unit.id, name: unit.name, code: unit.code, description: unit.description });
  }),
};
