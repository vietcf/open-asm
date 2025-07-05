import { pool } from '../../config/config.js';


/**
 * Domain Model - handles all database operations for domains and their relationships.
 *
 * Naming convention: All methods use ORM-style names (findAll, findById, create, update, delete, etc.).
 * All business logic for domain CRUD and relationship management is encapsulated here.
 */
class Domain {
  static async findAll() {
    const result = await pool.query('SELECT * FROM domains ORDER BY id');
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM domains WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async create({ domain, description, ip_id = null, record_type = null }, client = pool) {
    const result = await client.query(
      'INSERT INTO domains (domain, description, ip_id, record_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [domain, description || null, ip_id, record_type]
    );
    return result.rows[0];
  }

  static async update(id, { description, ip_id = null, record_type = null }, client = pool) {
    const result = await client.query(
      'UPDATE domains SET description = $1, ip_id = $2, record_type = $3 WHERE id = $4 RETURNING *',
      [description, ip_id, record_type, id]
    );
    return result.rows[0];
  }

  static async delete(id, client = pool) {
    // Remove system_domain links first
    await client.query('DELETE FROM system_domain WHERE domain_id = $1', [id]);
    await client.query('DELETE FROM domains WHERE id = $1', [id]);
  }

  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM domains');
    return parseInt(result.rows[0].count, 10);
  }

  static async findPage(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT d.*, 
        jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address) AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems
      FROM domains d
      LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
      LEFT JOIN system_domain sd ON d.id = sd.domain_id
      LEFT JOIN systems s ON sd.system_id = s.id
      GROUP BY d.id, ip.id
      ORDER BY d.id
      LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows.map(row => {
      row.systems = Array.isArray(row.systems) ? row.systems : JSON.parse(row.systems);
      return row;
    });
  }

  static async findSearchPage(search, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT d.*, 
        jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address) AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems
      FROM domains d
      LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
      LEFT JOIN system_domain sd ON d.id = sd.domain_id
      LEFT JOIN systems s ON sd.system_id = s.id
      WHERE d.domain ILIKE $1 OR d.description ILIKE $1 OR ip.ip_address::text ILIKE $1 OR s.name ILIKE $1
      GROUP BY d.id, ip.id
      ORDER BY d.id DESC
      LIMIT $2 OFFSET $3`,
      [`%${search}%`, pageSize, offset]
    );
    // Convert systems from JSON string to array if needed
    return result.rows.map(row => {
      row.systems = Array.isArray(row.systems) ? row.systems : JSON.parse(row.systems);
      return row;
    });
  }

  static async countSearch(search) {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM (
        SELECT d.id
        FROM domains d
        LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
        LEFT JOIN system_domain sd ON d.id = sd.domain_id
        LEFT JOIN systems s ON sd.system_id = s.id
        WHERE d.domain ILIKE $1 OR d.description ILIKE $1 OR ip.ip_address::text ILIKE $1 OR s.name ILIKE $1
        GROUP BY d.id, ip.id
      ) sub`,
      [`%${search}%`]
    );
    return parseInt(result.rows[0].count, 10);
  }

  // Relationship: Get all systems of a domain (many-to-many)
  static async findSystems(domainId) {
    const result = await pool.query(
      `SELECT s.* FROM systems s
       JOIN system_domain sd ON s.id = sd.system_id
       WHERE sd.domain_id = $1`,
      [domainId]
    );
    return result.rows;
  }

  // Relationship: Set all systems for a domain (removes all old, adds new)
  static async setSystems(domainId, systemIds, client = pool) {
    await client.query('DELETE FROM system_domain WHERE domain_id = $1', [domainId]);
    if (Array.isArray(systemIds) && systemIds.length > 0) {
      const values = systemIds.map((sid, idx) => `($1, $${idx + 2})`).join(',');
      await client.query(
        `INSERT INTO system_domain (domain_id, system_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [domainId, ...systemIds]
      );
    }
  }

  // Get IP info for a domain (returns {id, ip_address} or null)
  static async getIp(ip_id) {
    if (!ip_id) return null;
    const result = await pool.query('SELECT id, ip_address FROM ip_addresses WHERE id = $1', [ip_id]);
    return result.rows[0] || null;
  }
}

export default Domain;
