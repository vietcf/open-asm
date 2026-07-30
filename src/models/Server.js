import { pool } from '../../config/config.js';
import IpAddress from './IpAddress.js';

class Server {
  static async create({ name, os, status, location, type, description, username, client }) {
    const res = await client.query(
      'INSERT INTO servers (name, os_id, status, location, type, description, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, os, status, location, type, description || null, username]
    );
    return res.rows[0].id;
  }

  static async findAll() {
    const res = await pool.query('SELECT * FROM servers ORDER BY updated_at DESC');
    return res.rows;
  }

  static async findById(id) {
    const res = await pool.query(`
      SELECT s.*, p.name AS platform_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address, 'role', svi.role)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name)) FILTER (WHERE c.id IS NOT NULL), '[]') AS managers,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', sys.id, 'name', sys.name)) FILTER (WHERE sys.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ssv.id, 'name', ssv.name)) FILTER (WHERE ssv.id IS NOT NULL), '[]') AS services,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name, 'version', ag.version)) FILTER (WHERE ag.id IS NOT NULL), '[]') AS agents
      FROM servers s
      LEFT JOIN platforms p ON p.id = s.os_id
      LEFT JOIN server_ip svi ON svi.server_id = s.id
      LEFT JOIN ip_addresses ip ON ip.id = svi.ip_id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN server_contact sc ON sc.server_id = s.id
      LEFT JOIN contacts c ON c.id = sc.contact_id
      LEFT JOIN server_system ss ON ss.server_id = s.id
      LEFT JOIN systems sys ON sys.id = ss.system_id
      LEFT JOIN server_services sss ON sss.server_id = s.id
      LEFT JOIN services ssv ON ssv.id = sss.service_id
      LEFT JOIN server_agents sa ON sa.server_id = s.id
      LEFT JOIN agents ag ON ag.id = sa.agent_id
      WHERE s.id = $1
      GROUP BY s.id, p.name
    `, [id]);
    const server = res.rows[0];
    if (!server) return null;
    // Parse JSON fields
    server.ip = Array.isArray(server.ip) ? server.ip : JSON.parse(server.ip);
    server.tags = Array.isArray(server.tags) ? server.tags : JSON.parse(server.tags);
    server.managers = Array.isArray(server.managers) ? server.managers : JSON.parse(server.managers);
    server.systems = Array.isArray(server.systems) ? server.systems : JSON.parse(server.systems);
    server.services = Array.isArray(server.services) ? server.services : JSON.parse(server.services);
    server.agents = Array.isArray(server.agents) ? server.agents : JSON.parse(server.agents);
    return server;
  }

  static async update(id, { name, os, status, location, type, description, username, client }) {
    await client.query(
      'UPDATE servers SET name=$1, os_id=$2, status=$3, location=$4, type=$5, description=$6, updated_at=NOW(), updated_by=$7 WHERE id=$8',
      [name, os, status, location, type, description || null, username, id]
    );
  }

  static async remove(id, client = pool, { deleteIp = false } = {}) {
    await client.query('DELETE FROM server_contact WHERE server_id = $1', [id]);
    await client.query('DELETE FROM server_system WHERE server_id = $1', [id]);
    await client.query('DELETE FROM server_agents WHERE server_id = $1', [id]);
    await client.query('DELETE FROM server_services WHERE server_id = $1', [id]);

    const { rows: ipRows } = await client.query('SELECT ip_id FROM server_ip WHERE server_id = $1', [id]);
    const ipIds = ipRows.map(r => r.ip_id);

    // server_ip rows for this server are removed automatically (ON DELETE CASCADE)
    await client.query('DELETE FROM servers WHERE id = $1', [id]);

    if (ipIds.length > 0) {
      // Only touch IPs that have no other device/server (primary or VIP) left
      if (deleteIp) {
        await client.query(
          `DELETE FROM ip_addresses WHERE id = ANY($1)
           AND id NOT IN (SELECT ip_id FROM device_ip UNION SELECT ip_id FROM server_ip)`,
          [ipIds]
        );
      } else {
        await client.query(
          `UPDATE ip_addresses SET status = 'reserved' WHERE id = ANY($1)
           AND id NOT IN (SELECT ip_id FROM device_ip UNION SELECT ip_id FROM server_ip)`,
          [ipIds]
        );
      }
    }
  }

  // Replaces the server's PRIMARY IP assignments only — VIP links (role='vip')
  // added via setVipIps are left untouched.
  static async setIpAddresses(serverId, ipIds, client) {
    const { rows: oldRows } = await client.query(
      "SELECT ip_id FROM server_ip WHERE server_id = $1 AND role = 'normal'",
      [serverId]
    );
    const oldIpIds = oldRows.map(r => r.ip_id);
    await client.query("DELETE FROM server_ip WHERE server_id = $1 AND role = 'normal'", [serverId]);
    if (oldIpIds.length > 0) {
      await client.query('UPDATE ip_addresses SET status = NULL WHERE id = ANY($1)', [oldIpIds]);
    }
    for (const ipId of ipIds) {
      await client.query(
        `INSERT INTO server_ip (server_id, ip_id, role) VALUES ($1, $2, 'normal')
         ON CONFLICT (server_id, ip_id) DO UPDATE SET role = 'normal'`,
        [serverId, ipId]
      );
      await client.query('UPDATE ip_addresses SET status = $1 WHERE id = $2', ['assigned', ipId]);
    }
  }

  // Replaces the server's VIP ('vip'-role) IP links — the IPs may already
  // have a primary owner elsewhere; that's the whole point of a shared/VIP
  // IP. Same "full replace" semantics as setIpAddresses, but for role='vip'.
  static async setVipIps(serverId, vipIpIds, updated_by, client = pool) {
    const { rows: oldRows } = await client.query(
      "SELECT ip_id FROM server_ip WHERE server_id = $1 AND role = 'vip'",
      [serverId]
    );
    const oldIds = oldRows.map(r => r.ip_id);
    const newIds = (vipIpIds || []).map(id => Number(id));
    for (const ipId of oldIds) {
      if (!newIds.includes(ipId)) {
        await IpAddress.removeVipLink({ ip_id: ipId, server_id: serverId }, client);
      }
    }
    for (const ipId of newIds) {
      if (!oldIds.includes(ipId)) {
        await IpAddress.addVipLink({ ip_id: ipId, server_id: serverId, updated_by }, client);
      }
    }
  }

  static async setManagers(serverId, managerList, client) {
    await client.query('DELETE FROM server_contact WHERE server_id = $1', [serverId]);
    for (const contactId of managerList) {
      if (contactId && !isNaN(Number(contactId)) && Number(contactId) > 0) {
        await client.query('INSERT INTO server_contact (server_id, contact_id) VALUES ($1, $2)', [serverId, contactId]);
      }
    }
  }

  static async setSystems(serverId, systemList, client) {
    await client.query('DELETE FROM server_system WHERE server_id = $1', [serverId]);
    for (const systemId of systemList) {
      if (systemId && !isNaN(Number(systemId)) && Number(systemId) > 0) {
        await client.query('INSERT INTO server_system (server_id, system_id) VALUES ($1, $2)', [serverId, systemId]);
      }
    }
  }

  static async setAgents(serverId, agentList, client) {
    await client.query('DELETE FROM server_agents WHERE server_id = $1', [serverId]);
    for (const agentId of agentList) {
      if (agentId && !isNaN(Number(agentId)) && Number(agentId) > 0) {
        await client.query('INSERT INTO server_agents (server_id, agent_id) VALUES ($1, $2)', [serverId, agentId]);
      }
    }
  }

  static async setServices(serverId, serviceList, client) {
    await client.query('DELETE FROM server_services WHERE server_id = $1', [serverId]);
    for (const serviceId of serviceList) {
      if (serviceId && !isNaN(Number(serviceId)) && Number(serviceId) > 0) {
        await client.query('INSERT INTO server_services (server_id, service_id) VALUES ($1, $2)', [serverId, serviceId]);
      }
    }
  }

  static async setTags(serverId, tagList, client) {
    await client.query('DELETE FROM tag_object WHERE object_type = $1 AND object_id = $2', ['server', serverId]);
    for (const tagId of tagList) {
      if (tagId && !isNaN(Number(tagId)) && Number(tagId) > 0) {
        await client.query(
          "INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, 'server', $2) ON CONFLICT DO NOTHING",
          [tagId, serverId]
        );
      }
    }
  }

  static async getIpAddresses(serverId) {
    const result = await pool.query(
      `SELECT ip.ip_address FROM server_ip sv
       JOIN ip_addresses ip ON ip.id = sv.ip_id
       WHERE sv.server_id = $1`,
      [serverId]
    );
    return result.rows.map(r => r.ip_address);
  }

  static async getTags(serverId) {
    const result = await pool.query('SELECT t.id, t.name FROM tag_object tobj JOIN tags t ON tobj.tag_id = t.id WHERE tobj.object_type = $1 AND tobj.object_id = $2', ['server', serverId]);
    return result.rows;
  }

  static async findFilteredList({ search, status, type, location, tags, ip, manager, systems, services, os, page = 1, pageSize = 10 }) {
    let params = [];
    let whereClauses = [];
    let joinClauses = [];
    let idx = 1;
    joinClauses.push('LEFT JOIN server_ip svi ON svi.server_id = s.id');
    joinClauses.push('LEFT JOIN ip_addresses ip ON ip.id = svi.ip_id');
    joinClauses.push('LEFT JOIN server_system ss ON ss.server_id = s.id');
    joinClauses.push('LEFT JOIN systems sys ON sys.id = ss.system_id');
    joinClauses.push('LEFT JOIN server_contact sc ON sc.server_id = s.id');
    joinClauses.push('LEFT JOIN contacts c ON c.id = sc.contact_id');
    joinClauses.push('LEFT JOIN platforms p ON p.id = s.os_id');
    joinClauses.push("LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id");
    joinClauses.push('LEFT JOIN tags t ON t.id = tobj.tag_id');
    joinClauses.push('LEFT JOIN server_agents sa ON sa.server_id = s.id');
    joinClauses.push('LEFT JOIN agents ag ON ag.id = sa.agent_id');
    joinClauses.push('LEFT JOIN server_services ssr ON ssr.server_id = s.id');
    joinClauses.push('LEFT JOIN services sv ON sv.id = ssr.service_id');
    if (status) {
      whereClauses.push(`s.status = $${idx}`);
      params.push(status);
      idx++;
    }
    // '__none__' means "no type set" (IS NULL).
    if (type === '__none__') {
      whereClauses.push(`(s.type IS NULL OR s.type = '')`);
    } else if (type) {
      whereClauses.push(`s.type = $${idx}`);
      params.push(type);
      idx++;
    }

    // '__none__' means "no OS set". os is always an array on the backend even
    // though the UI is single-select, so a real value and '__none__' could in
    // theory both be present - handled the same OR-combined way as elsewhere.
    if (os && os.length > 0) {
      const noneOsSelected = os.includes('__none__');
      const realOs = os.filter(v => v !== '__none__');
      const noneOsClause = `s.os_id IS NULL`;
      if (realOs.length > 0) {
        const matchClause = `s.os_id = ANY($${idx})`;
        whereClauses.push(noneOsSelected ? `(${noneOsClause} OR ${matchClause})` : matchClause);
        params.push(realOs);
        idx++;
      } else if (noneOsSelected) {
        whereClauses.push(noneOsClause);
      }
    }
    // '__none__' means "no location set" (IS NULL/empty).
    if (location === '__none__') {
      whereClauses.push(`(s.location IS NULL OR s.location = '')`);
    } else if (location) {
      whereClauses.push(`s.location ILIKE $${idx}`);
      params.push(location);
      idx++;
    }
    if (tags && tags.length > 0) {
      whereClauses.push(`s.id IN (SELECT object_id FROM tag_object WHERE object_type = 'server' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    if (ip && ip.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_ip WHERE ip_id = ANY($${idx}))`);
      params.push(ip);
      idx++;
    }
    // '__none__' means "no manager/contact assigned" (NOT EXISTS).
    if (manager && manager.length > 0) {
      const noneManagerSelected = manager.includes('__none__');
      const realManagerIds = manager.filter(id => id !== '__none__');
      const noneManagerClause = `NOT EXISTS (SELECT 1 FROM server_contact sct2 WHERE sct2.server_id = s.id)`;
      if (realManagerIds.length > 0) {
        const inClause = `s.id IN (SELECT server_id FROM server_contact WHERE contact_id = ANY($${idx}))`;
        whereClauses.push(noneManagerSelected ? `(${noneManagerClause} OR ${inClause})` : inClause);
        params.push(realManagerIds);
        idx++;
      } else if (noneManagerSelected) {
        whereClauses.push(noneManagerClause);
      }
    }
    // '__none__' means "no system assigned" (NOT EXISTS).
    if (systems && systems.length > 0) {
      const noneSystemSelected = systems.includes('__none__');
      const realSystemIds = systems.filter(id => id !== '__none__');
      const noneSystemClause = `NOT EXISTS (SELECT 1 FROM server_system sys2 WHERE sys2.server_id = s.id)`;
      if (realSystemIds.length > 0) {
        const inClause = `s.id IN (SELECT server_id FROM server_system WHERE system_id = ANY($${idx}))`;
        whereClauses.push(noneSystemSelected ? `(${noneSystemClause} OR ${inClause})` : inClause);
        params.push(realSystemIds);
        idx++;
      } else if (noneSystemSelected) {
        whereClauses.push(noneSystemClause);
      }
    }
    if (services && services.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_services WHERE service_id = ANY($${idx}))`);
      params.push(services);
      idx++;
    }
    if (search) {
      whereClauses.push(`(LOWER(s.name) LIKE $${idx} OR LOWER(s.description) LIKE $${idx} OR s.id IN (SELECT sv.server_id FROM server_ip sv JOIN ip_addresses ip3 ON ip3.id = sv.ip_id WHERE ip3.ip_address::text ILIKE $${idx}))`);
      params.push(`%${search}%`);
      idx++;
    }
    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const joins = joinClauses.join(' ');
    const offset = (page - 1) * pageSize;
    // Sử dụng json_agg để tổng hợp các trường liên quan
    const sql = `SELECT s.*, p.name AS platform_name,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address, 'role', svi.role)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)) FILTER (WHERE c.id IS NOT NULL), '[]') AS managers,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', sys.id, 'name', sys.name)) FILTER (WHERE sys.id IS NOT NULL), '[]') AS systems,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', sv.id, 'name', sv.name)) FILTER (WHERE sv.id IS NOT NULL), '[]') AS services,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name, 'version', ag.version)) FILTER (WHERE ag.id IS NOT NULL), '[]') AS agents
      FROM servers s ${joins} ${where} 
      GROUP BY s.id, p.name
      ORDER BY s.updated_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(pageSize, offset);
    const res = await pool.query(sql, params);
    // Parse các trường JSON nếu cần
    return res.rows.map(server => {
      server.ip = Array.isArray(server.ip) ? server.ip : JSON.parse(server.ip);
      server.tags = Array.isArray(server.tags) ? server.tags : JSON.parse(server.tags);
      server.managers = Array.isArray(server.managers) ? server.managers : JSON.parse(server.managers);
      server.systems = Array.isArray(server.systems) ? server.systems : JSON.parse(server.systems);
      server.services = Array.isArray(server.services) ? server.services : JSON.parse(server.services);
      server.agents = Array.isArray(server.agents) ? server.agents : JSON.parse(server.agents);
      return server;
    });
  }

  static async countFiltered({ search, status, type, location, tags, ip, manager, systems, services, os }) {
    let params = [];
    let whereClauses = [];
    let joinClauses = [];
    let idx = 1;
    joinClauses.push('LEFT JOIN server_ip svi ON svi.server_id = s.id');
    joinClauses.push('LEFT JOIN ip_addresses ip ON ip.id = svi.ip_id');
    joinClauses.push('LEFT JOIN server_system ss ON ss.server_id = s.id');
    joinClauses.push('LEFT JOIN systems sys ON sys.id = ss.system_id');
    joinClauses.push('LEFT JOIN server_contact sc ON sc.server_id = s.id');
    joinClauses.push('LEFT JOIN contacts c ON c.id = sc.contact_id');
    joinClauses.push('LEFT JOIN platforms p ON p.id = s.os_id');
    joinClauses.push("LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id");
    joinClauses.push('LEFT JOIN tags t ON t.id = tobj.tag_id');
    joinClauses.push('LEFT JOIN server_agents sa ON sa.server_id = s.id');
    joinClauses.push('LEFT JOIN agents ag ON ag.id = sa.agent_id');
    joinClauses.push('LEFT JOIN server_services ssr ON ssr.server_id = s.id');
    joinClauses.push('LEFT JOIN services sv ON sv.id = ssr.service_id');
    if (status) {
      whereClauses.push(`s.status = $${idx}`);
      params.push(status);
      idx++;
    }
    // '__none__' means "no type set" (IS NULL).
    if (type === '__none__') {
      whereClauses.push(`(s.type IS NULL OR s.type = '')`);
    } else if (type) {
      whereClauses.push(`s.type = $${idx}`);
      params.push(type);
      idx++;
    }

    // '__none__' means "no OS set". os is always an array on the backend even
    // though the UI is single-select, so a real value and '__none__' could in
    // theory both be present - handled the same OR-combined way as elsewhere.
    if (os && os.length > 0) {
      const noneOsSelected = os.includes('__none__');
      const realOs = os.filter(v => v !== '__none__');
      const noneOsClause = `s.os_id IS NULL`;
      if (realOs.length > 0) {
        const matchClause = `s.os_id = ANY($${idx})`;
        whereClauses.push(noneOsSelected ? `(${noneOsClause} OR ${matchClause})` : matchClause);
        params.push(realOs);
        idx++;
      } else if (noneOsSelected) {
        whereClauses.push(noneOsClause);
      }
    }
    // '__none__' means "no location set" (IS NULL/empty).
    if (location === '__none__') {
      whereClauses.push(`(s.location IS NULL OR s.location = '')`);
    } else if (location) {
      whereClauses.push(`s.location ILIKE $${idx}`);
      params.push(location);
      idx++;
    }
    if (tags && tags.length > 0) {
      whereClauses.push(`s.id IN (SELECT object_id FROM tag_object WHERE object_type = 'server' AND tag_id = ANY($${idx}))`);
      params.push(tags);
      idx++;
    }
    if (ip && ip.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_ip WHERE ip_id = ANY($${idx}))`);
      params.push(ip);
      idx++;
    }
    // '__none__' means "no manager/contact assigned" (NOT EXISTS).
    if (manager && manager.length > 0) {
      const noneManagerSelected = manager.includes('__none__');
      const realManagerIds = manager.filter(id => id !== '__none__');
      const noneManagerClause = `NOT EXISTS (SELECT 1 FROM server_contact sct2 WHERE sct2.server_id = s.id)`;
      if (realManagerIds.length > 0) {
        const inClause = `s.id IN (SELECT server_id FROM server_contact WHERE contact_id = ANY($${idx}))`;
        whereClauses.push(noneManagerSelected ? `(${noneManagerClause} OR ${inClause})` : inClause);
        params.push(realManagerIds);
        idx++;
      } else if (noneManagerSelected) {
        whereClauses.push(noneManagerClause);
      }
    }
    // '__none__' means "no system assigned" (NOT EXISTS).
    if (systems && systems.length > 0) {
      const noneSystemSelected = systems.includes('__none__');
      const realSystemIds = systems.filter(id => id !== '__none__');
      const noneSystemClause = `NOT EXISTS (SELECT 1 FROM server_system sys2 WHERE sys2.server_id = s.id)`;
      if (realSystemIds.length > 0) {
        const inClause = `s.id IN (SELECT server_id FROM server_system WHERE system_id = ANY($${idx}))`;
        whereClauses.push(noneSystemSelected ? `(${noneSystemClause} OR ${inClause})` : inClause);
        params.push(realSystemIds);
        idx++;
      } else if (noneSystemSelected) {
        whereClauses.push(noneSystemClause);
      }
    }
    if (services && services.length > 0) {
      whereClauses.push(`s.id IN (SELECT server_id FROM server_services WHERE service_id = ANY($${idx}))`);
      params.push(services);
      idx++;
    }
    if (search) {
      whereClauses.push(`(LOWER(s.name) LIKE $${idx} OR LOWER(s.description) LIKE $${idx} OR s.id IN (SELECT sv.server_id FROM server_ip sv JOIN ip_addresses ip3 ON ip3.id = sv.ip_id WHERE ip3.ip_address::text ILIKE $${idx}))`);
      params.push(`%${search}%`);
      idx++;
    }
    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const joins = joinClauses.join(' ');
    const sql = `SELECT COUNT(DISTINCT s.id) AS count FROM servers s ${joins} ${where}`;
    const res = await pool.query(sql, params);
    return parseInt(res.rows[0].count, 10);
  }

  // Get full server detail, using JOINs and aggregates for optimal performance
  static async getFullDetail(id) {
    const res = await pool.query(`
      SELECT s.*, p.name AS platform_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address, 'role', svi.role)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)) FILTER (WHERE c.id IS NOT NULL), '[]') AS managers,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', sys.id, 'name', sys.name)) FILTER (WHERE sys.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ssv.id, 'name', ssv.name, 'description', ssv.description)) FILTER (WHERE ssv.id IS NOT NULL), '[]') AS services,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name, 'version', ag.version, 'description', ag.description)) FILTER (WHERE ag.id IS NOT NULL), '[]') AS agents
      FROM servers s
      LEFT JOIN platforms p ON p.id = s.os_id
      LEFT JOIN server_ip svi ON svi.server_id = s.id
      LEFT JOIN ip_addresses ip ON ip.id = svi.ip_id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN server_contact sc ON sc.server_id = s.id
      LEFT JOIN contacts c ON c.id = sc.contact_id
      LEFT JOIN server_system ss ON ss.server_id = s.id
      LEFT JOIN systems sys ON sys.id = ss.system_id
      LEFT JOIN server_services sss ON sss.server_id = s.id
      LEFT JOIN services ssv ON ssv.id = sss.service_id
      LEFT JOIN server_agents sa ON sa.server_id = s.id
      LEFT JOIN agents ag ON ag.id = sa.agent_id
      WHERE s.id = $1
      GROUP BY s.id, p.name
    `, [id]);
    const server = res.rows[0];
    if (!server) return null;
    // Parse JSON fields
    server.ip = Array.isArray(server.ip) ? server.ip : JSON.parse(server.ip);
    server.tags = Array.isArray(server.tags) ? server.tags : JSON.parse(server.tags);
    server.managers = Array.isArray(server.managers) ? server.managers : JSON.parse(server.managers);
    server.systems = Array.isArray(server.systems) ? server.systems : JSON.parse(server.systems);
    server.services = Array.isArray(server.services) ? server.services : JSON.parse(server.services);
    server.agents = Array.isArray(server.agents) ? server.agents : JSON.parse(server.agents);
    return server;
  }

  static async exists(id) {
    const res = await pool.query('SELECT 1 FROM servers WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  /**
   * Find servers by specific criteria (name, ip_address)
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.name - Server name (exact match)
   * @param {string} criteria.ip_address - IP address (exact match)
   * @returns {Promise<Array>} Array of servers with full details
   */
  static async findByCriteria(criteria) {
    let params = [];
    let whereClauses = [];
    let idx = 1;

    // Build WHERE clauses based on criteria
    if (criteria.name) {
      whereClauses.push(`s.name = $${idx}`);
      params.push(criteria.name);
      idx++;
    }

    if (criteria.ip_address) {
      whereClauses.push(`s.id IN (SELECT sv.server_id FROM server_ip sv JOIN ip_addresses ip3 ON ip3.id = sv.ip_id WHERE ip3.ip_address = $${idx})`);
      params.push(criteria.ip_address);
      idx++;
    }

    if (whereClauses.length === 0) {
      return [];
    }

    const sql = `
      SELECT s.*, p.name AS os_name, p.description AS os_description,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address, 'description', ip.description, 'status', ip.status, 'role', svi.role)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip_addresses,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'description', t.description)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone)) FILTER (WHERE c.id IS NOT NULL), '[]') AS managers,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', sys.id, 'name', sys.name, 'system_id', sys.system_id, 'description', sys.description)) FILTER (WHERE sys.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ssv.id, 'name', ssv.name, 'description', ssv.description)) FILTER (WHERE ssv.id IS NOT NULL), '[]') AS services,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name, 'version', ag.version, 'description', ag.description)) FILTER (WHERE ag.id IS NOT NULL), '[]') AS agents
      FROM servers s
      LEFT JOIN platforms p ON p.id = s.os_id
      LEFT JOIN server_ip svi ON svi.server_id = s.id
      LEFT JOIN ip_addresses ip ON ip.id = svi.ip_id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN server_contact sc ON sc.server_id = s.id
      LEFT JOIN contacts c ON c.id = sc.contact_id
      LEFT JOIN server_system ss ON ss.server_id = s.id
      LEFT JOIN systems sys ON sys.id = ss.system_id
      LEFT JOIN server_services sss ON sss.server_id = s.id
      LEFT JOIN services ssv ON ssv.id = sss.service_id
      LEFT JOIN server_agents sa ON sa.server_id = s.id
      LEFT JOIN agents ag ON ag.id = sa.agent_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY s.id, p.name, p.description
      ORDER BY s.updated_at DESC
    `;

    const result = await pool.query(sql, params);
    
    // Parse JSON fields for each server
    return result.rows.map(server => {
      // Create os object if exists
      if (server.os_name) {
        server.os = {
          id: server.os_id,
          name: server.os_name,
          description: server.os_description
        };
      }
      delete server.os_name;
      delete server.os_description;
      
      // Parse JSON arrays
      server.ip_addresses = Array.isArray(server.ip_addresses) ? server.ip_addresses : JSON.parse(server.ip_addresses);
      server.tags = Array.isArray(server.tags) ? server.tags : JSON.parse(server.tags);
      server.managers = Array.isArray(server.managers) ? server.managers : JSON.parse(server.managers);
      server.systems = Array.isArray(server.systems) ? server.systems : JSON.parse(server.systems);
      server.services = Array.isArray(server.services) ? server.services : JSON.parse(server.services);
      server.agents = Array.isArray(server.agents) ? server.agents : JSON.parse(server.agents);
      
      return server;
    });
  }

  static async select2Search({ search = '', limit = 20 }) {
    let sql = 'SELECT id, name FROM servers';
    let params = [];
    if (search) {
      sql += ' WHERE LOWER(name) LIKE $1';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(sql, params);
    // Select2 expects: { results: [ { id, text } ] }
    return result.rows.map(row => ({ id: row.id, text: row.name }));
  }

  /**
   * Find server by ID with full details (similar to findById but with more relationship data)
   * @param {number} id - Server ID
   * @returns {Promise<Object|null>} Server with full details or null if not found
   */
  static async findByIdWithDetails(id) {
    const sql = `
      SELECT s.*, p.name AS os_name, p.description AS os_description,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ip.id, 'ip_address', ip.ip_address, 'description', ip.description, 'status', ip.status, 'role', svi.role)) FILTER (WHERE ip.id IS NOT NULL), '[]') AS ip_addresses,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'description', t.description)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone)) FILTER (WHERE c.id IS NOT NULL), '[]') AS managers,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', sys.id, 'name', sys.name, 'system_id', sys.system_id, 'description', sys.description)) FILTER (WHERE sys.id IS NOT NULL), '[]') AS systems,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ssv.id, 'name', ssv.name, 'description', ssv.description)) FILTER (WHERE ssv.id IS NOT NULL), '[]') AS services,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name, 'version', ag.version, 'description', ag.description)) FILTER (WHERE ag.id IS NOT NULL), '[]') AS agents
      FROM servers s
      LEFT JOIN platforms p ON p.id = s.os_id
      LEFT JOIN server_ip svi ON svi.server_id = s.id
      LEFT JOIN ip_addresses ip ON ip.id = svi.ip_id
      LEFT JOIN tag_object tobj ON tobj.object_type = 'server' AND tobj.object_id = s.id
      LEFT JOIN tags t ON t.id = tobj.tag_id
      LEFT JOIN server_contact sc ON sc.server_id = s.id
      LEFT JOIN contacts c ON c.id = sc.contact_id
      LEFT JOIN server_system ss ON ss.server_id = s.id
      LEFT JOIN systems sys ON sys.id = ss.system_id
      LEFT JOIN server_services sss ON sss.server_id = s.id
      LEFT JOIN services ssv ON ssv.id = sss.service_id
      LEFT JOIN server_agents sa ON sa.server_id = s.id
      LEFT JOIN agents ag ON ag.id = sa.agent_id
      WHERE s.id = $1
      GROUP BY s.id, p.name, p.description
    `;

    const result = await pool.query(sql, [id]);
    if (result.rows.length === 0) return null;
    
    const server = result.rows[0];
    
    // Create os object if exists
    if (server.os_name) {
      server.os = {
        id: server.os_id,
        name: server.os_name,
        description: server.os_description
      };
    }
    delete server.os_name;
    delete server.os_description;
    
    // Parse JSON arrays
    server.ip_addresses = Array.isArray(server.ip_addresses) ? server.ip_addresses : JSON.parse(server.ip_addresses);
    server.tags = Array.isArray(server.tags) ? server.tags : JSON.parse(server.tags);
    server.managers = Array.isArray(server.managers) ? server.managers : JSON.parse(server.managers);
    server.systems = Array.isArray(server.systems) ? server.systems : JSON.parse(server.systems);
    server.services = Array.isArray(server.services) ? server.services : JSON.parse(server.services);
    server.agents = Array.isArray(server.agents) ? server.agents : JSON.parse(server.agents);
    
    return server;
  }

  static async findByName(name) {
    const res = await pool.query('SELECT id, name FROM servers WHERE LOWER(name) = LOWER($1)', [name]);
    return res.rows[0] || null;
  }

  static async findByIPAddress(ipAddress) {
    const res = await pool.query(`
      SELECT DISTINCT s.id, s.name 
      FROM servers s 
      INNER JOIN server_ip svi ON svi.server_id = s.id
      INNER JOIN ip_addresses ip ON ip.id = svi.ip_id
      WHERE ip.ip_address = $1
    `, [ipAddress]);
    return res.rows[0] || null;
  }

}

export default Server;
