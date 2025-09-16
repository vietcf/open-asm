import Configuration from '../../models/Configuration.js';
import { pool } from '../../../config/config.js';
import Subnet from '../../models/Subnet.js';
import Tag from '../../models/Tag.js';

// Helper: Load recordTypeOptions from DB (Configuration)
async function getRecordTypeOptionsFromConfig() {
  let recordTypeOptions = [];
  try {
    const config = await Configuration.findById('network_domain_record_type');
    if (config && config.value) {
      recordTypeOptions = JSON.parse(config.value);
    }
  } catch (e) {
    recordTypeOptions = [];
  }
  // Nếu không có config hoặc rỗng thì dùng mặc định giống init_data.js
  if (!Array.isArray(recordTypeOptions) || recordTypeOptions.length === 0) {
    recordTypeOptions = [
      { value: 'A', label: 'A' },
      { value: 'AAAA', label: 'AAAA' },
      { value: 'CNAME', label: 'CNAME' },
      { value: 'MX', label: 'MX' },
      { value: 'TXT', label: 'TXT' },
      { value: 'OTHER', label: 'Other' }
    ];
  }
  return recordTypeOptions;
}


const apiSubnetController = {};

apiSubnetController.listSubnets = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    let totalCount, totalPages, subnets;
    if (search) {
      totalCount = await Subnet.countFiltered({ search, tags: undefined, zone: undefined, environment: undefined });
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      subnets = await Subnet.findFilteredList({ search, tags: undefined, zone: undefined, environment: undefined, page, pageSize });
    } else {
      totalCount = await Subnet.countAll();
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      subnets = await Subnet.findPage(page, pageSize);
    }
    res.json({ totalCount, page, pageSize, totalPages, subnets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiSubnetController.getSubnet = async (req, res) => {
  try {
    const id = req.params.id;
    const subnet = await Subnet.findById(id);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });
    res.json(subnet);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  const client = await pool.connect();
  let clientReleased = false;
  
  const releaseClient = () => {
    if (!clientReleased) {
      client.release();
      clientReleased = true;
    }
  };
  
  try {
    let { address, description, zone, environment, tags } = req.body;
    address = typeof address === 'string' ? address.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    zone = typeof zone === 'string' ? zone.trim() : '';
    environment = typeof environment === 'string' ? environment.trim() : '';
    if (!address) {
      releaseClient();
      return res.status(400).json({ error: 'Subnet address is required' });
    }
    // Check for duplicate address
    const existing = await Subnet.findByAddress(address);
    if (existing) {
      releaseClient();
      return res.status(409).json({ error: 'Subnet already exists with this address' });
    }
    // Validate tags if provided
    if (tags && Array.isArray(tags)) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          releaseClient();
          return res.status(400).json({ error: `Tag does not exist: ${tagId}` });
        }
      }
    } else {
      tags = [];
    }
    
    // Transaction block
    await client.query('BEGIN');
    const subnet = await Subnet.create({ address, description, zone, environment }, client);
    await Subnet.setTags(subnet.id, tags, client);
    await client.query('COMMIT');
    
    // Return subnet with tags
    const created = await Subnet.findById(subnet.id);
    res.status(201).json(created);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback errors
    }
    res.status(500).json({ error: err.message });
  } finally {
    releaseClient();
  }
};

apiSubnetController.updateSubnet = async (req, res) => {
  const client = await pool.connect();
  let clientReleased = false;
  
  const releaseClient = () => {
    if (!clientReleased) {
      client.release();
      clientReleased = true;
    }
  };
  
  try {
    const id = req.params.id;
    let { address, description, zone, environment, tags } = req.body;
    // Fetch current subnet
    const currentSubnet = await Subnet.findById(id);
    if (!currentSubnet) {
      releaseClient();
      return res.status(404).json({ error: 'Subnet not found' });
    }

    // Build update object
    const updateFields = {};

    // If description is provided, update (including empty string to clear)
    if (description !== undefined) {
      description = typeof description === 'string' ? description.trim() : '';
      updateFields.description = description;
    }

    // If zone is provided, update (including empty string to clear)
    if (zone !== undefined) {
      zone = typeof zone === 'string' ? zone.trim() : '';
      updateFields.zone = zone;
    }

    // If environment is provided, update (including empty string to clear)
    if (environment !== undefined) {
      environment = typeof environment === 'string' ? environment.trim() : '';
      updateFields.environment = environment;
    }

    // If tags are provided, validate and update (including empty array to clear all tags)
    let updateTags = null;
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        for (const tagId of tags) {
          if (!(await Tag.exists(tagId))) {
            releaseClient();
            return res.status(400).json({ error: `Tag does not exist: ${tagId}` });
          }
        }
        updateTags = tags;
      } else {
        // If tags is not an array but is provided, treat as empty array (clear all tags)
        updateTags = [];
      }
    }

    // If no fields to update, return error
    if (Object.keys(updateFields).length === 0 && updateTags === null) {
      releaseClient();
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Transaction block
    await client.query('BEGIN');
    if (Object.keys(updateFields).length > 0) {
      // Only update fields that were provided, keep existing values for others
      const updateData = {
        description: updateFields.description !== undefined ? updateFields.description : currentSubnet.description,
        zone: updateFields.zone !== undefined ? updateFields.zone : currentSubnet.zone,
        environment: updateFields.environment !== undefined ? updateFields.environment : currentSubnet.environment
      };
      // @ts-ignore - client type mismatch between PoolClient and Pool
      await Subnet.update(id, updateData, client);
    }
    if (updateTags !== null) {
      await Subnet.setTags(id, updateTags, client);
    }
    await client.query('COMMIT');

    // Return the updated subnet
    const updated = await Subnet.findById(id);
    res.json(updated);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback errors
    }
    res.status(500).json({ error: err.message });
  } finally {
    releaseClient();
  }
};

apiSubnetController.deleteSubnet = async (req, res) => {
  try {
    const id = req.params.id;
    const subnet = await Subnet.findById(id);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });
    await Subnet.delete(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiSubnetController.getZones = async (req, res) => {
  try {
    const { search } = req.query;
    const zones = await Subnet.getDistinctZones(search);
    res.json(zones);
  } catch (err) {
    console.error('Error fetching zones:', err);
    res.status(500).json({ error: 'Error fetching zones: ' + err.message });
  }
};

apiSubnetController.getEnvironments = async (req, res) => {
  try {
    const { search } = req.query;
    const environments = await Subnet.getDistinctEnvironments(search);
    res.json(environments);
  } catch (err) {
    console.error('Error fetching environments:', err);
    res.status(500).json({ error: 'Error fetching environments: ' + err.message });
  }
};

export default apiSubnetController;
