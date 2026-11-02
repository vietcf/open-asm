// Devices: validation and persistence shared by the web pages and the REST API.
import Device from './device.model.js';
import DeviceType from './device-type.model.js';
import Platform from './platform.model.js';
import Tag from '../organize/tag.model.js';
import Contact from '../organize/contact.model.js';
import { assertPrimaryIps, assertVipIps, setPrimaryIps, setVipIps, ownedIpIds, releaseIps } from '../network/ip-ownership.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { toIdArray, hasKey, loadOptions, assertOption, resolveRelations, saveRelations } from '../../shared/service.js';

const RELATIONS = {
  tags: { label: 'tag', exists: (id) => Tag.exists(id), save: (id, ids, c) => Device.setTags(id, ids, c) },
  contacts: { label: 'contact', exists: (id) => Contact.exists(id), save: (id, ids, c) => Device.setContacts(id, ids, c) },
};
// input key -> column (serial / management are the API names)
const FIELDS = { name: 'name', manufacturer: 'manufacturer', device_role: 'device_role', platform_id: 'platform_id', device_type_id: 'device_type_id',
  location: 'location', serial: 'serial_number', management: 'management_address', description: 'description' };

// ===== Options ({id, text}) =====
export const getLocationOptions = () => loadOptions('device_location');

// ===== Queries =====
export async function listDevices(filter) {
  const [items, totalCount] = await Promise.all([Device.findFilteredList(filter), Device.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getDevice(id) {
  const device = await Device.getFullDetail(id);
  if (!device) throw new NotFoundError('Device not found');
  return device;
}

// ===== Validation =====
const clean = (v) => (v === undefined || v === '' ? null : (typeof v === 'string' ? v.trim() || null : v));

async function normalize(input, current = null) {
  const data = {};
  for (const [key, column] of Object.entries(FIELDS)) {
    if (!current || hasKey(input, key)) data[column] = clean(input[key]);
  }
  const changed = (column) => data[column] !== undefined;
  if (changed('name')) {
    if (!data.name) throw new ValidationError(current ? 'Device name cannot be empty' : 'Device name is required');
    const duplicate = await Device.findByName(data.name);
    if (duplicate && String(duplicate.id) !== String(current?.id)) throw new ConflictError('Device already exists with this name');
  }
  if (changed('device_type_id')) {
    if (!data.device_type_id) throw new ValidationError(current ? 'Device type ID cannot be empty' : 'Device type is required');
    if (!(await DeviceType.exists(data.device_type_id))) throw new ValidationError('Invalid device_type_id');
  }
  if (changed('platform_id') && data.platform_id && !(await Platform.exists(data.platform_id))) throw new ValidationError('Invalid platform_id');
  if (changed('location')) await assertOption('device_location', data.location, 'location');
  return data;
}

// ===== Commands =====
// input: {name, device_type_id, ip_addresses[], platform_id?, location?, serial?, management?,
//         manufacturer?, device_role?, description?, tags?, contacts?, updated_by?}
export async function createDevice(input, client) {
  const data = await normalize(input);
  const ipIds = toIdArray(input.ip_addresses);
  await assertPrimaryIps('device', ipIds, null, client);
  const links = await resolveRelations(input, RELATIONS);
  const id = await withTransaction(client, async (c) => {
    const created = await Device.create({ ...data, updated_by: input.updated_by || null }, c);
    await setPrimaryIps('device', created.id, ipIds, c);
    await saveRelations(created.id, links, RELATIONS, c);
    return created.id;
  });
  return Device.getFullDetail(id, client);
}

// Partial update: only the keys present in input change (links included).
export async function updateDevice(id, input, client) {
  const current = await Device.getFullDetail(id, client);
  if (!current) throw new NotFoundError('Device not found');
  const allowed = [...Object.keys(FIELDS), ...Object.keys(RELATIONS), 'ip_addresses', 'vip_ip_addresses', 'updated_by'];
  const unknown = Object.keys(input).filter((k) => !allowed.includes(k));
  if (unknown.length) throw new ValidationError(`Invalid field(s): ${unknown.join(', ')}`);

  const data = await normalize(input, current);
  const ipIds = hasKey(input, 'ip_addresses') ? toIdArray(input.ip_addresses) : null;
  if (ipIds) await assertPrimaryIps('device', ipIds, id, client);
  const vipIds = hasKey(input, 'vip_ip_addresses') ? toIdArray(input.vip_ip_addresses) : null;
  if (vipIds) await assertVipIps('device', vipIds, ipIds || current.ip_addresses.filter((ip) => ip.role !== 'vip').map((ip) => ip.id));
  const links = await resolveRelations(input, RELATIONS, { partial: true });

  await withTransaction(client, async (c) => {
    if (Object.keys(data).length || input.updated_by) await Device.updatePartial(id, { ...data, updated_by: input.updated_by || undefined }, c);
    if (ipIds) await setPrimaryIps('device', id, ipIds, c);
    if (vipIds) await setVipIps('device', id, vipIds, input.updated_by || null, c);
    await saveRelations(id, links, RELATIONS, c);
  });
  return Device.getFullDetail(id, client);
}

// deleteIp: false releases the device's IPs ('reserved'), true deletes them.
export async function deleteDevice(id, { deleteIp = false } = {}) {
  if (!(await Device.exists(id))) throw new NotFoundError('Device not found');
  await withTransaction(null, async (c) => {
    const ipIds = await ownedIpIds('device', id, c);
    await Device.remove(id, c);
    await releaseIps(ipIds, { deleteIp }, c);
  });
}
