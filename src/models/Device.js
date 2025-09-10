// Device model for CRUD operations
import { pool } from '../../config/config.js';


class Device {
  // Create a new device (with manufacturer and device_role)
  static async create({ name, manufacturer, device_role, platform_id, device_type_id, location, serial_number, management_address, description }) {
    const result = await pool.query(
      'INSERT INTO devices (name, manufacturer, device_role, platform_id, device_type_id, location, serial_number, management_address, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [name, manufacturer, device_role, platform_id, device_type_id, location, serial_number, management_address, description]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query('SELECT * FROM devices ORDER BY updated_at DESC, id DESC');
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async update(id, { name, manufacturer, device_role, platform_id, device_type_id, location, serial_number, management_address, description, updated_by }, client = null) {
    const query =
      'UPDATE devices SET name = $1, manufacturer = $2, device_role = $3, platform_id = $4, device_type_id = $5, location = $6, serial_number = $7, management_address = $8, description = $9, updated_by = $10, updated_at = CURRENT_TIMESTAMP WHERE id = $11 RETURNING *';
    const params = [name, manufacturer, device_role, platform_id, device_type_id, location, serial_number, management_address, description, updated_by, id];
    const exec = client ? client.query.bind(client) : pool.query.bind(pool);
    const result = await exec(query, params);
    return result.rows[0];
  }

  static async remove(id, client = pool) {
    await client.query('DELETE FROM device_contact WHERE device_id = $1', [id]);
    await client.query('DELETE FROM tag_object WHERE object_type = $1 AND object_id = $2', ['device', id]);
    await client.query('DELETE FROM ip_addresses WHERE device_id = $1', [id]);
    await client.query('DELETE FROM devices WHERE id = $1', [id]);
  }

  static async findPage(page = 1, pageSize = 5) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT d.*, dt.name AS device_type_name, p.name AS platform_name
       FROM devices d
       LEFT JOIN device_types dt ON d.device_type_id = dt.id
       LEFT JOIN platforms p ON d.platform_id = p.id
       ORDER BY d.updated_at DESC, d.id DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    const deviceList = result.rows;
    for (const device of deviceList) {
      device.ip_addresses = await Device.getIpAddresses(device.id);
      device.tags = await Device.getTags(device.id);
    }
    return deviceList;
  }

  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM devices');
    return parseInt(result.rows[0].count, 10);
  }

  static async setIpAddresses(deviceId, ipIds, client = pool) {
    await client.query('UPDATE ip_addresses SET device_id = NULL, status = NULL WHERE device_id = $1', [deviceId]);
    if (ipIds && ipIds.length > 0) {
      for (const ipId of ipIds) {
        await client.query("UPDATE ip_addresses SET device_id = $1, status = 'assigned' WHERE id = $2", [deviceId, ipId]);
      }
    }
  }

  static async setTags(deviceId, tagList, client = pool) {
    await client.query("DELETE FROM tag_object WHERE object_type = $1 AND object_id = $2", ['device', deviceId]);
    if (tagList && tagList.length > 0) {
      for (const tagId of tagList) {
        await client.query(
          "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'device', $2) ON CONFLICT DO NOTHING",
          [tagId, deviceId]
        );
      }
    }
  }

  static async setContacts(deviceId, contactList, client = pool) {
    await client.query('DELETE FROM device_contact WHERE device_id = $1', [deviceId]);
    if (contactList && contactList.length > 0) {
      for (const contactId of contactList) {
        await client.query(
          'INSERT INTO device_contact (device_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [deviceId, contactId]
        );
      }
    }
  }

  static async getIpAddresses(deviceId) {
    const ipResult = await pool.query(
      'SELECT id, ip_address FROM ip_addresses WHERE device_id = $1',
      [deviceId]
    );
    return ipResult.rows;
  }

  static async getTags(deviceId) {
    const tagResult = await pool.query(
      `SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_type = 'device' AND tobj.object_id = $1`,
      [deviceId]
    );
    return tagResult.rows;
  }

  static async getContactIds(deviceId) {
    const result = await pool.query('SELECT contact_id FROM device_contact WHERE device_id = $1', [deviceId]);
    return result.rows.map(row => row.contact_id);
  }

  static async findFilteredList({ search, device_type_id, tags, platform_id, location, manufacturer, device_role, page = 1, pageSize = 10 }) {
    let params = [];
    let whereClauses = [];
    let joinClauses = [];
    let idx = 1;
    joinClauses.push('LEFT JOIN ip_addresses ip ON ip.device_id = d.id');
    joinClauses.push("LEFT JOIN tag_object tobj ON tobj.object_type = 'device' AND tobj.object_id = d.id");
    joinClauses.push('LEFT JOIN tags t ON t.id = tobj.tag_id');
    if (device_type_id) {
      whereClauses.push(`d.device_type_id = $${idx}`);
      params.push(device_type_id);
      idx++;
    }
    if (platform_id) {
      whereClauses.push(`d.platform_id = $${idx}`);
      params.push(platform_id);
      idx++;
    }
    if (location) {
      whereClauses.push(`d.location ILIKE $${idx}`);
      params.push(`%${location}%`);
      idx++;
    }
    if (manufacturer) {
      whereClauses.push(`d.manufacturer ILIKE $${idx}`);
      params.push(`%${manufacturer}%`);
      idx++;
    }
    if (device_role) {
      whereClauses.push(`d.device_role ILIKE $${idx}`);
      params.push(`%${device_role}%`);
      idx++;
    }
    if (tags && tags.length > 0) {
      whereClauses.push(`d.id IN (SELECT object_id FROM tag_object WHERE object_type = 'device' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    if (search) {
      whereClauses.push('(' + [
        `d.name ILIKE $${idx}`,
        `d.manufacturer ILIKE $${idx}`,
        `d.device_role ILIKE $${idx}`,
        `COALESCE(p.name, '') ILIKE $${idx}`,
        `COALESCE(ip.ip_address, '') ILIKE $${idx}`,
        `COALESCE(d.management_address, '') ILIKE $${idx}`,
        `COALESCE(d.serial_number, '') ILIKE $${idx}`,
        `COALESCE(dt.name, '') ILIKE $${idx}`,
        `COALESCE(t.name, '') ILIKE $${idx}`
      ].join(' OR ') + ')');
      params.push(`%${search}%`);
      idx++;
    }
    let sql = `SELECT d.*, dt.name AS device_type_name, p.name AS platform_name,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip_addresses,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
      COALESCE((
        SELECT json_agg(jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email))
        FROM device_contact dc
        JOIN contacts c ON dc.contact_id = c.id
        WHERE dc.device_id = d.id
      ), '[]') AS contacts
      FROM devices d
      LEFT JOIN device_types dt ON d.device_type_id = dt.id
      LEFT JOIN platforms p ON d.platform_id = p.id
      ${joinClauses.join(' ')}
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      GROUP BY d.id, dt.name, p.name
      ORDER BY d.updated_at DESC, d.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(pageSize, (page - 1) * pageSize);
    const result = await pool.query(sql, params);
    return result.rows;
  }

  static async countFiltered({ search, device_type_id, tags, platform_id, location, manufacturer, device_role }) {
    let params = [];
    let whereClauses = [];
    let joinClauses = [];
    let idx = 1;
    joinClauses.push('LEFT JOIN ip_addresses ip ON ip.device_id = d.id');
    joinClauses.push("LEFT JOIN tag_object tobj ON tobj.object_type = 'device' AND tobj.object_id = d.id");
    joinClauses.push('LEFT JOIN tags t ON t.id = tobj.tag_id');
    if (device_type_id) {
      whereClauses.push(`d.device_type_id = $${idx}`);
      params.push(device_type_id);
      idx++;
    }
    if (platform_id) {
      whereClauses.push(`d.platform_id = $${idx}`);
      params.push(platform_id);
      idx++;
    }
    if (location) {
      whereClauses.push(`d.location ILIKE $${idx}`);
      params.push(`%${location}%`);
      idx++;
    }
    if (manufacturer) {
      whereClauses.push(`d.manufacturer ILIKE $${idx}`);
      params.push(`%${manufacturer}%`);
      idx++;
    }
    if (device_role) {
      whereClauses.push(`d.device_role ILIKE $${idx}`);
      params.push(`%${device_role}%`);
      idx++;
    }
    if (tags && tags.length > 0) {
      whereClauses.push(`d.id IN (SELECT object_id FROM tag_object WHERE object_type = 'device' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    if (search) {
      whereClauses.push('(' + [
        `d.name ILIKE $${idx}`,
        `d.manufacturer ILIKE $${idx}`,
        `d.device_role ILIKE $${idx}`,
        `COALESCE(p.name, '') ILIKE $${idx}`,
        `COALESCE(ip.ip_address, '') ILIKE $${idx}`,
        `COALESCE(d.management_address, '') ILIKE $${idx}`,
        `COALESCE(d.serial_number, '') ILIKE $${idx}`,
        `COALESCE(dt.name, '') ILIKE $${idx}`,
        `COALESCE(t.name, '') ILIKE $${idx}`
      ].join(' OR ') + ')');
      params.push(`%${search}%`);
      idx++;
    }
    let sql = `SELECT COUNT(DISTINCT d.id) FROM devices d
      LEFT JOIN device_types dt ON d.device_type_id = dt.id
      LEFT JOIN platforms p ON d.platform_id = p.id
      ${joinClauses.join(' ')}
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}`;
    const result = await pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  static async getFullDetail(id) {
    const result = await pool.query(
      `SELECT d.*, dt.name AS device_type_name, p.name AS platform_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip_addresses,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)) FILTER (WHERE c.id IS NOT NULL), '[]') AS contacts
       FROM devices d
       LEFT JOIN device_types dt ON d.device_type_id = dt.id
       LEFT JOIN platforms p ON d.platform_id = p.id
       LEFT JOIN ip_addresses ip ON ip.device_id = d.id
       LEFT JOIN tag_object tobj ON tobj.object_type = 'device' AND tobj.object_id = d.id
       LEFT JOIN tags t ON t.id = tobj.tag_id
       LEFT JOIN device_contact dc ON dc.device_id = d.id
       LEFT JOIN contacts c ON c.id = dc.contact_id
       WHERE d.id = $1
       GROUP BY d.id, dt.name, p.name`,
      [id]
    );
    const device = result.rows[0];
    if (!device) return null;
    device.ip_addresses = Array.isArray(device.ip_addresses) ? device.ip_addresses : JSON.parse(device.ip_addresses);
    device.tags = Array.isArray(device.tags) ? device.tags : JSON.parse(device.tags);
    device.contacts = Array.isArray(device.contacts) ? device.contacts : JSON.parse(device.contacts);
    return device;
  }

  // For select2 AJAX: get devices by search (id, name)
  static async select2Search(search = '', limit = 20) {
    let sql = 'SELECT id, name FROM devices';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }

  // Find a device by name (case-insensitive, for duplicate check)
  static async findByName(name) {
    const result = await pool.query('SELECT * FROM devices WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
    return result.rows[0] || null;
  }

  // Check if a device exists by id
  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM devices WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * Find devices by specific criteria (name, ip_address)
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.name - Device name (exact match)
   * @param {string} criteria.ip_address - IP address (exact match)
   * @returns {Promise<Array>} Array of devices with full details
   */
  static async findByCriteria(criteria) {
    let params = [];
    let whereClauses = [];
    let idx = 1;

    // Build WHERE clauses based on criteria
    if (criteria.name) {
      whereClauses.push(`d.name = $${idx}`);
      params.push(criteria.name);
      idx++;
    }

    if (criteria.ip_address) {
      whereClauses.push(`d.id IN (SELECT device_id FROM ip_addresses WHERE ip_address = $${idx})`);
      params.push(criteria.ip_address);
      idx++;
    }

    if (whereClauses.length === 0) {
      return [];
    }

    const sql = `
      SELECT d.*, dt.name AS device_type_name, p.name AS platform_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address, 'description', ip.description, 'status', ip.status)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip_addresses,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'description', t.description)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone)) FILTER (WHERE c.id IS NOT NULL), '[]') AS contacts
      FROM devices d
      LEFT JOIN device_types dt ON d.device_type_id = dt.id
      LEFT JOIN platforms p ON d.platform_id = p.id
      LEFT JOIN ip_addresses ip ON ip.device_id = d.id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'device' AND tobj.object_id = d.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN device_contact dc ON dc.device_id = d.id
      LEFT JOIN contacts c ON c.id = dc.contact_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY d.id, dt.name, p.name
      ORDER BY d.updated_at DESC, d.id DESC
    `;

    const result = await pool.query(sql, params);
    
    // Parse JSON fields for each device
    return result.rows.map(device => {
      // Parse JSON arrays
      device.ip_addresses = Array.isArray(device.ip_addresses) ? device.ip_addresses : JSON.parse(device.ip_addresses);
      device.tags = Array.isArray(device.tags) ? device.tags : JSON.parse(device.tags);
      device.contacts = Array.isArray(device.contacts) ? device.contacts : JSON.parse(device.contacts);
      
      return device;
    });
  }
}


export default Device;
