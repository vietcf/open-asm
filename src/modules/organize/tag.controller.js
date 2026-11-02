// Web pages: /organize/tag (list, export, add, edit, delete), lookups.
import Tag from './tag.model.js';
import * as tagService from './tag.service.js';
import { parseListQuery, totalPagesOf, errorMessage, takeFlash, runAndRedirect, page, lookup, lookupByIds } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/organize/tag';
const formInput = ({ name, description }) => ({ name, description: description ?? '' });
const renderForm = (res, mode, tag) => res.render('pages/organize/tag_form', {
  mode, tag, title: mode === 'edit' ? 'Edit Tag' : 'Add Tag', activeMenu: 'tag',
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const { items, totalCount } = await tagService.listTags({ search, page: pageNo, pageSize });
    res.render('pages/organize/tag_list', {
      tagList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize), ...takeFlash(req),
      title: 'Tag List', activeMenu: 'tag',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await tagService.listTags({ search, page: 1, pageSize: 10000 });
    await sendExcel(res, {
      filename: 'tag-list', sheet: 'Tags',
      columns: [
        { header: req.t('Tag Name'), value: (tg) => tg.name, width: 28 },
        { header: req.t('Description'), value: (tg) => tg.description, width: 40 },
        { header: req.t('Used by'), value: (tg) => tg.usage_count, width: 10 },
      ],
      rows: items,
    });
  }),

  addForm: (req, res) => renderForm(res, 'add', {}),

  async editForm(req, res) {
    try {
      renderForm(res, 'edit', await tagService.getTag(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => tagService.createTag(formInput(req.body)), 'Tag added successfully'),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, () => tagService.updateTag(req.params.id, formInput(req.body)), 'Tag updated successfully'),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => tagService.deleteTag(req.params.id), 'Tag deleted successfully'),

  // ===== AJAX =====
  lookup: lookup((search) => Tag.select2Search(search)),
  lookupByIds: lookupByIds((ids) => Tag.findByIds(ids), (tg) => tg.name),
};
