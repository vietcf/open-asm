const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const config = require('../../config/config');
const Contact = require('../models/Contact');
const Unit = require('../models/Unit');
const Configuration = require('../models/Configuration');

// Contact List page handler
exports.contactList = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    // Load config for allowed page sizes from database
    let allowedPageSizes = [10, 20, 50];
    try {
      const pageSizeConfig = await Configuration.findByKey('page_size');
      if (pageSizeConfig && pageSizeConfig.value) {
        allowedPageSizes = pageSizeConfig.value.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
      }
    } catch (e) {
      // fallback to default if config not found or error
    }
    // Ensure pageSize is always a valid value from allowedPageSizes
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!allowedPageSizes.includes(pageSize)) {
      pageSize = allowedPageSizes[0];
    }
    let contactList, totalCount;
    if (search) {
      totalCount = await Contact.searchCount(search);
      contactList = await Contact.searchPage(search, page, pageSize);
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
    const content = ejs.render(
      fs.readFileSync(path.join(__dirname, '../../public/html/pages/organize/contact_list.ejs'), 'utf8'),
      { contactList, units, search, page, totalPages, errorMessage, successMessage, user: req.session.user, hasPermission: req.app.locals.hasPermission, pageSize, totalCount, startItem: totalCount === 0 ? 0 : (page - 1) * pageSize + 1, endItem: totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount), allowedPageSizes }
    );
    const siteConfig = await Configuration.findByKey('site_name');
    const siteName = siteConfig ? siteConfig.value : undefined;
    return res.render('layouts/layout', {
      cssPath: config.cssPath,
      jsPath: config.jsPath,
      imgPath: config.imgPath,
      body: content,
      title: 'Contact List',
      activeMenu: 'contact',
      user: req.session.user,
      siteName
    });
  } catch (err) {
    console.error('Error loading contacts:', err);
    return res.status(500).send('Error loading contacts: ' + err.message);
  }
};

// Create new contact
exports.createContact = async (req, res) => {
  try {
    let { name, email, position, unit_id, phone, note } = req.body;
    name = (name || '').trim();
    email = (email || '').trim();
    position = (position || '').trim();
    phone = (phone || '').trim();
    note = (note || '').trim();
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
    await Contact.create({ name, email, position, unit_id, phone, note });
    res.redirect('/organize/contact?success=Contact added successfully');
  } catch (err) {
    console.error('Add contact error:', err);
    res.redirect('/organize/contact?error=Unable to add contact');
  }
};

// Update existing contact
exports.updateContact = async (req, res) => {
  try {
    let { name, email, position, unit_id, phone, note } = req.body;
    name = (name || '').trim();
    email = (email || '').trim();
    position = (position || '').trim();
    phone = (phone || '').trim();
    note = (note || '').trim();
    if (!name || !email || !position) {
      return res.redirect('/organize/contact?error=Name, Email, and Position are required');
    }
    await Contact.update(req.params.id, { name, email, position, unit_id, phone, note });
    res.redirect('/organize/contact?success=Contact updated successfully');
  } catch(err) {
    console.error(err);
    res.redirect('/organize/contact?error=Unable to update contact');
  }
};

// Delete contact
exports.deleteContact = async (req, res) => {
  try {
    await Contact.delete(req.params.id);
    res.redirect('/organize/contact?success=Contact deleted successfully');
  } catch(err) {
    console.error(err);
    res.redirect('/organize/contact?error=Unable to delete contact');
  }
};

// Organization Unit List page handler
exports.unitList = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    // Load config for allowed page sizes from database
    let allowedPageSizes = [10, 20, 50];
    try {
      const pageSizeConfig = await Configuration.findByKey('page_size');
      if (pageSizeConfig && pageSizeConfig.value) {
        allowedPageSizes = pageSizeConfig.value.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
      }
    } catch (e) {
      // fallback to default if config not found or error
    }
    // Ensure pageSize is always a valid value from allowedPageSizes
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!allowedPageSizes.includes(pageSize)) {
      pageSize = allowedPageSizes[0];
    }
    let totalCount, unitList;
    if (search) {
      totalCount = await Unit.searchCount(search);
      unitList = await Unit.searchPage(search, page, pageSize);
    } else {
      totalCount = await Unit.countAll();
      unitList = await Unit.findPage(page, pageSize);
    }
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const errorMessage = req.query.error || null;
    const successMessage = req.query.success || null;
    const content = ejs.render(
      fs.readFileSync(path.join(__dirname, '../../public/html/pages/organize/unit_list.ejs'), 'utf8'),
      { unitList, search, page, totalPages, errorMessage, successMessage, user: req.session.user, hasPermission: req.app.locals.hasPermission, pageSize, totalCount, startItem: totalCount === 0 ? 0 : (page - 1) * pageSize + 1, endItem: totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount), allowedPageSizes }
    );
    const siteConfig = await Configuration.findByKey('site_name');
    const siteName = siteConfig ? siteConfig.value : undefined;

    res.render('layouts/layout', {
      cssPath: config.cssPath,
      jsPath: config.jsPath,
      imgPath: config.imgPath,
      body: content,
      title: 'Organization Unit',
      activeMenu: 'unit',
      user: req.session.user,
      siteName
    });
  } catch (err) {
    console.error('Error loading units:', err);
    return res.status(500).send('Error loading units: ' + err.message);
  }
};

// Create new unit
exports.createUnit = async (req, res) => {
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
exports.updateUnit = async (req, res) => {
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
exports.deleteUnit = async (req, res) => {
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
exports.apiContactSearch = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const pool = require('../../config/config').pool;
    let sql = 'SELECT id, name, email FROM contacts';
    let params = [];
    if (search) {
      sql += ' WHERE name ILIKE $1 OR email ILIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT 20';
    const result = await pool.query(sql, params);
    // Format for select2
    const data = result.rows.map(row => ({ id: row.id, text: row.name + (row.email ? ` (${row.email})` : '') }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading contacts', detail: err.message });
  }
};

// API for select2 ajax unit (organize) search
exports.apiUnitSearch = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    let sql = 'SELECT id, name FROM units';
    let params = [];
    if (search) {
      sql += ' WHERE name ILIKE $1 OR code ILIKE $1 OR description ILIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT 20';
    const result = await require('../../config/config').pool.query(sql, params);
    // Format for select2
    const data = result.rows.map(row => ({ id: row.id, text: row.name }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading units', detail: err.message });
  }
};

// ===== TAG MENU =====
// Render tag list page with pagination
exports.tagList = async (req, res) => {
  try {
    const Tag = require('../models/Tag');
    const search = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    // Load config for allowed page sizes from database
    let allowedPageSizes = [10, 20, 50];
    try {
      const pageSizeConfig = await Configuration.findByKey('page_size');
      if (pageSizeConfig && pageSizeConfig.value) {
        allowedPageSizes = pageSizeConfig.value.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
      }
    } catch (e) {
      // fallback to default if config not found or error
    }
    // Ensure pageSize is always a valid value from allowedPageSizes
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!allowedPageSizes.includes(pageSize)) {
      pageSize = allowedPageSizes[0];
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
    const content = ejs.render(
      fs.readFileSync(path.join(__dirname, '../../public/html/pages/organize/tag_list.ejs'), 'utf8'),
      { tagList, search, page, totalPages, errorMessage, successMessage, startItem, endItem, totalCount, allowedPageSizes, pageSize, user: req.session.user, hasPermission: req.app.locals.hasPermission }
    );
    const siteConfig = await Configuration.findByKey('site_name');
    const siteName = siteConfig ? siteConfig.value : undefined;
    res.render('layouts/layout', {
      cssPath: config.cssPath,
      jsPath: config.jsPath,
      imgPath: config.imgPath,
      body: content,
      title: 'Tag List',
      activeMenu: 'tag',
      user: req.session.user,
      siteName
    });
  } catch (err) {
    res.status(500).send('Error loading tags: ' + err.message);
  }
};

// Create a new tag
exports.createTag = async (req, res) => {
  try {
    const Tag = require('../models/Tag');
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
exports.updateTag = async (req, res) => {
  try {
    const Tag = require('../models/Tag');
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
exports.deleteTag = async (req, res) => {
  try {
    const Tag = require('../models/Tag');
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
exports.apiTagSearch = async (req, res) => {
  try {
    const Tag = require('../models/Tag');
    const search = req.query.search ? req.query.search.trim() : '';
    const tags = await Tag.searchForSelect2(search);
    res.json(tags.map(tag => ({ id: tag.id, text: tag.name })));
  } catch (err) {
    res.status(500).json({ error: 'Error loading tags' });
  }
};
