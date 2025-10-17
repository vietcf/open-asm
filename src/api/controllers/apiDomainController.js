import { pool } from '../../../config/config.js';
import Domain from '../../models/Domain.js';
import System from '../../models/System.js';
import IpAddress from '../../models/IpAddress.js';

const apiDomainController = {};

// Helper function to parse array fields
function parseArrayField(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    return field.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// Get all domains with optional search and pagination
apiDomainController.getAll = async (req, res) => {
  try {
    const { search, page = 1, pageSize = 20 } = req.query;
    const pageNum = parseInt(page, 10);
    const pageSizeNum = Math.min(parseInt(pageSize, 10), 100); // Max 100 per page

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
    const id = req.params.id;
    const domain = await Domain.findById(id);
    
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Get related data
    const systems = await Domain.findSystems(id);
    const ip = await Domain.getIp(domain.ip_id);

    res.json({
      ...domain,
      systems,
      ip
    });
  } catch (err) {
    console.error('Error getting domain:', err);
    res.status(500).json({ error: err.message });
  }
};

// Create a new domain
apiDomainController.create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    let { domain, description, ip_id, record_type, systems } = req.body || {};
    
    // Validate required fields
    if (!domain || !domain.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Domain name is required' });
    }
    
    domain = domain.trim();
    description = description ? description.trim() : null;
    record_type = record_type ? record_type.trim() : 'A';
    ip_id = ip_id && String(ip_id).trim() !== '' ? parseInt(ip_id, 10) : null;
    systems = parseArrayField(systems);

    // Validate IP address if provided
    if (ip_id && !(await IpAddress.exists(ip_id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid IP address ID' });
    }

    // Validate systems if provided
    if (systems && systems.length > 0) {
      for (const systemId of systems) {
        if (!(await System.exists(systemId))) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid system ID: ${systemId}` });
        }
      }
    }

    // Create domain
    const newDomain = await Domain.create({
      domain,
      description,
      ip_id,
      record_type
    }, client);

    // Set systems if provided
    if (systems && systems.length > 0) {
      await Domain.setSystems(newDomain.id, systems, client);
    }

    await client.query('COMMIT');

    // Return the created domain with relationships
    const domainWithDetails = await Domain.findById(newDomain.id);
    const domainSystems = await Domain.findSystems(newDomain.id);
    const domainIp = await Domain.getIp(newDomain.ip_id);

    res.status(201).json({
      ...domainWithDetails,
      systems: domainSystems,
      ip: domainIp
    });
  } catch (err) {
    console.error('Error creating domain:', err);
    
    // Rollback transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
    // Handle specific database constraint errors
    if (err.code === '23505') { // unique_violation
      if (err.constraint === 'domains_domain_key') {
        return res.status(409).json({ error: 'Domain already exists' });
      }
      return res.status(409).json({ error: 'Duplicate value violates unique constraint' });
    }
    
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// Update a domain
apiDomainController.update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const id = req.params.id;
    let { domain, description, ip_id, record_type, systems } = req.body || {};
    
    const existingDomain = await Domain.findById(id);
    if (!existingDomain) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Validate domain name if provided
    if (domain !== undefined) {
      if (!domain || !domain.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Domain name cannot be empty' });
      }
      domain = domain.trim();
    }

    // Validate IP address if provided
    if (ip_id !== undefined) {
      ip_id = ip_id && String(ip_id).trim() !== '' ? parseInt(ip_id, 10) : null;
      if (ip_id && !(await IpAddress.exists(ip_id))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid IP address ID' });
      }
    }

    // Validate systems if provided
    if (systems !== undefined) {
      systems = parseArrayField(systems);
      if (systems && systems.length > 0) {
        for (const systemId of systems) {
          if (!(await System.exists(systemId))) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Invalid system ID: ${systemId}` });
          }
        }
      }
    }

    // Update domain basic info
    const updateData = {};
    if (domain !== undefined) updateData.domain = domain;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (ip_id !== undefined) updateData.ip_id = ip_id;
    if (record_type !== undefined) updateData.record_type = record_type ? record_type.trim() : 'A';

    if (Object.keys(updateData).length > 0) {
      await Domain.update(id, updateData, client);
    }

    // Update systems if provided
    if (systems !== undefined) {
      await Domain.setSystems(id, systems, client);
    }

    await client.query('COMMIT');

    // Return the updated domain with relationships
    const updatedDomain = await Domain.findById(id);
    const domainSystems = await Domain.findSystems(id);
    const domainIp = await Domain.getIp(updatedDomain.ip_id);

    res.json({
      ...updatedDomain,
      systems: domainSystems,
      ip: domainIp
    });
  } catch (err) {
    console.error('Error updating domain:', err);
    
    // Rollback transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
    // Handle specific database constraint errors
    if (err.code === '23505') { // unique_violation
      if (err.constraint === 'domains_domain_key') {
        return res.status(409).json({ error: 'Domain already exists' });
      }
      return res.status(409).json({ error: 'Duplicate value violates unique constraint' });
    }
    
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// Delete a domain
apiDomainController.remove = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const id = req.params.id;
    const domain = await Domain.findById(id);
    
    if (!domain) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Domain not found' });
    }

    await Domain.delete(id, client);
    await client.query('COMMIT');

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting domain:', err);
    
    // Rollback transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
    // Handle foreign key constraint errors
    if (err.code === '23503') { // foreign_key_violation
      return res.status(409).json({ error: 'Cannot delete domain: it is referenced by other records' });
    }
    
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export default apiDomainController;
