// Web pages: /device/device (list, export, import, add, edit, delete) and lookups.
import Device from './device.model.js';
import DeviceType from './device-type.model.js';
import Platform from './platform.model.js';
import Contact from '../organize/contact.model.js';
import Tag from '../organize/tag.model.js';
import deviceTypes from './device-type.service.js';
import * as deviceService from './device.service.js';
import { IPV4_REGEX } from '../network/ip-address.service.js';
import { assignedAddresses, ensureIpAddresses } from '../network/ip-ownership.js';
import { excelImport, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page, lookup, lookupByIds, duplicatePage } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';
import { pageOptions } from '../../shared/options.js';

const LIST_URL = '/device/device';

function listFilter(query) {
  return {
    device_type_id: queryValue(query, 'device_type_id'),
    platform_id: queryValue(query, 'platform_id'),
    location: queryValue(query, 'location'),
    manufacturer: queryValue(query, 'manufacturer'),
    device_role: queryValue(query, 'device_role'),
    tags: queryList(query, 'tags'),
  };
}

// The type field accepts an existing type id or a new name (created on save).
async function formInput(req, mode) {
  const b = req.body;
  const type = String(b.type || '').trim();
  const input = {
    name: b.name, manufacturer: b.manufacturer, device_role: b.device_role, platform_id: b.os, location: b.location,
    serial: b.serial_number, management: b.management_address, description: b.description,
    device_type_id: /^\d+$/.test(type) ? Number(type) : (type ? (await deviceTypes.findOrCreate(type)).id : null),
    ip_addresses: b.ip_addresses || [], tags: b.tags || [], contacts: b.managers || [], updated_by: actorName(req),
  };
  if (mode === 'edit') input.vip_ip_addresses = b.vip_ip_addresses || [];
  return input;
}

const options = (rows, text = (r) => r.name) => (rows || []).map((r) => ({ id: r.id, text: text(r) }));

async function renderForm(res, mode, device = {}, copiedFrom = null) {
  const ips = device.ip_addresses || [];
  res.render('pages/device/device_form', {
    ...(await pageOptions('deviceTypes', 'platforms', 'tags')),
    mode, device, copiedFrom, locationOptions: await deviceService.getLocationOptions(),
    selected: {
      ips: options(ips.filter((ip) => ip.role !== 'vip'), (ip) => ip.ip_address),
      vips: options(ips.filter((ip) => ip.role === 'vip'), (ip) => ip.ip_address),
      type: device.device_type_id ? [{ id: device.device_type_id, text: device.device_type_name }] : [],
      platform: device.platform_id ? [{ id: device.platform_id, text: device.platform_name }] : [],
      manufacturer: device.manufacturer ? [{ id: device.manufacturer, text: device.manufacturer }] : [],
      role: device.device_role ? [{ id: device.device_role, text: device.device_role }] : [],
      contacts: options(device.contacts, (c) => (c.email ? `${c.name} (${c.email})` : c.name)),
      tags: options(device.tags),
    },
    title: mode === 'edit' ? 'Edit Device' : 'Add Device', activeMenu: 'device',
  });
}

// Rows: IPs required (created as Reserved when unknown, then assigned to the
// new device), device type required; platform / managers (email) / tags by name.
// Name defaults to <type>_<first IP>. Existing name or assigned IP = skipped.
export const deviceImport = excelImport({
  name: 'device',
  columns: [
    { header: 'Name (Optional - auto-generated if empty)', key: 'name' },
    { header: 'IPAddress (Require, comma-separated if multiple)', key: 'ips' },
    { header: 'Device Type (Require)', key: 'type' },
    { header: 'Platform (Optional, OS)', key: 'platform' },
    { header: 'Location (Optional)', key: 'location' },
    { header: 'Serial Number (Optional)', key: 'serial' },
    { header: 'Management Address (Optional, comma-separated if multiple)', key: 'management' },
    { header: 'Manufacturer (Optional)', key: 'manufacturer' },
    { header: 'Device Role (Optional)', key: 'role' },
    { header: 'Manager (Optional, comma-separated if multiple)', key: 'manager' },
    { header: 'Tag (Optional, comma-separated if multiple)', key: 'tag' },
    { header: 'Description (Optional)', key: 'description' },
  ],
  sample: async () => [
    { name: 'Test Device 1', ips: '192.168.1.100,192.168.1.101', type: 'Router', platform: 'Linux', location: 'DC', serial: 'SN123456',
      management: '192.168.1.1,192.168.1.2', manufacturer: 'Cisco', role: 'Core Router', manager: 'admin@company.com,manager@company.com', tag: 'Tag1,Tag2', description: 'Test device description' },
    { name: '', ips: '192.168.2.3', type: 'Switch', platform: 'Windows', location: 'DR', serial: 'SN789012', management: '192.168.2.1',
      manufacturer: 'HP', role: 'Access Switch', manager: 'admin@company.com', tag: 'Tag1', description: 'Auto-generated name example' },
  ],
  async prepare(req) {
    return { locations: (await deviceService.getLocationOptions()).map((o) => o.id), username: actorName(req) || 'admin' };
  },
  async check(row, ctx) {
    const errors = [];
    row.ipList = splitList(row.ips);
    if (!row.ipList.length) errors.push('At least one IP address is required');
    row.ipList.filter((ip) => !IPV4_REGEX.test(ip)).forEach((ip) => errors.push(`Invalid IP format: ${ip}`));
    if (!row.type) errors.push('Device Type is required');
    if (row.location && ctx.locations.length && !ctx.locations.includes(row.location)) errors.push(`Invalid location: ${row.location}. Valid values: ${ctx.locations.join(', ')}`);

    const missing = [];
    row.typeId = row.type ? (await resolveNames([row.type], (n) => DeviceType.findByNameExact(n), 'Device Type', []))[0] : null;
    row.platformId = row.platform ? (await resolveNames([row.platform], (n) => Platform.findByNameExact(n), 'Platform', missing))[0] : null;
    row.contactIds = await resolveNames(splitList(row.manager), (n) => Contact.findByEmailSearch(n), 'Manager', missing);
    row.tagIds = await resolveNames(splitList(row.tag), (n) => Tag.findByNameExact(n), 'Tag', missing);
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);

    row.deviceName = row.name || (row.type ? `${row.type.toLowerCase().replace(/\s+/g, '-')}_${row.ipList[0]}` : `device_${row.ipList[0]}`);
    let skip;
    if (row.ipList.length && await Device.findByName(row.deviceName)) skip = 'Device name already exists';
    const assigned = await assignedAddresses(row.ipList);
    if (assigned.length) skip = `IP already assigned to a device: ${assigned.join(', ')}`;
    return { errors, skip };
  },
  duplicateKeys: (row) => ['n:' + String(row.deviceName).toLowerCase(), ...row.ipList.map((ip) => 'ip:' + ip)],
  async save(row, client, ctx) {
    if (!row.typeId && row.type) row.typeId = (await deviceTypes.findOrCreate(row.type, client)).id;
    const note = ['Note: This IP address was automatically created from device import feature', `Device: ${row.deviceName}`,
      `Device Type: ${row.type}`, `Location: ${row.location || 'N/A'}`, `Serial: ${row.serial || 'N/A'}`, `Management: ${row.management || 'N/A'}`,
      `Manufacturer: ${row.manufacturer || 'N/A'}`, `Device Role: ${row.role || 'N/A'}`, `Description: ${row.description || 'N/A'}`].join('\n');
    await deviceService.createDevice({
      name: row.deviceName, device_type_id: row.typeId, platform_id: row.platformId, location: row.location || null,
      serial: row.serial || null, management: row.management || null, manufacturer: row.manufacturer || null, device_role: row.role || null,
      description: row.description || null, tags: row.tagIds, contacts: row.contactIds,
      ip_addresses: await ensureIpAddresses(row.ipList, note, ctx.username, client), updated_by: ctx.username,
    }, client);
  },
  resultUrl: (file) => `/device/download/device-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, locationOptions] = await Promise.all([
      deviceService.listDevices({ search, page: pageNo, pageSize, ...filter }),
      deviceService.getLocationOptions(),
    ]);
    res.render('pages/device/device_list', {
    ...(await pageOptions('deviceTypes', 'platforms', 'tags')),
      deviceList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, locationOptions, ...takeFlash(req), title: 'Device List', activeMenu: 'device',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await deviceService.listDevices({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    await sendExcel(res, {
      filename: 'device-list', sheet: 'Device List',
      columns: [
        { header: req.t('Device Name'), value: (d) => d.name, width: 28 },
        { header: req.t('Device Type'), value: (d) => d.device_type_name, width: 16 },
        { header: req.t('Platform'), value: (d) => d.platform_name, width: 16 },
        { header: req.t('Manufacturer'), value: (d) => d.manufacturer, width: 16 },
        { header: req.t('Device Role'), value: (d) => d.device_role, width: 16 },
        { header: req.t('Serial Number'), value: (d) => d.serial_number, width: 18 },
        { header: req.t('Management Address'), value: (d) => d.management_address, width: 22 },
        { header: req.t('IP Addresses'), value: (d) => d.ip_addresses.filter((ip) => ip.role !== 'vip').map((ip) => ip.ip_address) },
        { header: req.t('VIP IP Address(es)'), value: (d) => d.ip_addresses.filter((ip) => ip.role === 'vip').map((ip) => ip.ip_address) },
        { header: req.t('Location'), value: (d) => d.location, width: 12 },
        { header: req.t('Tags'), value: (d) => (d.tags || []).map((tg) => tg.name) },
        { header: req.t('Managers'), value: (d) => (d.contacts || []).map((c) => c.email || c.name) },
        { header: req.t('Description'), value: (d) => d.description, width: 40 },
        { header: req.t('Updated'), value: (d) => d.updated_at && new Date(d.updated_at), width: 20 },
        { header: req.t('Updated By'), value: (d) => d.updated_by, width: 14 },
      ],
      rows: items,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),
  // Name, IP addresses and serial number are left empty (unique to the source); VIPs are set when editing
  duplicateForm: duplicatePage(LIST_URL, (id) => deviceService.getDevice(id), ({ name, serial_number, ip_addresses, ...rest }) => rest,
    (res, device, source) => renderForm(res, 'add', device, source)),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await deviceService.getDevice(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, async () => deviceService.createDevice(await formInput(req, 'add')), 'Device added successfully!'),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, async () => deviceService.updateDevice(req.params.id, await formInput(req, 'edit')), 'Device updated successfully!'),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL,
    () => deviceService.deleteDevice(req.params.id, { deleteIp: ['true', '1'].includes(String(req.body.delete_ip).toLowerCase()) }),
    'Device deleted successfully!'),

  // ===== AJAX =====
  lookup: lookup((search) => Device.select2Search(search)),
  // Select2 restore: ?ids=1&ids=2 -> [{id, text}]
  lookupByIds: lookupByIds((ids) => Device.findByIds(ids), (d) => d.name),
  // Known values of the free-text fields (tags mode: new values allowed)
  manufacturers: lookup(async (search) => (await Device.distinctValues('manufacturer', search)).map((v) => ({ id: v, text: v }))),
  roles: lookup(async (search) => (await Device.distinctValues('device_role', search)).map((v) => ({ id: v, text: v }))),
};
