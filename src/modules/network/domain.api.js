import { pool } from '../../../config/config.js';
import Domain from './domain.model.js';
import {
  getDomain as getDomainService,
  createDomain as createDomainService,
  updateDomain as updateDomainService,
  deleteDomain as deleteDomainService
} from './domain.service.js';
import { handleServiceErrorPlain } from '../../shared/api.js';

const apiDomainController = {};

// Get all domains with optional search and pagination
apiDomainController.getAll = async (req, res) => {
  try {
    const { search, page = 1, pageSize = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.max(1, Math.min(parseInt(pageSize, 10) || 20, 100)); // Max 100 per page

    let totalCount, domainList;

    if (search && search.trim()) {
      totalCount = await Domain.countSearch(search.trim());
      domainList = await Domain.findSearchPage(search.trim(), pageNum, pageSizeNum);
    } else {
      totalCount = await Domain.countAll();
      domainList = await Domain.findPage(pageNum, pageSizeNum);
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSizeNum));

    res.json({
      totalCount,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages,
      domains: domainList
    });
  } catch (err) {
    console.error('Error getting domains:', err);
    res.status(500).json({ error: err.message });
  }
};

// Find domains by exact name match
apiDomainController.findDomains = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search term "name" is required'
      });
    }

    const domainName = name.trim();
    const result = await pool.query(
      `SELECT d.*,
        jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address) AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems
      FROM domains d
      LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
      LEFT JOIN system_domain sd ON d.id = sd.domain_id
      LEFT JOIN systems s ON sd.system_id = s.id
      WHERE d.domain = $1
      GROUP BY d.id, ip.id
      ORDER BY d.id`,
      [domainName]
    );

    const domains = result.rows.map(row => {
      row.systems = Array.isArray(row.systems) ? row.systems : JSON.parse(row.systems);
      return row;
    });

    res.json({
      success: true,
      data: domains,
      count: domains.length
    });
  } catch (err) {
    console.error('Error finding domains:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Get domain by ID
apiDomainController.getById = async (req, res) => {
  try {
    const domain = await getDomainService(req.params.id);
    res.json(domain);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Create a new domain
apiDomainController.create = async (req, res) => {
  try {
    const domain = await createDomainService(req.body || {});
    res.status(201).json(domain);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Update a domain
apiDomainController.update = async (req, res) => {
  try {
    const domain = await updateDomainService(req.params.id, req.body || {});
    res.json(domain);
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

// Delete a domain
apiDomainController.remove = async (req, res) => {
  try {
    await deleteDomainService(req.params.id);
    res.status(204).send();
  } catch (err) {
    handleServiceErrorPlain(err, res);
  }
};

export default apiDomainController;
