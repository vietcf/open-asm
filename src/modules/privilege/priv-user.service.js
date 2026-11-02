// Privileged accounts: validation and persistence.
import PrivUser from './priv-user.model.js';
import PrivRole from './priv-role.model.js';
import Unit from '../organize/unit.model.js';
import Contact from '../organize/contact.model.js';
import System from '../system/system.model.js';
import Server from '../server/server.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toNullableString, loadOptions, resolveRelations, saveRelations } from '../../shared/service.js';

const RELATIONS = {
  contacts: { label: 'contact', exists: (id) => Contact.exists(id), save: (id, ids, c) => PrivUser.setContacts(id, ids, c) },
  systems: { label: 'system', exists: (id) => System.exists(id), save: (id, ids, c) => PrivUser.setSystems(id, ids, c) },
  servers: { label: 'server', exists: (id) => Server.exists(id), save: (id, ids, c) => PrivUser.setServers(id, ids, c) },
};

// OS / DB accounts live on servers, APP accounts behind a URL
export const SERVER_TYPES = ['OS', 'DB'];
export const URL_TYPES = ['APP'];

const withDefault = (fallback) => async (key) => {
  const options = await loadOptions(key);
  return options.length ? options : fallback;
};

// ===== Options ({id, text}) =====
export const getAccountTypeOptions = () => withDefault([
  { id: 'OS', text: 'Operating System (OS)' }, { id: 'APP', text: 'Application (APP)' }, { id: 'DB', text: 'Database (DB)' },
])('priv_account_type');
export const getManageTypeOptions = () => withDefault([
  { id: 'SELF', text: 'Self-managed' }, { id: 'PAM', text: 'Managed by PAM' }, { id: 'ENVELOPE', text: 'Envelope method' },
])('priv_account_manage_type');

// ===== Queries =====
export async function listAccounts(filter) {
  const [items, totalCount] = await Promise.all([PrivUser.findFilteredList(filter), PrivUser.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getAccount(id) {
  const account = await PrivUser.findById(id);
  if (!account) throw new NotFoundError('Privileged account not found');
  return account;
}

// ===== Commands =====
// input: {username, description, organize_id, role_id, account_type, manage_type, app_url, contacts, systems, servers, updated_by}
async function normalize(input, id = null) {
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  if (!username) throw new ValidationError('Account Name is required');
  const existing = await PrivUser.findByUsername(username);
  if (existing && String(existing.id) !== String(id)) throw new ConflictError('Account name already exists');

  const [accountTypes, manageTypes] = await Promise.all([getAccountTypeOptions(), getManageTypeOptions()]);
  const account_type = toNullableString(input.account_type);
  const manage_type = toNullableString(input.manage_type);
  if (!account_type) throw new ValidationError('Account Type is required');
  if (!accountTypes.some((o) => o.id === account_type)) throw new ValidationError('Invalid Account Type');
  if (!manage_type) throw new ValidationError('Management Method is required');
  if (!manageTypes.some((o) => o.id === manage_type)) throw new ValidationError('Invalid Management Method');

  const organize_id = parseInt(input.organize_id, 10) || null;
  if (!organize_id) throw new ValidationError('Organize Unit is required');
  if (!(await Unit.findById(organize_id))) throw new ValidationError('Invalid unit');

  const relations = await resolveRelations({ ...input, servers: SERVER_TYPES.includes(account_type) ? input.servers : [] }, RELATIONS);
  if (!relations.contacts.length) throw new ValidationError('At least one Contact is required');
  if (!relations.systems.length) throw new ValidationError('At least one System is required');
  if (SERVER_TYPES.includes(account_type) && !relations.servers.length) throw new ValidationError('At least one Server is required for OS/DB accounts');
  const app_url = URL_TYPES.includes(account_type) ? toNullableString(input.app_url) : null;
  if (URL_TYPES.includes(account_type) && !app_url) throw new ValidationError('Application URL is required for APP accounts');

  // The role must belong to one of the account's systems
  const role_id = parseInt(input.role_id, 10) || null;
  if (!role_id) throw new ValidationError('Role is required');
  const role = await PrivRole.findById(role_id);
  if (!role) throw new ValidationError('Invalid role');
  if (!relations.systems.includes(role.system_id)) throw new ValidationError('The role must belong to one of the selected systems');

  const data = { username, description: toNullableString(input.description), organize_id, role_id, account_type, manage_type, app_url, updated_by: input.updated_by };
  return { data, relations };
}

export async function createAccount(input, client) {
  const { data, relations } = await normalize(input);
  const id = await withTransaction(client, async (c) => {
    const account = await PrivUser.create(data, c);
    await saveRelations(account.id, relations, RELATIONS, c);
    return account.id;
  });
  return PrivUser.findById(id);
}

// Full update (the form always sends every field)
export async function updateAccount(id, input, client) {
  if (!(await PrivUser.findById(id))) throw new NotFoundError('Privileged account not found');
  const { data, relations } = await normalize(input, id);
  await withTransaction(client, async (c) => {
    await PrivUser.update(id, data, c);
    await saveRelations(id, relations, RELATIONS, c);
  });
  return PrivUser.findById(id);
}

export async function deleteAccount(id) {
  if (!(await PrivUser.findById(id))) throw new NotFoundError('Privileged account not found');
  await PrivUser.remove(id);
}

