// Web pages: /firewall/rule (list, import, add, edit, delete, export).
import RuleFirewall from './rule.model.js';
import Unit from '../organize/unit.model.js';
import Contact from '../organize/contact.model.js';
import Tag from '../organize/tag.model.js';
import { pageOptions as catalogOptions } from '../../shared/options.js';
import * as ruleService from './rule.service.js';
import { canonical } from './rule.service.js';
import { excelImport, splitList, resolveNames } from '../../shared/excelImport.js';
import { parseListQuery, queryList, queryValue, totalPagesOf, errorMessage, takeFlash, actorName, runAndRedirect, page } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/firewall/rule';
const listFilter = (query) => ({
  firewall_name: queryList(query, 'firewall_name'), action: queryList(query, 'action'), status: queryList(query, 'status'),
  violation_type: queryList(query, 'violation_type'), tags: queryList(query, 'tags'), contacts: queryList(query, 'contacts'),
  ou_id: parseInt(queryValue(query, 'ou_id'), 10) || null, audit_batch: queryValue(query, 'audit_batch'), work_order: queryValue(query, 'work_order'),
});

// Configured options, tags and units are small: rendered with the page
const pageOptions = async () => {
  const [options, catalogs] = await Promise.all([ruleService.getRuleOptions(), catalogOptions('tags', 'units')]);
  return { options, ...catalogs };
};

const FIELDS = ['rulename', 'firewall_name', 'audit_batch', 'src_zone', 'src', 'src_detail', 'dst_zone', 'dst', 'dst_detail', 'services', 'application', 'url',
  'action', 'status', 'violation_type', 'violation_detail', 'solution_proposal', 'solution_confirm', 'work_order', 'description', 'raw_data', 'ou_id'];
const formInput = (req) => ({
  ...Object.fromEntries(FIELDS.map((f) => [f, req.body[f] ?? ''])), contacts: req.body.contacts ?? [], tags: req.body.tags ?? [], updated_by: actorName(req),
});

async function renderForm(res, mode, rule = {}) {
  res.render('pages/firewall/rule_form', {
    mode, rule, ...(await pageOptions()),
    title: mode === 'edit' ? 'Edit Rule' : 'Add Rule', activeMenu: 'firewall-rule',
  });
}

// ===== Import =====
const IMPORT_COLUMNS = [
  ['audit_batch', 'Audit Batch (Required)'], ['firewall_name', 'Firewall Name (Required)'], ['rulename', 'Rule Name (Required)'],
  ['src_zone', 'Source Zone (Optional)'], ['src', 'Source (Required)'], ['src_detail', 'Source Detail (Optional)'],
  ['dst_zone', 'Destination Zone (Optional)'], ['dst', 'Destination (Required)'], ['dst_detail', 'Destination Detail (Optional)'],
  ['services', 'Services (Optional)'], ['application', 'Application (Optional)'], ['url', 'URL (Optional)'], ['action', 'Action (Required)'],
  ['violation_type', 'Violation Type (Optional)'], ['violation_detail', 'Violation Detail (Optional)'], ['ou', 'OU Name (Optional)'],
  ['contacts', 'Contacts (Optional, comma-separated emails)'], ['solution_proposal', 'Solution Proposal (Optional)'],
  ['solution_confirm', 'Solution Confirm (Optional)'], ['work_order', 'Work Order (Optional)'], ['status', 'Status (Optional)'],
  ['description', 'Description (Optional)'], ['raw_data', 'Raw Data (Optional)'], ['tags', 'Tags (Optional, comma-separated IDs)'],
].map(([key, header]) => ({ key, header }));
const REQUIRED = { audit_batch: 'Audit Batch', firewall_name: 'Firewall Name', rulename: 'Rule Name', src: 'Source', dst: 'Destination', action: 'Action' };
const AUDIT_BATCH = /^\d{4}-(0[1-9]|1[0-2])$/;

// Tag by id (the template's format) or by name
const findTag = async (value) => (/^\d+$/.test(value) && await Tag.exists(Number(value)) ? [{ id: Number(value) }] : Tag.findByNameExact(value));

export const ruleImport = excelImport({
  name: 'rule',
  columns: IMPORT_COLUMNS,
  sample: async () => [{
    audit_batch: '2024-01', firewall_name: 'Firewall-A', rulename: 'Allow-HTTP-Web-Server', src_zone: 'DMZ', src: '192.168.1.0/24', src_detail: 'DMZ Web Servers',
    dst_zone: 'Internal', dst: '10.0.1.100', dst_detail: 'Internal Web Server', services: 'TCP/80', application: 'HTTP', url: 'https://example.com',
    action: 'allow', violation_type: '', violation_detail: '', ou: 'IT Department', contacts: 'admin@company.com', solution_proposal: '',
    solution_confirm: '', work_order: 'WO-2024-001', status: '', description: 'Allow HTTP from DMZ to the web server', raw_data: '', tags: '',
  }],
  async prepare(req) {
    return { options: await ruleService.getRuleOptions(), username: actorName(req) || 'admin' };
  },
  async check(row, ctx) {
    const errors = Object.entries(REQUIRED).filter(([key]) => !row[key]).map(([, label]) => `Missing ${label}`);
    if (row.audit_batch && !AUDIT_BATCH.test(row.audit_batch)) errors.push(`Invalid Audit Batch: ${row.audit_batch} (expected YYYY-MM)`);
    for (const field of Object.keys(ruleService.OPTION_FIELDS)) {
      if (!row[field] || !ctx.options[field].length) continue;
      const value = canonical(ctx.options[field], row[field]);
      if (!value) errors.push(`Invalid ${field.replace('_', ' ')}: ${row[field]}`);
      else row[field] = value;
    }
    const missing = [];
    row.ouId = row.ou ? (await resolveNames([row.ou], async (n) => [await Unit.findByName(n)].filter(Boolean), 'OU', missing))[0] : null;
    row.contactIds = await resolveNames(splitList(row.contacts), (n) => Contact.findByEmailSearch(n), 'Contact', missing);
    row.tagIds = await resolveNames(splitList(row.tags), findTag, 'Tag', missing);
    if (missing.length) errors.push(`Not found: ${missing.join(', ')}`);
    const skip = !errors.length && await RuleFirewall.findByKey(row.firewall_name, row.rulename, row.audit_batch)
      ? `Rule already exists in audit batch ${row.audit_batch}` : undefined;
    return { errors, skip };
  },
  duplicateKeys: (row) => [[row.firewall_name, row.rulename, row.audit_batch].join('|').toLowerCase()],
  save: (row, client, ctx) => ruleService.createRule({
    ...row, ou_id: row.ouId, contacts: row.contactIds, tags: row.tagIds, updated_by: ctx.username,
  }, client),
  resultUrl: (file) => `/firewall/download/rule-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, options] = await Promise.all([ruleService.listRules({ search, page: pageNo, pageSize, ...filter }), pageOptions()]);
    res.render('pages/firewall/rule_list', {
      ruleList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filter, ...options, ...takeFlash(req), title: 'Firewall Rule', activeMenu: 'firewall-rule',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await ruleService.listRules({ search, page: 1, pageSize: 100000, ...listFilter(req.query) });
    const col = (key, header, width = 18) => ({ header: req.t(header), value: (r) => r[key], width });
    await sendExcel(res, {
      filename: 'firewall_rules', sheet: 'Firewall Rules',
      columns: [
        col('id', 'Rule ID', 10), col('firewall_name', 'Firewall Name'), col('rulename', 'Rule Name', 25), col('audit_batch', 'Audit Batch', 14),
        col('src_zone', 'Source Zone'), col('src', 'Source'), col('src_detail', 'Source Detail', 22), col('dst_zone', 'Destination Zone'),
        col('dst', 'Destination'), col('dst_detail', 'Destination Detail', 22), col('services', 'Service', 14), col('application', 'Application', 16),
        col('url', 'URL', 20), col('action', 'Action', 10), col('ou_name', 'OU (Unit)'),
        { header: req.t('Contacts'), value: (r) => r.contacts.map((c) => c.email || c.name), width: 28 },
        col('violation_type', 'Violation Type', 22), col('violation_detail', 'Violation Detail', 28), col('solution_proposal', 'Solution Proposal', 28),
        col('solution_confirm', 'Solution Confirm', 28), col('status', 'Status', 12), col('work_order', 'Work Order'), col('description', 'Description', 30),
        { header: req.t('Tags'), value: (r) => r.tags.map((x) => x.name), width: 24 },
        col('created_at', 'Created At', 20), col('updated_at', 'Updated At', 20), col('updated_by', 'Updated By', 16),
      ],
      rows: items,
    });
  }),

  addForm: page((req, res) => renderForm(res, 'add')),

  async editForm(req, res) {
    try {
      await renderForm(res, 'edit', await ruleService.getRule(req.params.id));
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => ruleService.createRule(formInput(req)), 'Rule added successfully', `${LIST_URL}/add`),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, () => ruleService.updateRule(req.params.id, formInput(req)), 'Rule updated successfully', `${LIST_URL}/${req.params.id}/edit`),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => ruleService.deleteRule(req.params.id), 'Rule deleted successfully'),
};
