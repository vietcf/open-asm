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
import { ServiceError } from '../services/errors.js';
import { parseCsvLine } from '../utils/csvParser.js';
import {
  listContacts as listContactsService,
  createContact as createContactService,
  updateContact as updateContactService,
  deleteContact as deleteContactService,
  getPositionOptions as getPositionOptionsFromConfig,
  EMAIL_REGEX
} from '../services/contactService.js';
import {
  listUnits as listUnitsService,
  createUnit as createUnitService,
  updateUnit as updateUnitService,
  deleteUnit as deleteUnitService
} from '../services/unitService.js';
import {
  listTags as listTagsService,
  createTag as createTagService,
  updateTag as updateTagService,
  deleteTag as deleteTagService
} from '../services/tagService.js';

const organizeController = {};

// Contact List page handler
organizeController.contactList = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const filterUnitId = req.query.unit_id ? req.query.unit_id.trim() : '';
    const filterPosition = req.query.position ? req.query.position.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    // Use global page size options
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!res.locals.pageSizeOptions.includes(pageSize)) {
      pageSize = res.locals.defaultPageSize;
    }
    const { items: contactList, totalCount } = await listContactsService({ search, unit_id: filterUnitId, position: filterPosition, page, pageSize });
    const totalPages = Math.ceil(totalCount / pageSize);
    // fetch units for Org Unit select options
    const units = await Unit.findAll();
    // fetch position options from config
    const positionOptions = await getPositionOptionsFromConfig();
    // bubble any error message
    const errorMessage = req.query.error || null;
    const successMessage = req.query.success || null;
    return res.render('pages/organize/contact_list', {
      contactList,
      units,
      positionOptions,
      search,
      filterUnitId,
      filterPosition,
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
    const { name, email, position, unit_id, phone, description } = req.body;
    await createContactService({ name, email, position, unit_id, phone, description });
    res.redirect('/organize/contact?success=Contact added successfully');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to add contact';
    if (!(err instanceof ServiceError)) console.error('Add contact error:', err);
    res.redirect('/organize/contact?error=' + encodeURIComponent(message));
  }
};

// Update existing contact
organizeController.updateContact = async (req, res) => {
  try {
    const { name, email, position, unit_id, phone, description } = req.body;
    await updateContactService(req.params.id, { name, email, position, unit_id, phone, description });
    res.redirect('/organize/contact?success=Contact updated successfully');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to update contact';
    if (!(err instanceof ServiceError)) console.error(err);
    res.redirect('/organize/contact?error=' + encodeURIComponent(message));
  }
};

// Delete contact
organizeController.deleteContact = async (req, res) => {
  try {
    await deleteContactService(req.params.id);
    res.redirect('/organize/contact?success=Contact deleted successfully');
  } catch (err) {
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
    const { items: unitList, totalCount } = await listUnitsService({ search, page, pageSize });
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
  const { name, code, description, page, search } = req.body;
  const pageNum = page || 1;
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
  try {
    await createUnitService({ name, code, description });
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&success=Unit added successfully`);
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to add unit';
    if (!(err instanceof ServiceError)) console.error('Add unit error:', err);
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&error=${encodeURIComponent(errorMsg)}`);
  }
};

// Update existing unit
organizeController.updateUnit = async (req, res) => {
  const { id } = req.params;
  const { name, code, description, page, search } = req.body;
  const pageNum = page || 1;
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
  try {
    await updateUnitService(id, { name, code, description });
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&success=Unit updated successfully`);
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to update unit';
    if (!(err instanceof ServiceError)) console.error('Update unit error:', err);
    return res.redirect(`/organize/unit?page=${pageNum}${searchQuery}&error=${encodeURIComponent(errorMsg)}`);
  }
};

// Delete unit
organizeController.deleteUnit = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteUnitService(id);
    res.redirect('/organize/unit?success=Unit deleted successfully');
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to delete unit';
    if (!(err instanceof ServiceError)) console.error('Delete unit error:', err);
    res.redirect('/organize/unit?error=' + encodeURIComponent(errorMsg));
  }
};

// API for select2 ajax contact search
organizeController.apiContactSearch = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const contacts = await Contact.contactSearchSelect2(search);
    const data = contacts.map(row => ({ 
      id: row.id, 
      text: row.name + (row.email ? ` (${row.email.split('@')[0]})` : '') 
    }));
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
    const { items: tagList, totalCount } = await listTagsService({ search, page, pageSize });
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
    const { name, description } = req.body;
    await createTagService({ name, description });
    res.redirect('/organize/tag?success=Tag added successfully');
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to add tag';
    res.redirect('/organize/tag?error=' + encodeURIComponent(errorMsg));
  }
};

// Update Tag (PUT/POST for modal form)
organizeController.updateTag = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;
    // Frontend edit form always submits a name, so this stays effectively
    // "name required" in practice even though the service allows a
    // description-only partial update for API callers.
    await updateTagService(id, { name, description });
    res.redirect('/organize/tag?success=Tag updated successfully');
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to update tag';
    res.redirect('/organize/tag?error=' + encodeURIComponent(errorMsg));
  }
};

// Delete a tag
organizeController.deleteTag = async (req, res) => {
  try {
    const id = req.params.id;
    await deleteTagService(id);
    res.redirect('/organize/tag?success=Tag deleted successfully');
  } catch (err) {
    const errorMsg = err instanceof ServiceError ? err.message : 'Unable to delete tag';
    if (!(err instanceof ServiceError)) console.error('Delete tag error:', err);
    res.redirect('/organize/tag?error=' + encodeURIComponent(errorMsg));
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

    // Add sample data — position values pulled from the real configured
    // list (contact_position) rather than a hardcoded guess, since that
    // guess ("MANAGER"/"STAFF") previously didn't match this deployment's
    // actual configured casing ("Manager"/"Staff") and would fail import.
    const positionOptions = await getPositionOptionsFromConfig();
    const samplePosition1 = positionOptions[0] ? positionOptions[0].value : 'Manager';
    const samplePosition2 = positionOptions[1] ? positionOptions[1].value : (positionOptions[0] ? positionOptions[0].value : 'Staff');
    const sampleData = [
      ['John Doe', 'john.doe@company.com', '0123456789', 'IT Department', samplePosition1, 'Sample contact for IT management'],
      ['Jane Smith', 'jane.smith@company.com', '0987654321', 'HR Department', samplePosition2, 'Sample contact for HR staff']
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
      const headers = parseCsvLine(lines[0]);

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
        const values = parseCsvLine(lines[i]);
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
      // { header: 1 } reads row 1 itself as the header list — the default
      // (object-per-row) mode instead infers headers from which cells of
      // the FIRST DATA row are non-blank, undercounting columns whenever
      // that row has any blank optional field (e.g. "Expected 6 columns,
      // got 4" on a perfectly valid file just because Phone/Description
      // happened to be blank on row 2).
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        const headers = jsonData[0];
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

        for (let i = 1; i < jsonData.length; i++) {
          const row = {};
          headers.forEach((header, index) => { row[header] = jsonData[i][index] || ''; });
          rows.push(row);
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
    // Real configured position list (config_name contact_position), not a
    // hardcoded guess — deployments can (and here, do) configure values
    // beyond just MANAGER/STAFF, e.g. "Staff", "Accountant", "Engineer".
    const positionOptions = await getPositionOptionsFromConfig();
    const allowedPositions = positionOptions.map(o => o.value);

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
      } else if (!EMAIL_REGEX.test(row['Email (Require)'].trim())) {
        errors.push('Invalid email format');
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
      } else if (allowedPositions.length > 0 && !allowedPositions.includes(row['Position (Require)'].trim())) {
        errors.push(`Invalid position. Must be one of: ${allowedPositions.join(', ')}`);
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
      const headers = parseCsvLine(lines[0]);

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
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
    // Tracks emails/names already claimed earlier in this same file — the
    // per-row "already exists" check below only queries the DB, so two rows
    // with the same email/name in one file would both pass it individually
    // (contacts.email has no DB-level UNIQUE constraint) and both get
    // created as separate contacts. See importSubnets for the SAVEPOINT
    // rationale: without it, a raw DB error on one row would abort the
    // whole shared transaction and the final COMMIT would silently discard
    // the entire batch, even rows already marked Success.
    const seenEmails = new Set();
    const seenNames = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = {
        ...row,
        import_status: 'Success',
        import_reason: ''
      };

      const name = (row['Name (Require)'] || '').toString().trim();
      const email = (row['Email (Require)'] || '').toString().trim();
      const position = (row['Position (Require)'] || '').toString().trim();

      if (!name || !email || !position) {
        result.import_status = 'Failed';
        result.import_reason = 'Name, Email, and Position are required';
        importResults.push(result);
        continue;
      }

      const emailKey = email.toLowerCase();
      const nameKey = name.toLowerCase();
      if (seenEmails.has(emailKey) || seenNames.has(nameKey)) {
        result.import_status = 'Skipped';
        result.import_reason = 'Duplicate email or name within this file';
        importResults.push(result);
        continue;
      }

      // Check if contact already exists by email or name
      const existingContactByEmail = await Contact.findByEmail(email);
      const existingContactByName = await Contact.findByName(name);
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
      if (row['Org Unit'] && row['Org Unit'].toString().trim()) {
        const unit = await Unit.findByName(row['Org Unit'].toString().trim());
        if (!unit) {
          result.import_status = 'Failed';
          result.import_reason = `Org Unit not found: ${row['Org Unit']}`;
          importResults.push(result);
          continue;
        }
        unit_id = unit.id;
      }

      seenEmails.add(emailKey);
      seenNames.add(nameKey);

      // Each row gets its own savepoint: createContactService runs the same
      // format/position/duplicate validation as the single-add path, but if
      // it (or anything else) still hits a raw DB error, that error leaves
      // the whole shared transaction "aborted" in Postgres until rolled
      // back — without a savepoint, every row after the first failure would
      // also fail and the final COMMIT would discard the entire batch.
      const savepoint = `import_contact_row_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepoint}`);
        await createContactService({
          name,
          email,
          position,
          phone: row['Phone'] ? row['Phone'].toString().trim() : '',
          unit_id,
          description: row['Description'] ? row['Description'].toString().trim() : ''
        }, client);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        result.import_reason = 'Successfully created contact';
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        console.error(`Error importing contact row ${i + 1}:`, err);
        result.import_status = 'Failed';
        result.import_reason = err instanceof ServiceError ? err.message : (err.message || 'Unknown error');
      }

      importResults.push(result);
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
