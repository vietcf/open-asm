// Device model for CRUD operations
const { pool } = require('../../config/config');

class Device {
  // Get all devices
  static async findAll() {
    const result = await pool.query('SELECT * FROM devices ORDER BY id');
    return result.rows;
  }

  // Get a device by ID
  static async findById(id) {
    const result = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    return result.rows[0];
  }

  // Create a new device (with manufacturer)
  static async create({ name, manufacturer, platform_id, device_type_id, location, serial_number, management_address, description }) {
    const result = await pool.query(
      'INSERT INTO devices (name, manufacturer, platform_id, device_type_id, location, serial_number, management_address, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, manufacturer, platform_id, device_type_id, location, serial_number, management_address, description]
    );
    return result.rows[0];
  }

  // Update device by ID (with manufacturer)
  static async update(id, { name, manufacturer, platform_id, device_type_id, location, serial_number, management_address, description, updated_by }, client = null) {
    const query =
      'UPDATE devices SET name = $1, manufacturer = $2, platform_id = $3, device_type_id = $4, location = $5, serial_number = $6, management_address = $7, description = $8, updated_by = $9, updated_at = CURRENT_TIMESTAMP WHERE id = $10 RETURNING *';
    const params = [name, manufacturer, platform_id, device_type_id, location, serial_number, management_address, description, updated_by, id];
    const exec = client ? client.query.bind(client) : pool.query.bind(pool);
    const result = await exec(query, params);
    return result.rows[0];
  }

  // Delete a device by ID
  static async delete(id) {
    await pool.query('DELETE FROM devices WHERE id = $1', [id]);
  }

  // Get a page of devices (pagination)
  static async findPage(page = 1, pageSize = 5) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT d.*, dt.name AS device_type_name, p.name AS platform_name
       FROM devices d
       LEFT JOIN device_types dt ON d.device_type_id = dt.id
       LEFT JOIN platforms p ON d.platform_id = p.id
       ORDER BY d.id LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    const deviceList = result.rows;
    for (const device of deviceList) {
      device.ip_addresses = await Device.getIpAddressesForDevice(device.id);
      device.tags = await Device.getTagsForDevice(device.id);
    }
    return deviceList;
  }

  // Count all devices
  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM devices');
    return parseInt(result.rows[0].count, 10);
  }

  // Set tags for a device
  static async setTags(deviceId, tagIds) {
    // Remove old tags for this device
    await pool.query("DELETE FROM tag_object WHERE object_type = 'device' AND object_id = $1", [deviceId]);
    // Add new tags
    if (tagIds && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await pool.query(
          "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'device', $2) ON CONFLICT DO NOTHING",
          [tagId, deviceId]
        );
      }
    }
  }

  // Get tag IDs for a device
  static async getTagIds(deviceId) {
    const result = await pool.query(
      "SELECT tag_id FROM tag_object WHERE object_type = 'device' AND object_id = $1",
      [deviceId]
    );
    return result.rows.map(row => row.tag_id);
  }

  // Get all tags for a device
  static async getTagsForDevice(deviceId) {
    const tagResult = await pool.query(
      `SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_type = 'device' AND tobj.object_id = $1`,
      [deviceId]
    );
    return tagResult.rows;
  }

  // Get all IP addresses for a device
  static async getIpAddressesForDevice(deviceId) {
    const ipResult = await pool.query(
      'SELECT id, ip_address FROM ip_addresses WHERE device_id = $1',
      [deviceId]
    );
    return ipResult.rows;
  }

  // Filtered device list with pagination, search (multi fields, including tag name)
  static async filterList({ search, device_type_id, tags, platform_id, location, page = 1, pageSize = 10 }) {
    let params = [];
    let whereClauses = [];
    let joinClauses = [];
    let idx = 1;
    joinClauses.push('LEFT JOIN ip_addresses ip ON ip.device_id = d.id');
    joinClauses.push("LEFT JOIN tag_object tobj ON tobj.object_type = 'device' AND tobj.object_id = d.id");
    joinClauses.push('LEFT JOIN tags t ON t.id = tobj.tag_id');
    // Filter by device_type_id
    if (device_type_id) {
      whereClauses.push(`d.device_type_id = $${idx}`);
      params.push(device_type_id);
      idx++;
    }
    // Filter by platform_id
    if (platform_id) {
      whereClauses.push(`d.platform_id = $${idx}`);
      params.push(platform_id);
      idx++;
    }
    // Filter by location
    if (location) {
      whereClauses.push(`d.location ILIKE $${idx}`);
      params.push(`%${location}%`);
      idx++;
    }
    // Filter by tags (all selected tags must be present)
    if (tags && tags.length > 0) {
      whereClauses.push(`d.id IN (SELECT object_id FROM tag_object WHERE object_type = 'device' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    // Search by Name, Manufacturer, Platform (OS), IP Address(es), Management, Serial, Device Type Name, Tag Name
    if (search) {
      whereClauses.push('(' + [
        `d.name ILIKE $${idx}`,
        `d.manufacturer ILIKE $${idx}`,
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
      ORDER BY d.id
      LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(pageSize, (page - 1) * pageSize);
    const result = await pool.query(sql, params);
    return result.rows;
  }

  // Count for filtered device list
  static async filterCount({ search, device_type_id, tags, platform_id, location }) {
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
    if (tags && tags.length > 0) {
      whereClauses.push(`d.id IN (SELECT object_id FROM tag_object WHERE object_type = 'device' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    if (search) {
      whereClauses.push('(' + [
        `d.name ILIKE $${idx}`,
        `d.manufacturer ILIKE $${idx}`,
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

  // Gán contacts cho device (xóa hết rồi insert lại)
  static async setContacts(deviceId, contactIds, client = null) {
    const exec = client ? client.query.bind(client) : pool.query.bind(pool);
    await exec('DELETE FROM device_contact WHERE device_id = $1', [deviceId]);
    if (contactIds && contactIds.length > 0) {
      for (const contactId of contactIds) {
        await exec(
          'INSERT INTO device_contact (device_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [deviceId, contactId]
        );
      }
    }
  }

  // Lấy danh sách contact_id của device
  static async getContactIds(deviceId) {
    const result = await pool.query('SELECT contact_id FROM device_contact WHERE device_id = $1', [deviceId]);
    return result.rows.map(row => row.contact_id);
  }

  // Get a device by ID with enrich (tags, contacts, ip_addresses, platform_name, device_type_name)
  static async findByIdEnriched(id) {
    // Get main device info with platform/device_type name
    const result = await pool.query(
      `SELECT d.*, dt.name AS device_type_name, p.name AS platform_name
       FROM devices d
       LEFT JOIN device_types dt ON d.device_type_id = dt.id
       LEFT JOIN platforms p ON d.platform_id = p.id
       WHERE d.id = $1`,
      [id]
    );
    if (!result.rows.length) return null;
    const device = result.rows[0];
    // Get IP addresses
    device.ip_addresses = await Device.getIpAddressesForDevice(device.id);
    // Get tags (for select2: {id, text})
    const tags = await Device.getTagsForDevice(device.id);
    device.tags = tags;
    device.selectedTags = tags.map(t => ({ id: t.id, text: t.name }));
    // Get contacts (enrich: id, name, email)
    const contactRows = await pool.query('SELECT c.id, c.name, c.email FROM device_contact dc JOIN contacts c ON dc.contact_id = c.id WHERE dc.device_id = $1', [device.id]);
    device.contacts = contactRows.rows;
    device.selectedContacts = contactRows.rows.map(c => ({ id: c.id, name: c.name }));
    return device;
  }

  // Insert device only (không xử lý liên kết)
  static async insertDevice({ name, manufacturer, platform_id, location, serial, management, description, device_type_id, updated_by }, client = null) {
    const exec = client ? client.query.bind(client) : pool.query.bind(pool);
    const result = await exec(
      `INSERT INTO devices (name, manufacturer, platform_id, location, serial_number, management_address, description, device_type_id, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, manufacturer, platform_id, location, serial, management, description, device_type_id, updated_by]
    );
    return result.rows[0];
  }

  // Set IP addresses for device (gán device_id cho các IP, xóa device_id cũ nếu cần)
  static async setIpAddresses(deviceId, ipIds, client = null) {
    const exec = client ? client.query.bind(client) : pool.query.bind(pool);
    // Xóa device_id và status khỏi các IP cũ của device này
    await exec('UPDATE ip_addresses SET device_id = NULL, status = NULL WHERE device_id = $1', [deviceId]);
    // Gán device_id và status cho các IP mới
    if (ipIds && ipIds.length > 0) {
      for (const ipId of ipIds) {
        await exec("UPDATE ip_addresses SET device_id = $1, status = 'assigned' WHERE id = $2", [deviceId, ipId]);
      }
    }
  }

  // Set tags for device (xóa hết rồi insert lại)
  static async setTags(deviceId, tagIds, client = null) {
    const exec = client ? client.query.bind(client) : pool.query.bind(pool);
    await exec("DELETE FROM tag_object WHERE object_type = 'device' AND object_id = $1", [deviceId]);
    if (tagIds && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await exec(
          "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'device', $2) ON CONFLICT DO NOTHING",
          [tagId, deviceId]
        );
      }
    }
  }

  // Set contacts for device (xóa hết rồi insert lại)
  static async setContacts(deviceId, contactIds, client = null) {
    const exec = client ? client.query.bind(client) : pool.query.bind(pool);
    await exec('DELETE FROM device_contact WHERE device_id = $1', [deviceId]);
    if (contactIds && contactIds.length > 0) {
      for (const contactId of contactIds) {
        await exec(
          'INSERT INTO device_contact (device_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [deviceId, contactId]
        );
      }
    }
  }
}

module.exports = Device;
