// Web pages: /administrator/users (list, add, edit, delete).
import Role from './role.model.js';
import * as userService from './user.service.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, runAndRedirect, page } from '../../shared/web.js';
import { PASSWORD_RULE_MESSAGE } from '../../shared/password.js';

const LIST_URL = '/administrator/users';
const listFilter = (query) => ({
  role_id: queryList(query, 'role_id'), auth_source: queryList(query, 'auth_source'), status: queryValue(query, 'status'), twofa: queryValue(query, 'twofa'),
});
const actor = (req) => req.session.user;

async function renderForm(req, res, mode, user = {}) {
  res.render('pages/administrator/user_form', {
    mode, user, roleOptions: await Role.options(), isSelf: String(user.id) === String(actor(req)?.id), passwordRule: PASSWORD_RULE_MESSAGE,
    title: mode === 'edit' ? 'Edit User' : 'Add User', activeMenu: 'user-management',
  });
}

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, roleOptions] = await Promise.all([userService.listUsers({ search, page: pageNo, pageSize, ...filter }), Role.options()]);
    res.render('pages/administrator/user_list', {
      userList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, roleOptions, currentUserId: actor(req)?.id, ...takeFlash(req), title: 'User Management', activeMenu: 'user-management',
    });
  }),

  addForm: page((req, res) => renderForm(req, res, 'add')),

  async editForm(req, res) {
    try {
      await renderForm(req, res, 'edit', await userService.getUser(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => userService.createUser(req.body), 'User added successfully', `${LIST_URL}/add`),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, () => userService.updateUser(req.params.id, req.body, actor(req)), 'User updated successfully', `${LIST_URL}/${req.params.id}/edit`),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => userService.deleteUser(req.params.id, actor(req)), 'User deleted successfully'),
};
