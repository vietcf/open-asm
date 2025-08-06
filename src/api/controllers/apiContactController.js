// Controller for Contact API
import Contact from '../../models/Contact.js';
import Unit from '../../models/Unit.js';


const apiContactController = {};

apiContactController.createContact = async (req, res) => {
  try {
    let { name, email, phone, position, unit_id, description } = req.body;
    if (!position) position = 'STAFF';
    if (!name || !email || !position) {
      return res.status(400).json({ error: 'Name, email, and position are required' });
    }
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    const allowedPositions = ['MANAGER', 'STAFF'];
    if (!allowedPositions.includes(position)) {
      return res.status(400).json({ error: 'Invalid position value' });
    }
    if (unit_id !== undefined && unit_id !== null && unit_id !== '') {
      const unit = await Unit.findById(unit_id);
      if (!unit) {
        return res.status(400).json({ error: 'Invalid unit_id: unit does not exist' });
      }
    }
    const existing = await Contact.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Contact already exists with this email' });
    }
    const contact = await Contact.create({ name, email, phone, position, unit_id, description });
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiContactController.updateContact = async (req, res) => {
  try {
    const id = req.params.id;
    const current = await Contact.findById(id);
    if (!current) return res.status(404).json({ error: 'Contact not found' });
    let name = ('name' in req.body) ? (typeof req.body.name === 'string' ? req.body.name.trim() : current.name) : current.name;
    let email = ('email' in req.body) ? (typeof req.body.email === 'string' ? req.body.email.trim() : current.email) : current.email;
    let phone = ('phone' in req.body) ? (typeof req.body.phone === 'string' ? req.body.phone.trim() : current.phone) : current.phone;
    let position = ('position' in req.body) ? (typeof req.body.position === 'string' ? req.body.position.trim() : current.position) : current.position;
    let unit_id = ('unit_id' in req.body) ? req.body.unit_id : current.unit_id;
    let description = ('description' in req.body) ? (typeof req.body.description === 'string' ? req.body.description.trim() : current.description) : current.description;
    if ('name' in req.body && !name) {
      return res.status(400).json({ error: 'Name must not be empty if provided' });
    }
    if ('email' in req.body && !email) {
      return res.status(400).json({ error: 'Email must not be empty if provided' });
    }
    if ('position' in req.body && !position) {
      return res.status(400).json({ error: 'Position must not be empty if provided' });
    }
    if (position && !['MANAGER', 'STAFF'].includes(position)) {
      return res.status(400).json({ error: 'Invalid position value' });
    }
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
    if ('email' in req.body && email) {
      const existing = await Contact.findByEmail(email);
      if (existing && existing.id != id) {
        return res.status(409).json({ error: 'Contact already exists with this email' });
      }
    }
    const updated = await Contact.update(id, { name, email, phone, position, unit_id, description });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiContactController.deleteContact = async (req, res) => {
  try {
    const id = req.params.id;
    const contact = await Contact.findById(id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    await Contact.delete(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiContactController.searchContacts = async (req, res) => {
  try {
    let query = req.query.query;
    if (typeof query === 'string') query = query.trim();
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    if (!query) {
      return res.json({ totalCount: 0, page, pageSize, totalPages: 1, results: [] });
    }
    const totalCount = await Contact.countSearch(query);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const results = await Contact.findSearchPage(query, page, pageSize);
    res.json({ totalCount, page, pageSize, totalPages, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiContactController.getContactById = async (req, res) => {
  try {
    const id = req.params.id;
    const contact = await Contact.findById(id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
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
    res.status(500).json({ error: err.message });
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

    // Use email search (supports both full email and prefix)
    const contacts = await Contact.findByEmailSearch(email.trim());

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

export default apiContactController;
