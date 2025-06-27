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

exports.updateContact = async (req, res) => {
  try {
    const id = req.params.id;
    // Lấy contact hiện tại
    const current = await Contact.findById(id);
    if (!current) return res.status(404).json({ error: 'Contact not found' });
    // Merge các trường: chỉ cập nhật trường nào truyền lên, còn lại giữ nguyên
    let name = ('name' in req.body) ? (typeof req.body.name === 'string' ? req.body.name.trim() : '') : current.name;
    let email = ('email' in req.body) ? (typeof req.body.email === 'string' ? req.body.email.trim() : '') : current.email;
    let phone = ('phone' in req.body) ? (typeof req.body.phone === 'string' ? req.body.phone.trim() : '') : current.phone;
    let position = ('position' in req.body) ? (typeof req.body.position === 'string' ? req.body.position.trim() : '') : current.position;
    let unit_id = ('unit_id' in req.body) ? req.body.unit_id : current.unit_id;
    // Validate: nếu trường name/email/position được truyền lên thì phải khác rỗng
    if ('name' in req.body && !name) {
      return res.status(400).json({ error: 'Name must not be empty if provided' });
    }
    if ('email' in req.body && !email) {
      return res.status(400).json({ error: 'Email must not be empty if provided' });
    }
    if ('position' in req.body && !position) {
      return res.status(400).json({ error: 'Position must not be empty if provided' });
    }
    // Validate position
    if (position && !['MANAGER', 'STAFF'].includes(position)) {
      return res.status(400).json({ error: 'Invalid position value' });
    }
    // Validate unit_id nếu truyền lên
    if ('unit_id' in req.body && unit_id !== undefined && unit_id !== null && unit_id !== '') {
      unit_id = parseInt(unit_id, 10);
      if (isNaN(unit_id)) unit_id = null;
      else {
        const unit = await Unit.findById(unit_id);
        if (!unit) {
          return res.status(400).json({ error: 'Invalid unit_id: unit does not exist' });
        }
      }
    } else if ('unit_id' in req.body) {
      unit_id = null;
    }
    // Check for duplicate email (case-insensitive, except for this id)
    if ('email' in req.body && email) {
      const existing = await Contact.findByEmail(email);
      if (existing && existing.id != id) {
        return res.status(409).json({ error: 'Contact already exists with this email' });
      }
    }
    // Update
    const updated = await Contact.update(id, { name, email, phone, position, unit_id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const id = req.params.id;
    // Check if exists
    const contact = await Contact.findById(id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    await Contact.delete(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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

exports.getContactById = async (req, res) => {
  try {
    const id = req.params.id;
    const contact = await Contact.findById(id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    // Only return fields needed for detail view
    res.json({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      unit_id: contact.unit_id,
      unit_name: contact.unit_name,
      position: contact.position
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
