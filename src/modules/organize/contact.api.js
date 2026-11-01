// Controller for Contact API
import {
  listContacts as listContactsService,
  getContact as getContactService,
  findContactsByEmail,
  createContact as createContactService,
  updateContact as updateContactService,
  deleteContact as deleteContactService,
  getPositionOptions as getPositionOptionsFromConfig
} from './contact.service.js';
import { handleServiceErrorPlain } from '../../shared/api.js';

const apiContactController = {};

apiContactController.createContact = async (req, res) => {
  try {
    const contact = await createContactService(req.body || {});
    res.status(201).json(contact);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiContactController.updateContact = async (req, res) => {
  try {
    const updated = await updateContactService(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiContactController.deleteContact = async (req, res) => {
  try {
    await deleteContactService(req.params.id);
    res.status(204).send();
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// There's no bare GET /contacts list route — /search doubles as it when
// `query` is omitted. It used to short-circuit to an empty result set in
// that case, even though listContactsService already falls back to a plain
// paginated "get all" when search is empty (the frontend contact list relies
// on exactly that). That made /search the only contact list endpoint with no
// way to actually list contacts. Fixed to always call the service.
apiContactController.searchContacts = async (req, res) => {
  try {
    let query = req.query.query;
    if (typeof query === 'string') query = query.trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    const { items: results, totalCount } = await listContactsService({ search: query, page, pageSize });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    res.json({ totalCount, page, pageSize, totalPages, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiContactController.getContactById = async (req, res) => {
  try {
    const contact = await getContactService(req.params.id);
    res.json({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      unit_id: contact.unit_id,
      unit_name: contact.unit_name,
      position: contact.position,
      description: contact.description
    });
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Find contacts by email (supports both full email and email prefix)
apiContactController.findContacts = async (req, res) => {
  try {
    const { email } = req.query;

    // Require search term
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search term "email" is required'
      });
    }

    const contacts = await findContactsByEmail(email.trim());

    res.json({
      success: true,
      data: contacts,
      count: contacts.length
    });
  } catch (error) {
    console.error('Error finding contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Config endpoint to get dynamic enum values
apiContactController.getConfig = async (req, res) => {
  try {
    const positionOptions = await getPositionOptionsFromConfig();

    res.json({
      success: true,
      data: {
        position: positionOptions
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Export helper functions for use in routes
export { getPositionOptionsFromConfig };
export default apiContactController;
