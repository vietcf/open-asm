// Web pages: /organize/unit (list, export, add, edit, delete), lookups.
import Unit from './unit.model.js';
import Contact from './contact.model.js';
import * as unitService from './unit.service.js';
import { getPositionOptions } from './contact.service.js';
import { parseListQuery, queryValue, totalPagesOf, errorMessage, takeFlash, runAndRedirect, page, lookup, lookupByIds } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/organize/unit';
const formInput = ({ name, code, description, parent_id }) => ({ name, code, description, parent_id: parent_id ?? '' });
// filter: parent_id (a unit: its sub-units at any depth; __none__: top level), level ('parent' | 'leaf')
const listFilter = (query) => ({ parent_id: queryValue(query, 'parent_id'), level: queryValue(query, 'level') });

// Parent picker: every unit except this one and its sub-units
async function renderForm(res, mode, unit) {
  const excluded = new Set(unit.id ? [Number(unit.id), ...await Unit.descendantIds(unit.id)] : []);
  res.render('pages/organize/unit_form', {
    mode, unit, parentOptions: (await Unit.pathOptions()).filter((o) => !excluded.has(Number(o.id))),
    title: mode === 'edit' ? 'Edit Unit' : 'Add Unit', activeMenu: 'unit',
  });
}

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, unitOptions] = await Promise.all([
      unitService.listUnits({ search, page: pageNo, pageSize, ...filter }), Unit.pathOptions(),
    ]);
    res.render('pages/organize/unit_list', {
      unitList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize), ...takeFlash(req),
      filter, parentOptions: unitOptions,
      title: 'Organization Unit', activeMenu: 'unit',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await unitService.listUnits({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    const members = new Map();
    for (const c of await Contact.findByUnitIds(items.map((u) => u.id))) {
      if (!members.has(c.unit_id)) members.set(c.unit_id, []);
      members.get(c.unit_id).push(c.email ? `${c.name} <${c.email}>` : c.name);
    }
    await sendExcel(res, {
      filename: 'unit-list', sheet: 'Units',
      columns: [
        { header: req.t('Unit Name'), value: (u) => u.name, width: 30 },
        { header: req.t('Parent unit'), value: (u) => u.parent_path, width: 36 },
        { header: req.t('Sub-units'), value: (u) => u.children_count, width: 10 },
        { header: req.t('Code'), value: (u) => u.code, width: 14 },
        { header: req.t('Description'), value: (u) => u.description, width: 40 },
        { header: req.t('Contacts'), value: (u) => u.contacts_count, width: 10 },
        { header: req.t('Systems'), value: (u) => u.systems_count, width: 10 },
        { header: req.t('Members'), value: (u) => members.get(u.id) || [], width: 60 },
      ],
      rows: items,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add', {})),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await unitService.getUnit(req.params.id));
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

  // Unit detail modal: every contact of the unit, position as its label
  members: page(async (req, res) => {
    if (!Number(req.params.id) || !(await Unit.exists(req.params.id))) return res.status(404).json({ error: 'Unit not found' });
    const [contacts, positions, children] = await Promise.all([Contact.findByUnitIds([Number(req.params.id)]), getPositionOptions(), Unit.findChildren(req.params.id)]);
    const label = new Map(positions.map((o) => [o.id, o.text]));
    res.json({ members: contacts.map((c) => ({ ...c, position_label: c.position ? label.get(c.position) || c.position : null })), children });
  }),

  // name / code / description for hover tooltips
  detail: page(async (req, res) => {
    const unit = Number(req.params.id) ? await Unit.findById(req.params.id) : null;
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    res.json({ id: unit.id, name: unit.name, code: unit.code, description: unit.description });
  }),
};
