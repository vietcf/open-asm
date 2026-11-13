// Customers: shared by the web pages and the REST API.
import Customer from './customer.model.js';
import Unit from '../organize/unit.model.js';
import Contact from '../organize/contact.model.js';
import Device from '../device/device.model.js';
import IpAddress from '../network/ip-address.model.js';
import FileUpload from '../file/file-upload.model.js';
import { IPV4_REGEX } from '../network/ip-address.service.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { hasKey, assertIdsExist, loadOptions, assertOption } from '../../shared/service.js';
import { loadCustomFields, normalizeAttributes } from '../../shared/customFields.js';

export const CONNECTION_ROLES = ['primary', 'backup'];
export const CONNECTION_STATUSES = ['active', 'inactive'];

const str = (v, max = 255) => {
  const s = typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v).trim();
  if (s.length > max) throw new ValidationError('A value is too long (max {max} characters): {value}').withParams({ max, value: `${s.slice(0, 40)}…` });
  return s || null;
};
const id = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v, label) => {
  const s = str(v, 10);
  if (!s) return null;
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw new ValidationError('{label}: a date (YYYY-MM-DD) is required').withParams({ label });
  return s;
};

// "10.1.2.0/24" or "10.1.2.3" -> "10.1.2.0/24" / "10.1.2.3/32"; host bits must be zero
export function normalizeNetwork(value) {
  const s = String(value ?? '').trim();
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/.exec(s);
  if (!m || !IPV4_REGEX.test(m[1]) || (m[2] !== undefined && Number(m[2]) > 32)) {
    throw new ValidationError('Invalid IP or network (CIDR): {value}').withParams({ value: s });
  }
  const bits = m[2] === undefined ? 32 : Number(m[2]);
  const n = m[1].split('.').reduce((acc, o) => acc * 256 + Number(o), 0);
  const base = n - (n % 2 ** (32 - bits));
  if (base !== n) {
    const ip = [24, 16, 8, 0].map((sh) => Math.floor(base / 2 ** sh) % 256).join('.');
    throw new ValidationError('{value} is not a network address: use {network}').withParams({ value: s, network: `${ip}/${bits}` });
  }
  return `${m[1]}/${bits}`;
}

// Networks: array of {network, description} or of strings, or text with one per line
// ("10.1.2.0/24 Core servers") -> [{network, description}] (duplicates dropped)
export function parseNetworks(raw) {
  const items = Array.isArray(raw) ? raw : String(raw ?? '').split(/\r?\n/);
  const seen = new Set();
  const out = [];
  for (const item of items) {
    let network;
    let description;
    if (item && typeof item === 'object') {
      network = item.network;
      description = item.description;
    } else {
      const line = String(item ?? '').trim();
      if (!line) continue;
      const [first, ...rest] = line.split(/\s+/);
      network = first;
      description = rest.join(' ').replace(/^[-–:]\s*/, '');
    }
    const value = normalizeNetwork(network);
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({ network: value, description: str(description) });
  }
  return out;
}

function normalizeContacts(raw) {
  return [].concat(raw ?? []).map((p) => ({ name: str(p?.name), role: str(p?.role), email: str(p?.email), phone: str(p?.phone, 50) }))
    .filter((p) => p.name || p.email || p.phone)
    .map((p) => {
      if (!p.name) throw new ValidationError('Every customer contact needs a name');
      if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw new ValidationError('Invalid email: {email}').withParams({ email: p.email });
      return p;
    });
}

async function normalizeConnections(raw, customerId) {
  // the customer's connections: id -> channel
  const own = new Map(customerId ? (await Customer.connectionChannels(customerId)).map((r) => [r.id, r.channel]) : []);
  const channels = await loadOptions('customer_channel');
  const names = new Set();
  const out = [];
  for (const x of [].concat(raw ?? [])) {
    if (!x || typeof x !== 'object') continue;
    const name = str(x.name);
    const networks = parseNetworks(x.networks);
    if (!name && !str(x.channel) && !networks.length) continue; // empty row
    if (!name) throw new ValidationError('Every connection needs a name');
    if (names.has(name.toLowerCase())) throw new ValidationError('Two connections are named {name}').withParams({ name });
    names.add(name.toLowerCase());
    const channel = str(x.channel, 100);
    if (!channel) throw new ValidationError('Connection {name}: the channel is required').withParams({ name });
    const existingId = own.has(id(x.id)) ? id(x.id) : null;
    const option = channels.find((o) => o.id === channel);
    if (!option) throw new ValidationError('Connection {name}: invalid channel {channel}').withParams({ name, channel });
    // a retired channel stays on a connection that had it; it cannot be newly chosen
    if (option.inactive && own.get(existingId) !== channel) throw new ValidationError('{value} is no longer in use for {label}').withParams({ value: channel, label: 'channel' });
    const role = str(x.role, 20);
    if (role && !CONNECTION_ROLES.includes(role)) throw new ValidationError('Connection {name}: invalid role {role}').withParams({ name, role });
    const status = str(x.status, 20) || 'active';
    if (!CONNECTION_STATUSES.includes(status)) throw new ValidationError('Connection {name}: invalid status {status}').withParams({ name, status });
    const start = date(x.start_date, name);
    const end = date(x.end_date, name);
    if (start && end && end < start) throw new ValidationError('Connection {name}: the end date is before the start date').withParams({ name });
    out.push({
      id: existingId, name, channel, role, device_id: id(x.device_id), local_ip_id: id(x.local_ip_id), status, start_date: start, end_date: end,
      description: str(x.description, 5000), networks,
    });
  }
  await assertIdsExist(out.map((x) => x.device_id).filter(Boolean), (v) => Device.exists(v), 'device');
  await assertIdsExist(out.map((x) => x.local_ip_id).filter(Boolean), (v) => IpAddress.exists(v), 'IP address');
  return out;
}

async function assertUnique(name, code, excludeId) {
  if ((await Customer.findByNameExact(name)).some((c) => c.id !== Number(excludeId))) throw new ConflictError('Customer name already exists: {name}').withParams({ name });
  if (code && (await Customer.findByCode(code)).some((c) => c.id !== Number(excludeId))) throw new ConflictError('Customer code already exists: {code}').withParams({ code });
}

// Fields of the customer row, merged over `current` for a partial update
async function customerData(input, current) {
  const pick = (key, fallback) => (hasKey(input, key) ? input[key] : fallback);
  const name = str(pick('name', current?.name));
  if (!name) throw new ValidationError('Customer name is required');
  const code = str(pick('code', current?.code), 50);
  const type = str(pick('type', current?.type), 100);
  const status = str(pick('status', current?.status), 100);
  await assertOption('customer_type', type, 'type', current?.type);
  await assertOption('customer_status', status, 'status', current?.status);
  const unitId = id(pick('unit_id', current?.unit_id));
  if (unitId && !(await Unit.findById(unitId))) throw new ValidationError('Unit not found');
  const defs = await loadCustomFields('customer');
  const attributes = normalizeAttributes(defs, hasKey(input, 'attributes') ? input.attributes : {}, current?.attributes || {},
    { partial: Boolean(current) && !input.wholeAttributes });
  return { code, name, type, status, unit_id: unitId, description: str(pick('description', current?.description), 5000), attributes };
}

async function links(input, customerId) {
  const out = {};
  if (hasKey(input, 'owner_ids')) {
    out.owners = [...new Set([].concat(input.owner_ids ?? []).map(id).filter(Boolean))];
    await assertIdsExist(out.owners, (v) => Contact.exists(v), 'contact');
  }
  if (hasKey(input, 'contacts')) out.contacts = normalizeContacts(input.contacts);
  if (hasKey(input, 'connections')) out.connections = await normalizeConnections(input.connections, customerId);
  return out;
}

// The networks a save would remove (their connection dropped, or the line deleted) must not
// be used by a service mapping: the mapping is changed first.
async function assertNetworksFree(customerId, connections) {
  const current = (await Customer.findWithLinks(customerId))?.connections || [];
  const wanted = new Map(connections.filter((x) => x.id).map((x) => [x.id, new Set(x.networks.map((n) => n.network))]));
  const cidr = (text) => (text.includes('/') ? text : `${text}/32`);
  const removed = current.flatMap((x) => x.networks.filter((n) => !wanted.get(x.id)?.has(cidr(n.network))).map((n) => n.id));
  const used = await Customer.networksInUse(removed);
  if (used.length) {
    throw new ConflictError('{list}: used by service mappings, remove them there first').withParams({ list: used.map((u) => `${u.address} (${u.mappings})`).join('; ') });
  }
}

async function saveLinks(customerId, l, updatedBy, c) {
  if (l.owners) await Customer.setOwners(customerId, l.owners, c);
  if (l.contacts) await Customer.setContacts(customerId, l.contacts, c);
  if (l.connections) await Customer.setConnections(customerId, l.connections, updatedBy, c);
}

async function withFiles(customer) {
  if (!customer) return customer;
  const files = await FileUpload.findByObject('customer', customer.id);
  customer.docs = files.map((f) => ({ id: f.id, name: f.original_name || f.name, url: FileUpload.getUrl(f) }));
  return customer;
}

// ===== Queries =====
export async function listCustomers(filter) {
  const [items, totalCount] = await Promise.all([Customer.findFilteredList(filter), Customer.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getCustomer(customerId, { files = true } = {}) {
  const customer = await Customer.findWithLinks(customerId);
  if (!customer) throw new NotFoundError('Customer not found');
  return files ? withFiles(customer) : customer;
}

export const getTypeOptions = () => loadOptions('customer_type');
export const getStatusOptions = () => loadOptions('customer_status');
export const getChannelOptions = () => loadOptions('customer_channel');
export const getCustomFields = () => loadCustomFields('customer');
export const getServiceMappings = (customerId) => Customer.serviceMappings(customerId);

// ===== Commands =====
// input: {name, code?, type?, status?, unit_id?, description?, attributes? {key: value}, owner_ids[]?,
//   contacts[]? [{name, role, email, phone}], connections[]? [{id?, name, channel, role, device_id, local_ip_id, status, start_date, end_date, description, networks}], updated_by}
// networks: [{network, description}] or text, one "IP-or-CIDR description" per line. IPs / networks of a
// customer are entered here only: nothing else creates them.
// files(customerId, c): attachments, inside the same transaction
export async function createCustomer(input, client, files) {
  const data = await customerData(input, null);
  await assertUnique(data.name, data.code, null);
  const l = await links({ owner_ids: [], contacts: [], connections: [], ...input }, null);
  const updatedBy = input.updated_by || 'admin';
  const newId = await withTransaction(client, async (c) => {
    const created = await Customer.create({ ...data, updated_by: updatedBy }, c);
    await saveLinks(created.id, l, updatedBy, c);
    if (files) await files(created.id, c);
    return created.id;
  });
  return Customer.findWithLinks(newId, client);
}

// Partial update: only the keys present in input change (attributes: only the fields
// present, unless wholeAttributes - the form sends them all).
export async function updateCustomer(customerId, input, client, files) {
  const current = await Customer.findById(customerId);
  if (!current) throw new NotFoundError('Customer not found');
  const data = await customerData(input, current);
  await assertUnique(data.name, data.code, customerId);
  const l = await links(input, Number(customerId));
  if (l.connections) await assertNetworksFree(Number(customerId), l.connections);
  const updatedBy = input.updated_by || 'admin';
  const removed = await withTransaction(client, async (c) => {
    await Customer.update(customerId, { ...data, updated_by: updatedBy }, c);
    await saveLinks(Number(customerId), l, updatedBy, c);
    return files ? files(Number(customerId), c) : [];
  });
  FileUpload.unlinkFiles(removed || []);
  return Customer.findWithLinks(customerId, client);
}

export async function deleteCustomer(customerId) {
  if (!(await Customer.exists(customerId))) throw new NotFoundError('Customer not found');
  const mappings = await Customer.serviceMappings(customerId);
  if (mappings.length) {
    throw new ConflictError('The customer is used by service mappings ({names}): remove its partner IPs there first').withParams({ names: mappings.map((m) => m.name).join(', ') });
  }
  const files = await withTransaction(null, async (c) => {
    const removed = await FileUpload.removeRecords('customer', customerId, c);
    await Customer.delete(customerId, c);
    return removed;
  });
  FileUpload.unlinkFiles(files);
}
