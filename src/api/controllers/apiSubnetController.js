
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
    address = typeof address === 'string' ? address.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';

    // Fetch current subnet
    const currentSubnet = await Subnet.findById(id);
    if (!currentSubnet) {
      client.release();
      return res.status(404).json({ error: 'Subnet not found' });
    }

    // Address is required (but don't update it, just check for duplicate)
    if (!address) {
      client.release();
      return res.status(400).json({ error: 'Subnet address is required' });
    }
    // Check for duplicate address (except for this id)
    const existing = await Subnet.findByAddress(address);
    if (existing && String(existing.id) !== String(id)) {
      client.release();
      return res.status(409).json({ error: 'Subnet already exists with this address' });
    }

    // Only update description if provided and not empty, else keep old
    const newDescription = description !== '' ? description : currentSubnet.description;

    // Normalize tags: if provided, validate; else keep old
    let newTags;
    if (tags && Array.isArray(tags)) {
      for (const tagId of tags) {
        if (!(await Tag.exists(tagId))) {
          client.release();
          return res.status(400).json({ error: `Tag does not exist: ${tagId}` });
        }
      }
      newTags = tags;
    } else {
      newTags = currentSubnet.tags ? currentSubnet.tags.map(t => t.id) : [];
    }

    // Transaction block
    await client.query('BEGIN');
    await Subnet.update(id, { description: newDescription }, client);
    await Subnet.setTags(id, newTags, client);
    await client.query('COMMIT');

    // Return the updated subnet
    const updated = await Subnet.findById(id);
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
