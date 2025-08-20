import { pool } from '../../config/config.js';

/**
 * PrivUser Model - handles all database operations for privileged users and their relationships.
 * Naming convention: All methods use get/set prefix for clarity and consistency.
 */

class PrivUser {
  /**
   * Find filtered list of privileged users with pagination and details.
   * @param {Object} params - { search, system_ids, organize_id, contact_ids, page, pageSize }
   * @returns {Array} users with details
   */
  static async findFilteredList({ search = '', system_ids = [], organize_id = '', contact_ids = [], page = 1, pageSize = 10 }) {
    let where = [];
    let params = [];
    let idx = 1;
    if (search) {
      where.push('(pu.username ILIKE $' + idx + ' OR pu.description ILIKE $' + idx + ')');
      params.push(`%${search}%`);
      idx++;
    }
    if (system_ids && system_ids.length) {
      where.push('EXISTS (SELECT 1 FROM priv_user_systems pus WHERE pus.user_id = pu.id AND pus.system_id = ANY($' + idx + '))');
      params.push(system_ids);
      idx++;
    }
    if (organize_id) {
      where.push('pu.organize_id = $' + idx);
      params.push(organize_id);
      idx++;
    }
    if (contact_ids && contact_ids.length) {
      where.push('EXISTS (SELECT 1 FROM priv_user_contacts puc WHERE puc.user_id = pu.id AND puc.contact_id = ANY($' + idx + '))');
      params.push(contact_ids);
      idx++;
    }
    let whereClause = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    params.push(pageSize, (page - 1) * pageSize);
    const sql = `
      SELECT DISTINCT pu.* 
      FROM priv_users pu
      ${whereClause}
      ORDER BY pu.id
      LIMIT $${params.length - 1} 
      OFFSET $${params.length}
    `;
    const result = await pool.query(sql, params);
    const users = result.rows;
    // Load details for each user (contacts, systems, organize, role, servers)
    for (const user of users) {
      // Contacts
      const contactRows = await pool.query(
        `SELECT c.id, c.name, c.email 
         FROM priv_user_contacts puc 
         JOIN contacts c ON puc.contact_id = c.id 
         WHERE puc.user_id = $1`,
        [user.id]
      );
      user.contacts = contactRows.rows;
      // Systems
      const systemRows = await pool.query(
        `SELECT s.id, s.name 
         FROM priv_user_systems pus 
         JOIN systems s ON pus.system_id = s.id 
         WHERE pus.user_id = $1`,
        [user.id]
      );
      user.systems = systemRows.rows;
      // Organize
      if (user.organize_id) {
        const orgRows = await pool.query('SELECT id, name FROM units WHERE id = $1', [user.organize_id]);
        user.organize = orgRows.rows[0];
      }
      // Role
      if (user.role_id) {
        const roleRows = await pool.query('SELECT id, name FROM priv_roles WHERE id = $1', [user.role_id]);
        user.role = roleRows.rows[0];
      }
      // Servers
      if (user.account_type === 'OS' || user.account_type === 'DB') {
        const serverRows = await pool.query(
          `SELECT s.id, s.name 
           FROM priv_user_servers pus 
           JOIN servers s ON pus.server_id = s.id 
           WHERE pus.user_id = $1`,
          [user.id]
        );
        user.servers = serverRows.rows;
      }
    }
    return users;
  }

  /**
   * Count filtered privileged users (for pagination)
   * @param {Object} params - { search, system_ids, organize_id, contact_ids }
   * @returns {number}
   */
  static async countFilteredList({ search = '', system_ids = [], organize_id = '', contact_ids = [] }) {
    let where = [];
    let params = [];
    let idx = 1;
    if (search) {
      where.push('(pu.username ILIKE $' + idx + ' OR pu.description ILIKE $' + idx + ')');
      params.push(`%${search}%`);
      idx++;
    }
    if (system_ids && system_ids.length) {
      where.push('EXISTS (SELECT 1 FROM priv_user_systems pus WHERE pus.user_id = pu.id AND pus.system_id = ANY($' + idx + '))');
      params.push(system_ids);
      idx++;
    }
    if (organize_id) {
      where.push('pu.organize_id = $' + idx);
      params.push(organize_id);
      idx++;
    }
    if (contact_ids && contact_ids.length) {
      where.push('EXISTS (SELECT 1 FROM priv_user_contacts puc WHERE puc.user_id = pu.id AND puc.contact_id = ANY($' + idx + '))');
      params.push(contact_ids);
      idx++;
    }
    let whereClause = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    const countSql = `
      SELECT COUNT(DISTINCT pu.id) 
      FROM priv_users pu
      ${whereClause}
    `;
    const countResult = await pool.query(countSql, params);
    return parseInt(countResult.rows[0].count, 10);
  }
  // ===== CRUD METHODS =====


  /**
   * Create a privileged user (only priv_users table)
   * @param {Object} params - { username, description, organize_id, role_id, account_type, manage_type, app_url, updated_by }
   * @param {object} client - optional pg client for transaction
   * @returns {Object} created user
   */
  static async create({ username, description, organize_id, role_id, account_type, manage_type, app_url, updated_by, client = pool }) {
    const res = await client.query(
      `INSERT INTO priv_users (username, description, organize_id, role_id, account_type, manage_type, app_url, created_at, updated_date, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8) RETURNING *`,
      [username, description, organize_id || null, role_id || null, account_type, manage_type, app_url || null, updated_by || username]
    );
    return res.rows[0];
  }

  /**
   * Add contacts to a privileged user (helper for transaction)
   */
  static async addContacts(userId, contactIds, client = pool) {
    for (const contactId of contactIds) {
      if (contactId) {
        await client.query('INSERT INTO priv_user_contacts (user_id, contact_id) VALUES ($1, $2)', [userId, contactId]);
      }
    }
  }

  /**
   * Add systems to a privileged user (helper for transaction)
   */
  static async addSystems(userId, systemIds, client = pool) {
    for (const systemId of systemIds) {
      if (systemId) {
        await client.query('INSERT INTO priv_user_systems (user_id, system_id) VALUES ($1, $2)', [userId, systemId]);
      }
    }
  }

  /**
   * Add servers to a privileged user (helper for transaction)
   */
  static async addServers(userId, serverIds, client = pool) {
    for (const serverId of serverIds) {
      if (serverId) {
        await client.query('INSERT INTO priv_user_servers (user_id, server_id) VALUES ($1, $2)', [userId, serverId]);
      }
    }
  }

  static async findAll() {
    const res = await pool.query('SELECT * FROM priv_users ORDER BY id');
    return res.rows;
  }

  static async findById(id) {
    const res = await pool.query('SELECT * FROM priv_users WHERE id = $1', [id]);
    return res.rows[0];
  }

  static async update(id, { username, description, client = pool }) {
    const res = await client.query(
      'UPDATE priv_users SET username = $1, description = $2, updated_date = NOW() WHERE id = $3 RETURNING *',
      [username, description, id]
    );
    return res.rows[0];
  }

  static async remove(id, client = pool) {
    await client.query('DELETE FROM priv_users WHERE id = $1', [id]);
  }



  static async getByIdWithDetails(id) {
    const res = await pool.query('SELECT * FROM priv_users WHERE id = $1', [id]);
    if (!res.rows.length) return null;
    const user = res.rows[0];
    const contactRows = await pool.query(
      `SELECT puc.user_id, c.id, c.name, c.email FROM priv_user_contacts puc JOIN contacts c ON puc.contact_id = c.id WHERE puc.user_id = $1`,
      [user.id]
    );
    const systemRows = await pool.query(
      `SELECT pus.user_id, s.id, s.name FROM priv_user_systems pus JOIN systems s ON pus.system_id = s.id WHERE pus.user_id = $1`,
      [user.id]
    );
    const serverRows = await pool.query(
      `SELECT pus.user_id, s.id, s.name FROM priv_user_servers pus JOIN servers s ON pus.server_id = s.id WHERE pus.user_id = $1`,
      [user.id]
    );
    let organize = null;
    if (user.organize_id) {
      const orgRows = await pool.query('SELECT id, name FROM units WHERE id = $1', [user.organize_id]);
      organize = orgRows.rows[0] || null;
    }
    let role = null;
    if (user.role_id) {
      const roleRows = await pool.query('SELECT id, name FROM priv_roles WHERE id = $1', [user.role_id]);
      role = roleRows.rows[0] || null;
    }
    user.contacts = contactRows.rows.map(r => ({ id: r.id, name: r.name, email: r.email }));
    user.systems = systemRows.rows.map(r => ({ id: r.id, name: r.name }));
    user.servers = serverRows.rows.map(r => ({ id: r.id, name: r.name }));
    user.organize = organize;
    user.role = role;
    return user;
  }

    /**
   * Set contacts for a privileged user (removes all and adds new)
   * @param {number} userId
   * @param {Array} contactIds
   * @param {object} client
   */
  static async setContacts(userId, contactIds, client = pool) {
    await client.query('DELETE FROM priv_user_contacts WHERE user_id = $1', [userId]);
    for (const contactId of contactIds) {
      if (contactId) {
        await client.query('INSERT INTO priv_user_contacts (user_id, contact_id) VALUES ($1, $2)', [userId, contactId]);
      }
    }
  }

  /**
   * Set systems for a privileged user (removes all and adds new)
   * @param {number} userId
   * @param {Array} systemIds
   * @param {object} client
   */
  static async setSystems(userId, systemIds, client = pool) {
    await client.query('DELETE FROM priv_user_systems WHERE user_id = $1', [userId]);
    for (const systemId of systemIds) {
      if (systemId) {
        await client.query('INSERT INTO priv_user_systems (user_id, system_id) VALUES ($1, $2)', [userId, systemId]);
      }
    }
  }

  /**
   * Set servers for a privileged user (removes all and adds new)
   * @param {number} userId
   * @param {Array} serverIds
   * @param {object} client
   */
  static async setServers(userId, serverIds, client = pool) {
    await client.query('DELETE FROM priv_user_servers WHERE user_id = $1', [userId]);
    for (const serverId of serverIds) {
      if (serverId) {
        await client.query('INSERT INTO priv_user_servers (user_id, server_id) VALUES ($1, $2)', [userId, serverId]);
      }
    }
  }
}

export default PrivUser;
