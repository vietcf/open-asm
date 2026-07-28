/**
 * IpAddress Model - handles all database operations for IP addresses and their relationships.
 *
 * Naming convention: All methods use get/set prefix for clarity and consistency.
 * - get...: Fetch data (single/multiple records, filtered, paginated, etc.)
 * - set...: Update or assign relationships (tags, contacts, systems, etc.)
 *
 * Relationships handled:
 *   - Tags (tag_object)
 *   - Contacts (ip_contact)
 *   - Systems (system_ip)
 *   - Device/Server (joins for info only)
 *
 * All business logic for IP address CRUD and relationship management is encapsulated here.
 */
import { pool } from '../../config/config.js';

class IpAddress {

  // ===== CRUD METHODS =====

  
  /**
   * Create a new IP address
   * @param {Object} data
   * @param {string} data.address
   * @param {string} data.description
   * @param {string} data.status
   * @param {string} data.updated_by
   * @param {object} [client=pool]
   * @returns {Promise<Object>} The created IP address
   */
  static async create({ address, description, status, updated_by }, client = pool) {
    const result = await client.query(
      'INSERT INTO ip_addresses (ip_address, description, status, updated_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [address, description, status, updated_by]
    );
    return result.rows[0];
  }

  /**
   * Get all IP addresses (no filter, ordered by id)
   * @returns {Promise<Array>} List of all IP addresses
   */
  static async findAll() {
    const result = await pool.query('SELECT * FROM ip_addresses ORDER BY updated_at DESC');
    return result.rows;
  }

  /**
   * Get an IP address by id
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id, client = pool) {
    const result = await client.query('SELECT * FROM ip_addresses WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * Get an IP address by ID with full details (tags, contacts, systems)
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findByIdWithDetails(id) {
    const sql = `SELECT ip.*,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone)) FILTER (WHERE c.id IS NOT NULL), '[]') AS contacts,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name, 'system_id', s.system_id)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', d.id, 'name', d.name, 'role', di.role)) FILTER (WHERE d.id IS NOT NULL), '[]') AS devices,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', srv.id, 'name', srv.name, 'role', svi.role)) FILTER (WHERE srv.id IS NOT NULL), '[]') AS servers
      FROM ip_addresses ip
      LEFT JOIN tag_object tobj ON tobj.object_type = 'ip_address' AND tobj.object_id = ip.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN ip_contact ic ON ic.ip_id = ip.id
      LEFT JOIN contacts c ON c.id = ic.contact_id
      LEFT JOIN system_ip si ON si.ip_id = ip.id
      LEFT JOIN systems s ON s.id = si.system_id
      LEFT JOIN device_ip di ON di.ip_id = ip.id
      LEFT JOIN devices d ON d.id = di.device_id
      LEFT JOIN server_ip svi ON svi.ip_id = ip.id
      LEFT JOIN servers srv ON srv.id = svi.server_id
      WHERE ip.id = $1
      GROUP BY ip.id`;

    const result = await pool.query(sql, [id]);
    if (result.rows.length === 0) return null;

    return IpAddress._attachOwners(result.rows[0]);
  }

  /**
   * Get an IP address by address string
   * @param {string} address
   * @returns {Promise<Object|null>}
   */
  static async findByAddress(address) {
    const result = await pool.query('SELECT * FROM ip_addresses WHERE ip_address = $1', [address]);
    return result.rows[0];
  }

  /**
   * Get an IP address by address string with full details (tags, contacts, systems)
   * @param {string} address
   * @returns {Promise<Object|null>}
   */
  static async findByAddressWithDetails(address) {
    const sql = `SELECT ip.*,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone)) FILTER (WHERE c.id IS NOT NULL), '[]') AS contacts,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name, 'system_id', s.system_id)) FILTER (WHERE s.id IS NOT NULL), '[]') AS systems,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', d.id, 'name', d.name, 'role', di.role)) FILTER (WHERE d.id IS NOT NULL), '[]') AS devices,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', srv.id, 'name', srv.name, 'role', svi.role)) FILTER (WHERE srv.id IS NOT NULL), '[]') AS servers
      FROM ip_addresses ip
      LEFT JOIN tag_object tobj ON tobj.object_type = 'ip_address' AND tobj.object_id = ip.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN ip_contact ic ON ic.ip_id = ip.id
      LEFT JOIN contacts c ON c.id = ic.contact_id
      LEFT JOIN system_ip si ON si.ip_id = ip.id
      LEFT JOIN systems s ON s.id = si.system_id
      LEFT JOIN device_ip di ON di.ip_id = ip.id
      LEFT JOIN devices d ON d.id = di.device_id
      LEFT JOIN server_ip svi ON svi.ip_id = ip.id
      LEFT JOIN servers srv ON srv.id = svi.server_id
      WHERE ip.ip_address = $1
      GROUP BY ip.id`;

    const result = await pool.query(sql, [address]);
    if (result.rows.length === 0) return null;

    return IpAddress._attachOwners(result.rows[0]);
  }


  /**
   * Update an IP address
   * @param {number} id
   * @param {Object} data
   * @param {string} data.description
   * @param {string} data.status
   * @param {string} data.updated_by
   * @returns {Promise<Object>} The updated IP address
   */
  static async update(id, { description, status, updated_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      'UPDATE ip_addresses SET description = $1, status = $2, updated_at = NOW(), updated_by = $3 WHERE id = $4 RETURNING *',
      [description, status, updated_by, id]
    );
    return result.rows[0];
  }

  /**
   * Delete an IP address by id
   * @param {number} id
   * @returns {Promise<void>}
   */
  /**
   * Delete an IP address
   * @param {number} id - IP address ID
   * @param {object} [client=pool] - Database client
   * @returns {Promise<void>}
   * @throws {Error} If IP is assigned to server or device
   */
  static async delete(id, client = pool) {
    // Check if IP is assigned to any server or device
    const assignment = await this.checkAssignment(id);
    if (assignment) {
      const assignedTo = [
        ...assignment.servers.map(s => `server "${s.name}"`),
        ...assignment.devices.map(d => `device "${d.name}"`)
      ];
      throw new Error(`Cannot delete IP address: it is assigned to ${assignedTo.join(' and ')}`);
    }

    await client.query('DELETE FROM ip_addresses WHERE id = $1', [id]);
  }

  /**
   * Count all IP addresses
   * @returns {Promise<number>}
   */
  static async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM ip_addresses');
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get paginated list of IP addresses
   * @param {number} page
   * @param {number} pageSize
   * @returns {Promise<Array>}
   */
  static async findPage(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query('SELECT * FROM ip_addresses ORDER BY updated_at DESC LIMIT $1 OFFSET $2', [pageSize, offset]);
    return result.rows;
  }

  /**
   * Get paginated list of IP addresses by search
   * @param {string} search
   * @param {number} page
   * @param {number} pageSize
   * @returns {Promise<Array>}
   */
  static async findSearchPage(search, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `SELECT * FROM ip_addresses WHERE ip_address::text ILIKE $1 OR description ILIKE $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
      [`%${search}%`, pageSize, offset]
    );
    return result.rows;
  }

  /**
   * Count IP addresses by search
   * @param {string} search
   * @returns {Promise<number>}
   */
  static async countSearch(search) {
    const result = await pool.query(
      `SELECT COUNT(*) FROM ip_addresses WHERE ip_address::text ILIKE $1 OR description ILIKE $1`,
      [`%${search}%`]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get all IP addresses in a subnet
   * @param {string} subnetAddress
   * @returns {Promise<Array>}
   */
  static async findBySubnet(subnetAddress) {
    const result = await pool.query(
      'SELECT * FROM ip_addresses WHERE ip_address::inet <<= $1::inet ORDER BY ip_address::inet',
      [subnetAddress]
    );
    return result.rows;
  }

  /**
   * Get all IP addresses by server id
   * @param {number} serverId
   * @returns {Promise<Array>}
   */
  static async findByServerId(serverId) {
    const res = await pool.query(
      'SELECT ip.* FROM ip_addresses ip JOIN server_ip sv ON sv.ip_id = ip.id WHERE sv.server_id = $1 ORDER BY ip.id',
      [serverId]
    );
    return res.rows;
  }

  /**
   * Get unassigned IP addresses (for select2 ajax, etc.)
   * @param {Object} params
   * @param {string} params.search
   * @param {number} params.limit
   * @returns {Promise<Array<{id:number, ip_address:string}>>}
   */
  static async findUnassignIP({ search = '', limit = 20 }) {
    const result = await pool.query(
      "SELECT id, ip_address FROM ip_addresses WHERE (status IS NULL OR status != 'assigned') AND ip_address::text ILIKE $1 ORDER BY ip_address LIMIT $2",
      [`%${search}%`, limit]
    );
    return result.rows;
  }

  // ===== ADVANCED FILTERED LISTS =====

  // Filtered IP list with pagination, search, tags, status, systems, contacts
  /**
   * Get filtered list of IP addresses (with pagination, search, tags, status, systems, contacts)
   * @param {Object} filters { search, tags, status, systems, contacts, page, pageSize }
   * @returns {Promise<Array>} Filtered list of IP addresses
   */
  static async findFilteredList({ search, tags, status, systems, contacts, page = 1, pageSize = 10 }) {
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
    // Join device and server (many-to-many via device_ip/server_ip)
    joinClauses.push('LEFT JOIN device_ip di ON di.ip_id = ip.id');
    joinClauses.push('LEFT JOIN devices d ON d.id = di.device_id');
    joinClauses.push('LEFT JOIN server_ip svi ON svi.ip_id = ip.id');
    joinClauses.push('LEFT JOIN servers srv ON srv.id = svi.server_id');
    // Filter by tags (all selected tags must be present)
    if (tags && tags.length > 0) {
      whereClauses.push(`ip.id IN (SELECT object_id FROM tag_object WHERE object_type = 'ip_address' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    // Filter by status — '__none__' means "no status set" (IS NULL), which
    // can't be expressed via ip.status = $n since SQL NULL never equals
    // anything, not even itself.
    if (status === '__none__') {
      whereClauses.push('ip.status IS NULL');
    } else if (status && status !== '') {
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
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', d.id, 'name', d.name, 'role', di.role)) FILTER (WHERE d.id IS NOT NULL), '[]') AS devices,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', srv.id, 'name', srv.name, 'role', svi.role)) FILTER (WHERE srv.id IS NOT NULL), '[]') AS servers
      FROM ip_addresses ip
      ${joinClauses.join(' ')}
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      GROUP BY ip.id
      ORDER BY ip.updated_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(pageSize, (page - 1) * pageSize);
    const result = await pool.query(sql, params);

    // Get subnet information for each IP
    const ipsWithSubnet = await Promise.all(result.rows.map(async (row) => {
      // Map device/server info into each IP object (devices[]/servers[] plus
      // legacy single device/server = primary owner)
      IpAddress._attachOwners(row);
      row.device_name = row.device ? row.device.name : null;
      row.server_name = row.server ? row.server.name : null;

      // Get subnet information for this IP
      const subnetInfo = await IpAddress.getSubnetInfo(row.ip_address);
      if (subnetInfo) {
        row.subnet = {
          id: subnetInfo.id,
          address: subnetInfo.address,
          description: subnetInfo.description,
          zone: subnetInfo.zone,
          environment: subnetInfo.environment,
          prefix_length: subnetInfo.prefix_length
        };
      }
      
      return row;
    }));
    
    return ipsWithSubnet;
  }

  // Count for filtered IP list
  /**
   * Get count for filtered IP address list (search, tags, status, systems, contacts)
   * @param {Object} filters { search, tags, status, systems, contacts }
   * @returns {Promise<number>} Count of filtered IP addresses
   */
  static async countFiltered({ search, tags, status, systems, contacts }) {
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
    if (status === '__none__') {
      whereClauses.push('ip.status IS NULL');
    } else if (status && status !== '') {
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

  // Set all tags for an IP address (remove all old, add new)
  /**
   * Set all tags for an IP address (removes all old, adds new)
   * @param {number} ipId
   * @param {Array<number>} tagIds
   * @returns {Promise<void>}
   */
  static async setTags(ipId, tagIds, client = pool) {
    // Remove all old tags
    await client.query("DELETE FROM tag_object WHERE object_type = 'ip_address' AND object_id = $1", [ipId]);
    // Add new tags if any
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const values = tagIds.map((tagId, idx) => `($1, $${idx + 2}, 'ip_address')`).join(',');
      await client.query(
        `INSERT INTO tag_object (object_id, tag_id, object_type) VALUES ${values}`,
        [ipId, ...tagIds]
      );
    }
  }

  // Set all contacts for an IP address (remove all old, add new)
  /**
   * Set all contacts for an IP address (removes all old, adds new)
   * @param {number} ipId
   * @param {Array<number>} contactIds
   * @returns {Promise<void>}
   */
  static async setContacts(ipId, contactIds, client = pool) {
    await client.query('DELETE FROM ip_contact WHERE ip_id = $1', [ipId]);
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      const values = contactIds.map((cid, idx) => `($1, $${idx + 2})`).join(',');
      await client.query(
        `INSERT INTO ip_contact (ip_id, contact_id) VALUES ${values}`,
        [ipId, ...contactIds]
      );
    }
  }

  // Set all systems for an IP address (remove all old, add new)
  /**
   * Set all systems for an IP address (removes all old, adds new)
   * @param {number} ipId
   * @param {Array<number>} systemIds
   * @returns {Promise<void>}
   */
  static async setSystems(ipId, systemIds, client = pool) {
    await client.query('DELETE FROM system_ip WHERE ip_id = $1', [ipId]);
    if (Array.isArray(systemIds) && systemIds.length > 0) {
      const values = systemIds.map((sid, idx) => `($1, $${idx + 2})`).join(',');
      await client.query(
        `INSERT INTO system_ip (ip_id, system_id) VALUES ${values}`,
        [ipId, ...systemIds]
      );
    }
  }

  /**
   * Check if an IP address exists by id
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM ip_addresses WHERE id = $1 LIMIT 1', [id]);
    return result.rowCount > 0;
  }

  /**
   * Check if IP address is assigned to any server or device (primary or VIP)
   * @param {number} id - IP address ID
   * @returns {Promise<Object|null>} { devices: [...], servers: [...] } or null if not assigned to anything
   */
  static async checkAssignment(id) {
    const { devices, servers } = await IpAddress.getOwners(id);
    if (devices.length === 0 && servers.length === 0) return null;
    return { devices, servers };
  }

  /**
   * Get every device/server currently linked to an IP address (primary + VIP)
   * @param {number} ipId
   * @returns {Promise<{devices: Array, servers: Array}>}
   */
  static async getOwners(ipId, client = pool) {
    const [deviceRes, serverRes] = await Promise.all([
      client.query(
        `SELECT d.id, d.name, di.role FROM device_ip di JOIN devices d ON d.id = di.device_id WHERE di.ip_id = $1 ORDER BY di.role = 'normal' DESC, d.name`,
        [ipId]
      ),
      client.query(
        `SELECT srv.id, srv.name, sv.role FROM server_ip sv JOIN servers srv ON srv.id = sv.server_id WHERE sv.ip_id = $1 ORDER BY sv.role = 'normal' DESC, srv.name`,
        [ipId]
      )
    ]);
    return { devices: deviceRes.rows, servers: serverRes.rows };
  }

  /**
   * Get the primary (role='normal') device/server id for an IP, if any.
   * Used to validate "is this IP already the primary assignment of a
   * DIFFERENT device/server" without relying on the deprecated scalar
   * ip_addresses.device_id/server_id columns.
   * @param {number} ipId
   * @param {object} [client=pool]
   * @returns {Promise<{deviceId: number|null, serverId: number|null}>}
   */
  static async getPrimaryOwnerIds(ipId, client = pool) {
    const [d, s] = await Promise.all([
      client.query(`SELECT device_id FROM device_ip WHERE ip_id = $1 AND role = 'normal' LIMIT 1`, [ipId]),
      client.query(`SELECT server_id FROM server_ip WHERE ip_id = $1 AND role = 'normal' LIMIT 1`, [ipId])
    ]);
    return {
      deviceId: d.rows[0] ? d.rows[0].device_id : null,
      serverId: s.rows[0] ? s.rows[0].server_id : null
    };
  }

  /**
   * Recompute ip_addresses.ip_type from the real device_ip/server_ip link
   * count. Not user-editable — always derived, called after any VIP link
   * add/remove so it can never drift out of sync.
   * @param {number} ipId
   * @param {object} [client=pool]
   */
  static async recomputeIpType(ipId, client = pool) {
    await client.query(`
      UPDATE ip_addresses SET ip_type = CASE WHEN (
        (SELECT COUNT(*) FROM device_ip WHERE ip_id = $1) +
        (SELECT COUNT(*) FROM server_ip WHERE ip_id = $1)
      ) > 1 THEN 'vip' ELSE 'physical' END
      WHERE id = $1
    `, [ipId]);
  }

  /**
   * Add a secondary ('vip') device or server link to an IP that already has
   * a primary owner elsewhere. Exactly one of device_id/server_id must be set.
   * @param {Object} params
   * @param {number} params.ip_id
   * @param {number} [params.device_id]
   * @param {number} [params.server_id]
   * @param {string} [params.updated_by]
   * @param {object} [client=pool]
   */
  static async addVipLink({ ip_id, device_id, server_id, updated_by }, client = pool) {
    if (device_id) {
      await client.query(
        `INSERT INTO device_ip (device_id, ip_id, role, updated_by) VALUES ($1, $2, 'vip', $3) ON CONFLICT (device_id, ip_id) DO NOTHING`,
        [device_id, ip_id, updated_by]
      );
    }
    if (server_id) {
      await client.query(
        `INSERT INTO server_ip (server_id, ip_id, role, updated_by) VALUES ($1, $2, 'vip', $3) ON CONFLICT (server_id, ip_id) DO NOTHING`,
        [server_id, ip_id, updated_by]
      );
    }
    await IpAddress.recomputeIpType(ip_id, client);
  }

  /**
   * Remove a device or server link from an IP (used to detach a VIP link).
   * Exactly one of device_id/server_id must be set.
   * @param {Object} params
   * @param {number} params.ip_id
   * @param {number} [params.device_id]
   * @param {number} [params.server_id]
   * @param {object} [client=pool]
   */
  static async removeVipLink({ ip_id, device_id, server_id }, client = pool) {
    if (device_id) {
      await client.query('DELETE FROM device_ip WHERE device_id = $1 AND ip_id = $2', [device_id, ip_id]);
    }
    if (server_id) {
      await client.query('DELETE FROM server_ip WHERE server_id = $1 AND ip_id = $2', [server_id, ip_id]);
    }
    await IpAddress.recomputeIpType(ip_id, client);
  }

  /**
   * Search across ALL IP addresses (assigned or not) for the "Assign VIP IP"
   * picker — unlike findUnassignIP this intentionally includes IPs that
   * already have an owner, since VIP assignment means adding a second owner.
   * @param {Object} params
   * @param {string} [params.search='']
   * @param {number} [params.excludeDeviceId] - hide IPs already linked to this device
   * @param {number} [params.excludeServerId] - hide IPs already linked to this server
   * @param {number} [params.limit=20]
   * @returns {Promise<Array<{id:number, ip_address:string, owner_label:string|null}>>}
   */
  static async searchAllForVip({ search = '', excludeDeviceId, excludeServerId, limit = 20 }) {
    const params = [`%${search}%`];
    let idx = 2;
    let excludeClause = '';
    if (excludeDeviceId) {
      excludeClause += ` AND NOT EXISTS (SELECT 1 FROM device_ip WHERE ip_id = ip.id AND device_id = $${idx})`;
      params.push(excludeDeviceId);
      idx++;
    }
    if (excludeServerId) {
      excludeClause += ` AND NOT EXISTS (SELECT 1 FROM server_ip WHERE ip_id = ip.id AND server_id = $${idx})`;
      params.push(excludeServerId);
      idx++;
    }
    params.push(limit);
    const sql = `
      SELECT ip.id, ip.ip_address,
        (SELECT d.name FROM device_ip di JOIN devices d ON d.id = di.device_id WHERE di.ip_id = ip.id AND di.role = 'normal' LIMIT 1) AS owner_device,
        (SELECT srv.name FROM server_ip sv JOIN servers srv ON srv.id = sv.server_id WHERE sv.ip_id = ip.id AND sv.role = 'normal' LIMIT 1) AS owner_server
      FROM ip_addresses ip
      WHERE ip.ip_address::text ILIKE $1 ${excludeClause}
      ORDER BY ip.ip_address
      LIMIT $${idx}
    `;
    const result = await pool.query(sql, params);
    return result.rows.map(row => ({
      id: row.id,
      ip_address: row.ip_address,
      owner_label: row.owner_device || row.owner_server || null
    }));
  }

  /**
   * Derive row.device/row.server (single, primary-owner) from the aggregated
   * row.devices/row.servers arrays. Mutates and returns row.
   * @param {Object} row
   */
  static _attachOwners(row) {
    row.devices = Array.isArray(row.devices) ? row.devices : JSON.parse(row.devices || '[]');
    row.servers = Array.isArray(row.servers) ? row.servers : JSON.parse(row.servers || '[]');
    row.device = row.devices.find(o => o.role === 'normal') || row.devices[0] || null;
    row.server = row.servers.find(o => o.role === 'normal') || row.servers[0] || null;
    return row;
  }

  /**
   * Get subnet information for an IP address
   * Returns the most specific subnet (longest prefix) that contains this IP
   * @param {string} ipAddress - IP address to find subnet for
   * @returns {Promise<Object|null>} Returns subnet info with zone and environment or null if not found
   */
  static async getSubnetInfo(ipAddress) {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.address,
        s.description,
        s.zone,
        s.environment,
        masklen(s.address) as prefix_length
      FROM subnets s
      WHERE s.address >>= $1::inet
      ORDER BY masklen(s.address) DESC
      LIMIT 1
    `, [ipAddress]);
    
    if (result.rows.length === 0) return null;
    
    return result.rows[0];
  }
}

// Export the IpAddress model
export default IpAddress;
