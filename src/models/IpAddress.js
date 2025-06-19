// Import required modules
const { pool } = require('../../config/config');

class IpAddress {
  static async findAll() {
    const result = await pool.query('SELECT * FROM ip_addresses ORDER BY id');
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM ip_addresses WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async create({ address, description, status, updated_by }) {
    const result = await pool.query(
      'INSERT INTO ip_addresses (ip_address, description, status, updated_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [address, description, status, updated_by]
    );
    return result.rows[0];
  }

  // Update only description, status, updated_by (KHÔNG update ip_address)
  static async update(id, { description, status, updated_by }) {
    const result = await pool.query(
      'UPDATE ip_addresses SET description = $1, status = $2, updated_at = NOW(), updated_by = $3 WHERE id = $4 RETURNING *',
      [description, status, updated_by, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM ip_addresses WHERE id = $1', [id]);
  }

  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM ip_addresses');
    return parseInt(result.rows[0].count, 10);
  }

  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query('SELECT * FROM ip_addresses ORDER BY id LIMIT $1 OFFSET $2', [pageSize, offset]);
    return result.rows;
  }

  static async findByAddress(address) {
    const result = await pool.query('SELECT * FROM ip_addresses WHERE ip_address = $1', [address]);
    return result.rows[0];
  }

  static async searchPage(search, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT * FROM ip_addresses WHERE ip_address::text ILIKE $1 OR description ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3`,
      [`%${search}%`, pageSize, offset]
    );
    return result.rows;
  }

  static async searchCount(search) {
    const result = await pool.query(
      `SELECT COUNT(*) FROM ip_addresses WHERE ip_address::text ILIKE $1 OR description ILIKE $1`,
      [`%${search}%`]
    );
    return parseInt(result.rows[0].count, 10);
  }

  static async findBySubnet(subnetAddress) {
    const result = await pool.query(
      'SELECT * FROM ip_addresses WHERE ip_address::inet <<= $1::inet ORDER BY ip_address::inet',
      [subnetAddress]
    );
    return result.rows;
  }

  static async findByServerId(serverId) {
    const res = await pool.query('SELECT * FROM ip_addresses WHERE server_id = $1 ORDER BY id', [serverId]);
    return res.rows;
  }

  // Filtered IP list with pagination, search, tags, status, systems, contacts
  static async filterList({ search, tags, status, systems, contacts, page = 1, pageSize = 10 }) {
    let params = [];
    let whereClauses = [];
    let joinClauses = [];
    let idx = 1;
    // Join tag_object/tags
    joinClauses.push('LEFT JOIN tag_object tobj ON tobj.object_type = \'ip_address\' AND tobj.object_id = ip.id');
    joinClauses.push('LEFT JOIN tags t ON t.id = tobj.tag_id');
    // Join ip_contact/contacts
    joinClauses.push('LEFT JOIN ip_contact ic ON ic.ip_id = ip.id');
    joinClauses.push('LEFT JOIN contacts c ON c.id = ic.contact_id');
    // Join system_ip/systems
    joinClauses.push('LEFT JOIN system_ip si ON si.ip_id = ip.id');
    joinClauses.push('LEFT JOIN systems s ON s.id = si.system_id');
    // Join device and server
    joinClauses.push('LEFT JOIN devices d ON d.id = ip.device_id');
    joinClauses.push('LEFT JOIN servers srv ON srv.id = ip.server_id');
    // Filter by tags (all selected tags must be present)
    if (tags && tags.length > 0) {
      whereClauses.push(`ip.id IN (SELECT object_id FROM tag_object WHERE object_type = 'ip_address' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    // Filter by status
    if (status && status !== '') {
      whereClauses.push(`ip.status = $${idx}`);
      params.push(status);
      idx++;
    }
    // Filter by systems
    if (systems && systems.length > 0) {
      whereClauses.push(`ip.id IN (SELECT ip_id FROM system_ip WHERE system_id = ANY($${idx}))`);
      params.push(systems);
      idx++;
    }
    // Filter by contacts
    if (contacts && contacts.length > 0) {
      whereClauses.push(`ip.id IN (SELECT ip_id FROM ip_contact WHERE contact_id = ANY($${idx}))`);
      params.push(contacts);
      idx++;
    }
    // Search by IP, description, tag name, contact name, system name
    if (search && search.trim() !== '') {
      whereClauses.push(`(
        ip.ip_address::text ILIKE $${idx} OR
        ip.description ILIKE $${idx} OR
        t.name ILIKE $${idx} OR
        c.name ILIKE $${idx} OR
        s.name ILIKE $${idx}
      )`);
      params.push(`%${search}%`);
      idx++;
    }
    let sql = `SELECT ip.*, 
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone)) FILTER (WHERE c.id IS NOT NULL), '[]') AS contacts,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name, 'system_id', s.system_id)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems,
      d.id AS device_id, d.name AS device_name, srv.id AS server_id, srv.name AS server_name
      FROM ip_addresses ip
      ${joinClauses.join(' ')}
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      GROUP BY ip.id, d.id, srv.id
      ORDER BY ip.id
      LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(pageSize, (page - 1) * pageSize);
    const result = await pool.query(sql, params);
    // Map device/server info into each IP object
    return result.rows.map(row => {
      if (row.device_id) {
        row.device = { id: row.device_id, name: row.device_name };
      }
      if (row.server_id) {
        row.server = { id: row.server_id, name: row.server_name };
      }
      delete row.device_id;
      delete row.device_name;
      delete row.server_id;
      delete row.server_name;
      return row;
    });
  }

  // Count for filtered IP list
  static async filterCount({ search, tags, status, systems, contacts }) {
    let params = [];
    let whereClauses = [];
    let joinClauses = [];
    let idx = 1;
    joinClauses.push('LEFT JOIN tag_object tobj ON tobj.object_type = \'ip_address\' AND tobj.object_id = ip.id');
    joinClauses.push('LEFT JOIN tags t ON t.id = tobj.tag_id');
    joinClauses.push('LEFT JOIN ip_contact ic ON ic.ip_id = ip.id');
    joinClauses.push('LEFT JOIN contacts c ON c.id = ic.contact_id');
    joinClauses.push('LEFT JOIN system_ip si ON si.ip_id = ip.id');
    joinClauses.push('LEFT JOIN systems s ON s.id = si.system_id');
    // XÓA các join device_ip/devices và server_ip/servers khỏi filterCount vì không dùng trong SELECT COUNT, tránh lỗi nếu bảng không tồn tại.
    if (tags && tags.length > 0) {
      whereClauses.push(`ip.id IN (SELECT object_id FROM tag_object WHERE object_type = 'ip_address' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    if (status && status !== '') {
      whereClauses.push(`ip.status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (systems && systems.length > 0) {
      whereClauses.push(`ip.id IN (SELECT ip_id FROM system_ip WHERE system_id = ANY($${idx}))`);
      params.push(systems);
      idx++;
    }
    if (contacts && contacts.length > 0) {
      whereClauses.push(`ip.id IN (SELECT ip_id FROM ip_contact WHERE contact_id = ANY($${idx}))`);
      params.push(contacts);
      idx++;
    }
    if (search && search.trim() !== '') {
      whereClauses.push(`(
        ip.ip_address::text ILIKE $${idx} OR
        ip.description ILIKE $${idx} OR
        t.name ILIKE $${idx} OR
        c.name ILIKE $${idx} OR
        s.name ILIKE $${idx}
      )`);
      params.push(`%${search}%`);
      idx++;
    }
    let sql = `SELECT COUNT(DISTINCT ip.id) FROM ip_addresses ip
      ${joinClauses.join(' ')}
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}`;
    const result = await pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }
}

// Export the IpAddress model
module.exports = IpAddress;
