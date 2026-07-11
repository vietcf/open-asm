import IpAddress from '../models/IpAddress.js';
import Tag from '../models/Tag.js';
import Contact from '../models/Contact.js';
import System from '../models/System.js';
import Configuration from '../models/Configuration.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';
import { withTransaction } from './transaction.js';

// Stricter, correctly octet-bounded regex (was previously only applied by the
// API; the frontend's old `^[0-9]{1,3}(\.[0-9]{1,3}){3}$` allowed octets >255).
// Adopted for both consumers — rejects a class of addresses that were never
// actually valid IPv4.
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

const toIdArray = v => {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(Number).filter(x => !isNaN(x));
};

export async function getIpStatusOptions() {
  try {
    const config = await Configuration.findById('ip_address_status');
    if (config && config.value) {
      const parsed = JSON.parse(config.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* fall through to empty */ }
  return [];
}

// No status options configured means the deployment isn't restricting status
// values — treat as free text rather than rejecting everything.
async function validateStatus(status) {
  if (!status) return;
  const options = await getIpStatusOptions();
  if (!options.length) return;
  const allowed = options.map(s => s.value);
  if (!allowed.includes(status)) {
    throw new ValidationError(`Invalid status. Allowed: ${allowed.join(', ')}`);
  }
}

export async function validateTagIds(tagIds) {
  const invalid = [];
  for (const id of tagIds) {
    if (!(await Tag.exists(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid tag IDs: ${invalid.join(', ')}`);
}

export async function validateContactIds(contactIds) {
  const invalid = [];
  for (const id of contactIds) {
    if (!(await Contact.exists(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid contact IDs: ${invalid.join(', ')}`);
}

export async function validateSystemIds(systemIds) {
  const invalid = [];
  for (const id of systemIds) {
    if (!(await System.exists(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid system IDs: ${invalid.join(', ')}`);
}

export async function listIpAddresses(filter) {
  const [items, totalCount] = await Promise.all([
    IpAddress.findFilteredList(filter),
    IpAddress.countFiltered(filter)
  ]);
  return { items, totalCount };
}

export async function getIpAddress(id) {
  const ip = await IpAddress.findByIdWithDetails(id);
  if (!ip) throw new NotFoundError('IP address not found');
  return ip;
}

export async function getIpAddressByAddress(address) {
  const ip = await IpAddress.findByAddressWithDetails(address);
  if (!ip) throw new NotFoundError('IP address not found');
  return ip;
}

// Single-address create (matches the API's granularity). The frontend's
// comma-separated multi-address form loops over this, sharing one transaction
// client across calls to keep the whole batch atomic — see networkController.
// input: {address, description, status, tags?, contacts?, systems?, updated_by}
export async function createIpAddress(input, client) {
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  if (!address) throw new ValidationError('IP address is required');
  if (!IPV4_REGEX.test(address)) throw new ValidationError('Invalid IPv4 address format');

  const existing = await IpAddress.findByAddress(address);
  if (existing) throw new ConflictError('IP address already exists');

  // The old frontend defaulted blank status to 'active' — but the actual
  // configured status options (migrations/init_data.js: reserved/assigned/
  // inactive) never included 'active' at all, so that default silently wrote
  // an out-of-list value with no validation to catch it. Not carried over:
  // blank status is left unset here, matching the API's original (correct)
  // behavior, and only validated against the config when a value is given.
  const statusValue = typeof input.status === 'string' && input.status.trim() ? input.status.trim() : null;
  await validateStatus(statusValue);

  const tags = toIdArray(input.tags);
  const contacts = toIdArray(input.contacts);
  const systems = toIdArray(input.systems);
  // Existence validation on create was previously API-only (the frontend just
  // let bad IDs fail at the FK constraint as a raw 500). Adopted for both —
  // gives the frontend the same clean validation messages the API already had.
  if (tags.length) await validateTagIds(tags);
  if (contacts.length) await validateContactIds(contacts);
  if (systems.length) await validateSystemIds(systems);

  const description = typeof input.description === 'string' ? input.description.trim() : input.description;

  let created;
  try {
    created = await withTransaction(client, async (c) => {
      const ip = await IpAddress.create({ address, description, status: statusValue, updated_by: input.updated_by || null }, c);
      await IpAddress.setTags(ip.id, tags, c);
      await IpAddress.setContacts(ip.id, contacts, c);
      await IpAddress.setSystems(ip.id, systems, c);
      return ip;
    });
  } catch (err) {
    // Belt-and-suspenders for a race with the pre-check above.
    if (err.code === '23505') throw new ConflictError('IP address already exists');
    throw err;
  }
  return IpAddress.findByIdWithDetails(created.id);
}

// Partial update. description/status are always written together (the model
// has no partial-column update for them), so missing keys fall back to the
// current row's values. tags/contacts/systems: key present (even as an empty
// array) replaces the association; key absent leaves it untouched.
export async function updateIpAddress(id, input, client) {
  const current = await IpAddress.findById(id);
  if (!current) throw new NotFoundError('IP address not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  const description = has('description') && typeof input.description === 'string'
    ? input.description.trim()
    : current.description;

  let status = current.status;
  if (has('status') && typeof input.status === 'string' && input.status.trim()) {
    status = input.status.trim();
    await validateStatus(status);
  }

  let tags = null;
  if (has('tags')) {
    tags = toIdArray(input.tags);
    if (tags.length) await validateTagIds(tags);
  }
  let contacts = null;
  if (has('contacts')) {
    contacts = toIdArray(input.contacts);
    if (contacts.length) await validateContactIds(contacts);
  }
  let systems = null;
  if (has('systems')) {
    systems = toIdArray(input.systems);
    if (systems.length) await validateSystemIds(systems);
  }

  await withTransaction(client, async (c) => {
    await IpAddress.update(id, { description, status, updated_by: input.updated_by || null }, c);
    if (tags) await IpAddress.setTags(id, tags, c);
    if (contacts) await IpAddress.setContacts(id, contacts, c);
    if (systems) await IpAddress.setSystems(id, systems, c);
  });
  return IpAddress.findByIdWithDetails(id);
}

export async function deleteIpAddress(id) {
  const exists = await IpAddress.exists(id);
  if (!exists) throw new NotFoundError('IP address not found');
  try {
    await IpAddress.setTags(id, []);
    await IpAddress.delete(id);
  } catch (err) {
    // IpAddress.delete() throws a plain Error when the IP is still assigned
    // to a device/server — both controllers used to sniff err.message for
    // this; centralizing it here means neither has to any more.
    if (err.message && err.message.includes('assigned to')) {
      throw new ConflictError(err.message);
    }
    throw err;
  }
}
