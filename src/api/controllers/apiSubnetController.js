
// API Controller for Subnet (ES6)
import { pool } from '../../../config/config.js';
import Subnet from '../../models/Subnet.js';
import Tag from '../../models/Tag.js';

const apiSubnetController = {};

apiSubnetController.listSubnets = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    let totalCount, totalPages, subnets;
    if (search) {
      totalCount = await Subnet.countFiltered({ search });
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      subnets = await Subnet.findFilteredList({ search, page, pageSize });
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

apiSubnetController.createSubnet = async (req, res) => {
  try {
    let { address, description, tags } = req.body;
    address = typeof address === 'string' ? address.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    if (!address) {
      return res.status(400).json({ error: 'Subnet address is required' });
    }
    // Check for duplicate address
    const existing = await Subnet.findByAddress(address);
    if (existing) {
      return res.status(409).json({ error: 'Subnet already exists with this address' });
    }
    // Validate tags if provided
    if (tags && Array.isArray(tags)) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          return res.status(400).json({ error: `Tag does not exist: ${tagId}` });
        }
      }
    } else {
      tags = [];
    }
    const subnet = await Subnet.create({ address, description });
    await Subnet.setTags(subnet.id, tags);
    // Return subnet with tags
    const created = await Subnet.findById(subnet.id);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

apiSubnetController.updateSubnet = async (req, res) => {

  const client = await pool.connect();
  try {
    const id = req.params.id;
    let { address, description, tags } = req.body;
    // Fetch current subnet
    const currentSubnet = await Subnet.findById(id);
    if (!currentSubnet) {
      client.release();
      return res.status(404).json({ error: 'Subnet not found' });
    }

    // Build update object
    const updateFields = {};

    // If description is provided, update
    if (typeof description === 'string') {
      description = description.trim();
      updateFields.description = description;
    }

    // If tags are provided, validate and update
    let updateTags = null;
    if (tags && Array.isArray(tags)) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          client.release();
          return res.status(400).json({ error: `Tag does not exist: ${tagId}` });
        }
      }
      updateTags = tags;
    }

    // If no fields to update, return error
    if (Object.keys(updateFields).length === 0 && updateTags === null) {
      client.release();
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Transaction block
    await client.query('BEGIN');
    if (Object.keys(updateFields).length > 0) {
      await Subnet.update(id, updateFields, client);
    }
    if (updateTags !== null) {
      await Subnet.setTags(id, updateTags, client);
    }
    await client.query('COMMIT');

    // Return the updated subnet
    const updated = await Subnet.findById(id);
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    if (!client.released) client.release();
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

export default apiSubnetController;
