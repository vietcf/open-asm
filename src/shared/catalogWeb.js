// Web pages of a catalog (see catalog.js): list, export, add, edit, delete and
// Select2 lookups, rendered by pages/catalog/list.ejs and form.ejs.
//
//   export default catalogPages({
//     service: agents, model: Agent, base: '/server/agent', permission: 'agent', activeMenu: 'agent',
//     labels: { list: 'Agent List', singular: 'Agent', add: 'Add Agent', edit: 'Edit Agent', section: 'Server Management',
//               search: 'Search Agent...', empty: 'No agents found', summary: 'Showing {1} - {2} of {3} agents' },
//     fields: [{ key: 'name', label: 'Agent Name', required: true }, { key: 'version', label: 'Version' },
//              { key: 'description', label: 'Description', type: 'textarea' }],
//   });
import { parseListQuery, totalPagesOf, errorMessage, takeFlash, runAndRedirect, page, lookup, lookupByIds } from './web.js';
import { sendExcel } from '../utils/excelExport.js';

export function catalogPages({ service, model, base, permission, activeMenu, labels, fields, icon = 'bi-list-ul', usageLabel = 'Used by' }) {
  const formInput = (body) => Object.fromEntries(fields.map((f) => [f.key, body[f.key] ?? '']));
  const view = { base, permission, labels, fields, icon, usageLabel };
  const renderForm = (res, mode, record) => res.render('pages/catalog/form', {
    mode, record, catalog: view, title: mode === 'edit' ? labels.edit : labels.add, activeMenu,
  });

  return {
    list: page(async (req, res) => {
      const { page: pageNo, pageSize, search } = parseListQuery(req, res);
      const { items, totalCount } = await service.list({ search, page: pageNo, pageSize });
      res.render('pages/catalog/list', {
        items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
        catalog: view, ...takeFlash(req), title: labels.list, activeMenu,
      });
    }),

    export: page(async (req, res) => {
      const { search } = parseListQuery(req, res);
      const { items } = await service.list({ search, page: 1, pageSize: 10000 });
      await sendExcel(res, {
        filename: base.split('/').pop() + '-list', sheet: req.t(labels.list).slice(0, 31),
        columns: [
          ...fields.map((f) => ({ header: req.t(f.label), value: (row) => row[f.key], width: f.type === 'textarea' ? 50 : 28 })),
          { header: req.t(usageLabel), value: (row) => row.usage_count, width: 10 },
        ],
        rows: items,
      });
    }),

    addForm: (req, res) => renderForm(res, 'add', {}),

    async editForm(req, res) {
      try {
        renderForm(res, 'edit', await service.get(req.params.id));
      } catch (err) {
        req.flash('error', errorMessage(req, err));
        res.redirect(base);
      }
    },

    create: (req, res) => runAndRedirect(req, res, base, () => service.create(formInput(req.body)), `${labels.singular} added successfully`),
    update: (req, res) => runAndRedirect(req, res, base, () => service.update(req.params.id, formInput(req.body)), `${labels.singular} updated successfully`),
    remove: (req, res) => runAndRedirect(req, res, base, () => service.remove(req.params.id), `${labels.singular} deleted successfully`),

    lookup: lookup((search) => model.select2Search({ search })),
    lookupByIds: lookupByIds((ids) => model.findByIds(ids), (row) => row.name),
  };
}

// Mounts the pages on a router under `path` (e.g. '/agent'):
//   GET path, path/export, path/add, path/:id/edit; POST path/add, path/:id/edit, path/:id/delete
export function mountCatalogPages(router, path, pages, permission, can) {
  router.get(path, can(`${permission}.read`), pages.list);
  router.get(`${path}/export`, can(`${permission}.read`), pages.export);
  router.get(`${path}/add`, can(`${permission}.create`), pages.addForm);
  router.post(`${path}/add`, can(`${permission}.create`), pages.create);
  router.get(`${path}/:id/edit`, can(`${permission}.update`), pages.editForm);
  router.post(`${path}/:id/edit`, can(`${permission}.update`), pages.update);
  router.post(`${path}/:id/delete`, can(`${permission}.delete`), pages.remove);
}
