// Web pages: /organize/contact (list, export, import, add, edit, delete), lookups, vCard QR.
import QRCode from 'qrcode';
import Contact from './contact.model.js';
import Unit from './unit.model.js';
import * as contactService from './contact.service.js';
import { excelImport } from '../../shared/excelImport.js';
import { parseListQuery, queryValue, totalPagesOf, errorMessage, takeFlash, runAndRedirect, page, lookup, lookupByIds } from '../../shared/web.js';
import { sendExcel } from '../../utils/excelExport.js';

const LIST_URL = '/organize/contact';
const listFilter = (query) => ({ unit_id: queryValue(query, 'unit_id'), position: queryValue(query, 'position') });
const formInput = ({ name, email, position, unit_id, phone, description }) => ({ name, email, position, unit_id, phone, description });

function renderForm(res, mode, contact, positionOptions) {
  res.render('pages/organize/contact_form', {
    mode, contact, positionOptions, title: mode === 'edit' ? 'Edit Contact' : 'Add Contact', activeMenu: 'contact',
    selectedUnit: contact.unit_id ? [{ id: contact.unit_id, text: contact.unit_name }] : [],
  });
}

// vCard 3.0 for the QR code
function vcard(c) {
  const parts = (c.name || '').trim().split(/\s+/).filter(Boolean);
  const n = parts.length > 1 ? `${parts[parts.length - 1]};${parts[0]};${parts.slice(1, -1).join(' ')};;` : `${parts[0] || ''};;;;`;
  return ['BEGIN:VCARD', 'VERSION:3.0', `N:${n}`, `FN:${c.name || ''}`,
    c.email && `EMAIL:${c.email}`, c.phone && `TEL:${c.phone}`, c.unit_name && `ORG:${c.unit_name}`, c.position && `TITLE:${c.position}`,
    'END:VCARD'].filter(Boolean).join('\n');
}

export const contactImport = excelImport({
  name: 'contact',
  columns: [
    { header: 'Name (Require)', key: 'name' },
    { header: 'Email (Require)', key: 'email' },
    { header: 'Phone', key: 'phone' },
    { header: 'Org Unit', key: 'unit' },
    { header: 'Position (Require)', key: 'position' },
    { header: 'Description', key: 'description' },
  ],
  async sample() {
    const positions = (await contactService.getPositionOptions()).map((o) => o.id);
    return [
      { name: 'John Doe', email: 'john.doe@company.com', phone: '0123456789', unit: 'IT Department', position: positions[0] || 'Manager', description: 'Sample contact for IT management' },
      { name: 'Jane Smith', email: 'jane.smith@company.com', phone: '0987654321', unit: 'HR Department', position: positions[1] || positions[0] || 'Staff', description: 'Sample contact for HR staff' },
    ];
  },
  prepare: async () => ({ positions: (await contactService.getPositionOptions()).map((o) => o.id) }),
  async check(row, { positions }) {
    const errors = [];
    if (!row.name) errors.push('Name is required');
    if (!row.email) errors.push('Email is required');
    else if (!contactService.EMAIL_REGEX.test(row.email)) errors.push('Invalid email format');
    if (!row.position) errors.push('Position is required');
    else if (positions.length && !positions.includes(row.position)) errors.push(`Invalid position. Must be one of: ${positions.join(', ')}`);
    if (row.unit) {
      row.unitId = (await Unit.findByName(row.unit))?.id;
      if (!row.unitId) errors.push('Org Unit not found');
    }
    let skip;
    if (row.name && row.email) {
      const [byEmail, byName] = await Promise.all([Contact.findByEmail(row.email), Contact.findByName(row.name)]);
      if (byEmail && byName) skip = 'Contact already exists (both email and name)';
      else if (byEmail) skip = 'Email already exists';
      else if (byName) skip = 'Name already exists';
    }
    return { errors, skip };
  },
  duplicateKeys: (row) => [row.email && 'e:' + row.email.toLowerCase(), row.name && 'n:' + row.name.toLowerCase()],
  save: (row, client) => contactService.createContact({ ...row, unit_id: row.unitId || null }, client),
  resultUrl: (file) => `/organize/download/contact-validation/${file}`,
});

export default {
  list: page(async (req, res) => {
    const { page: pageNo, pageSize, search } = parseListQuery(req, res);
    const filter = listFilter(req.query);
    const [{ items, totalCount }, units, positionOptions] = await Promise.all([
      contactService.listContacts({ search, page: pageNo, pageSize, ...filter }),
      Unit.findAll(),
      contactService.getPositionOptions(),
    ]);
    res.render('pages/organize/contact_list', {
      contactList: items, search, page: pageNo, pageSize, totalCount, totalPages: totalPagesOf(totalCount, pageSize),
      filterUnitId: filter.unit_id, filterPosition: filter.position, units, positionOptions, ...takeFlash(req),
      title: 'Contact List', activeMenu: 'contact',
    });
  }),

  export: page(async (req, res) => {
    const { search } = parseListQuery(req, res);
    const { items } = await contactService.listContacts({ search, page: 1, pageSize: 10000, ...listFilter(req.query) });
    await sendExcel(res, {
      filename: 'contact-list', sheet: 'Contacts',
      columns: [
        { header: req.t('Name'), value: (c) => c.name, width: 28 },
        { header: req.t('Email'), value: (c) => c.email, width: 30 },
        { header: req.t('Phone'), value: (c) => c.phone, width: 16 },
        { header: req.t('Position'), value: (c) => c.position, width: 18 },
        { header: req.t('Organization'), value: (c) => c.unit_name, width: 28 },
        { header: req.t('Description'), value: (c) => c.description, width: 40 },
      ],
      rows: items,
    });
  }),

  addForm: page(async (req, res) => renderForm(res, 'add', {}, await contactService.getPositionOptions())),

  async editForm(req, res) {
    try {
      renderForm(res, 'edit', await contactService.getContact(req.params.id), await contactService.getPositionOptions());
    } catch (err) {
      req.flash('error', errorMessage(req, err));
      res.redirect(LIST_URL);
    }
  },

  create: (req, res) => runAndRedirect(req, res, LIST_URL, () => contactService.createContact(formInput(req.body)), 'Contact added successfully'),
  update: (req, res) => runAndRedirect(req, res, LIST_URL, () => contactService.updateContact(req.params.id, formInput(req.body)), 'Contact updated successfully'),
  remove: (req, res) => runAndRedirect(req, res, LIST_URL, () => contactService.deleteContact(req.params.id), 'Contact deleted successfully'),

  // ===== AJAX =====
  lookup: lookup((search) => Contact.select2Search(search)),
  lookupByIds: lookupByIds((ids) => Contact.findByIds(ids), (c) => (c.email ? `${c.name} (${c.email})` : c.name)),

  // vCard QR as base64 PNG for the detail modal
  qrcode: page(async (req, res) => {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    const dataUrl = await QRCode.toDataURL(vcard(contact), { type: 'image/png', errorCorrectionLevel: 'M', margin: 1, width: 256 });
    res.json({ image: dataUrl.replace(/^data:image\/png;base64,/, ''), mime: 'image/png' });
  }),
};
