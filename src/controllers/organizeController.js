import { config, pool } from '../../config/config.js';
import Contact from '../models/Contact.js';
import Unit from '../models/Unit.js';
import Tag from '../models/Tag.js';
import Configuration from '../models/Configuration.js';
import QRCode from 'qrcode';

const organizeController = {};

// Contact List page handler
organizeController.contactList = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    // Use global page size options
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }
    let contactList, totalCount;
    if (search) {
      totalCount = await Contact.countSearch(search);
      contactList = await Contact.findSearchPage(search, page, pageSize);
    } else {
      totalCount = await Contact.countAll();
      contactList = await Contact.findPage(page, pageSize);
    }
    const totalPages = Math.ceil(totalCount / pageSize);
    // fetch units for Org Unit select options
    const units = await Unit.findAll();
    // bubble any error message
    const errorMessage = req.query.error || null;
    const successMessage = req.query.success || null;
    return res.render('pages/organize/contact_list', {
      contactList,
      units,
      search,
      page,
      totalPages,
      errorMessage,
      successMessage,
      pageSize,
      totalCount,
      startItem: totalCount === 0 ? 0 : (page - 1) * pageSize + 1,
      endItem: totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount),
      title: 'Contact List',
      activeMenu: 'contact'
    });
  } catch (err) {
    console.error('Error loading contacts:', err);
    return res.status(500).send('Error loading contacts: ' + err.message);
  }
};

// Create new contact
organizeController.createContact = async (req, res) => {
  try {
    let { name, email, position, unit_id, phone, description } = req.body;
    name = (name || '').trim();
    email = (email || '').trim();
    position = (position || '').trim();
    phone = (phone || '').trim();
    description = (description || '').trim();
    // Validate required fields
    if (!name || !email || !position) {
      return res.redirect('/organize/contact?error=Name, Email, and Position are required');
    }
    // Check if email already exists
    const existing = await Contact.findByEmail(email);
    if (existing) {
      console.warn(`Duplicate email: ${email}`);
      return res.redirect('/organize/contact?error=Email already exists');
    }
    // Insert new contact
    await Contact.create({ name, email, position, unit_id, phone, description });
    res.redirect('/organize/contact?success=Contact added successfully');
  } catch (err) {
    console.error('Add contact error:', err);
    res.redirect('/organize/contact?error=Unable to add contact');
  }
};

// Update existing contact
organizeController.updateContact = async (req, res) => {
  try {
    let { name, email, position, unit_id, phone, description } = req.body;
    name = (name || '').trim();
    email = (email || '').trim();
    position = (position || '').trim();
    phone = (phone || '').trim();
    description = (description || '').trim();
    if (!name || !email || !position) {
      return res.redirect('/organize/contact?error=Name, Email, and Position are required');
    }
    await Contact.update(req.params.id, { name, email, position, unit_id, phone, description });
    res.redirect('/organize/contact?success=Contact updated successfully');
  } catch(err) {
    console.error(err);
    res.redirect('/organize/contact?error=Unable to update contact');
  }
};

// Delete contact
organizeController.deleteContact = async (req, res) => {
  try {
    await Contact.delete(req.params.id);
    res.redirect('/organize/contact?success=Contact deleted successfully');
  } catch(err) {
    console.error(err);
    res.redirect('/organize/contact?error=Unable to delete contact');
  }
};

// Organization Unit List page handler
organizeController.unitList = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    // Use global page size options
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }
    let totalCount, unitList;
    if (search) {
      totalCount = await Unit.countSearch(search);
      unitList = await Unit.findSearchPage(search, page, pageSize);
    } else {
      totalCount = await Unit.countAll();
      unitList = await Unit.findPage(page, pageSize);
    }
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const errorMessage = req.query.error || null;
    const successMessage = req.query.success || null;
    res.render('pages/organize/unit_list', {
      unitList,
      search,
      page,
      totalPages,
      errorMessage,
      successMessage,
      pageSize,
      totalCount,
      startItem: totalCount === 0 ? 0 : (page - 1) * pageSize + 1,
      endItem: totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount),
      title: 'Organization Unit',
      activeMenu: 'unit'
    });
  } catch (err) {
    console.error('Error loading units:', err);
    return res.status(500).send('Error loading units: ' + err.message);
  }
};

// Create new unit
organizeController.createUnit = async (req, res) => {
  let { name, code, description, page, search } = req.body;
  name = (name || '').trim();
  code = (code || '').trim();
  description = (description || '').trim();
  if (!name) {
    const pageNum = page || 1;
    const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&error=Unit Name is required`);
  }
  try {
    await Unit.create({ name, code, description });
    const pageNum = page || 1;
    const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&success=Unit added successfully`);
  } catch (err) {
    let errorMsg = 'Unable to add unit';
    const errStr = (err && (err.detail || err.message)) ? (err.detail || err.message) : '';
    if (
      (errStr && errStr.toLowerCase().includes('already exists') && errStr.toLowerCase().includes('(name)')) ||
      (errStr && errStr.toLowerCase().includes('duplicate key') && errStr.toLowerCase().includes('name')) ||
      (err && String(err.detail).includes('units_name_unique'))
    ) {
      errorMsg = 'Unit Name already exists. Please choose a different name.';
    } else if (err && err.detail) {
      errorMsg = err.detail;
    } else if (err && err.message) {
      errorMsg = err.message;
    }
    const pageNum = page || 1;
    const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&error=${encodeURIComponent(errorMsg)}`);
  }
};

// Update existing unit
organizeController.updateUnit = async (req, res) => {
  const { id } = req.params;
  let { name, code, description, page, search } = req.body;
  name = (name || '').trim();
  code = (code || '').trim();
  description = (description || '').trim();
  if (!name) {
    const pageNum = page || 1;
    const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&error=Unit Name is required`);
  }
  try {
    await Unit.update(id, { name, code, description });
    const pageNum = page || 1;
    const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&success=Unit updated successfully`);
  } catch (err) {
    let errorMsg = 'Unable to update unit';
    const errStr = (err && (err.detail || err.message)) ? (err.detail || err.message) : '';
    if (
      (errStr && errStr.toLowerCase().includes('already exists') && errStr.toLowerCase().includes('(name)')) ||
      (errStr && errStr.toLowerCase().includes('duplicate key') && errStr.toLowerCase().includes('name')) ||
      (err && String(err.detail).includes('units_name_unique'))
    ) {
      errorMsg = 'Unit Name already exists. Please choose a different name.';
    } else if (err && err.detail) {
      errorMsg = err.detail;
    } else if (err && err.message) {
      errorMsg = err.message;
    }
    const pageNum = page || 1;
    const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&error=${encodeURIComponent(errorMsg)}`);
  }
};

// Delete unit
organizeController.deleteUnit = async (req, res) => {
  const { id } = req.params;
  try {
    await Unit.delete(id);
    res.redirect('/organize/unit?success=Unit deleted successfully');
  } catch (err) {
    console.error('Delete unit error:', err);
    res.redirect('/organize/unit?error=Unable to delete unit');
  }
};

// API for select2 ajax contact search
organizeController.apiContactSearch = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const contacts = await Contact.contactSearchSelect2(search);
    const data = contacts.map(row => ({ id: row.id, text: row.name + (row.email ? ` (${row.email})` : '') }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading contacts', detail: err.message });
  }
};

// API for getting contacts by IDs (for filter restore)
organizeController.apiContactByIds = async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.json([]);
    }
    
    // Handle both array and single value
    let idsArray = Array.isArray(ids) ? ids : [ids];
    
    if (idsArray.length === 0) {
      return res.json([]);
    }
    
    const contactIds = idsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (contactIds.length === 0) {
      return res.json([]);
    }
    
    const contacts = await Contact.findByIds(contactIds);
    
    const data = contacts.map(contact => ({ 
      id: contact.id, 
      text: contact.name + (contact.email ? ` (${contact.email})` : ''),
      name: contact.name,
      email: contact.email
    }));
    res.json(data);
  } catch (err) {
    console.error('API /organize/api/contact by IDs error:', err);
    res.status(500).json({ error: 'Error loading contacts by IDs', detail: err.message });
  }
};

// API for select2 ajax unit (organize) search
organizeController.apiUnitSearch = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    // Move DB logic to Unit model
    const units = await Unit.unitSearchSelect2(search);
    const data = units.map(row => ({ id: row.id, text: row.name }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading units', detail: err.message });
  }
};

// ===== TAG MENU =====
// Render tag list page with pagination
organizeController.tagList = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    // Use global page size options
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }
    let tagList, totalCount;
    if (search) {
      totalCount = await Tag.countAll(search);
      tagList = await Tag.findPage(page, pageSize, search);
    } else {
      totalCount = await Tag.countAll();
      tagList = await Tag.findPage(page, pageSize);
    }
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const errorMessage = req.query.error || null;
    const successMessage = req.query.success || null;
    res.render('pages/organize/tag_list', {
      tagList,
      search,
      page,
      totalPages,
      errorMessage,
      successMessage,
      startItem,
      endItem,
      totalCount,
      pageSize,
      title: 'Tag List',
      activeMenu: 'tag'
    });
  } catch (err) {
    res.status(500).send('Error loading tags: ' + err.message);
  }
};

// Create a new tag
organizeController.createTag = async (req, res) => {
  try {
    let { name, description } = req.body;
    name = (name || '').trim();
    description = (description || '').trim();
    if (!name) {
      return res.redirect('/organize/tag?error=Tag Name is required');
    }
    await Tag.create({ name, description });
    res.redirect('/organize/tag?success=Tag added successfully');
  } catch (err) {
    let errorMsg = 'Unable to add tag';
    if (err && err.message && err.message.includes('duplicate key value') && err.message.includes('tags_name_key')) {
      errorMsg = 'Tag name already exists. Please choose a different name.';
    }
    res.redirect('/organize/tag?error=' + errorMsg);
  }
};

// Update Tag (PUT/POST for modal form)
organizeController.updateTag = async (req, res) => {
  try {
    const id = req.params.id;
    let { name, description } = req.body;
    name = (name || '').trim();
    description = (description || '').trim();
    if (!name) {
      return res.redirect('/organize/tag?error=Tag Name is required');
    }
    await Tag.update(id, { name, description });
    res.redirect('/organize/tag?success=Tag updated successfully');
  } catch (err) {
    let errorMsg = 'Unable to update tag';
    if (err && err.message && err.message.includes('duplicate key value') && err.message.includes('tags_name_key')) {
      errorMsg = 'Tag name already exists. Please choose a different name.';
    }
    res.redirect('/organize/tag?error=' + errorMsg);
  }
};

// Delete a tag
organizeController.deleteTag = async (req, res) => {
  try {
    const id = req.params.id;
    await Tag.delete(id);
    res.redirect('/organize/tag?success=Tag deleted successfully');
  } catch (err) {
    res.redirect('/organize/tag?error=Unable to delete tag');
  }
};

// API: Tag search for select2 ajax
// tag used in system add/edit forms
// tag use in ip address add/edit forms
// tag use in subnet add/edit forms
organizeController.apiTagSearch = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const tags = await Tag.findSearchForSelect2(search);
    res.json(tags.map(tag => ({ id: tag.id, text: tag.name })));
  } catch (err) {
    res.status(500).json({ error: 'Error loading tags' });
  }
};

// API for getting tags by IDs (for filter restore)
organizeController.apiTagByIds = async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.json([]);
    }
    
    // Handle both array and single value
    let idsArray = Array.isArray(ids) ? ids : [ids];
    
    if (idsArray.length === 0) {
      return res.json([]);
    }
    
    const tagIds = idsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (tagIds.length === 0) {
      return res.json([]);
    }
    
    const tags = await Tag.findByIds(tagIds);
    
    const data = tags.map(tag => ({ 
      id: tag.id, 
      text: tag.name,
      name: tag.name
    }));
    res.json(data);
  } catch (err) {
    console.error('API /organize/api/tag by IDs error:', err);
    res.status(500).json({ error: 'Error loading tags by IDs', detail: err.message });
  }
};

// API: Serve contact QR vCard as base64 PNG (for AJAX modal)
organizeController.apiContactQrVcard = async (req, res) => {
  try {
    const contactId = req.params.id;
    const contact = await Contact.findById(contactId);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    // Tách tên cho trường N:
    let nField = '';
    if (contact.name) {
      const parts = contact.name.trim().split(/\s+/);
      if (parts.length === 1) {
        nField = `${parts[0]};;;;`;
      } else if (parts.length === 2) {
        nField = `${parts[1]};${parts[0]};;;`;
      } else {
        const last = parts.pop();
        const first = parts.shift();
        nField = `${last};${first};${parts.join(' ')};;`;
      }
    }
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      nField ? `N:${nField}` : '',
      `FN:${contact.name || ''}`,
      contact.email ? `EMAIL:${contact.email}` : '',
      contact.phone ? `TEL:${contact.phone}` : '',
      contact.unit_name ? `ORG:${contact.unit_name}` : '',
      contact.position ? `TITLE:${contact.position}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\n');
    const qrDataUrl = await QRCode.toDataURL(vcard, { type: 'image/png', errorCorrectionLevel: 'M', margin: 1, width: 256 });
    const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    res.json({ image: base64, mime: 'image/png' });
  } catch (err) {
    res.status(500).json({ error: 'Unable to generate QR vCard', detail: err.message });
  }
};

// API endpoint to get systems by IDs
organizeController.apiSystemByIds = async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.json([]);
    }
    
    // Handle both single value and array
    let idsArray = Array.isArray(ids) ? ids : [ids];
    
    if (idsArray.length === 0) {
      return res.json([]);
    }
    
    // Convert to integers and filter out invalid values
    const systemIds = idsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (systemIds.length === 0) {
      return res.json([]);
    }
    
    const result = await pool.query(
      'SELECT id, name FROM systems WHERE id = ANY($1) ORDER BY name',
      [systemIds]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('API System by IDs - Error:', err);
    res.status(500).json({ error: err.message });
  }
};

export default organizeController;
