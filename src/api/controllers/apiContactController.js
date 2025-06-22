// Controller for Contact API
const Contact = require('../../models/Contact');
const Unit = require('../../models/Unit');

// exports.listContacts = async (req, res) => {
//   try {
//     // TODO: Replace with real DB logic
//     res.json([]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// exports.getContact = async (req, res) => {
//   try {
//     // TODO: Replace with real DB logic
//     res.json({ id: req.params.id });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

exports.createContact = async (req, res) => {
  try {
    let { name, email, phone, position, unit_id } = req.body;
    // Default position to 'STAFF' if not provided
    if (!position) position = 'STAFF';
    // Validate required fields
    if (!name || !email || !position) {
      return res.status(400).json({ error: 'Name, email, and position are required' });
    }
    // Validate email format
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    // Validate allowed position values
    const allowedPositions = ['MANAGER', 'STAFF'];
    if (!allowedPositions.includes(position)) {
      return res.status(400).json({ error: 'Invalid position value' });
    }
    // Validate unit_id if provided
    if (unit_id !== undefined && unit_id !== null && unit_id !== '') {
      const unit = await Unit.findById(unit_id);
      if (!unit) {
        return res.status(400).json({ error: 'Invalid unit_id: unit does not exist' });
      }
    }
    // Check for duplicate email
    const existing = await Contact.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Contact already exists with this email' });
    }
    const contact = await Contact.create({ name, email, phone, position, unit_id });
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// exports.updateContact = async (req, res) => {
//   try {
//     // TODO: Replace with real DB logic
//     res.json({ message: 'Contact updated', id: req.params.id });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// exports.deleteContact = async (req, res) => {
//   try {
//     // TODO: Replace with real DB logic
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

exports.searchContacts = async (req, res) => {
    // console.log('fuak');
  try {
    let query = req.query.query;
    if (typeof query === 'string') query = query.trim();
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    //console.log('[Contact Search]', { query, page, pageSize });
    if (!query) {
      return res.json({ totalCount: 0, page, pageSize, totalPages: 1, results: [] });
    }
    const totalCount = await Contact.searchCount(query);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const results = await Contact.searchPage(query, page, pageSize);
    //console.log('[Contact Search Result]', { totalCount, totalPages, resultsCount: results.length });
    res.json({ totalCount, page, pageSize, totalPages, results });
  } catch (err) {
    //console.error('[Contact Search Error]', err);
    res.status(500).json({ error: err.message });
  }
};
