import { config, pool } from '../../config/config.js';
import Contact from '../models/Contact.js';
import Unit from '../models/Unit.js';
import Tag from '../models/Tag.js';
import Configuration from '../models/Configuration.js';
import QRCode from 'qrcode';
import XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

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

// Helper function to sanitize string data for Excel
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
};

// Download contact template
organizeController.downloadContactTemplate = async (req, res) => {
  try {
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contact Template');

    // Define headers
    const headers = [
      'Name (Require)',
      'Email (Require)', 
      'Phone',
      'Org Unit',
      'Position (Require)',
      'Description'
    ];

    // Add headers with styling
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add sample data
    const sampleData = [
      ['John Doe', 'john.doe@company.com', '0123456789', 'IT Department', 'MANAGER', 'Sample contact for IT management'],
      ['Jane Smith', 'jane.smith@company.com', '0987654321', 'HR Department', 'STAFF', 'Sample contact for HR staff']
    ];

    sampleData.forEach(row => {
      worksheet.addRow(row);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width || 10, 15);
    });

    const tempFilePath = path.join(tempDir, 'temp_contact_template.xlsx');
    await workbook.xlsx.writeFile(tempFilePath);

    // Send file for download
    res.download(tempFilePath, 'contact_import_template.xlsx', (err) => {
      if (err) {
        console.error('Error downloading template:', err);
      }
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

  } catch (error) {
    console.error('Error creating contact template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
};

// Validate contact import
organizeController.validateImportContacts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    let rows = [];

    // Parse file based on extension
    const ext = path.extname(originalFileName).toLowerCase();
    if (ext === '.csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      // Validate headers order and required fields
      const expectedHeaders = [
        'Name (Require)',
        'Email (Require)',
        'Phone',
        'Org Unit', 
        'Position (Require)',
        'Description'
      ];
      
      if (headers.length !== expectedHeaders.length) {
        return res.status(400).json({ 
          error: `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headers.length}` 
        });
      }
      
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (headers[i] !== expectedHeaders[i]) {
          return res.status(400).json({ 
            error: `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headers[i]}"` 
          });
        }
      }
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet);
      
      // Validate headers for Excel files
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const expectedHeaders = [
          'Name (Require)',
          'Email (Require)',
          'Phone',
          'Org Unit',
          'Position (Require)',
          'Description'
        ];
        
        if (headers.length !== expectedHeaders.length) {
          return res.status(400).json({ 
            error: `Invalid file format. Expected ${expectedHeaders.length} columns, got ${headers.length}` 
          });
        }
        
        for (let i = 0; i < expectedHeaders.length; i++) {
          if (headers[i] !== expectedHeaders[i]) {
            return res.status(400).json({ 
              error: `Invalid column order. Expected "${expectedHeaders[i]}" at position ${i + 1}, got "${headers[i]}"` 
            });
          }
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Only CSV and Excel files are allowed.' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data found in file' });
    }

    // Validation logic
    const validationResults = [];
    let allPassed = true;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        ...row,
        validation_status: 'Pass',
        validation_reason: ''
      };

      const errors = [];

      // Validate required fields
      if (!row['Name (Require)'] || !row['Name (Require)'].trim()) {
        errors.push('Name is required');
      }

      if (!row['Email (Require)'] || !row['Email (Require)'].trim()) {
        errors.push('Email is required');
      } else {
        // Validate email format
        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        if (!emailRegex.test(row['Email (Require)'].trim())) {
          errors.push('Invalid email format');
        }
      }

      // Check if contact already exists (by email or name)
      if (row['Name (Require)'] && row['Name (Require)'].trim() && row['Email (Require)'] && row['Email (Require)'].trim()) {
        const existingContactByEmail = await Contact.findByEmail(row['Email (Require)'].trim());
        const existingContactByName = await Contact.findByName(row['Name (Require)'].trim());
        
        if (existingContactByEmail && existingContactByName) {
          errors.push('Contact already exists (both email and name)');
        } else if (existingContactByEmail) {
          errors.push('Email already exists');
        } else if (existingContactByName) {
          errors.push('Name already exists');
        }
      }

      if (!row['Position (Require)'] || !row['Position (Require)'].trim()) {
        errors.push('Position is required');
      } else {
        // Validate position values
        const allowedPositions = ['MANAGER', 'STAFF'];
        if (!allowedPositions.includes(row['Position (Require)'].trim().toUpperCase())) {
          errors.push('Position must be MANAGER or STAFF');
        }
      }

      // Validate Org Unit if provided
      if (row['Org Unit'] && row['Org Unit'].trim()) {
        const unit = await Unit.findByName(row['Org Unit'].trim());
        if (!unit) {
          errors.push('Org Unit not found');
        }
      }

      if (errors.length > 0) {
        result.validation_status = 'Fail';
        result.validation_reason = errors.join('; ');
        allPassed = false;
      }

      validationResults.push(result);
    }

    // Generate validation results file
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const validationFileName = `${timestamp}_${originalFileName.replace(/\.[^/.]+$/, '')}_validation.xlsx`;
    const validationFilePath = path.join(tempDir, validationFileName);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Validation Results');

    // Add headers
    const headers = [
      'Name (Require)',
      'Email (Require)',
      'Phone',
      'Org Unit',
      'Position (Require)',
      'Description',
      'Validation Status',
      'Validation Reason'
    ];

    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data with color coding
    validationResults.forEach(result => {
      const row = worksheet.addRow([
        sanitizeString(result['Name (Require)'] || ''),
        sanitizeString(result['Email (Require)'] || ''),
        sanitizeString(result['Phone'] || ''),
        sanitizeString(result['Org Unit'] || ''),
        sanitizeString(result['Position (Require)'] || ''),
        sanitizeString(result['Description'] || ''),
        result.validation_status,
        sanitizeString(result.validation_reason || '')
      ]);

      // Color code based on validation status
      if (result.validation_status === 'Fail') {
        row.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' }
        };
        row.getCell(7).font = { color: { argb: 'FFCC0000' } };
      } else {
        row.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFCCFFCC' }
        };
        row.getCell(7).font = { color: { argb: 'FF006600' } };
      }
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width || 10, 15);
    });

    await workbook.xlsx.writeFile(validationFilePath);

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Set validation summary header
    res.set('X-Validation-Summary', JSON.stringify({
      totalRows: rows.length,
      passedRows: validationResults.filter(r => r.validation_status === 'Pass').length,
      failedRows: validationResults.filter(r => r.validation_status === 'Fail').length,
      allPassed: allPassed
    }));

    res.json({
      success: true,
      validation_file: `/organize/download/contact-validation/${validationFileName}`,
      summary: {
        totalRows: rows.length,
        passedRows: validationResults.filter(r => r.validation_status === 'Pass').length,
        failedRows: validationResults.filter(r => r.validation_status === 'Fail').length,
        allPassed: allPassed
      }
    });

  } catch (error) {
    console.error('Contact validation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Validation failed: ' + error.message });
    }
  }
};

// Import contacts
organizeController.importContacts = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    let rows = [];

    // Parse file (same logic as validation)
    const ext = path.extname(originalFileName).toLowerCase();
    if (ext === '.csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet);
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data found in file' });
    }

    const importResults = [];
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        ...row,
        import_status: 'Success',
        import_reason: ''
      };

      try {
        // Check if contact already exists by email or name
        const existingContactByEmail = await Contact.findByEmail(row['Email (Require)'].trim());
        const existingContactByName = await Contact.findByName(row['Name (Require)'].trim());
        
        if (existingContactByEmail && existingContactByName) {
          result.import_status = 'Skipped';
          result.import_reason = 'Contact already exists (both email and name)';
          importResults.push(result);
          continue;
        } else if (existingContactByEmail) {
          result.import_status = 'Skipped';
          result.import_reason = 'Email already exists';
          importResults.push(result);
          continue;
        } else if (existingContactByName) {
          result.import_status = 'Skipped';
          result.import_reason = 'Name already exists';
          importResults.push(result);
          continue;
        }

        // Get unit_id if Org Unit is provided
        let unit_id = null;
        if (row['Org Unit'] && row['Org Unit'].trim()) {
          const unit = await Unit.findByName(row['Org Unit'].trim());
          if (unit) {
            unit_id = unit.id;
          }
        }

        // Create contact
        const newContact = await Contact.create({
          name: row['Name (Require)'].trim(),
          email: row['Email (Require)'].trim(),
          phone: row['Phone'] ? row['Phone'].trim() : null,
          position: row['Position (Require)'].trim().toUpperCase(),
          unit_id: unit_id,
          description: row['Description'] ? row['Description'].trim() : null
        });

        importResults.push(result);

      } catch (err) {
        console.error(`Error importing contact row ${i + 1}:`, err);
        result.import_status = 'Failed';
        result.import_reason = err.message;
        importResults.push(result);
      }
    }

    await client.query('COMMIT');

    // Generate import results file
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const importFileName = `${timestamp}_${originalFileName.replace(/\.[^/.]+$/, '')}_imported.xlsx`;
    const importFilePath = path.join(tempDir, importFileName);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import Results');

    // Add headers
    const headers = [
      'Name (Require)',
      'Email (Require)',
      'Phone',
      'Org Unit',
      'Position (Require)',
      'Description',
      'Import Status',
      'Import Reason'
    ];

    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data with color coding
    importResults.forEach(result => {
      const row = worksheet.addRow([
        sanitizeString(result['Name (Require)'] || ''),
        sanitizeString(result['Email (Require)'] || ''),
        sanitizeString(result['Phone'] || ''),
        sanitizeString(result['Org Unit'] || ''),
        sanitizeString(result['Position (Require)'] || ''),
        sanitizeString(result['Description'] || ''),
        result.import_status,
        sanitizeString(result.import_reason || '')
      ]);

      // Color code based on import status
      if (result.import_status === 'Failed') {
        row.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' }
        };
        row.getCell(7).font = { color: { argb: 'FFCC0000' } };
      } else if (result.import_status === 'Skipped') {
        row.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFCC' }
        };
        row.getCell(7).font = { color: { argb: 'FFCC6600' } };
      } else {
        row.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFCCFFCC' }
        };
        row.getCell(7).font = { color: { argb: 'FF006600' } };
      }
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width || 10, 15);
    });

    await workbook.xlsx.writeFile(importFilePath);

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      success: true,
      import_file: `/organize/download/contact-validation/${importFileName}`,
      summary: {
        totalRows: rows.length,
        successRows: importResults.filter(r => r.import_status === 'Success').length,
        skippedRows: importResults.filter(r => r.import_status === 'Skipped').length,
        failedRows: importResults.filter(r => r.import_status === 'Failed').length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Contact import error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Import failed: ' + error.message });
    }
  } finally {
    client.release();
  }
};

// Download validation/import result files
organizeController.downloadContactValidationFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    const filePath = path.join(tempDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      // Clean up file after download
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed' });
    }
  }
};

export default organizeController;
