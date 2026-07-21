// API Controller for Server (ES6)
import { pool } from '../../../config/config.js';
import Server from '../../models/Server.js';
import {
  listServers as listServersService,
  getServer as getServerService,
  createServer as createServerService,
  updateServer as updateServerService,
  deleteServer as deleteServerService,
  getServerLocationOptions,
  getServerStatusOptions,
  getServerTypeOptions
} from '../../services/serverService.js';
import { handleServiceError } from '../utils/handleServiceError.js';

const apiServerController = {};

// Get server configuration options
apiServerController.getConfig = async (req, res) => {
  try {
    const [statusOptions, typeOptions, locationOptions, serverRoles] = await Promise.all([
      getServerStatusOptions(),
      getServerTypeOptions(),
      getServerLocationOptions(),
      getServerRolesFromDB()
    ]);

    res.json({
      success: true,
      data: {
        status: statusOptions,
        type: typeOptions,
        location: locationOptions,
        server_roles: serverRoles
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// List all servers (with filter and pagination)
apiServerController.listServers = async (req, res) => {
  try {
    const { search, status, type, server_role, location, tags, ip, manager, systems, services, os, page = 1, pageSize = 10 } = req.query;
    const normalize = v => (!v ? [] : Array.isArray(v) ? v : [v]);
    const filterParams = {
      search: search ? search.trim().toLowerCase() : '',
      status,
      type,
      server_role,
      location,
      tags: normalize(tags),
      ip: normalize(ip),
      manager: normalize(manager),
      systems: normalize(systems),
      services: normalize(services),
      os: normalize(os),
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.max(1, Math.min(parseInt(pageSize, 10) || 10, 100))
    };
    const { items, totalCount } = await listServersService(filterParams);
    res.json({
      success: true,
      data: items,
      count: items.length,
      total: totalCount
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Find servers by specific field values (exact match)
apiServerController.findServers = async (req, res) => {
  try {
    const { name, ip_address } = req.query;

    if (!name && !ip_address) {
      return res.status(400).json({
        success: false,
        message: 'At least one search criteria must be provided (name or ip_address)'
      });
    }

    const criteria = {};
    if (name) criteria.name = name.trim();
    if (ip_address) criteria.ip_address = ip_address.trim();

    const servers = await Server.findByCriteria(criteria);

    if (!servers || servers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No servers found matching the specified criteria',
        criteria
      });
    }

    res.json({
      success: true,
      data: servers,
      count: servers.length,
      criteria
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Get a single server by id
apiServerController.getServer = async (req, res) => {
  try {
    const server = await getServerService(req.params.id);
    res.json({
      success: true,
      data: server
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Create a new server
apiServerController.createServer = async (req, res) => {
  try {
    const server = await createServerService({ ...req.body, updated_by: req.user ? req.user.username : null });
    res.status(201).json(server);
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Update a server
apiServerController.updateServer = async (req, res) => {
  try {
    const id = req.params.id;
    const server = await updateServerService(id, { ...req.body, updated_by: req.user ? req.user.username : null });
    res.json({
      success: true,
      message: 'Server updated successfully',
      data: server
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Delete a server
apiServerController.deleteServer = async (req, res) => {
  try {
    const deleteIp = ['true', '1'].includes(String(req.query.delete_ip).toLowerCase());
    await deleteServerService(req.params.id, { deleteIp });
    res.json({
      success: true,
      message: 'Server deleted successfully'
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Helper: Get distinct server roles from database
async function getServerRolesFromDB() {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT DISTINCT server_role
        FROM servers
        WHERE server_role IS NOT NULL
        AND server_role != ''
        ORDER BY server_role ASC
      `);
      return result.rows.map(row => ({
        value: row.server_role,
        label: row.server_role
      }));
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error fetching server roles:', err);
    return [];
  }
}

export default apiServerController;
