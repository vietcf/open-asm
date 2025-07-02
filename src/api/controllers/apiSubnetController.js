// Controller for Subnet API
const Subnet = require('../../models/Subnet');
const Tag = require('../../models/Tag');

exports.listSubnets = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    let totalCount, totalPages, subnets;
    if (search) {
      totalCount = await Subnet.searchCount(search);
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      subnets = await Subnet.searchPage(search, page, pageSize);
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

exports.getSubnet = async (req, res) => {
  try {
    const id = req.params.id;
    const subnet = await Subnet.findById(id);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });
    res.json(subnet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSubnet = async (req, res) => {
  try {
    let { address, description, tags } = req.body;
    address = typeof address === 'string' ? address.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    if (!address) {
      return res.status(400).json({ error: 'Subnet address is required' });
    }
    // Check for duplicate address
    const existing = await Subnet.findByAddress ? await Subnet.findByAddress(address) : null;
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
    const subnet = await Subnet.createSubnet({ address, description, tags });
    res.status(201).json(subnet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSubnet = async (req, res) => {
  try {
    const id = req.params.id;
    let { address, description, tags } = req.body;
    address = typeof address === 'string' ? address.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    if (!address) {
      return res.status(400).json({ error: 'Subnet address is required' });
    }
    // Check for duplicate address (except for this id)
    const existing = await Subnet.findByAddress ? await Subnet.findByAddress(address) : null;
    if (existing && String(existing.id) !== String(id)) {
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
    await Subnet.updateSubnet(id, { description, tags });
    // Return the updated subnet
    const updated = await Subnet.findById(id);
    if (!updated) return res.status(404).json({ error: 'Subnet not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSubnet = async (req, res) => {
  try {
    const id = req.params.id;
    const subnet = await Subnet.findById(id);
    if (!subnet) return res.status(404).json({ error: 'Subnet not found' });
    await Subnet.deleteSubnet(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
