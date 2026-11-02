// API Controller for Cluster (JSON-only, mirrors apiComponentController's
// pattern). members is accepted/returned as an array of
// { ip_address_id, role } objects — converted here to the parallel
// member_ip_id[]/member_role[] arrays clusterService expects (the same
// shape the web form's repeatable rows submit), so the service itself
// doesn't need two different input formats.

import {
  listClusters as listClustersService,
  getCluster,
  getRoleOptions,
  getClustersForSystem,
  createCluster as createClusterService,
  updateCluster as updateClusterService,
  deleteCluster as deleteClusterService
} from './cluster.service.js';
import { handleServiceErrorPlain } from '../../shared/api.js';

const apiClusterController = {};

function toMemberArrays(members) {
  const list = Array.isArray(members) ? members : [];
  return {
    member_ip_id: list.map(m => m.ip_address_id),
    member_role: list.map(m => m.role || '')
  };
}

apiClusterController.getAll = async (req, res) => {
  try {
    const { search = '', page = 1, pageSize = 10, role, system_id } = req.query;
    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeInt = Math.max(1, Math.min(parseInt(pageSize, 10) || 10, 100));
    const filter = { search: search.trim(), page: pageInt, pageSize: pageSizeInt };
    if (role) filter.role = role;
    if (system_id) filter.system_id = system_id;
    const { items, totalCount } = await listClustersService(filter);
    const totalPages = Math.ceil(totalCount / pageSizeInt);
    res.json({
      data: items,
      pagination: {
        page: pageInt,
        pageSize: pageSizeInt,
        totalCount,
        totalPages,
        hasNext: pageInt < totalPages,
        hasPrev: pageInt > 1
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiClusterController.getByObject = async (req, res) => {
  try {
    const { system_id } = req.query;
    if (!system_id) return res.status(400).json({ error: 'system_id is required' });
    const clusters = await getClustersForSystem(system_id);
    res.json({ data: clusters });
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiClusterController.getById = async (req, res) => {
  try {
    const cluster = await getCluster(req.params.id);
    res.json(cluster);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiClusterController.getRoles = async (req, res) => {
  try {
    res.json({ data: await getRoleOptions() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiClusterController.create = async (req, res) => {
  try {
    const { member_ip_id, member_role } = toMemberArrays(req.body.members);
    const cluster = await createClusterService({
      name: req.body.name,
      description: req.body.description,
      member_ip_id,
      member_role,
      systems: req.body.systems,
      updated_by: req.user?.username || 'api-user'
    });
    res.status(201).json(cluster);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiClusterController.update = async (req, res) => {
  try {
    const has = key => Object.prototype.hasOwnProperty.call(req.body, key);
    const input = { updated_by: req.user?.username || 'api-user' };
    if (has('name')) input.name = req.body.name;
    if (has('description')) input.description = req.body.description;
    if (has('systems')) input.systems = req.body.systems;
    if (has('members')) {
      const { member_ip_id, member_role } = toMemberArrays(req.body.members);
      input.member_ip_id = member_ip_id;
      input.member_role = member_role;
    }
    const cluster = await updateClusterService(req.params.id, input);
    res.json(cluster);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiClusterController.remove = async (req, res) => {
  try {
    await deleteClusterService(req.params.id);
    res.status(204).end();
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

export default apiClusterController;
