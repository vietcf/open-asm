// Web pages: /network/subnet-address (list, import, add, edit, delete).
import Subnet from './subnet.model.js';
import Tag from '../organize/tag.model.js';
import * as subnetService from './subnet.service.js';
import { excelImport, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/network/subnet-address';
const CIDR_REGEX = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;
const IP_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;
const listFilter = (query) => ({ tags: queryList(query, 'tags'), zone: queryValue(query, 'zone'), environment: queryValue(query, 'environment') });

// Small lists rendered with the page
const pageOptions = async () => {
  const [tagOptions, zoneOptions, environmentOptions] = await Promise.all([Tag.options(), Subnet.distinctValues('zone'), Subnet.distinctValues('environment')]);
  return { tagOptions, zoneOptions, environmentOptions };
};

const formInput = (req) => {
  const b = req.body;
  return { description: b.description, zone: b.zone, environment: b.environment, gateway_ip_id: b.gateway_ip_id || null, tags: b.tags ?? [], updated_by: actorName(req) };
};

async function renderForm(res, mode, subnet = {}) {
  res.render('pages/network/subnet_form', {
    mode, subnet, ...(await pageOptions()),
    title: mode === 'edit' ? 'Edit Subnet' : 'Add Subnet', activeMenu: 'subnet-address',
  });
}

export const subnetImport = excelImport({
  name: 'subnet',
  columns: [
    { header: 'Subnet Address (Require)', key: 'address' },
    { header: 'Description (Optional)', key: 'description' },
    { header: 'Zone (Optional)', key: 'zone' },
    { header: 'Environment (Optional)', key: 'environment' },
    { header: 'Tag (Optional, comma-separated if multiple)', key: 'tags' },
  ],
  sample: async () => [
    { address: '192.168.1.0/24', description: 'Office LAN', zone: 'Internal', environment: 'Production', tags: 'Production' },
    { address: '10.10.0.0/16', description: '', zone: 'DMZ', environment: '', tags: '' },
  ],
  prepare: async (req) => ({ username: actorName(req) || 'admin' }),
  async check(row) {
    const errors = [];
    if (!row.address) errors.push('Subnet Address is required');
    else if (!CIDR_REGEX.test(row.address)) errors.push('Invalid subnet format. Must be in format: 192.168.1.0/24');
    const missing = [];
    row.tagIds = await resolveNames(splitList(row.tags), (n) => Tag.findByNameExact(n), 'Tag', missing);
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);
    const skip = !errors.length && await Subnet.findByAddress(row.address) ? 'Subnet address already exists' : undefined;
    return { errors, skip };
  },
  duplicateKeys: (row) => [row.address],
  save: (row, client, ctx) => subnetService.createSubnet({
    address: row.address, description: row.description, zone: row.zone, environment: row.environment, tags: row.tagIds, updated_by: ctx.username,
  }, client),
  resultUrl: (file) => `/network/download/subnet-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, options] = await Promise.all([
      subnetService.listSubnets({ search, page: pageNo, pageSize, ...filter }), pageOptions(),
    ]);
    res.render('pages/network/subnet_list', {
      subnetList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, ...options, ...takeFlash(req), title: 'Subnet Address', activeMenu: 'subnet-address',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await subnetService.listSubnets({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    await sendExcel(res, {
      filename: 'subnet_list', sheet: 'Subnet List',
      columns: [
        { header: req.t('Subnet Address'), value: (s) => s.address, width: 18 },
        { header: req.t('Description'), value: (s) => s.description, width: 36 },
        { header: req.t('Zone'), value: (s) => s.zone, width: 16 },
        { header: req.t('Environment'), value: (s) => s.environment, width: 16 },
        { header: req.t('Gateway'), value: (s) => s.gateway_ip_address, width: 16 },
        { header: req.t('IP Addresses'), value: (s) => s.ip_count, width: 12 },
        { header: req.t('Tags'), value: (s) => s.tags.map((x) => x.name) },
        { header: req.t('Updated'), value: (s) => s.updated_at, width: 20 },
        { header: req.t('Updated By'), value: (s) => s.updated_by, width: 16 },
      ],
      rows: items,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await subnetService.getSubnet(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL,
    () => subnetService.createSubnet({ ...formInput(req), address: req.body.address }), 'Subnet added successfully', `${LIST_URL}/add`),
  update: (req, res) => runAndRedirect(req, res, LIST_URL,
    () => subnetService.updateSubnet(req.params.id, formInput(req)), 'Subnet updated successfully', `${LIST_URL}/${req.params.id}/edit`),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => subnetService.deleteSubnet(req.params.id), 'Subnet deleted successfully'),

  // IP detail modal: ?ip=<address> -> [{id, address, description}], smallest first
  containing: page(async (req, res) => {
    const ip = String(req.query.ip || '').trim();
    if (!IP_REGEX.test(ip)) return res.status(400).json({ error: 'A valid IP address is required' });
    res.json(await Subnet.findAllContaining(ip));
  }),

  // Subnet tooltip (detail-view.js), fetched on hover
  detail: page(async (req, res) => {
    const subnet = await Subnet.findById(Number(req.params.id) || 0);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });
    const { id, address, description, zone, environment, gateway_ip_address, ip_count, tags } = subnet;
    res.json({ id, address, description, zone, environment, gateway_ip_address, ip_count, tags: (tags || []).map((t) => t.name) });
  }),
};
