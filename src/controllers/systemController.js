const path = require('path');
const fs = require('fs');

const System = require('../models/System');
const Unit = require('../models/Unit');
const Contact = require('../models/Contact');
const Domain = require('../models/Domain');
const FileUpload = require('../models/FileUpload');
const Configuration = require('../models/Configuration');
const systemOptions = require('../../config/systemOptions');
const pool = require('../../config/config').pool;

// System list page (with DB)
exports.listSystem = async (req, res) => {
  try {
    // Paging & search params
    const allowedPageSizes = res.locals.pageSizeOptions;
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!pageSize || !allowedPageSizes.includes(pageSize)) pageSize = res.locals.defaultPageSize;
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search?.trim() || '';

    // Data
    const systemList = await System.filterList({ search, page, pageSize });
    const totalCount = await System.filterCount({ search });
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
      title: 'System',
      activeMenu: 'system'
    });
  } catch (err) {
    res.status(500).send('Error loading systems: ' + err.message);
  }
};

// Render edit system form
exports.editSystemForm = async (req, res) => {
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
exports.updateSystem = async (req, res) => {
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
    // Update the systems table
    await System.updateMain(id, {
      system_id,
      name,
      level,
      department_id,
      alias: aliasValue,
      description,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    }, client);
    await System.updateContacts(id, managers, client);
    await System.updateIPs(id, ip_addresses, client);
    await System.updateDomains(id, domains, client);
    await System.updateTags(id, tags, client);
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
        // Move file from tmp to system folder if using local storage
        let finalPath = doc.url;
        if (process.env.FILE_UPLOAD_DRIVER !== 's3' && doc.url && doc.url.startsWith('/uploads/tmp/')) {
          const filename = doc.url.split('/').pop();
          const tmpPath = path.join(__dirname, '../../public/uploads/tmp/', filename);
          const destDir = path.join(__dirname, '../../public/uploads/system/');
          const destPath = path.join(destDir, filename);
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
          try {
            fs.renameSync(tmpPath, destPath);
            finalPath = '/uploads/system/' + filename;
          } catch (e) { /* If error, keep original tmp url */ }
        }
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
exports.addSystemForm = async (req, res) => {
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
exports.addSystem = async (req, res) => {
  const pool = require('../../config/config').pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Get data from the form and check/initialize safely
    let {
      system_id = '',
      name = '',
      level = null,
      department_id = null,
      alias = [],
      managers = [],
      servers = [],
      ip_addresses = [],
      tags = [],
      domains = [],
      description = ''
    } = req.body;
    // Ensure all array fields are always arrays
    if (!Array.isArray(alias)) alias = alias ? alias.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!Array.isArray(managers)) managers = managers ? [managers] : [];
    if (!Array.isArray(servers)) servers = servers ? [servers] : [];
    if (!Array.isArray(ip_addresses)) ip_addresses = ip_addresses ? [ip_addresses] : [];
    if (!Array.isArray(tags)) tags = tags ? [tags] : [];
    if (!Array.isArray(domains)) domains = domains ? [domains] : [];
    // Ensure all string fields are always strings
    system_id = typeof system_id === 'string' ? system_id.trim() : '';
    name = typeof name === 'string' ? name.trim() : '';
    description = typeof description === 'string' ? description : '';
    // Ensure all number fields are null if empty
    level = (level === undefined || level === null || level === '') ? null : level;
    department_id = (department_id === undefined || department_id === null || department_id === '') ? null : department_id;
    // Validate level if present, use allowed values from systemOptions.levels
    if (level !== null) {
      const allowedLevels = (systemOptions.levels || []).map(l => l.value);
      if (!allowedLevels.includes(level)) {
        return res.status(400).send('Invalid level value.');
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
    await System.addContacts(newSystem.id, managers, client);
    await System.addIPs(newSystem.id, ip_addresses, client);
    await System.addDomains(newSystem.id, domains, client);
    await System.addTags(newSystem.id, tags, client);
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
        // Move file from tmp to system folder if using local storage
        let finalPath = doc.url;
        if (process.env.FILE_UPLOAD_DRIVER !== 's3' && doc.url && doc.url.startsWith('/uploads/tmp/')) {
          const filename = doc.url.split('/').pop();
          const tmpPath = path.join(__dirname, '../../public/uploads/tmp/', filename);
          const destDir = path.join(__dirname, '../../public/uploads/system/');
          const destPath = path.join(destDir, filename);
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
          try {
            // Copy file to system folder
            fs.copyFileSync(tmpPath, destPath);
            finalPath = '/uploads/system/' + filename;
            // Delete file from tmp if copy is successful
            fs.unlinkSync(tmpPath);
          } catch (e) { /* If error, keep original tmp url */ }
        }
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
exports.deleteSystem = async (req, res) => {
  const pool = require('../../config/config').pool;
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
    const files = await FileUpload.findByObject('system', id);
    await client.query('DELETE FROM file_uploads WHERE object_type = $1 AND object_id = $2', ['system', id]);
    // Delete physical files
    for (const file of files) {
      if (file.file_path && file.file_path.startsWith('/uploads/system/')) {
        const absPath = path.join(__dirname, '../../public', file.file_path);
        try {
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        } catch (e) { /* ignore */ }
      }
    }
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
exports.apiSystemSearch = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    // Move query logic to model for cleaner controller
    const data = await System.apiSystemSearch({ search });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error loading systems', detail: err.message });
  }
};