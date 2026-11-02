// REST: /api/v1/contacts
import * as contactService from './contact.service.js';
import { apiHandler, apiPage, handleServiceError } from '../../shared/api.js';
import { toValueLabel } from '../../shared/service.js';

export default {
  // List / search: ?query=&page=&pageSize= (no query = every contact)
  searchContacts: apiHandler(async (req, res) => {
    const { page, pageSize } = apiPage({ pageSize: 20, ...req.query });
    const search = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const { items, totalCount } = await contactService.listContacts({ search, page, pageSize });
    res.json({ totalCount, page, pageSize, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)), results: items });
  }),

  // ?email= full address or mailbox name (part before @)
  findContacts: apiHandler(async (req, res) => {
    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({ success: false, message: 'Search term "email" is required' });
    const data = await contactService.findContactsByEmail(email);
    res.json({ success: true, data, count: data.length });
  }, handleServiceError),

  // Values that can be set (retired ones left out)
  getConfig: apiHandler(async (req, res) => {
    const positions = await contactService.getPositionOptions();
    res.json({ success: true, data: { position: toValueLabel(positions) } });
  }, handleServiceError),

  getContactById: apiHandler(async (req, res) => {
    const { id, name, email, phone, unit_id, unit_name, position, description } = await contactService.getContact(req.params.id);
    res.json({ id, name, email, phone, unit_id, unit_name, position, description });
  }),

  createContact: apiHandler(async (req, res) => res.status(201).json(await contactService.createContact(req.body || {}))),
  updateContact: apiHandler(async (req, res) => res.json(await contactService.updateContact(req.params.id, req.body || {}))),
  deleteContact: apiHandler(async (req, res) => { await contactService.deleteContact(req.params.id); res.status(204).send(); }),
};
