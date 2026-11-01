// Web pages: /priv-account/account (list, add, edit, delete, export).
import * as accountService from './priv-user.service.js';
import { SERVER_TYPES, URL_TYPES } from './priv-user.service.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page } from '../../shared/web.js';
import { optionLabel } from '../../utils/viewHelpers.js';
import { sendExcel } from '../../utils/excelExport.js';
import { pageOptions } from '../../shared/options.js';

const LIST_URL = '/priv-account/account';
const listFilter = (query) => ({
  system_ids: queryList(query, 'system_ids'), contact_ids: queryList(query, 'contact_ids'), organize_id: queryValue(query, 'organize_id'),
  account_type: queryList(query, 'account_type'), manage_type: queryList(query, 'manage_type'),
});

const typeOptions = async () => {
  const [accountTypes, manageTypes] = await Promise.all([accountService.getAccountTypeOptions(), accountService.getManageTypeOptions()]);
  return { accountTypes, manageTypes, serverTypes: SERVER_TYPES, urlTypes: URL_TYPES };
};

const formInput = (req) => {
  const b = req.body;
  return {
    username: b.username, description: b.description, organize_id: b.organize_id, role_id: b.role_id, account_type: b.account_type,
    manage_type: b.manage_type, app_url: b.app_url, contacts: b.contacts ?? [], systems: b.systems ?? [], servers: b.servers ?? [], updated_by: actorName(req),
  };
};

async function renderForm(res, mode, account = {}) {
  res.render('pages/privilege/priv_account_form', {
    ...(await pageOptions('units')),
    mode, account, ...(await typeOptions()),
    title: mode === 'edit' ? 'Edit Privileged Account' : 'Add Privileged Account', activeMenu: 'priv-account-list',
  });
}

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, options] = await Promise.all([
      accountService.listAccounts({ search, page: pageNo, pageSize, ...filter }), typeOptions(),
    ]);
    res.render('pages/privilege/priv_account_list', {
    ...(await pageOptions('units')),
      accountList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, ...options, ...takeFlash(req), title: 'Privileged Account', activeMenu: 'priv-account-list',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const [{ items }, { accountTypes, manageTypes }] = await Promise.all([
      accountService.listAccounts({ search, page: 1, pageSize: 10000, ...listFilter(req.query) }), typeOptions(),
    ]);
    const names = (list) => list.map((x) => x.name);
    await sendExcel(res, {
      filename: 'privileged_accounts', sheet: 'Privileged Accounts',
      columns: [
        { header: req.t('Account Name'), value: (a) => a.username, width: 28 },
        { header: req.t('Account Type'), value: (a) => optionLabel(accountTypes, a.account_type), width: 18 },
        { header: req.t('Management Method'), value: (a) => optionLabel(manageTypes, a.manage_type), width: 20 },
        { header: req.t('Role'), value: (a) => a.role?.name, width: 22 },
        { header: req.t('Organize Unit'), value: (a) => a.organize?.name, width: 22 },
        { header: req.t('Systems'), value: (a) => names(a.systems) },
        { header: req.t('Servers'), value: (a) => names(a.servers) },
        { header: req.t('Application URL'), value: (a) => a.app_url, width: 32 },
        { header: req.t('Contacts'), value: (a) => names(a.contacts) },
        { header: req.t('Description'), value: (a) => a.description, width: 32 },
        { header: req.t('Updated'), value: (a) => a.updated_date, width: 20 },
        { header: req.t('Updated By'), value: (a) => a.updated_by, width: 16 },
      ],
      rows: items,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await accountService.getAccount(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => accountService.createAccount(formInput(req)), 'Privileged account added successfully', `${LIST_URL}/add`),
  update: (req, res) => runAndRedirect(req, res, LIST_URL,
    () => accountService.updateAccount(req.params.id, formInput(req)), 'Privileged account updated successfully', `${LIST_URL}/${req.params.id}/edit`),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => accountService.deleteAccount(req.params.id), 'Privileged account deleted successfully'),
};
