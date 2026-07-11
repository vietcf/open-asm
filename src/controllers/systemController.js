import ExcelJS from 'exceljs';
import System from '../models/System.js';
import Contact from '../models/Contact.js';
import FileUpload from '../models/FileUpload.js';
import { pool } from '../../config/config.js';
import SystemComponent from '../models/SystemComponent.js';
import * as systemService from '../services/systemService.js';
import * as systemComponentService from '../services/systemComponentService.js';
import { ServiceError } from '../services/errors.js';

const { getLevelOptions, getScopeOptions, getArchitectureOptions } = systemService;
const { getAppTypeOptions } = systemComponentService;

const systemController = {};
// System Component list page
systemController.listSystemComponent = async (req, res) => {
  try {
    const allowedPageSizes = res.locals.pageSizeOptions;
    let pageSize = parseInt(req.query.pageSize, 10);
    if (!pageSize || !allowedPageSizes.includes(pageSize)) pageSize = res.locals.defaultPageSize;
    const page = parseInt(req.query.page, 10) || 1;
    const search = req.query.search?.trim() || '';
    // Filter tags, contacts, system_id, and app_type
    const normalizeArray = v => (Array.isArray(v) ? v : (v ? [v] : []));
    let filterTags = req.query['tags[]'] || req.query.tags || [];
    let filterContacts = req.query['contacts[]'] || req.query.contacts || [];
    let filterSystemId = req.query['system_id[]'] || req.query.system_id || [];
    let filterAppType = req.query['app_type[]'] || req.query.app_type || [];
    filterTags = normalizeArray(filterTags).filter(x => x !== '');
    filterContacts = normalizeArray(filterContacts).filter(x => x !== '');
    filterSystemId = normalizeArray(filterSystemId).filter(x => x !== '');
    filterAppType = normalizeArray(filterAppType).filter(x => x !== '');
    const { items: componentList, totalCount } = await systemComponentService.listComponents({
      search, page, pageSize, filterTags, filterContacts, system_id: filterSystemId, app_type: filterAppType
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];
    // Get app type options for filter
    const appTypeOptions = await getAppTypeOptions();

    res.render('pages/system/component_list', {
      componentList,
      search,
      page,
      pageSize,
      totalPages,
      totalCount,
      startItem,
      endItem,
      filterTags,
      filterContacts,
      filterSystemId,
      filterAppType,
      appTypeOptions,
      successMessage,
      errorMessage,
      title: 'System Component',
      activeMenu: 'system-component',
    });
  } catch (err) {
    res.status(500).send('Error loading system components: ' + err.message);
  }
};

// Render add component form
systemController.addSystemComponentForm = async (req, res) => {
  // Fetch App Type options from configuration table
  const appTypeOptions = await getAppTypeOptions();
  res.render('pages/system/component_add', {
    error: null,
    appTypeOptions,
    title: 'Add System Component',
    activeMenu: 'system-component',
  });
};

// Handle add component
systemController.addSystemComponent = async (req, res) => {
  try {
    let { system_id, name, app_type, description, fqdn, contacts, ips, tags } = req.body;
    await systemComponentService.createComponent({
      system_id, name, app_type, description, fqdn, contacts, ips, tags,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    });
    req.flash('success', 'Component added successfully');
    return res.redirect('/system/component');
  } catch (err) {
    if (err instanceof ServiceError) {
      req.flash('error', err.message);
    } else {
      req.flash('error', 'Error adding component: ' + err.message);
    }
    return res.redirect('/system/component');
  }
};

// Render edit component form
systemController.editSystemComponentForm = async (req, res) => {
  try {
    const id = req.params.id;
    const component = await SystemComponent.findByIdWithRelations(id);
    if (!component) {
      req.flash('error', 'Component not found.');
      return res.redirect('/system/component');
    }
    // Lấy options cho app_type
    const appTypeOptions = await getAppTypeOptions();
    res.render('pages/system/component_edit', {
      component,
      appTypeOptions,
      title: 'Edit System Component',
      activeMenu: 'system-component',
    });
  } catch (err) {
    res.status(500).send('Error loading component: ' + err.message);
  }
};

// Handle update component
systemController.updateSystemComponent = async (req, res) => {
  try {
    const id = req.params.id;
    let { name, description, ips, tags, contacts, app_type, fqdn, system_id } = req.body;
    await systemComponentService.updateComponent(id, {
      name, description, ips, tags, contacts, app_type, fqdn, system_id,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    });
    req.flash('success', 'Component updated successfully');
    return res.redirect('/system/component');
  } catch (err) {
    if (err instanceof ServiceError) {
      req.flash('error', err.message);
    } else {
      req.flash('error', 'Error updating component: ' + err.message);
    }
    return res.redirect('/system/component');
  }
};

// Handle delete component
systemController.deleteSystemComponent = async (req, res) => {
  try {
    const id = req.params.id;
    await systemComponentService.deleteComponent(id);
    req.flash('success', 'Component deleted successfully');
    return res.redirect('/system/component');
  } catch (err) {
    if (err instanceof ServiceError) {
      req.flash('error', err.message);
    } else {
      req.flash('error', 'Error deleting component: ' + err.message);
    }
    return res.redirect('/system/component');
  }
};

// System list page (with DB)
systemController.listSystem = async (req, res) => {
  try {
  // Paging & search params
  const allowedPageSizes = res.locals.pageSizeOptions;
  let pageSize = parseInt(req.query.pageSize, 10);
  if (!pageSize || !allowedPageSizes.includes(pageSize)) pageSize = res.locals.defaultPageSize;
  const page = parseInt(req.query.page, 10) || 1;
  const search = req.query.search?.trim() || '';
  // Normalize filter from query (accept both tags[] and tags, contacts[] and contacts, scopes[] and scopes, architectures[] and architectures)
  const normalizeArray = v => (Array.isArray(v) ? v : (v ? [v] : []));
  let filterTags = req.query['tags[]'] || req.query.tags || [];
  let filterContacts = req.query['contacts[]'] || req.query.contacts || [];
  let filterScopes = req.query['scopes[]'] || req.query.scopes || [];
  let filterArchitecture = req.query['architectures[]'] || req.query.architectures || [];
  filterTags = normalizeArray(filterTags).filter(x => x !== '');
  filterContacts = normalizeArray(filterContacts).filter(x => x !== '');
  filterScopes = normalizeArray(filterScopes).filter(x => x !== '');
  filterArchitecture = normalizeArray(filterArchitecture).filter(x => x !== '');
  // Data
  const { items: systemList, totalCount } = await systemService.listSystems({ search, page, pageSize, filterTags, filterContacts, filterScopes, filterArchitecture });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

    // Fetch all components for all systems in this page
    const systemIds = systemList.map(s => s.id);
    let componentsBySystem = {};
    if (systemIds.length > 0) {
      // Ensure systemIds is array of numbers (not strings)
      let systemIdInts = systemIds.map(id => typeof id === 'number' ? id : parseInt(id, 10)).filter(id => !isNaN(id));
      for (const sysId of systemIdInts) {
        const comps = await SystemComponent.findFilteredList({ system_id: sysId, pageSize: 1000 });
        if (comps && comps.length > 0) {
          componentsBySystem[sysId] = comps.map(c => ({ name: c.name }));
        }
      }
    }
    // Fetch files for all systems in this page
    let filesBySystem = {};
    if (systemIds.length > 0) {
      for (const sysId of systemIds) {
        const files = await FileUpload.findByObject('system', sysId);
        if (files && files.length > 0) {
          filesBySystem[sysId] = files.map(f => ({
            id: f.id,
            name: f.original_name || f.name,
            url: FileUpload.getUrl(f)
          }));
        }
      }
    }

    // Attach to each system
    systemList.forEach(s => {
      // Only attach components if there are any; otherwise, leave as empty array
      s.components = Array.isArray(componentsBySystem[s.id]) && componentsBySystem[s.id].length > 0 ? componentsBySystem[s.id] : [];
      // Attach files if there are any; otherwise, leave as empty array
      s.docs = Array.isArray(filesBySystem[s.id]) && filesBySystem[s.id].length > 0 ? filesBySystem[s.id] : [];
    });

    // Flash messages
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];

    // Get scope and architecture options for filter modal
    const scopeOptions = await getScopeOptions();
    const architectureOptions = await getArchitectureOptions();

    res.render('pages/system/system_list', {
      systemList,
      search,
      page,
      pageSize,
      totalPages,
      totalCount,
      startItem,
      endItem,
      successMessage,
      errorMessage,
      // Ensure filterTags, filterContacts, filterScopes, and filterArchitecture are always defined for EJS
      filterTags,
      filterContacts,
      filterScopes,
      filterArchitecture,
      scopeOptions,
      architectureOptions,
      title: 'System Management',
      activeMenu: 'system'
    });
  } catch (err) {
    res.status(500).send('Error loading systems: ' + err.message);
  }
};

// Export System List as Excel (filtered, same filters as listSystem)
systemController.exportSystemList = async (req, res) => {
  try {
    const normalizeArray = v => (Array.isArray(v) ? v : (v ? [v] : []));
    const search = req.query.search?.trim() || '';
    let filterTags = req.query['tags[]'] || req.query.tags || [];
    let filterContacts = req.query['contacts[]'] || req.query.contacts || [];
    let filterScopes = req.query['scopes[]'] || req.query.scopes || [];
    let filterArchitecture = req.query['architectures[]'] || req.query.architectures || [];
    filterTags = normalizeArray(filterTags).filter(x => x !== '');
    filterContacts = normalizeArray(filterContacts).filter(x => x !== '');
    filterScopes = normalizeArray(filterScopes).filter(x => x !== '');
    filterArchitecture = normalizeArray(filterArchitecture).filter(x => x !== '');

    // Lấy toàn bộ danh sách phù hợp filter (không phân trang)
    const { items: systemList } = await systemService.listSystems({
      search, page: 1, pageSize: 10000, filterTags, filterContacts, filterScopes, filterArchitecture
    });

    const headers = ['System Code', 'System Name', 'Tags', 'Contacts'];
    const rows = systemList.map(s => [
      s.system_id || '',
      s.name || '',
      (s.tags && s.tags.length ? s.tags.map(t => t.name).join(', ') : ''),
      (s.contacts && s.contacts.length ? s.contacts.map(c => c.name).join(', ') : '')
    ]);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('System List');
    worksheet.addRow(headers);
    rows.forEach(row => worksheet.addRow(row));
    worksheet.columns.forEach(col => { col.width = 30; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="system_list.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).send('Error exporting system list: ' + err.message);
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

    // Lấy toàn bộ component thuộc system này
    const componentList = await SystemComponent.findFilteredList({ system_id: id, pageSize: 1000 });
    // Get info of selected managers (contacts) for select2 selected options
    let selectedManagerObjects = [];
    if (selectedContacts && selectedContacts.length > 0) {
      selectedManagerObjects = await Contact.findByIds(selectedContacts);
    }
    const levelOptions = await getLevelOptions();
    const scopeOptions = await getScopeOptions();
    const architectureOptions = await getArchitectureOptions();
    res.render('pages/system/system_edit', {
      system,
      selectedContacts,
      ipAddresses,
      selectedIPs,
      selectedTags,
      selectedDomains,
      selectedManagerObjects,
      levelOptions,
      scopeOptions,
      architectureOptions,
      title: 'Edit System',
      activeMenu: 'system',
      componentList
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
    const id = req.params.id;
    let {
      system_id, name, level, department_id, alias, managers, ip_addresses,
      tags, domains, description, fqdn, scopes, architecture
    } = req.body;

    // Multi-selects submit no key at all when nothing is selected, so these
    // associations are always passed through explicitly (defaulting to [])
    // to preserve the edit form's "fully replace on submit" UX under the
    // service's has-key semantics — same fix applied to Server's controller.
    const updatedSystem = await systemService.updateSystem(id, {
      system_id, name, level, department_id, alias,
      managers: managers || [],
      ip_addresses: ip_addresses || [],
      tags: tags || [],
      domains: domains || [],
      description, fqdn, scopes, architecture,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    }, client);

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
    if (err instanceof ServiceError) {
      req.flash('error', err.message);
    } else {
      req.flash('error', 'Error updating system: ' + err.message);
    }
    return res.redirect('/system/system');
  } finally {
    client.release();
  }
};

// Render add system form
systemController.addSystemForm = async (req, res) => {
  try {
    const levelOptions = await getLevelOptions();
    const scopeOptions = await getScopeOptions();
    const architectureOptions = await getArchitectureOptions();
    res.render('pages/system/system_add', {
      error: null,
      levelOptions,
      scopeOptions,
      architectureOptions,
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
    let {
      system_id, name, level, department_id, alias, managers, ip_addresses,
      tags, domains, description, fqdn, scopes, architecture
    } = req.body;

    const newSystem = await systemService.createSystem({
      system_id, name, level, department_id, alias, managers, ip_addresses,
      tags, domains, description, fqdn, scopes, architecture,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    }, client);

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
    if (err instanceof ServiceError) {
      req.flash('error', err.message);
    } else {
      req.flash('error', 'Error adding system: ' + err.message);
    }
    return res.redirect('/system/system');
  } finally {
    client.release();
  }
};

// Delete system and related links
systemController.deleteSystem = async (req, res) => {
  try {
    const id = req.params.id;
    await systemService.deleteSystem(id);
    req.flash('success', 'System deleted successfully');
    return res.redirect('/system/system');
  } catch (err) {
    if (err instanceof ServiceError) {
      req.flash('error', err.message);
    } else {
      req.flash('error', 'Error deleting system: ' + err.message);
    }
    return res.redirect('/system/system');
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


// API: Get all components of a system by system id
systemController.apiSystemComponents = async (req, res) => {
  try {
    const systemId = req.params.id;
    if (!systemId) return res.status(400).json({ error: 'Missing system id' });
    // Get all components for this system (no paging, just all)
    const componentList = await SystemComponent.findFilteredList({ system_id: systemId, pageSize: 1000 });
    res.json({ components: componentList });
  } catch (err) {
    res.status(500).json({ error: 'Error loading components', detail: err.message });
  }
};

export default systemController;
