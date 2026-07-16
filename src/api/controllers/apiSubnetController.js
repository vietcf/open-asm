import Subnet from '../../models/Subnet.js';
import {
  listSubnets as listSubnetsService,
  getSubnet as getSubnetService,
  createSubnet as createSubnetService,
  updateSubnet as updateSubnetService,
  deleteSubnet as deleteSubnetService
} from '../../services/subnetService.js';
import { handleServiceErrorPlain } from '../utils/handleServiceError.js';

const apiSubnetController = {};

apiSubnetController.listSubnets = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const { items: subnets, totalCount } = await listSubnetsService({ search, page, pageSize });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    res.json({ totalCount, page, pageSize, totalPages, subnets });
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiSubnetController.getSubnet = async (req, res) => {
  try {
    const subnet = await getSubnetService(req.params.id);
    res.json(subnet);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiSubnetController.findSubnet = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'Address parameter is required' });
    }
    const subnet = await Subnet.findByAddress(address);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });
    res.json(subnet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiSubnetController.createSubnet = async (req, res) => {
  try {
    const subnet = await createSubnetService({ ...req.body, updated_by: req.user ? req.user.username : null });
    res.status(201).json(subnet);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiSubnetController.updateSubnet = async (req, res) => {
  try {
    const subnet = await updateSubnetService(req.params.id, { ...req.body, updated_by: req.user ? req.user.username : null });
    res.json(subnet);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

apiSubnetController.deleteSubnet = async (req, res) => {
  try {
    await deleteSubnetService(req.params.id);
    res.status(204).send();
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// API endpoint to get all subnet configuration options
apiSubnetController.getConfig = async (req, res) => {
  try {
    const [zones, environments] = await Promise.all([
      getZonesFromDB(),
      getEnvironmentsFromDB()
    ]);

    res.json({
      success: true,
      data: {
        zones: zones,
        environments: environments
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

// Helper: Get zones from database
async function getZonesFromDB() {
  try {
    const zones = await Subnet.getDistinctZones();
    return zones.map(zone => ({
      value: zone.id,
      label: zone.text
    }));
  } catch (err) {
    console.error('Error fetching zones:', err);
    return [];
  }
}

// Helper: Get environments from database
async function getEnvironmentsFromDB() {
  try {
    const environments = await Subnet.getDistinctEnvironments();
    return environments.map(env => ({
      value: env.id,
      label: env.text
    }));
  } catch (err) {
    console.error('Error fetching environments:', err);
    return [];
  }
}

export default apiSubnetController;
