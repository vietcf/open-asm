import System from '../models/System.js';
import { ServiceError } from '../services/errors.js';
import {
  listClusters as listClustersService,
  getCluster,
  getRoleOptions,
  getClustersForSystem,
  createCluster as createClusterService,
  updateCluster as updateClusterService,
  deleteCluster as deleteClusterService
} from '../services/clusterService.js';

const clusterController = {};

function normalizeFilterArray(val) {
  if (!val || val === 'undefined') return [];
  if (Array.isArray(val)) return val.filter(v => v && v !== 'undefined').map(String);
  if (typeof val === 'string') return [val];
  return [];
}

clusterController.listClusters = async (req, res) => {
  try {
    const pageSizeOptions = res.locals.pageSizeOptions || [10, 20, 50];
    let pageSize = parseInt(req.query.pageSize, 10) || pageSizeOptions[0];
    if (!pageSizeOptions.includes(pageSize)) pageSize = pageSizeOptions[0];
    const page = parseInt(req.query.page, 10) || 1;

    const filterParams = {
      search: req.query.search ? req.query.search.trim() : '',
      role: normalizeFilterArray(req.query.role),
      system_id: normalizeFilterArray(req.query.system_id)
    };

    const [{ items: clusterList, totalCount }, roleOptions] = await Promise.all([
      listClustersService({ ...filterParams, page, pageSize }),
      getRoleOptions()
    ]);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

    let selectedSystems = [];
    if (filterParams.system_id.length) {
      selectedSystems = (await Promise.all(filterParams.system_id.map(id => System.findById(id))))
        .filter(Boolean).map(s => ({ id: s.id, text: s.name }));
    }

    const success = req.flash('success')[0];
    const error = req.flash('error')[0];

    res.render('pages/cluster/cluster_list', {
      clusterList,
      search: filterParams.search,
      page,
      pageSize,
      totalPages,
      totalCount,
      startItem,
      endItem,
      filterRole: filterParams.role,
      filterSystemId: filterParams.system_id,
      selectedSystems,
      roleOptions,
      success,
      error,
      title: 'Cluster Management',
      activeMenu: 'cluster'
    });
  } catch (err) {
    res.status(500).send('Error loading clusters: ' + err.message);
  }
};

clusterController.addClusterForm = async (req, res) => {
  const roleOptions = await getRoleOptions();
  res.render('pages/cluster/cluster_add', {
    roleOptions,
    title: 'Add Cluster',
    activeMenu: 'cluster'
  });
};

clusterController.addCluster = async (req, res) => {
  try {
    const { name, description, member_ip_id, member_role, systems } = req.body || {};
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    await createClusterService({ name, description, member_ip_id, member_role, systems, updated_by: username });
    req.flash('success', 'Cluster added successfully');
    res.redirect('/cluster');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to add cluster: ' + err.message;
    req.flash('error', message);
    res.redirect('/cluster/add');
  }
};

clusterController.editClusterForm = async (req, res) => {
  try {
    const id = req.params.id;
    const cluster = await getCluster(id);
    const roleOptions = await getRoleOptions();
    res.render('pages/cluster/cluster_edit', {
      cluster,
      roleOptions,
      title: 'Edit Cluster',
      activeMenu: 'cluster'
    });
  } catch (err) {
    req.flash('error', 'Cluster not found');
    res.redirect('/cluster');
  }
};

clusterController.updateCluster = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description, member_ip_id, member_role, systems } = req.body || {};
    const username = req.session && req.session.user && req.session.user.username ? req.session.user.username : 'admin';

    await updateClusterService(id, {
      name, description,
      member_ip_id: member_ip_id ?? [],
      member_role: member_role ?? [],
      systems: systems ?? [],
      updated_by: username
    });
    req.flash('success', 'Cluster updated successfully');
    res.redirect('/cluster');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to update cluster: ' + err.message;
    req.flash('error', message);
    res.redirect(`/cluster/${req.params.id}/edit`);
  }
};

clusterController.deleteCluster = async (req, res) => {
  try {
    await deleteClusterService(req.params.id);
    req.flash('success', 'Cluster deleted successfully');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Unable to delete cluster: ' + err.message;
    req.flash('error', message);
  }
  res.redirect('/cluster');
};

// AJAX: clusters serving one System, for System Detail's read-only
// "Clusters" section.
clusterController.apiClustersBySystem = async (req, res) => {
  try {
    const systemId = req.query.system_id;
    if (!systemId || isNaN(Number(systemId))) {
      return res.status(400).json({ error: 'system_id is required' });
    }
    const clusters = await getClustersForSystem(systemId);
    res.json({ clusters });
  } catch (err) {
    res.status(500).json({ error: 'Error loading clusters', detail: err.message });
  }
};

// AJAX: role autocomplete suggestions
clusterController.apiRoleOptions = async (req, res) => {
  try {
    const roles = await getRoleOptions();
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ error: 'Error loading roles', detail: err.message });
  }
};

export default clusterController;
