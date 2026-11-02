// Web pages: /priv-account/role and /priv-account/permission, and their pickers.
import PrivRole from './priv-role.model.js';
import PrivPermission from './priv-permission.model.js';
import System from '../system/system.model.js';
import * as roleService from './priv-role.service.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const ROLE_URL = '/priv-account/role';
const PERMISSION_URL = '/priv-account/permission';
const listFilter = (query) => ({ system_id: parseInt(queryValue(query, 'system_id'), 10) || null });
const systemFilter = (filter) => (filter.system_id ? System.findById(filter.system_id) : null);
const formInput = (req) => ({ name: req.body.name, description: req.body.description, system_id: req.body.system_id, permissions: req.body.permissions ?? [], updated_by: actorName(req) });

// List + export + Add/Edit pages of roles or permissions
function pagesFor({ url, entity, view, activeMenu, labels, service, exportColumns }) {
  const renderForm = async (res, mode, record = {}) => res.render(`pages/privilege/${view}_form`, {
    mode, record, title: mode === 'edit' ? labels.edit : labels.add, activeMenu,
  });
  return {
    list: page(async (req, res) => {
      const { page: pageNo, pageSize, search } = parseListQuery(req, res);
      const filter = listFilter(req.query);
      const [{ items, totalCount }, system] = await Promise.all([service.list({ search, page: pageNo, pageSize, ...filter }), systemFilter(filter)]);
      res.render(`pages/privilege/${view}_list`, {
        list: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
        filter, system, ...takeFlash(req), title: labels.title, activeMenu,
      });
    }),
    export: page(async (req, res) => {
      const { search } = parseListQuery(req, res);
      const { items } = await service.list({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
      await sendExcel(res, { filename: `privileged_${entity}s`, sheet: labels.title, columns: exportColumns(req.t), rows: items });
    }),
    addForm: page((req, res) => renderForm(res, 'add')),
    async editForm(req, res) {
      try {
        await renderForm(res, 'edit', await service.get(req.params.id));
      } catch (err) {
        req.flash('error', errorMessage(req, err));
        res.redirect(url);
      }
    },
    create: (req, res) => runAndRedirect(req, res, url, () => service.create(formInput(req)), labels.added, `${url}/add`),
    update: (req, res) => runAndRedirect(req, res, url, () => service.update(req.params.id, formInput(req)), labels.updated, `${url}/${req.params.id}/edit`),
    remove: (req, res) => runAndRedirect(req, res, url, () => service.remove(req.params.id), labels.deleted),
  };
}

const commonColumns = (t) => [
  { header: t('Description'), value: (r) => r.description, width: 36 },
  { header: t('Updated'), value: (r) => r.updated_at, width: 20 },
  { header: t('Updated By'), value: (r) => r.updated_by, width: 16 },
];

export const rolePages = pagesFor({
  url: ROLE_URL, entity: 'role', view: 'priv_role', activeMenu: 'priv-role-list',
  labels: { title: 'Privileged Role List', add: 'Add Privileged Role', edit: 'Edit Privileged Role',
    added: 'Privileged role added successfully', updated: 'Privileged role updated successfully', deleted: 'Privileged role deleted successfully' },
  service: { list: roleService.listRoles, get: roleService.getRole, create: roleService.createRole, update: roleService.updateRole, remove: roleService.deleteRole },
  exportColumns: (t) => [
    { header: t('Role Name'), value: (r) => r.name, width: 28 },
    { header: t('System'), value: (r) => r.system?.name, width: 24 },
    { header: t('Permissions'), value: (r) => r.permissions.map((p) => p.name) },
    { header: t('Accounts'), value: (r) => r.account_count, width: 10 },
    ...commonColumns(t),
  ],
});

export const permissionPages = pagesFor({
  url: PERMISSION_URL, entity: 'permission', view: 'priv_permission', activeMenu: 'priv-permission-list',
  labels: { title: 'Privileged Permission List', add: 'Add Privileged Permission', edit: 'Edit Privileged Permission',
    added: 'Privileged permission added successfully', updated: 'Privileged permission updated successfully', deleted: 'Privileged permission deleted successfully' },
  service: { list: roleService.listPermissions, get: roleService.getPermission, create: roleService.createPermission, update: roleService.updatePermission, remove: roleService.deletePermission },
  exportColumns: (t) => [
    { header: t('Permission Name'), value: (p) => p.name, width: 28 },
    { header: t('System'), value: (p) => p.system?.name, width: 24 },
    { header: t('Roles'), value: (p) => p.role_count, width: 10 },
    ...commonColumns(t),
  ],
});

// ===== Pickers (depend on the systems chosen in the form) =====
export const pickers = {
  // ?system_ids[]=&search= -> [{id, text}]
  roles: page(async (req, res) => {
    const ids = queryList(req.query, 'system_ids').map(Number).filter(Number.isInteger);
    res.json(await PrivRole.searchForSystems(String(req.query.search || '').trim(), ids));
  }),
  // ?system_id=&search= -> [{id, text}]
  permissions: page(async (req, res) => {
    res.json(await PrivPermission.searchForSystem(String(req.query.search || '').trim(), parseInt(req.query.system_id, 10) || null));
  }),
};
