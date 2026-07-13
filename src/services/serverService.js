import Server from '../models/Server.js';
import IpAddress from '../models/IpAddress.js';
import Platform from '../models/Platform.js';
import Contact from '../models/Contact.js';
import System from '../models/System.js';
import Agent from '../models/Agent.js';
import Service from '../models/Service.js';
import Tag from '../models/Tag.js';
import Configuration from '../models/Configuration.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';
import { withTransaction } from './transaction.js';
import { getLocationOptions as getServerLocationOptions } from './deviceService.js';

const toIdArray = v => {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(Number).filter(x => !isNaN(x));
};

// Server location reuses the same 'device_location' config key as Device, so
// this re-exports deviceService's loader rather than duplicating it.
export { getServerLocationOptions };

async function loadOptions(configKey) {
  try {
    const config = await Configuration.findById(configKey);
    if (config && config.value) {
      const parsed = JSON.parse(config.value);
      if (Array.isArray(parsed)) {
        return parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) { /* fall through to empty */ }
  return [];
}
export async function getServerStatusOptions() {
  return loadOptions('server_status');
}
export async function getServerTypeOptions() {
  return loadOptions('server_type');
}

async function validateLocation(location) {
  if (!location) return;
  const options = await getServerLocationOptions();
  if (!options.length) return;
  if (!options.some(o => o.value === location)) throw new ValidationError(`Invalid location: ${location}`);
}
async function validateStatus(status) {
  if (!status) return;
  const options = await getServerStatusOptions();
  if (!options.length) return;
  if (!options.some(o => o.value === status)) throw new ValidationError(`Invalid status: ${status}`);
}
async function validateOs(os) {
  if (!os) return;
  if (!(await Platform.exists(os))) throw new ValidationError(`Invalid platform (os) ID: ${os}`);
}
async function validateIds(ids, existsFn, label) {
  const invalid = [];
  for (const id of ids) {
    if (!(await existsFn(id))) invalid.push(id);
  }
  if (invalid.length) throw new ValidationError(`Invalid ${label} IDs: ${invalid.join(', ')}`);
}
const validateManagerIds = ids => validateIds(ids, id => Contact.exists(id), 'manager (contact)');
const validateSystemIds = ids => validateIds(ids, id => System.exists(id), 'system');
const validateAgentIds = ids => validateIds(ids, id => Agent.exists(id), 'agent');
const validateServiceIds = ids => validateIds(ids, id => Service.exists(id), 'service');
const validateTagIds = ids => validateIds(ids, id => Tag.exists(id), 'tag');

// excludeServerId: on update, an IP already assigned to THIS server is fine.
async function validateIpAddressIds(ids, excludeServerId) {
  const invalid = [];
  const assigned = [];
  for (const id of ids) {
    const details = await IpAddress.findById(id);
    if (!details) {
      invalid.push(id);
    } else if (details.status === 'assigned' && (excludeServerId == null || String(details.server_id) !== String(excludeServerId))) {
      assigned.push(`IP ${details.ip_address} (ID: ${id})`);
    }
  }
  if (invalid.length) throw new ValidationError(`Invalid IP address IDs: ${invalid.join(', ')}`);
  if (assigned.length) throw new ValidationError(`Cannot use already assigned IP addresses: ${assigned.join(', ')}`);
}

export async function assertNameAvailable(name, excludeId) {
  const existing = await Server.findByName(name);
  if (existing && (excludeId == null || String(existing.id) !== String(excludeId))) {
    throw new ConflictError('Server name already exists');
  }
}

export async function listServers(filter) {
  const [items, totalCount] = await Promise.all([
    Server.findFilteredList(filter),
    Server.countFiltered(filter)
  ]);
  return { items, totalCount };
}

export async function getServer(id) {
  const server = await Server.findByIdWithDetails(id);
  if (!server) throw new NotFoundError('Server not found');
  return server;
}

// input: {name, os?, status?, location?, type?, description?, managers?,
//         systems?, agents?, services?, tags?, ip_addresses, updated_by?}
// Existence validation on os/managers/systems/agents/services/tags and the
// already-assigned-IP guard were previously API-only — adopted here for both
// consumers, matching the Device/IP precedent set earlier in this refactor.
export async function createServer(input, client) {
  const name = (input.name || '').trim();
  if (!name) throw new ValidationError('Server name is required');
  await assertNameAvailable(name);

  const os = input.os || null;
  await validateOs(os);
  const status = typeof input.status === 'string' ? input.status.trim() : input.status;
  await validateStatus(status);
  const location = typeof input.location === 'string' ? input.location.trim() : input.location;
  await validateLocation(location);
  const type = typeof input.type === 'string' ? input.type.trim() : input.type;

  const managers = toIdArray(input.managers);
  if (managers.length) await validateManagerIds(managers);
  const systems = toIdArray(input.systems);
  if (systems.length) await validateSystemIds(systems);
  const agents = toIdArray(input.agents);
  if (agents.length) await validateAgentIds(agents);
  const services = toIdArray(input.services);
  if (services.length) await validateServiceIds(services);
  const tags = toIdArray(input.tags);
  if (tags.length) await validateTagIds(tags);

  const ipAddresses = toIdArray(input.ip_addresses);
  if (ipAddresses.length === 0) throw new ValidationError('At least one IP address is required');
  await validateIpAddressIds(ipAddresses);

  const description = typeof input.description === 'string' ? (input.description.trim() || null) : (input.description ?? null);
  const username = input.updated_by || 'admin';

  const serverId = await withTransaction(client, async (c) => {
    const id = await Server.create({ name, os, status, location, type, description, username, client: c });
    await Server.setIpAddresses(id, ipAddresses, c);
    await Server.setManagers(id, managers, c);
    await Server.setSystems(id, systems, c);
    await Server.setAgents(id, agents, c);
    await Server.setServices(id, services, c);
    await Server.setTags(id, tags, c);
    return id;
  });
  return Server.findByIdWithDetails(serverId);
}

const UPDATABLE_FIELDS = [
  'name', 'description', 'os', 'status', 'type', 'location',
  'tags', 'managers', 'systems', 'agents', 'services', 'ip_addresses'
];
const ARRAY_FIELD_SPECS = [
  { key: 'tags', validate: validateTagIds, set: Server.setTags },
  { key: 'managers', validate: validateManagerIds, set: Server.setManagers },
  { key: 'systems', validate: validateSystemIds, set: Server.setSystems },
  { key: 'agents', validate: validateAgentIds, set: Server.setAgents },
  { key: 'services', validate: validateServiceIds, set: Server.setServices }
];

// Partial update (has-key semantics) with a strict field allow-list, matching
// the API's existing behavior.
export async function updateServer(id, input, client) {
  const current = await Server.findById(id);
  if (!current) throw new NotFoundError('Server not found');

  const invalidFields = Object.keys(input).filter(k => !UPDATABLE_FIELDS.includes(k) && k !== 'updated_by');
  if (invalidFields.length > 0) {
    throw new ValidationError(`Invalid field(s): ${invalidFields.join(', ')}`);
  }

  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  const name = has('name') ? (typeof input.name === 'string' ? input.name.trim() : input.name) : current.name;
  const description = has('description') ? (typeof input.description === 'string' ? input.description.trim() : input.description) : current.description;
  const os = has('os') ? input.os : current.os_id;
  const status = has('status') ? input.status : current.status;
  const type = has('type') ? input.type : current.type;
  const location = has('location') ? input.location : current.location;

  if (has('name') && name && name !== current.name) {
    await assertNameAvailable(name, id);
  }
  if (has('location') && location) await validateLocation(location);
  if (has('status') && status) await validateStatus(status);
  if (has('os') && os) await validateOs(os);

  const normalizedArrays = {};
  for (const { key, validate } of ARRAY_FIELD_SPECS) {
    if (has(key)) {
      const arr = toIdArray(input[key]);
      if (arr.length > 0) await validate(arr);
      normalizedArrays[key] = arr;
    }
  }
  if (has('ip_addresses')) {
    const arr = toIdArray(input.ip_addresses);
    // The API's original update path only enforced "at least one IP" on
    // create — clearing to zero on update silently succeeded, unlike the
    // frontend which always required at least one. A server with no IPs
    // isn't a meaningful state, so the frontend's stricter rule is adopted
    // here for both.
    if (arr.length === 0) throw new ValidationError('At least one IP address is required');
    await validateIpAddressIds(arr, id);
    normalizedArrays.ip_addresses = arr;
  }

  const username = input.updated_by || 'admin';

  await withTransaction(client, async (c) => {
    await Server.update(id, { name, os, status, location, type, description, username, client: c });
    for (const { key, set } of ARRAY_FIELD_SPECS) {
      if (has(key)) await set(id, normalizedArrays[key], c);
    }
    if (has('ip_addresses')) await Server.setIpAddresses(id, normalizedArrays.ip_addresses, c);
  });

  return Server.findByIdWithDetails(id);
}

// Wrapped in a transaction — the frontend previously called Server.remove()
// non-transactionally (partial failure across its 5 DELETEs could leave
// orphaned rows); the API already did this correctly.
// deleteIp: false (default) releases the server's IPs back to 'reserved'
// instead of deleting them.
export async function deleteServer(id, { deleteIp = false } = {}) {
  const exists = await Server.exists(id);
  if (!exists) throw new NotFoundError('Server not found');
  await withTransaction(null, async (c) => {
    await Server.remove(id, c, { deleteIp });
  });
}
