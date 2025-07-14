import path from 'path';
import fs from 'fs';
import System from '../models/System.js';
import Unit from '../models/Unit.js';
import Contact from '../models/Contact.js';
import Domain from '../models/Domain.js';
import FileUpload from '../models/FileUpload.js';
import Configuration from '../models/Configuration.js';
import IpAddress from '../models/IpAddress.js';
import Tag from '../models/Tag.js';
import systemOptions from '../../config/systemOptions.js';
import { pool } from '../../config/config.js';

const systemController = {};

// System list page (with DB)
systemController.listSystem = async (req, res) => {
  try {
    // Paging & search params
    const allowedPageSizes = res.locals.pageSizeOptions;
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!pageSize || !allowedPageSizes.includes(pageSize)) pageSize = res.locals.defaultPageSize;
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search?.trim() || '';

    // Data
    const systemList = await System.findFilteredList({ search, page, pageSize });
    const totalCount = await System.countFiltered({ search });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

    // Flash messages
    const [success, error] = [req.flash('success')[0], req.flash('error')[0]];

    // Render
    res.render('pages/system/system_list', {
      systemList,
      search,
      page,
      pageSize,
      totalPages,
      totalCount,
      startItem,
      endItem,
      success,
      error,
      title: 'System Management',
      activeMenu: 'system-management',
    });
  } catch (err) {
    res.status(500).send('Error loading systems: ' + err.message);
  }
};

// Render edit system form
systemController.editSystemForm = async (req, res) => {
  try {
    const id = req.params.id;
    const system = await System.findById(id);
    // Get the correct list of contact_id as managers of this system
    const selectedContacts = await System.getContactsBySystemId(id);
    // Get the list of IPs assigned to this system
    const selectedIPs = await System.getIpIdsBySystemId(id);
    // Get info of selected IPs (to render selected options)
    let ipAddresses = [];
    if (selectedIPs.length > 0) {
      ipAddresses = await System.getIpAddressesByIds(selectedIPs);
    }
    // Get the list of domains assigned to this system (for multi-select, with name)
    const selectedDomains = await System.getDomainsBySystemId(id);
    // Get the list of tags assigned to this system
    const selectedTags = await System.getTagIds(id);
    // Get the list of files uploaded for this system
    const files = await FileUpload.findByObject('system', id);
    system.docs = files.map(f => ({
      id: f.id,
      name: f.original_name || f.name, // fallback if original_name is missing
      url: FileUpload.getUrl(f)
    }));
    // Get info of selected managers (contacts) for select2 selected options
    let selectedManagerObjects = [];
    if (selectedContacts && selectedContacts.length > 0) {
      selectedManagerObjects = await Contact.findByIds(selectedContacts);
    }
    res.render('pages/system/system_edit', {
      system,
      // units,
      //contacts,
      selectedContacts,
      ipAddresses,
      selectedIPs,
      selectedTags, // <-- ensure this is passed
      selectedDomains,
      selectedManagerObjects,
      levelOptions: systemOptions.levels, // Add this line
      title: 'Edit System',
      activeMenu: 'system'
    });
  } catch (err) {
    res.status(500).send('Error loading system: ' + err.message);
  }
};

// Handle system update
systemController.updateSystem = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Extract id from params
    const id = req.params.id;
    // Extract all fields from req.body first
    let {
      system_id,
      name,
      level,
      department_id,
      alias,
      managers,
      servers,
      ip_addresses,
      tags,
      domains,
      description
    } = req.body;
    // Now check and initialize each field as needed
    system_id = (system_id === undefined || system_id === null) ? '' : String(system_id).trim();
    name = (name === undefined || name === null) ? '' : String(name).trim();
    level = (level === undefined || level === null || level === '') ? null : level;
    department_id = (department_id === undefined || department_id === null || department_id === '') ? null : department_id;
    // Alias: always an array
    let aliasValue = [];
    if (alias !== undefined && alias !== null && alias !== '') {
      if (Array.isArray(alias)) {
        aliasValue = alias.filter(Boolean);
      } else {
        aliasValue = String(alias).split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    // Managers: always an array
    if (!Array.isArray(managers)) managers = managers ? [managers] : [];
    // Servers: always an array
    if (!Array.isArray(servers)) servers = servers ? [servers] : [];
    // IP addresses: always an array
    if (!Array.isArray(ip_addresses)) ip_addresses = ip_addresses ? [ip_addresses] : [];
    // Tags: always an array
    if (!Array.isArray(tags)) tags = tags ? [tags] : [];
    // Domains: always an array
    if (!Array.isArray(domains)) domains = domains ? [domains] : [];
    // Description: always a string
    description = (description === undefined || description === null) ? '' : String(description);

    // Explicit required field validation (only required fields in the form)
    const requiredFields = [
      { key: 'system_id', value: system_id, label: 'System ID' },
      { key: 'name', value: name, label: 'System Name' }
    ];
    const missing = requiredFields.filter(f => f.value === null || f.value === undefined || f.value === '');
    if (missing.length > 0) {
      req.flash('error', 'Missing required field(s): ' + missing.map(f => f.label).join(', '));
      return res.redirect('/system/system');
    }

    // Validate level if present, use allowed values from systemOptions.levels
    if (level !== null) {
      const allowedLevels = (systemOptions.levels || []).map(l => l.value);
      if (!allowedLevels.includes(level)) {
        req.flash('error', 'Invalid level value.');
        return res.redirect('/system/system');
      }
    }

    // Validate department_id if present
    if (department_id !== null) {
      const unit = await Unit.findById(department_id);
      if (!unit) {
        req.flash('error', 'Invalid department (unit) selected.');
        return res.redirect('/system/system');
      }
    }

    // Validate managers (contact ids)
    if (managers && managers.length > 0) {
      const invalidManagers = [];
      for (const mid of managers) {
        if (!(await Contact.exists(mid))) invalidManagers.push(mid);
      }
      if (invalidManagers.length > 0) {
        req.flash('error', 'Invalid manager (contact) IDs: ' + invalidManagers.join(', '));
        return res.redirect('/system/system');
      }
    }

    // Validate ip_addresses
    if (ip_addresses && ip_addresses.length > 0) {
      const invalidIps = [];
      for (const ipid of ip_addresses) {
        if (!(await IpAddress.exists(ipid))) invalidIps.push(ipid);
      }
      if (invalidIps.length > 0) {
        req.flash('error', 'Invalid IP address IDs: ' + invalidIps.join(', '));
        return res.redirect('/system/system');
      }
    }

    // Validate tags
    if (tags && tags.length > 0) {
      const invalidTags = [];
      for (const tid of tags) {
        if (!(await Tag.exists(tid))) invalidTags.push(tid);
      }
      if (invalidTags.length > 0) {
        req.flash('error', 'Invalid tag IDs: ' + invalidTags.join(', '));
        return res.redirect('/system/system');
      }
    }

    // Validate domains
    if (domains && domains.length > 0) {
      const invalidDomains = [];
      for (const did of domains) {
        if (!(await Domain.findById(did))) invalidDomains.push(did);
      }
      if (invalidDomains.length > 0) {
        req.flash('error', 'Invalid domain IDs: ' + invalidDomains.join(', '));
        return res.redirect('/system/system');
      }
    }
    // Update the systems table
    await System.update(id, {
      system_id,
      name,
      level,
      department_id,
      alias: aliasValue,
      description,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    }, client);
    await System.setContacts(id, managers, client);
    await System.setIPs(id, ip_addresses, client);
    await System.setDomains(id, domains, client);
    await System.setTags(id, tags, client);
    // Handle file deletion if requested
    let filesToDelete = [];
    if (req.body.delete_files) {
      try {
        filesToDelete = JSON.parse(req.body.delete_files);
      } catch (e) { filesToDelete = []; }
    }
    if (Array.isArray(filesToDelete) && filesToDelete.length > 0) {
      for (const fileId of filesToDelete) {
        await FileUpload.deleteById(fileId);
      }
    }
    // Handle new file uploads (multiple files supported)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let filePath = file.path || (file.location ? file.location : null);
        await FileUpload.create({
          object_type: 'system',
          object_id: id,
          original_name: file.originalname,
          file_path: filePath,
          mime_type: file.mimetype,
          size: file.size,
          uploaded_by: req.session.user ? req.session.user.id : null
        }, client);
      }
    }
    // Handle uploaded files from AJAX (hidden input: uploaded_docs_edit)
    let uploadedDocsEdit = [];
    if (req.body.uploaded_docs_edit) {
      try {
        uploadedDocsEdit = JSON.parse(req.body.uploaded_docs_edit);
      } catch (e) { uploadedDocsEdit = []; }
    }
    if (Array.isArray(uploadedDocsEdit) && uploadedDocsEdit.length > 0) {
      for (const doc of uploadedDocsEdit) {
        // Move file from tmp to system folder if using local storage (now via FileUpload helper)
        let finalPath = FileUpload.moveFromTmpToSystem(doc.url);
        // Validate file info before saving to the database
        if (!finalPath || !(doc.originalname || doc.name) || !doc.mimetype || !doc.size) {
          continue;
        }
        await FileUpload.create({
          object_type: 'system',
          object_id: id,
          original_name: doc.originalname || doc.name,
          file_path: finalPath,
          mime_type: doc.mimetype,
          size: doc.size,
          uploaded_by: req.session.user ? req.session.user.id : null
        }, client);
      }
    }
    await client.query('COMMIT');
    req.flash('success', 'System updated successfully');
    return res.redirect('/system/system');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Error updating system: ' + err.message);
    return res.redirect('/system/system');
  } finally {
    client.release();
  }
};

// Render add system form
systemController.addSystemForm = async (req, res) => {
  try {
    res.render('pages/system/system_add', {
      error: null, // Always pass error as null, no error message on add form
      levelOptions: systemOptions.levels, // Add this line
      title: 'Add System',
      activeMenu: 'system'
    });
  } catch (err) {
    res.status(500).send('Error loading add system form: ' + err.message);
  }
};

// Handle add system
systemController.addSystem = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Extract raw data from form
    let {
      system_id,
      name,
      level,
      department_id,
      alias,
      managers,
      servers,
      ip_addresses,
      tags,
      domains,
      description
    } = req.body;

    // Normalize/validate fields
    system_id = typeof system_id === 'string' ? system_id.trim() : '';
    name = typeof name === 'string' ? name.trim() : '';
    description = typeof description === 'string' ? description : '';

    alias = !alias ? [] : Array.isArray(alias) ? alias.filter(Boolean) : alias.split(',').map(s => s.trim()).filter(Boolean);
    managers = !managers ? [] : Array.isArray(managers) ? managers : [managers];
    servers = !servers ? [] : Array.isArray(servers) ? servers : [servers];
    ip_addresses = !ip_addresses ? [] : Array.isArray(ip_addresses) ? ip_addresses : [ip_addresses];
    tags = !tags ? [] : Array.isArray(tags) ? tags : [tags];
    domains = !domains ? [] : Array.isArray(domains) ? domains : [domains];

    level = (level === undefined || level === null || level === '') ? null : level;
    department_id = (department_id === undefined || department_id === null || department_id === '') ? null : department_id;

    // Explicit required field validation (only required fields in the form)
    const requiredFields = [
      { key: 'system_id', value: system_id, label: 'System ID' },
      { key: 'name', value: name, label: 'System Name' }
    ];
    const missing = requiredFields.filter(f => f.value === null || f.value === undefined || f.value === '');
    if (missing.length > 0) {
      req.flash('error', 'Missing required field(s): ' + missing.map(f => f.label).join(', '));
      return res.redirect('/system/system');
    }

    // Validate level if present, use allowed values from systemOptions.levels
    if (level !== null) {
      const allowedLevels = (systemOptions.levels || []).map(l => l.value);
      if (!allowedLevels.includes(level)) {
        req.flash('error', 'Invalid level value.');
        return res.redirect('/system/system');
      }
    }

    // Validate department_id if present
    if (department_id !== null) {
      const unit = await Unit.findById(department_id);
      if (!unit) {
        req.flash('error', 'Invalid department (unit) selected.');
        return res.redirect('/system/system');
      }
    }

    // Validate managers (contact ids)
    if (managers && managers.length > 0) {
      const invalidManagers = [];
      for (const mid of managers) {
        if (!(await Contact.exists(mid))) invalidManagers.push(mid);
      }
      if (invalidManagers.length > 0) {
        req.flash('error', 'Invalid manager (contact) IDs: ' + invalidManagers.join(', '));
        return res.redirect('/system/system');
      }
    }

    // Validate ip_addresses
    if (ip_addresses && ip_addresses.length > 0) {
      const invalidIps = [];
      for (const ipid of ip_addresses) {
        if (!(await IpAddress.exists(ipid))) invalidIps.push(ipid);
      }
      if (invalidIps.length > 0) {
        req.flash('error', 'Invalid IP address IDs: ' + invalidIps.join(', '));
        return res.redirect('/system/system');
      }
    }

    // Validate tags
    if (tags && tags.length > 0) {
      const invalidTags = [];
      for (const tid of tags) {
        if (!(await Tag.exists(tid))) invalidTags.push(tid);
      }
      if (invalidTags.length > 0) {
        req.flash('error', 'Invalid tag IDs: ' + invalidTags.join(', '));
        return res.redirect('/system/system');
      }
    }

    // Validate domains
    if (domains && domains.length > 0) {
      const invalidDomains = [];
      for (const did of domains) {
        if (!(await Domain.findById(did))) invalidDomains.push(did);
      }
      if (invalidDomains.length > 0) {
        req.flash('error', 'Invalid domain IDs: ' + invalidDomains.join(', '));
        return res.redirect('/system/system');
      }
    }
    // Create new system
    const newSystem = await System.create({
      system_id,
      name,
      level,
      department_id,
      alias,
      description,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    }, client);
    // Use set... methods for consistency and future-proofing
    await System.setContacts(newSystem.id, managers, client);
    await System.setIPs(newSystem.id, ip_addresses, client);
    await System.setDomains(newSystem.id, domains, client);
    await System.setTags(newSystem.id, tags, client);
    // Save uploaded files info to file_uploads table if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let filePath = file.path || (file.location ? file.location : null);
        await FileUpload.create({
          object_type: 'system',
          object_id: newSystem.id,
          original_name: file.originalname,
          file_path: filePath,
          mime_type: file.mimetype,
          size: file.size,
          uploaded_by: req.session.user ? req.session.user.id : null
        }, client);
      }
    }
    // Handle uploaded files from AJAX (hidden input: uploaded_docs)
    let uploadedDocs = [];
    if (req.body.uploaded_docs) {
      try {
        uploadedDocs = JSON.parse(req.body.uploaded_docs);
      } catch (e) { uploadedDocs = []; }
    }
    if (Array.isArray(uploadedDocs) && uploadedDocs.length > 0) {
      for (const doc of uploadedDocs) {
        // Validate file info before saving to the database
        if (!(doc.url && (doc.originalname || doc.name) && doc.mimetype && doc.size)) {
          continue;
        }
        // Move file from tmp to system folder if using local storage (now via FileUpload helper)
        let finalPath = FileUpload.moveFromTmpToSystem(doc.url);
        await FileUpload.create({
          object_type: 'system',
          object_id: newSystem.id,
          original_name: doc.originalname,
          file_path: finalPath,
          mime_type: doc.mimetype,
          size: doc.size,
          uploaded_by: req.session.user ? req.session.user.id : null
        }, client);
      }
    }
    await client.query('COMMIT');
    req.flash('success', 'System added successfully');
    return res.redirect('/system/system');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      req.flash('error', 'System ID already exists. Please use a unique System ID.');
      return res.redirect('/system/system');
    }
    req.flash('error', 'Error adding system: ' + err.message);
    return res.redirect('/system/system');
  } finally {
    client.release();
  }
};

// Delete system and related links
systemController.deleteSystem = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    // Delete related links via model
    await System.deleteTags(id, client);
    await System.deleteIPs(id, client);
    await System.deleteContacts(id, client);
    await System.deleteDomains(id, client);
    await System.deleteServers(id, client);
    // Delete file uploads related to this system from both DB and physical storage
    await FileUpload.deleteByObject('system', id);
    // Delete system
    await System.delete(id, client);
    await client.query('COMMIT');
    req.flash('success', 'System deleted successfully');
    return res.redirect('/system/system');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Error deleting system: ' + err.message);
    return res.redirect('/system/system');
  } finally {
    client.release();
  }
};

// API for select2 ajax system search
systemController.apiSystemSearch = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    // Use select2Search for select2 API
    const data = await System.select2Search({ search });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading systems', detail: err.message });
  }
};

export default systemController;