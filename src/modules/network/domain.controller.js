// Web pages: /network/domain (list, import, add, edit, delete) and the domain picker.
import Domain from './domain.model.js';
import IpAddress from './ip-address.model.js';
import Tag from '../organize/tag.model.js';
import System from '../system/system.model.js';
import * as domainService from './domain.service.js';
import { excelImport, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryList, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page, lookup, lookupByIds } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/network/domain';
const listFilter = (query) => ({ record_type: queryList(query, 'record_type'), tags: queryList(query, 'tags'), systems: queryList(query, 'systems') });

// Small lists rendered with the page; IPs / systems load via AJAX
const pageOptions = async () => {
  const [recordTypeOptions, tagOptions] = await Promise.all([domainService.getRecordTypeOptions(), Tag.options()]);
  return { recordTypeOptions, tagOptions };
};

const formInput = (req) => {
  const b = req.body;
  return { description: b.description, record_type: b.record_type, ip_id: b.ip_id || null, systems: b.systems ?? [], tags: b.tags ?? [] };
};

async function renderForm(res, mode, domain = {}) {
  res.render('pages/network/domain_form', {
    mode, domain, ...(await pageOptions()),
    title: mode === 'edit' ? 'Edit Domain' : 'Add Domain', activeMenu: 'domain',
  });
}

export const domainImport = excelImport({
  name: 'domain',
  columns: [
    { header: 'Domain Name (Require)', key: 'domain' },
    { header: 'Description (Optional)', key: 'description' },
    { header: 'Record Type (Optional, default A)', key: 'record_type' },
    { header: 'IP Address (Optional)', key: 'ip' },
    { header: 'System Name (Optional, comma-separated if multiple)', key: 'systems' },
    { header: 'Tag (Optional, comma-separated if multiple)', key: 'tags' },
  ],
  sample: async () => [
    { domain: 'www.example.com', description: 'Public website', record_type: 'A', ip: '192.168.1.10', systems: 'System 001', tags: 'Production' },
    { domain: 'mail.example.com', description: '', record_type: 'CNAME', ip: '', systems: '', tags: '' },
  ],
  prepare: async () => ({ recordTypes: (await domainService.getRecordTypeOptions()).map((o) => o.id) }),
  async check(row, ctx) {
    const errors = [];
    if (!row.domain) errors.push('Domain Name is required');
    if (row.record_type && ctx.recordTypes.length && !ctx.recordTypes.includes(row.record_type)) errors.push(`Invalid record type: ${row.record_type}. Valid values: ${ctx.recordTypes.join(', ')}`);
    if (row.ip) {
      row.ipId = (await IpAddress.findByAddress(row.ip))?.id;
      if (!row.ipId) errors.push(`IP address not found: ${row.ip}`);
    }
    const missing = [];
    row.systemIds = await resolveNames(splitList(row.systems), (n) => System.findByNameExact(n), 'System', missing);
    row.tagIds = await resolveNames(splitList(row.tags), (n) => Tag.findByNameExact(n), 'Tag', missing);
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);
    const skip = row.domain && await Domain.findByDomain(row.domain) ? 'Domain already exists' : undefined;
    return { errors, skip };
  },
  duplicateKeys: (row) => [row.domain],
  save: (row, client) => domainService.createDomain({
    domain: row.domain, description: row.description, record_type: row.record_type, ip_id: row.ipId || null, systems: row.systemIds, tags: row.tagIds,
  }, client),
  resultUrl: (file) => `/network/download/domain-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, options] = await Promise.all([
      domainService.listDomains({ search, page: pageNo, pageSize, ...filter }), pageOptions(),
    ]);
    res.render('pages/network/domain_list', {
      domainList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, ...options, ...takeFlash(req), title: 'Domain', activeMenu: 'domain',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await domainService.listDomains({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    await sendExcel(res, {
      filename: 'domain_list', sheet: 'Domain List',
      columns: [
        { header: req.t('Domain'), value: (d) => d.domain, width: 30 },
        { header: req.t('Record Type'), value: (d) => d.record_type, width: 12 },
        { header: req.t('IP Address'), value: (d) => d.ip?.ip_address, width: 16 },
        { header: req.t('Description'), value: (d) => d.description, width: 36 },
        { header: req.t('Systems'), value: (d) => d.systems.map((x) => x.name) },
        { header: req.t('Tags'), value: (d) => d.tags.map((x) => x.name) },
      ],
      rows: items,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await domainService.getDomain(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL,
    () => domainService.createDomain({ ...formInput(req), domain: req.body.domain }), 'Domain added successfully', `${LIST_URL}/add`),
  update: (req, res) => runAndRedirect(req, res, LIST_URL,
    () => domainService.updateDomain(req.params.id, formInput(req)), 'Domain updated successfully', `${LIST_URL}/${req.params.id}/edit`),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => domainService.deleteDomain(req.params.id), 'Domain deleted successfully'),

  // Picker (system form): ?search= / ?ids[]= -> [{id, text}]
  search: (req, res, next) => (req.query.ids || req.query['ids[]']
    ? lookupByIds((ids) => Domain.findByIds(ids), (d) => d.domain)(req, res, next)
    : lookup((term) => Domain.select2Search(term))(req, res, next)),
};
