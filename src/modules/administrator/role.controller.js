// Web pages: /administrator/roles and /administrator/permissions.
import Permission from './permission.model.js';
import { SUPERADMIN } from './role.model.js';
import * as roleService from './role.service.js';
import { parseListQuery, totalPagesOf, errorMessage, takeFlash, runAndRedirect, page } from '../../shared/web.js';

// Permissions grouped by resource for the role form: [{resource, actions: {read: perm, ...}}]
function permissionGrid(permissions) {
  const groups = new Map();
  for (const p of permissions) {
    const [resource, action] = p.name.split('.');
    if (!groups.has(resource)) groups.set(resource, { resource, actions: {} });
    groups.get(resource).actions[action] = p;
  }
  return [...groups.values()].sort((a, b) => a.resource.localeCompare(b.resource));
}

// List + Add/Edit pages of roles or permissions
function pagesFor({ url, view, activeMenu, labels, service, formLocals = async () => ({}) }) {
  const renderForm = async (res, mode, record = {}) => res.render(`pages/administrator/${view}_form`, {
    mode, record, ...(await formLocals()), title: mode === 'edit' ? labels.edit : labels.add, activeMenu,
  });
  return {
    list: page(async (req, res) => {
      const { page: pageNo, pageSize, search } = parseListQuery(req, res);
      const { items, totalCount } = await service.list({ search, page: pageNo, pageSize });
      res.render(`pages/administrator/${view}_list`, {
        list: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
        superadmin: SUPERADMIN, ...takeFlash(req), title: labels.title, activeMenu,
      });
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
    create: (req, res) => runAndRedirect(req, res, url, () => service.create(req.body), labels.added, `${url}/add`),
    update: (req, res) => runAndRedirect(req, res, url, () => service.update(req.params.id, req.body), labels.updated, `${url}/${req.params.id}/edit`),
    remove: (req, res) => runAndRedirect(req, res, url, () => service.remove(req.params.id), labels.deleted),
  };
}

export const rolePages = pagesFor({
  url: '/administrator/roles', view: 'role', activeMenu: 'role-management',
  labels: { title: 'Role Management', add: 'Add Role', edit: 'Edit Role', added: 'Role added successfully', updated: 'Role updated successfully', deleted: 'Role deleted successfully' },
  service: { list: roleService.listRoles, get: roleService.getRole, create: roleService.createRole, update: roleService.updateRole, remove: roleService.deleteRole },
  formLocals: async () => ({ permissionGrid: permissionGrid(await Permission.findAll()), actions: ['read', 'create', 'update', 'delete', 'restore'] }),
});

export const permissionPages = pagesFor({
  url: '/administrator/permissions', view: 'permission', activeMenu: 'permission-management',
  labels: { title: 'Permission Management', add: 'Add Permission', edit: 'Edit Permission',
    added: 'Permission added successfully', updated: 'Permission updated successfully', deleted: 'Permission deleted successfully' },
  service: { list: roleService.listPermissions, get: roleService.getPermission, create: roleService.createPermission, update: roleService.updatePermission, remove: roleService.deletePermission },
});
