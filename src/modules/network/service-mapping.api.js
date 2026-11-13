// REST: /api/v1/service-mappings (plain bodies, errors as {error})
// Integrations (F5, Citrix ADC...) create the IP addresses, domains and systems
// through their own APIs first, then send their ids here; nothing is created
// on the fly and an unknown id is a 400.
import ServiceMapping from './service-mapping.model.js';
import IpAddress from './ip-address.model.js';
import Domain from './domain.model.js';
import System from '../system/system.model.js';
import * as smService from './service-mapping.service.js';
import { apiHandler, apiPage, apiActor, paginated } from '../../shared/api.js';
import { ValidationError, NotFoundError } from '../../shared/errors.js';

const FIELDS = ['name', 'domain_id', 'ip_address_id', 'port', 'protocol', 'direction', 'scope', 'access_mode', 'allowed_ips', 'partner_ips',
  'provider', 'provider_port', 'provider_protocol', 'nat_ip_address_id', 'nat_port', 'system_id', 'description', 'members'];
const STATUS_OPTIONS = ['active', 'inactive'];
const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);

// null / '' -> null, else a positive integer id (or a 400)
function toId(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new ValidationError(`Invalid ${field}: {value}`).withParams({ value });
  return id;
}

async function assertExists(id, field, find) {
  if (id !== null && !(await find(id))) throw new ValidationError(`${field} not found: {id}`).withParams({ id });
}

// [{ip_address_id, port?, protocol?, status?}] -> the service's parallel member_ip / member_port / member_protocol / member_status
async function toMembers(raw) {
  if (!Array.isArray(raw)) throw new ValidationError('members must be an array of {ip_address_id, port, status}');
  const member_ip = [];
  const member_port = [];
  const member_protocol = [];
  const member_status = [];
  for (const m of raw) {
    const id = toId(m?.ip_address_id, 'members[].ip_address_id');
    if (id === null) throw new ValidationError('members[].ip_address_id is required');
    await assertExists(id, 'IP address', (x) => IpAddress.exists(x));
    const port = m.port === null || m.port === undefined || m.port === '' ? null : Number(m.port);
    if (port !== null && !(Number.isInteger(port) && port >= 1 && port <= 65535)) throw new ValidationError('Invalid members[].port: {port}').withParams({ port: m.port });
    const status = m.status ? String(m.status).toLowerCase() : 'active';
    if (!STATUS_OPTIONS.includes(status)) throw new ValidationError('Invalid members[].status: {status}').withParams({ status: m.status });
    member_protocol.push(m.protocol ? String(m.protocol) : '');
    member_ip.push(String(id));
    member_port.push(port);
    member_status.push(status);
  }
  return { member_ip, member_port, member_protocol, member_status };
}

// JSON body -> service input; only the keys present are passed (PUT is partial)
async function toInput(body, req) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('A JSON object body is required');
  const unknown = Object.keys(body).filter((k) => !FIELDS.includes(k));
  if (unknown.length) throw new ValidationError(`Invalid field(s): ${unknown.join(', ')}`);
  const input = { updated_by: apiActor(req) };
  for (const key of ['name', 'port', 'protocol', 'direction', 'scope', 'access_mode', 'allowed_ips', 'partner_ips', 'provider', 'provider_port', 'provider_protocol', 'description']) {
    if (has(body, key)) input[key] = body[key];
  }
  if (has(body, 'port') && body.port !== null && !(Number.isInteger(Number(body.port)) && Number(body.port) >= 1 && Number(body.port) <= 65535)) {
    throw new ValidationError('Invalid port: {port}').withParams({ port: body.port });
  }
  if (has(body, 'ip_address_id')) {
    const id = toId(body.ip_address_id, 'ip_address_id');
    await assertExists(id, 'IP address', (x) => IpAddress.exists(x));
    input.ip_address = id === null ? '' : String(id);
  }
  if (has(body, 'nat_ip_address_id')) {
    const id = toId(body.nat_ip_address_id, 'nat_ip_address_id');
    await assertExists(id, 'IP address', (x) => IpAddress.exists(x));
    input.nat_ip = id === null ? '' : String(id);
  }
  if (has(body, 'nat_port')) input.nat_port = body.nat_port;
  if (has(body, 'domain_id')) {
    const id = toId(body.domain_id, 'domain_id');
    await assertExists(id, 'Domain', (x) => Domain.exists(x));
    input.domain = id === null ? '' : String(id);
  }
  if (has(body, 'system_id')) {
    const id = toId(body.system_id, 'system_id');
    await assertExists(id, 'System', (x) => System.exists(x));
    input.system_id = id;
  }
  if (has(body, 'members')) Object.assign(input, await toMembers(body.members));
  return input;
}

export default {
  // ?search=&page=&pageSize=&protocol=&provider=&direction=&scope=&access_mode=&system_id=&device_id=&customer_id=
  // (the same filters as the web list)
  getAll: apiHandler(async (req, res) => {
    const { search, page, pageSize } = apiPage(req.query);
    const q = (k) => (typeof req.query[k] === 'string' && req.query[k].trim() ? req.query[k].trim() : '');
    const bad = ['system_id', 'device_id'].find((k) => q(k) && !/^\d+$/.test(q(k)));
    if (bad) return res.status(400).json({ error: `"${bad}" must be an integer` });
    const filter = { search, page, pageSize, protocol: q('protocol'), provider: q('provider'), direction: q('direction'),
      scope: q('scope'), access_mode: q('access_mode'), system_id: q('system_id'), device_id: q('device_id'), customer_id: q('customer_id') };
    const { items, totalCount } = await smService.listServiceMappings(filter);
    res.json(paginated(items, totalCount, page, pageSize));
  }),

  // ?name= exact (case-insensitive) match; integrations use it to update instead of create
  find: apiHandler(async (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'Search term "name" is required' });
    const rows = await ServiceMapping.findByNameExact(name);
    const data = await Promise.all(rows.map((r) => ServiceMapping.findByIdWithRelations(r.id)));
    res.json({ data, count: data.length });
  }),

  getById: apiHandler(async (req, res) => {
    res.json(await smService.getServiceMapping(toId(req.params.id, 'id') ?? 0));
  }),

  create: apiHandler(async (req, res) => {
    const body = req.body || {};
    // which IPs and ports are required depends on the flow (direction-scope), checked by the service
    res.status(201).json(await smService.createServiceMapping(await toInput(body, req)));
  }),

  // Partial: only the keys sent change; "members" replaces every backend
  update: apiHandler(async (req, res) => {
    const id = toId(req.params.id, 'id');
    if (!(await ServiceMapping.exists(id))) throw new NotFoundError('Service Mapping not found');
    res.json(await smService.updateServiceMapping(id, await toInput(req.body, req)));
  }),

  remove: apiHandler(async (req, res) => {
    await smService.deleteServiceMapping(toId(req.params.id, 'id') ?? 0);
    res.status(204).end();
  }),
};
