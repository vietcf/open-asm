import Device from '../models/Device.js';
import DeviceType from '../models/DeviceType.js';
import Platform from '../models/Platform.js';
import Tag from '../models/Tag.js';
import Contact from '../models/Contact.js';
import IpAddress from '../models/IpAddress.js';
import Configuration from '../models/Configuration.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';
import { withTransaction } from './transaction.js';

const safe = v => (v === undefined || v === '') ? null : v;
const safeStr = v => (v === undefined || v === '') ? null : (typeof v === 'string' ? v.trim() : v);
const toIdArray = v => {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
};

export async function getLocationOptions() {
  let locationOptions = [];
  try {
    const config = await Configuration.findById('device_location');
    if (config && config.value) {
      let parsed;
      try { parsed = JSON.parse(config.value); } catch { parsed = null; }
      if (Array.isArray(parsed)) {
        locationOptions = parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) {
    locationOptions = [];
  }
  return Array.isArray(locationOptions) ? locationOptions : [];
}

// If no locations are configured, location is treated as free text (skip check) —
// avoids the API becoming stricter than before once the fallback list is dropped.
async function validateLocation(location) {
  const locationOptions = await getLocationOptions();
  if (!locationOptions.length) return;
  const allowed = locationOptions.map(opt => opt.value);
  if (!allowed.includes(location)) {
    throw new ValidationError(`Invalid location. Allowed values: ${allowed.join(', ')}`);
  }
}

export async function validateDeviceTypeId(deviceTypeId) {
  if (!(await DeviceType.exists(deviceTypeId))) {
    throw new ValidationError('Invalid device_type_id');
  }
}

export async function validatePlatformId(platformId) {
  if (!(await Platform.exists(platformId))) {
    throw new ValidationError('Invalid platform_id');
  }
}

export async function validateTagIds(tagIds) {
  for (const tagId of tagIds) {
    if (!(await Tag.exists(tagId))) {
      throw new ValidationError(`Tag does not exist: ${tagId}`);
    }
  }
}

export async function validateContactIds(contactIds) {
  for (const contactId of contactIds) {
    if (!(await Contact.exists(contactId))) {
      throw new ValidationError(`Contact does not exist: ${contactId}`);
    }
  }
}

// excludeDeviceId: when checking IPs for an update, an IP already assigned to
// THIS device is fine; assigned to any other device is rejected.
// client is optional — pass the caller's transaction client so a newly
// created IP address (not yet committed) is still visible here, instead of
// falsely reporting it as an invalid ID via a plain pool read.
export async function validateIpAddressIds(ipIds, excludeDeviceId, client) {
  const invalidIps = [];
  const assignedIps = [];
  for (const ipId of ipIds) {
    const ip = await IpAddress.findById(ipId, client);
    if (!ip) {
      invalidIps.push(ipId);
    } else if (ip.status === 'assigned' && (excludeDeviceId == null || String(ip.device_id) !== String(excludeDeviceId))) {
      assignedIps.push(`IP ${ip.ip_address} (ID: ${ipId})`);
    }
  }
  if (invalidIps.length > 0) throw new ValidationError(`Invalid IP address IDs: ${invalidIps.join(', ')}`);
  if (assignedIps.length > 0) throw new ValidationError(`Cannot use already assigned IP addresses: ${assignedIps.join(', ')}`);
}

export async function assertNameAvailable(name, excludeId) {
  const duplicate = await Device.findByName(name);
  if (duplicate && (excludeId == null || String(duplicate.id) !== String(excludeId))) {
    throw new ConflictError('Device already exists with this name');
  }
}

export async function listDevices(filter) {
  const [items, totalCount] = await Promise.all([
    Device.findFilteredList(filter),
    Device.countFiltered(filter)
  ]);
  return { items, totalCount };
}

export async function getDevice(id) {
  const device = await Device.getFullDetail(id);
  if (!device) throw new NotFoundError('Device not found');
  return device;
}

// input: {name, device_type_id, ip_addresses[], platform_id?, location?, serial?,
//         management?, manufacturer?, device_role?, description?, tags?, contacts?,
//         updated_by?}
export async function createDevice(input, client) {
  const name = typeof input.name === 'string' ? input.name.trim() : String(input.name || '').trim();
  if (!name) throw new ValidationError('Device name is required');

  if (!input.device_type_id) throw new ValidationError('Device type is required');
  await validateDeviceTypeId(input.device_type_id);

  const ipAddresses = toIdArray(input.ip_addresses);
  if (ipAddresses.length === 0) throw new ValidationError('At least one IP address is required');
  await validateIpAddressIds(ipAddresses, undefined, client);

  await assertNameAvailable(name);

  if (input.platform_id) await validatePlatformId(input.platform_id);
  if (input.location) await validateLocation(input.location);

  const tags = toIdArray(input.tags);
  if (tags.length) await validateTagIds(tags);
  const contacts = toIdArray(input.contacts);
  if (contacts.length) await validateContactIds(contacts);

  const device = await withTransaction(client, async (c) => {
    const created = await Device.create({
      name,
      manufacturer: safeStr(input.manufacturer),
      device_role: safeStr(input.device_role),
      platform_id: safe(input.platform_id),
      device_type_id: input.device_type_id,
      location: safeStr(input.location),
      serial_number: safeStr(input.serial),
      management_address: safeStr(input.management),
      description: safeStr(input.description),
      updated_by: input.updated_by || null
    }, c);
    await Device.setIpAddresses(created.id, ipAddresses, c);
    if (tags.length) await Device.setTags(created.id, tags, c);
    if (contacts.length) await Device.setContacts(created.id, contacts, c);
    return created;
  });
  // Read after commit: getFullDetail always queries via the pool (it takes no
  // client param), so reading inside the still-open transaction would race
  // against an uncommitted write on a different connection.
  return Device.getFullDetail(device.id);
}

// Partial update: only fields present as own-properties of `input` are touched.
// For tags/contacts/ip_addresses specifically: key present (even as an empty
// array) clears/replaces the association; key absent leaves it untouched.
const UPDATABLE_FIELDS = [
  'name', 'manufacturer', 'device_role', 'platform_id', 'device_type_id', 'location',
  'serial', 'management', 'description', 'tags', 'contacts', 'ip_addresses', 'updated_by'
];

export async function updateDevice(id, input, client) {
  const current = await Device.getFullDetail(id);
  if (!current) throw new NotFoundError('Device not found');

  const invalidFields = Object.keys(input).filter(k => !UPDATABLE_FIELDS.includes(k));
  if (invalidFields.length > 0) {
    throw new ValidationError(`Invalid field(s): ${invalidFields.join(', ')}`);
  }

  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  const updateFields = {};

  if (has('name')) {
    const name = typeof input.name === 'string' ? input.name.trim() : String(input.name || '').trim();
    if (!name) throw new ValidationError('Device name cannot be empty');
    updateFields.name = name;
  }
  if (has('manufacturer')) updateFields.manufacturer = safeStr(input.manufacturer);
  if (has('device_role')) updateFields.device_role = safeStr(input.device_role);
  if (has('platform_id')) updateFields.platform_id = safe(input.platform_id);
  if (has('device_type_id')) {
    if (!input.device_type_id) throw new ValidationError('Device type ID cannot be empty');
    updateFields.device_type_id = input.device_type_id;
  }
  if (has('location')) updateFields.location = safeStr(input.location);
  if (has('serial')) updateFields.serial_number = safeStr(input.serial);
  if (has('management')) updateFields.management_address = safeStr(input.management);
  if (has('description')) updateFields.description = safeStr(input.description);
  if (input.updated_by) updateFields.updated_by = input.updated_by;

  if (has('device_type_id')) await validateDeviceTypeId(updateFields.device_type_id);
  if (has('platform_id') && updateFields.platform_id) await validatePlatformId(updateFields.platform_id);
  if (has('location') && updateFields.location) await validateLocation(updateFields.location);

  let ipAddresses = null;
  if (has('ip_addresses')) {
    ipAddresses = toIdArray(input.ip_addresses);
    if (ipAddresses.length === 0) throw new ValidationError('At least one IP address is required');
    await validateIpAddressIds(ipAddresses, id, client);
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

  if (has('name')) await assertNameAvailable(updateFields.name, id);

  await withTransaction(client, async (c) => {
    if (Object.keys(updateFields).length > 0) {
      await Device.updatePartial(id, updateFields, c);
    }
    if (ipAddresses) await Device.setIpAddresses(id, ipAddresses, c);
    if (tags) await Device.setTags(id, tags, c);
    if (contacts) await Device.setContacts(id, contacts, c);
  });
  // Read after commit — see the comment in createDevice for why.
  return Device.getFullDetail(id);
}

// deleteIp: false (default) releases the device's IPs back to 'reserved'
// instead of deleting them.
export async function deleteDevice(id, { deleteIp = false } = {}) {
  const exists = await Device.exists(id);
  if (!exists) throw new NotFoundError('Device not found');
  await withTransaction(null, async (c) => {
    await Device.remove(id, c, { deleteIp });
  });
}
