// Web pages: /priv-account/role and /priv-account/permission, and their pickers.
import PrivRole from './priv-role.model.js';
import PrivPermission from './priv-permission.model.js';
import System from '../system/system.model.js';
import * as roleService from './priv-role.service.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';
import { ForbiddenError } from '../../shared/errors.js';
import { privAccess, managedSystemIds } from './priv-scope.js';

const ROLE_URL = '/priv-account/role';
const PERMISSION_URL = '/priv-account/permission';
const listFilter = (query) => ({ system_id: parseInt(queryValue(query, 'system_id'), 10) || null });
const systemFilter = (filter) => (filter.system_id ? System.findById(filter.system_id) : null);
const formInput = (req) => ({
  name: req.body.name, description: req.body.description, system_id: req.body.system_id, all_systems: req.body.all_systems,
  permissions: req.body.permissions ?? [], updated_by: actorName(req),
});
// "All systems" in exports / lists
const systemName = (t) => (r) => (r.all_systems ? t('All systems') : r.system?.name);

// List + export + Add/Edit pages of roles or permissions
function pagesFor({ url, entity, view, activeMenu, labels, service, exportColumns }) {
  const renderForm = async (res, mode, record = {}, access) => res.render(`pages/privilege/${view}_form`, {
    mode, record, canGlobal: access.canGlobal, title: mode === 'edit' ? labels.edit : labels.add, activeMenu,
  });
  return {
    list: page(async (req, res) => {
      const { page: pageNo, pageSize, search } = parseListQuery(req, res);
      const filter = listFilter(req.query);
      const access = await privAccess(req, res);
      const [{ items, totalCount }, system] = await Promise.all([service.list({ search, page: pageNo, pageSize, ...filter }, access), systemFilter(filter)]);
      res.render(`pages/privilege/${view}_list`, {
        list: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
        filter, system, scopeUnits: access.scopeUnits, ...takeFlash(req), title: labels.title, activeMenu,
      });
    }),
    export: page(async (req, res) => {
      const { search } = parseListQuery(req, res);
      const { items } = await service.list({ search, page: 1, pageSize: 10000, ...listFilter(req.query) }, await privAccess(req, res));
      await sendExcel(res, { filename: `privileged_${entity}s`, sheet: labels.title, columns: exportColumns(req.t), rows: items });
    }),
    addForm: page(async (req, res) => renderForm(res, 'add', {}, await privAccess(req, res))),
    async editForm(req, res) {
      try {
        const access = await privAccess(req, res);
        const record = await service.get(req.params.id, access);
        if (record.all_systems && !access.canGlobal) throw new ForbiddenError('Only administrators can change "All systems" roles and permissions');
        await renderForm(res, 'edit', record, access);
      } catch (err) {
        req.flash('error', errorMessage(req, err));
        res.redirect(url);
      }
    },
    create: (req, res) => runAndRedirect(req, res, url, async () => service.create(formInput(req), null, await privAccess(req, res)), labels.added, `${url}/add`),
    update: (req, res) => runAndRedirect(req, res, url, async () => service.update(req.params.id, formInput(req), null, await privAccess(req, res)),
      labels.updated, `${url}/${req.params.id}/edit`),
    remove: (req, res) => runAndRedirect(req, res, url, async () => service.remove(req.params.id, await privAccess(req, res)), labels.deleted),
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
    { header: t('System'), value: systemName(t), width: 24 },
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
    { header: t('System'), value: systemName(t), width: 24 },
    { header: t('Roles'), value: (p) => p.role_count, width: 10 },
    ...commonColumns(t),
  ],
});

// ===== Pickers (depend on the systems chosen in the form) =====
export const pickers = {
  // Systems the user may use on these forms (the systems of their units while limited): ?search= -> [{id, text}]
  systems: page(async (req, res) => {
    const { scope } = await privAccess(req, res);
    res.json(await System.select2Search({ search: String(req.query.search || '').trim(), onlyIds: await managedSystemIds(scope) }));
  }),
  // ?system_ids[]=&search= -> roles of those systems + "All systems" roles, [{id, text}]
  roles: page(async (req, res) => {
    const { scope } = await privAccess(req, res);
    const managed = await managedSystemIds(scope);
    const ids = queryList(req.query, 'system_ids').map(Number).filter((id) => Number.isInteger(id) && (!managed || managed.includes(id)));
    res.json(await PrivRole.searchForSystems(String(req.query.search || '').trim(), ids, req.t('All systems')));
  }),
  // ?system_id=&all_systems=on&search= -> permissions the role may hold, [{id, text}]
  permissions: page(async (req, res) => {
    const allSystems = ['on', 'true', '1'].includes(String(req.query.all_systems || ''));
    res.json(await PrivPermission.searchForSystem(String(req.query.search || '').trim(), parseInt(req.query.system_id, 10) || null, allSystems, req.t('All systems')));
  }),
};
