import { pool } from '../../config/config.js';


/**
 * Domain Model - handles all database operations for domains and their relationships.
 *
 * Naming convention: All methods use ORM-style names (findAll, findById, create, update, delete, etc.).
 * All business logic for domain CRUD and relationship management is encapsulated here.
 */
class Domain {
  // ===== CRUD METHODS =====

  /**
   * Create a new domain
   */
  static async create({ domain, description, ip_id = null, record_type = null }, client = pool) {
    const result = await client.query(
      'INSERT INTO domains (domain, description, ip_id, record_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [domain, description || null, ip_id, record_type]
    );
    return result.rows[0];
  }

  /**
   * Get all domains (no filter, ordered by id)
   */
  static async findAll() {
    const result = await pool.query('SELECT * FROM domains ORDER BY id');
    return result.rows;
  }

  /**
   * Get a domain by id
   */
  static async findById(id) {
    const result = await pool.query('SELECT * FROM domains WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Update a domain
   */
  static async update(id, { description, ip_id = null, record_type = null }, client = pool) {
    const result = await client.query(
      'UPDATE domains SET description = $1, ip_id = $2, record_type = $3 WHERE id = $4 RETURNING *',
      [description, ip_id, record_type, id]
    );
    return result.rows[0];
  }

  /**
   * Delete a domain by id
   */
  static async delete(id, client = pool) {
    await client.query('DELETE FROM system_domain WHERE domain_id = $1', [id]);
    await client.query('DELETE FROM domains WHERE id = $1', [id]);
  }

  /**
   * Count all domains
   */
  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM domains');
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get paginated list of domains
   */
  static async findPage(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT d.*, 
        jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address) AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM domains d
      LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
      LEFT JOIN system_domain sd ON d.id = sd.domain_id
      LEFT JOIN systems s ON sd.system_id = s.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'domain' AND tobj.object_id = d.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      GROUP BY d.id, ip.id
      ORDER BY d.id
      LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return result.rows.map(row => {
      row.systems = Array.isArray(row.systems) ? row.systems : JSON.parse(row.systems);
      row.tags = Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags);
      return row;
    });
  }

  /**
   * Get paginated list of domains by search
   */
  static async findSearchPage(search, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT d.*, 
        jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address) AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM domains d
      LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
      LEFT JOIN system_domain sd ON d.id = sd.domain_id
      LEFT JOIN systems s ON sd.system_id = s.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'domain' AND tobj.object_id = d.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      WHERE d.domain ILIKE $1 OR d.description ILIKE $1 OR ip.ip_address::text ILIKE $1 OR s.name ILIKE $1
      GROUP BY d.id, ip.id
      ORDER BY d.id DESC
      LIMIT $2 OFFSET $3`,
      [`%${search}%`, pageSize, offset]
    );
    return result.rows.map(row => {
      row.systems = Array.isArray(row.systems) ? row.systems : JSON.parse(row.systems);
      row.tags = Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags);
      return row;
    });
  }

  /**
   * Count domains by search
   */
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

  /**
   * Get filtered list of domains with pagination
   */
  static async findFilteredList({ search = '', tags = [], systems = [], status = '', page = 1, pageSize = 10 }) {
    const offset = (page - 1) * pageSize;
    let whereClauses = [];
    let params = [];
    let paramCount = 0;

    // Search condition
    if (search) {
      paramCount++;
      whereClauses.push(`(d.domain ILIKE $${paramCount} OR d.description ILIKE $${paramCount} OR ip.ip_address::text ILIKE $${paramCount} OR s.name ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    // Tags filter
    if (tags && tags.length > 0) {
      paramCount++;
      whereClauses.push(`d.id IN (
        SELECT tobj.object_id 
        FROM tag_object tobj 
        WHERE tobj.object_type = 'domain' 
        AND tobj.tag_id = ANY($${paramCount})
      )`);
      params.push(tags);
    }

    // Systems filter
    if (systems && systems.length > 0) {
      paramCount++;
      whereClauses.push(`d.id IN (
        SELECT sd.domain_id 
        FROM system_domain sd 
        WHERE sd.system_id = ANY($${paramCount})
      )`);
      params.push(systems);
    }

    // Status filter (Record Type)
    if (status) {
      paramCount++;
      whereClauses.push(`d.record_type = $${paramCount}`);
      params.push(status);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT d.*, 
        jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address) AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM domains d
      LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
      LEFT JOIN system_domain sd ON d.id = sd.domain_id
      LEFT JOIN systems s ON sd.system_id = s.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'domain' AND tobj.object_id = d.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      ${whereClause}
      GROUP BY d.id, ip.id
      ORDER BY d.id DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, pageSize, offset]
    );
    
    return result.rows.map(row => {
      row.systems = Array.isArray(row.systems) ? row.systems : JSON.parse(row.systems);
      row.tags = Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags);
      return row;
    });
  }

  /**
   * Count filtered domains
   */
  static async countFiltered({ search = '', tags = [], systems = [], status = '' }) {
    let whereClauses = [];
    let params = [];
    let paramCount = 0;

    // Search condition
    if (search) {
      paramCount++;
      whereClauses.push(`(d.domain ILIKE $${paramCount} OR d.description ILIKE $${paramCount} OR ip.ip_address::text ILIKE $${paramCount} OR s.name ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    // Tags filter
    if (tags && tags.length > 0) {
      paramCount++;
      whereClauses.push(`d.id IN (
        SELECT tobj.object_id 
        FROM tag_object tobj 
        WHERE tobj.object_type = 'domain' 
        AND tobj.tag_id = ANY($${paramCount})
      )`);
      params.push(tags);
    }

    // Systems filter
    if (systems && systems.length > 0) {
      paramCount++;
      whereClauses.push(`d.id IN (
        SELECT sd.domain_id 
        FROM system_domain sd 
        WHERE sd.system_id = ANY($${paramCount})
      )`);
      params.push(systems);
    }

    // Status filter (Record Type)
    if (status) {
      paramCount++;
      whereClauses.push(`d.record_type = $${paramCount}`);
      params.push(status);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT COUNT(DISTINCT d.id) 
      FROM domains d
      LEFT JOIN ip_addresses ip ON d.ip_id = ip.id
      LEFT JOIN system_domain sd ON d.id = sd.domain_id
      LEFT JOIN systems s ON sd.system_id = s.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'domain' AND tobj.object_id = d.id
      ${whereClause}`,
      params
    );
    
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check if a domain exists by id
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM domains WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * Get all systems of a domain (many-to-many)
   */
  static async findSystems(domainId) {
    const result = await pool.query(
      `SELECT s.* FROM systems s
       JOIN system_domain sd ON s.id = sd.system_id
       WHERE sd.domain_id = $1`,
      [domainId]
    );
    return result.rows;
  }

  /**
   * Set all systems for a domain (removes all old, adds new)
   */
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

  /**
   * Set all tags for a domain (removes all old, adds new)
   */
  static async setTags(domainId, tagIds, client = pool) {
    await client.query('DELETE FROM tag_object WHERE object_type = $1 AND object_id = $2', ['domain', domainId]);
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const values = tagIds.map((tagId, idx) => `($${idx + 1}, $${tagIds.length + 1}, $${tagIds.length + 2})`).join(',');
      await client.query(
        `INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [...tagIds, 'domain', domainId]
      );
    }
  }

  /**
   * Get IP info for a domain (returns {id, ip_address} or null)
   */
  static async getIp(ip_id) {
    if (!ip_id) return null;
    const result = await pool.query('SELECT id, ip_address FROM ip_addresses WHERE id = $1', [ip_id]);
    return result.rows[0] || null;
  }
}

export default Domain;
