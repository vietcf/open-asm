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
import { pool } from '../../config/config.js';
import SystemComponent from '../models/SystemComponent.js';


// Tiện ích lấy levelOptions từ DB (Configuration)
async function getLevelOptionsFromConfig() {
  let levelOptions = [];
  try {
    const config = await Configuration.findById('system_level');
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch {
        parsed = null;
      }
      if (parsed) {
        if (Array.isArray(parsed)) {
          levelOptions = parsed.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        } else if (parsed.levels && Array.isArray(parsed.levels)) {
          levelOptions = parsed.levels.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        }
      } else {
        // fallback: comma string
        levelOptions = String(config.value).split(',').map(v => ({ id: v.trim(), text: v.trim() })).filter(x => x.id);
      }
    }
  } catch (e) {
    levelOptions = [];
  }
  if (!Array.isArray(levelOptions) || levelOptions.length === 0) {
    levelOptions = [1,2,3,4,5].map(v => ({ id: String(v), text: `level ${v}` }));
  }
  return levelOptions;
}

// Tiện ích lấy scopeOptions từ DB (Configuration)
async function getScopeOptionsFromConfig() {
  let scopeOptions = [];
  try {
    const config = await Configuration.findById('system_user_scope');
    
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch {
        parsed = null;
      }
      
      if (Array.isArray(parsed)) {
        scopeOptions = parsed.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
      } else if (parsed && typeof parsed === 'object') {
        // Handle case where parsed is an object with nested structure
        if (parsed.scopes && Array.isArray(parsed.scopes)) {
          scopeOptions = parsed.scopes.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        } else if (parsed.options && Array.isArray(parsed.options)) {
          scopeOptions = parsed.options.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        }
      } else if (typeof parsed === 'string') {
        // Handle comma-separated string
        scopeOptions = parsed.split(',').map(s => ({ id: s.trim(), text: s.trim() })).filter(x => x.id);
      }
    }
    
    return scopeOptions;
  } catch (e) {
    scopeOptions = [];
    return scopeOptions;
  }
}

// Tiện ích lấy architectureOptions từ DB (Configuration)
async function getArchitectureOptionsFromConfig() {
  let architectureOptions = [];
  try {
    const config = await Configuration.findById('system_arch');
    
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch {
        parsed = null;
      }
      
      if (Array.isArray(parsed)) {
        architectureOptions = parsed.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
      } else if (parsed && typeof parsed === 'object') {
        // Handle case where parsed is an object with nested structure
        if (parsed.architectures && Array.isArray(parsed.architectures)) {
          architectureOptions = parsed.architectures.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        } else if (parsed.options && Array.isArray(parsed.options)) {
          architectureOptions = parsed.options.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        }
      } else if (typeof parsed === 'string') {
        // Handle comma-separated string
        architectureOptions = parsed.split(',').map(s => ({ id: s.trim(), text: s.trim() })).filter(x => x.id);
      }
    }
    
    return architectureOptions;
  } catch (e) {
    architectureOptions = [];
    return architectureOptions;
  }
}

// Tiện ích lấy appTypeOptions từ DB (Configuration)
async function getAppTypeOptionsFromConfig() {
  let appTypeOptions = [];
  try {
    const config = await Configuration.findById('system_app_type');
    if (config && config.value) {
      let parsed;
      try {
        parsed = JSON.parse(config.value);
      } catch {
        parsed = null;
      }
      
      if (Array.isArray(parsed)) {
        appTypeOptions = parsed.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
      } else if (parsed && typeof parsed === 'object') {
        // Handle case where parsed is an object with nested structure
        if (parsed.appTypes && Array.isArray(parsed.appTypes)) {
          appTypeOptions = parsed.appTypes.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        } else if (parsed.options && Array.isArray(parsed.options)) {
          appTypeOptions = parsed.options.map(item => typeof item === 'object' ? { id: item.value, text: item.label } : { id: String(item), text: String(item) });
        }
      } else if (typeof parsed === 'string') {
        // Handle comma-separated string
        appTypeOptions = parsed.split(',').map(s => ({ id: s.trim(), text: s.trim() })).filter(x => x.id);
      }
    }
  } catch (e) {
    appTypeOptions = [];
  }
  return appTypeOptions;
}

// Helper function để validate scopes
async function validateScopes(scopes) {
  if (!scopes || scopes.length === 0) return null; // Allow empty
  
  const scopeOptions = await getScopeOptionsFromConfig();
  const allowedScopes = (scopeOptions || []).map(s => s.id);
  
  // Filter only valid scopes
  const validScopes = scopes.filter(scope => allowedScopes.includes(scope));
  return validScopes.length > 0 ? validScopes : null;
}

// Helper function để validate architecture
async function validateArchitecture(architecture) {
  if (!architecture || architecture.length === 0) return null; // Allow empty
  
  const architectureOptions = await getArchitectureOptionsFromConfig();
  const allowedArchitectures = (architectureOptions || []).map(a => a.id);
  
  // Filter only valid architectures
  const validArchitectures = architecture.filter(arch => allowedArchitectures.includes(arch));
  return validArchitectures.length > 0 ? validArchitectures : null;
}




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
    let filterSystemId = req.query.system_id || '';
    let filterAppType = req.query.app_type || '';
    filterTags = normalizeArray(filterTags).filter(x => x !== '');
    filterContacts = normalizeArray(filterContacts).filter(x => x !== '');
    filterSystemId = filterSystemId ? String(filterSystemId).trim() : '';
    filterAppType = filterAppType ? String(filterAppType).trim() : '';
    // @ts-ignore - filterTags, filterContacts, filterSystemId, and filterAppType are supported by model methods
    const componentList = await SystemComponent.findFilteredList({ search, page, pageSize, filterTags, filterContacts, system_id: filterSystemId, app_type: filterAppType });
    // @ts-ignore - filterTags, filterContacts, filterSystemId, and filterAppType are supported by model methods
    const totalCount = await SystemComponent.countFiltered({ search, filterTags, filterContacts, system_id: filterSystemId, app_type: filterAppType });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    const [success, error] = [req.flash('success')[0], req.flash('error')[0]];
    // Get app type options for filter
    const appTypeOptions = await getAppTypeOptionsFromConfig();
    
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
      success,
      error,
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
  const appTypeOptions = await getAppTypeOptionsFromConfig();
  res.render('pages/system/component_add', {
    error: null,
    appTypeOptions,
    title: 'Add System Component',
    activeMenu: 'system-component',
  });
};

// Handle add component
systemController.addSystemComponent = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Extract raw data from form
    let {
      system_id,
      name,
      app_type,
      description,
      fqdn,
      contacts,
      ips,
      tags
    } = req.body;

    // Normalize/validate fields
    system_id = typeof system_id === 'string' ? system_id.trim() : null;
    name = typeof name === 'string' ? name.trim() : '';
    app_type = typeof app_type === 'string' ? app_type.trim() : null;
    description = typeof description === 'string' ? description : '';
    // FQDN: comma separated string to array
    let fqdnList = [];
    if (typeof fqdn === 'string') {
      fqdnList = fqdn.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(fqdn)) {
      fqdnList = fqdn.map(s => String(s).trim()).filter(Boolean);
    }
    // Contacts, IPs, Tags: always array
    contacts = !contacts ? [] : Array.isArray(contacts) ? contacts : [contacts];
    ips = !ips ? [] : Array.isArray(ips) ? ips : [ips];
    tags = !tags ? [] : Array.isArray(tags) ? tags : [tags];

    // Required field validation
    if (!name) {
      req.flash('error', 'Component name is required.');
      return res.redirect('/system/component');
    }

    // Create new component
    const newComponent = await SystemComponent.create({
      system_id,
      name,
      app_type,
      description,
      fqdn: fqdnList,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    }, client);


    // Set contacts, IPs, tags
    // @ts-ignore - client parameter is supported by model methods
    await SystemComponent.setContacts(newComponent.id, contacts, client);
    // @ts-ignore - client parameter is supported by model methods
    await SystemComponent.setIPs(newComponent.id, ips, client);
    // @ts-ignore - client parameter is supported by model methods
    await SystemComponent.setTags(newComponent.id, tags, client);

    // --- Sync IPs between component and system ---
    // Get current IP list of the system
    let systemIpIds = [];
    if (system_id) {
      try {
        systemIpIds = await System.getIpIdsBySystemId(system_id);
      } catch (e) {
        systemIpIds = [];
  // ...
      }
    }
    // Find IPs assigned to component but not yet in system
    const ipsToAdd = (ips || []).filter(ip => !systemIpIds.includes(ip));
    if (ipsToAdd.length > 0 && system_id) {
      try {
        // Only add new IPs, do not remove existing ones
        await System.addIPs(system_id, ipsToAdd, client);
  // ...
      } catch (e) {
        // Log error, do not rollback
  // ...
      }
    }

    await client.query('COMMIT');
    req.flash('success', 'Component added successfully');
    return res.redirect('/system/component');
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Error adding component: ' + err.message);
    return res.redirect('/system/component');
  } finally {
    client.release();
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
    const appTypeOptions = await getAppTypeOptionsFromConfig();
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
  // ...
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.params.id;
    // Fetch current component from DB
    const currentComponent = await SystemComponent.findById(id);
    if (!currentComponent || !currentComponent.system_id) {
      req.flash('error', 'Component is missing system_id.');
      await client.query('ROLLBACK');
      return res.redirect('/system/component');
    }
  // Extract and normalize fields from req.body
  let { name, description, ips, tags, contacts, app_type, fqdn, system_id } = req.body;
  name = typeof name === 'string' ? name.trim() : currentComponent.name;
  description = typeof description === 'string' ? description : (currentComponent.description || '');
  // App type: string or null
  app_type = typeof app_type === 'string' ? app_type.trim() : (currentComponent.app_type || null);
  // FQDN: comma separated string to array
  let fqdnList = [];
  if (typeof fqdn === 'string') {
    fqdnList = fqdn.split(',').map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(fqdn)) {
    fqdnList = fqdn.map(s => String(s).trim()).filter(Boolean);
  } else if (Array.isArray(currentComponent.fqdn)) {
    fqdnList = currentComponent.fqdn;
  }
  // system_id: lấy từ req.body nếu có, fallback về cũ nếu không
  system_id = typeof system_id === 'string' && system_id.trim() ? system_id.trim() : currentComponent.system_id;
  // Contacts, IPs, Tags: always array
  contacts = !contacts ? [] : Array.isArray(contacts) ? contacts : [contacts];
  ips = !ips ? [] : Array.isArray(ips) ? ips : [ips];
  tags = !tags ? [] : Array.isArray(tags) ? tags : [tags];


    // Validate required fields (name, system_id)
    if (!name) {
      req.flash('error', 'Component name is required.');
      await client.query('ROLLBACK');
      return res.redirect('/system/component');
    }
    if (!system_id) {
      req.flash('error', 'Component must belong to a system.');
      await client.query('ROLLBACK');
      return res.redirect('/system/component');
    }

    // Validate contacts (if any)
    if (contacts && contacts.length > 0) {
      const invalidContacts = [];
      for (const cid of contacts) {
        if (!(await Contact.exists(cid))) invalidContacts.push(cid);
      }
      if (invalidContacts.length > 0) {
        req.flash('error', 'Invalid contact IDs: ' + invalidContacts.join(', '));
        await client.query('ROLLBACK');
        return res.redirect('/system/component');
      }
    }
    // Validate tags (if any)
    if (tags && tags.length > 0) {
      const invalidTags = [];
      for (const tid of tags) {
        if (!(await Tag.exists(tid))) invalidTags.push(tid);
      }
      if (invalidTags.length > 0) {
        req.flash('error', 'Invalid tag IDs: ' + invalidTags.join(', '));
        await client.query('ROLLBACK');
        return res.redirect('/system/component');
      }
    }
    // Validate IPs (if any)
    if (ips && ips.length > 0) {
      const invalidIps = [];
      for (const ipid of ips) {
        if (!(await IpAddress.exists(ipid))) invalidIps.push(ipid);
      }
      if (invalidIps.length > 0) {
        req.flash('error', 'Invalid IP address IDs: ' + invalidIps.join(', '));
        await client.query('ROLLBACK');
        return res.redirect('/system/component');
      }
    }

    // Build update object, only update fields that are changed
    const updateObj = {
      name,
      description,
      app_type,
      fqdn: fqdnList,
      system_id,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    };
    await SystemComponent.update(id, updateObj);
    // Update contacts for component
    // @ts-ignore - client parameter is supported by model methods
    await SystemComponent.setContacts(id, contacts, client);
    // Update IPs for component
    // @ts-ignore - client parameter is supported by model methods
    await SystemComponent.setIPs(id, ips, client);
    // Update tags for component
    // @ts-ignore - client parameter is supported by model methods
    await SystemComponent.setTags(id, tags, client);

    // --- Sync IPs between component and system (edit) ---
    let systemIpIds = [];
    if (system_id) {
      try {
        systemIpIds = await System.getIpIdsBySystemId(system_id);
      } catch (e) {
        systemIpIds = [];
      }
    }
    // Find IPs assigned to component but not yet in system
    const ipsToAdd = (ips || []).filter(ip => !systemIpIds.includes(ip));
    if (ipsToAdd.length > 0 && system_id) {
      try {
        await System.addIPs(system_id, ipsToAdd, client);
      } catch (e) {
        // ...
      }
    }

    await client.query('COMMIT');
    req.flash('success', 'Component updated successfully');
    return res.redirect('/system/component');
  } catch (err) {
  // ...
    await client.query('ROLLBACK');
    req.flash('error', 'Error updating component: ' + err.message);
    return res.redirect('/system/component');
  } finally {
    client.release();
  }
};

// Handle delete component
systemController.deleteSystemComponent = async (req, res) => {
  try {
    const id = req.params.id;
    // Get component info (to get system_id)
    const component = await SystemComponent.findById(id);
    if (!component) {
      req.flash('error', 'Component not found.');
      return res.redirect('/system/component');
    }
    // Get all IPs linked to this component
    const ips = await SystemComponent.getIPs(id);
    // Remove system_ip links for these IPs and the parent system
    if (component.system_id && Array.isArray(ips) && ips.length > 0) {
      for (const ip of ips) {
        await System.removeIP(component.system_id, ip.id);
      }
    }
    await SystemComponent.delete(id);
    req.flash('success', 'Component deleted successfully');
    return res.redirect('/system/component');
  } catch (err) {
    req.flash('error', 'Error deleting component: ' + err.message);
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
  // @ts-ignore - filterTags, filterContacts, filterScopes, and filterArchitecture are supported by model methods
  const systemList = await System.findFilteredList({ search, page, pageSize, filterTags, filterContacts, filterScopes, filterArchitecture });
  // @ts-ignore - filterTags, filterContacts, filterScopes, and filterArchitecture are supported by model methods
  const totalCount = await System.countFiltered({ search, filterTags, filterContacts, filterScopes, filterArchitecture });
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
    // Attach to each system
    systemList.forEach(s => {
      // Only attach components if there are any; otherwise, leave as empty array
      s.components = Array.isArray(componentsBySystem[s.id]) && componentsBySystem[s.id].length > 0 ? componentsBySystem[s.id] : [];
    });

    // Flash messages
    const [success, error] = [req.flash('success')[0], req.flash('error')[0]];

    // Get scope and architecture options for filter modal
    const scopeOptions = await getScopeOptionsFromConfig();
    const architectureOptions = await getArchitectureOptionsFromConfig();

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
    const levelOptions = await getLevelOptionsFromConfig();
    const scopeOptions = await getScopeOptionsFromConfig();
    const architectureOptions = await getArchitectureOptionsFromConfig();
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
      description,
      fqdn,
      scopes,
      architecture
    } = req.body;
    // Now check and initialize each field as needed
    system_id = (system_id === undefined || system_id === null) ? '' : String(system_id).trim();
    name = (name === undefined || name === null) ? '' : String(name).trim();
    level = (level === undefined || level === null || level === '') ? null : level;
    department_id = (department_id === undefined || department_id === null || department_id === '') ? null : department_id;
    // Lấy giá trị cũ từ DB để fallback nếu trường nào không nhập
    const currentSystem = await System.findById(id);
    // Alias: giữ lại nếu không nhập
    let aliasValue = [];
    if (alias !== undefined && alias !== null && alias !== '') {
      if (Array.isArray(alias)) {
        aliasValue = alias.filter(Boolean);
      } else {
        aliasValue = String(alias).split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      aliasValue = Array.isArray(currentSystem?.alias) ? currentSystem.alias : [];
    }
    // FQDN: giữ lại nếu không nhập
    let fqdnList = [];
    if (typeof fqdn === 'string') {
      fqdnList = fqdn.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(fqdn)) {
      fqdnList = fqdn.map(s => String(s).trim()).filter(Boolean);
    }
    if ((!fqdn || fqdnList.length === 0)) {
      fqdnList = Array.isArray(currentSystem?.fqdn) ? currentSystem.fqdn : [];
    }
    // Managers: giữ lại nếu không nhập
    if (!Array.isArray(managers)) managers = managers ? [managers] : [];
    if (!managers || managers.length === 0) managers = Array.isArray(currentSystem?.managers) ? currentSystem.managers : [];
    // Servers: giữ lại nếu không nhập
    if (!Array.isArray(servers)) servers = servers ? [servers] : [];
    if (!servers || servers.length === 0) servers = Array.isArray(currentSystem?.servers) ? currentSystem.servers : [];
    // IP addresses: giữ lại nếu không nhập
    if (!Array.isArray(ip_addresses)) ip_addresses = ip_addresses ? [ip_addresses] : [];
    if (!ip_addresses || ip_addresses.length === 0) ip_addresses = Array.isArray(currentSystem?.ip_addresses) ? currentSystem.ip_addresses : [];
    // Tags: giữ lại nếu không nhập
    if (!Array.isArray(tags)) tags = tags ? [tags] : [];
    if (!tags || tags.length === 0) tags = Array.isArray(currentSystem?.tags) ? currentSystem.tags : [];
    // Domains: giữ lại nếu không nhập
    if (!Array.isArray(domains)) domains = domains ? [domains] : [];
    if (!domains || domains.length === 0) domains = Array.isArray(currentSystem?.domains) ? currentSystem.domains : [];
    // Scopes: giữ lại nếu không nhập
    if (!Array.isArray(scopes)) scopes = scopes ? [scopes] : [];
    if (!scopes || scopes.length === 0) scopes = currentSystem?.scopes || [];
    // Architecture: giữ lại nếu không nhập
    if (!Array.isArray(architecture)) architecture = architecture ? [architecture] : [];
    if (!architecture || architecture.length === 0) architecture = currentSystem?.architecture || [];
    // Description: giữ lại nếu không nhập
    description = (description === undefined || description === null) ? (currentSystem?.description || '') : String(description);

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

    // Validate level if present, use allowed values from levelOptions
    if (level !== null) {
      const levelOptions = await getLevelOptionsFromConfig();
      const allowedLevels = (levelOptions || []).map(l => l.id);
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
    // Validate scopes and architecture if present
    const validatedScopes = await validateScopes(scopes);
    const validatedArchitecture = await validateArchitecture(architecture);
    
    // Update the systems table
    await System.update(id, {
      system_id,
      name,
      level,
      department_id,
      alias: aliasValue,
      description,
      fqdn: fqdnList,
      scopes: validatedScopes,
      architecture: validatedArchitecture,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    }, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.setContacts(id, managers, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.setIPs(id, ip_addresses, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.setDomains(id, domains, client);
    // @ts-ignore - client parameter is supported by model methods
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
    const levelOptions = await getLevelOptionsFromConfig();
    const scopeOptions = await getScopeOptionsFromConfig();
    const architectureOptions = await getArchitectureOptionsFromConfig();
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
      description,
      scopes,
      architecture
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
    scopes = !scopes ? [] : Array.isArray(scopes) ? scopes : [scopes];
    architecture = !architecture ? [] : Array.isArray(architecture) ? architecture : [architecture];

    level = (level === undefined || level === null || level === '') ? null : level;
    department_id = (department_id === undefined || department_id === null || department_id === '') ? null : department_id;

    // Explicit required field validation (only required fields in the form)
    let fqdn = req.body.fqdn;
    let fqdnList = [];
    if (typeof fqdn === 'string') {
      fqdnList = fqdn.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(fqdn)) {
      fqdnList = fqdn.map(s => String(s).trim()).filter(Boolean);
    }
    const requiredFields = [
      { key: 'system_id', value: system_id, label: 'System ID' },
      { key: 'name', value: name, label: 'System Name' }
    ];
    const missing = requiredFields.filter(f => f.value === null || f.value === undefined || f.value === '');
    if (missing.length > 0) {
      req.flash('error', 'Missing required field(s): ' + missing.map(f => f.label).join(', '));
      return res.redirect('/system/system');
    }

    // Validate level if present, use allowed values from levelOptions
    if (level !== null) {
      const levelOptions = await getLevelOptionsFromConfig();
      const allowedLevels = (levelOptions || []).map(l => l.id);
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
      let fqdn = req.body.fqdn; // Added fqdn to the destructuring
      let fqdnList = [];
      if (fqdn !== undefined && fqdn !== null && fqdn !== '') {
        if (Array.isArray(fqdn)) {
          fqdnList = fqdn.map(s => String(s).trim()).filter(Boolean);
        } else {
          fqdnList = String(fqdn).split(',').map(s => s.trim()).filter(Boolean);
        }
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
    // Validate scopes and architecture if present
    const validatedScopes = await validateScopes(scopes);
    const validatedArchitecture = await validateArchitecture(architecture);
    
    const newSystem = await System.create({
      system_id,
      name,
      level,
      department_id,
      alias,
      description,
      fqdn: fqdnList,
      scopes: validatedScopes,
      architecture: validatedArchitecture,
      updated_by: req.session.user && req.session.user.username ? req.session.user.username : null
    }, client);

    // Set relationships (links) after creation
    // @ts-ignore - client parameter is supported by model methods
    await System.setContacts(newSystem.id, managers, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.setIPs(newSystem.id, ip_addresses, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.setDomains(newSystem.id, domains, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.setTags(newSystem.id, tags, client);

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
    // Check if system still has components
    const componentCount = await SystemComponent.countBySystemId(id, client);
    if (componentCount > 0) {
      await client.query('ROLLBACK');
      req.flash('error', 'You must delete all components of this system before deleting the system. Please remove all components first.');
      return res.redirect('/system/system');
    }
    // Delete related links via model
    // @ts-ignore - client parameter is supported by model methods
    await System.deleteTags(id, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.deleteIPs(id, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.deleteContacts(id, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.deleteDomains(id, client);
    // @ts-ignore - client parameter is supported by model methods
    await System.deleteServers(id, client);
    // Delete file uploads related to this system from both DB and physical storage
    await FileUpload.deleteByObject('system', id);
    // Delete system
    // @ts-ignore - client parameter is supported by model methods
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