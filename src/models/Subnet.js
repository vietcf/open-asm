// Import required modules
const { pool } = require('../../config/config');

class Subnet {
  // Get all subnets
  static async findAll() {
    const result = await pool.query('SELECT * FROM subnets ORDER BY id');
    return result.rows;
  }

  // Get a subnet by ID (with tags)
  static async findById(id) {
    const result = await pool.query(
      `SELECT s.*, COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
       FROM subnets s
       LEFT JOIN tag_object tobj ON tobj.object_type = 'subnet' AND tobj.object_id = s.id
       LEFT JOIN tags t ON tobj.tag_id = t.id
       WHERE s.id = $1
       GROUP BY s.id`,
      [id]
    );
    return result.rows[0];
  }

  // Create a new subnet
  static async create({ address, description }) {
    const result = await pool.query(
      'INSERT INTO subnets (address, description) VALUES ($1, $2) RETURNING *',
      [address, description]
    );
    return result.rows[0];
  }

  // Update subnet description by ID
  static async update(id, description) {
    const result = await pool.query(
      'UPDATE subnets SET description = $1 WHERE id = $2 RETURNING *',
      [description, id]
    );
    return result.rows[0];
  }

  // Delete a subnet by ID
  static async delete(id) {
    await pool.query('DELETE FROM subnets WHERE id = $1', [id]);
  }

  // Count all subnets
  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM subnets');
    return parseInt(result.rows[0].count, 10);
  }

  // Get a page of subnets
  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT s.*, COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
       FROM subnets s
       LEFT JOIN tag_object tobj ON tobj.object_type = 'subnet' AND tobj.object_id = s.id
       LEFT JOIN tags t ON tobj.tag_id = t.id
       GROUP BY s.id
       ORDER BY s.id
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows;
  }

  // Search subnets by address, description, or tag name (with pagination), including tags
  static async searchPage(search, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT s.*, COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
       FROM subnets s
       LEFT JOIN tag_object tobj ON tobj.object_type = 'subnet' AND tobj.object_id = s.id
       LEFT JOIN tags t ON tobj.tag_id = t.id
       WHERE s.address::text ILIKE $1 OR s.description ILIKE $1 OR t.name ILIKE $1
       GROUP BY s.id
       ORDER BY s.id
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, pageSize, offset]
    );
    return result.rows;
  }

  // Count subnets matching search (address, description, or tag name)
  static async searchCount(search) {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT s.id) AS count
       FROM subnets s
       LEFT JOIN tag_object tobj ON tobj.object_type = 'subnet' AND tobj.object_id = s.id
       LEFT JOIN tags t ON tobj.tag_id = t.id
       WHERE s.address::text ILIKE $1 OR s.description ILIKE $1 OR t.name ILIKE $1`,
      [`%${search}%`]
    );
    return parseInt(result.rows[0].count, 10);
  }

  // Create a new subnet and assign tags (transaction client optional)
  static async createSubnet({ address, description, tags = [] }, client) {
    const db = client || pool;
    const result = await db.query(
      'INSERT INTO subnets (address, description) VALUES ($1, $2) RETURNING *',
      [address, description]
    );
    const newSubnet = result.rows[0];
    for (const tagId of tags) {
      await db.query(
        "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'subnet', $2) ON CONFLICT DO NOTHING",
        [tagId, newSubnet.id]
      );
    }
    return newSubnet;
  }

  // Update subnet description and tags by ID (transaction client optional)
  static async updateSubnet(id, { description, tags = [] }, client) {
    const db = client || pool;
    await db.query(
      'UPDATE subnets SET description = $1 WHERE id = $2',
      [description, id]
    );
    await db.query("DELETE FROM tag_object WHERE object_type = 'subnet' AND object_id = $1", [id]);
    for (const tagId of tags) {
      await db.query(
        "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'subnet', $2) ON CONFLICT DO NOTHING",
        [tagId, id]
      );
    }
  }

  // Delete subnet and its tag links (transaction client optional)
  static async deleteSubnet(id, client) {
    const db = client || pool;
    await db.query("DELETE FROM tag_object WHERE object_type = 'subnet' AND object_id = $1", [id]);
    await db.query('DELETE FROM subnets WHERE id = $1', [id]);
  }

  // Find subnet by address (for duplicate check)
  static async findByAddress(address) {
    const result = await pool.query('SELECT * FROM subnets WHERE address = $1', [address]);
    return result.rows[0];
  }
}

// Export the Subnet model
module.exports = Subnet;
