import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, jsonList } from '../../shared/db.js';

// Cluster with its systems and members (ip + the server/device owning it)
const SELECT_WITH_LINKS = `
  SELECT cl.*,
    ${jsonList('s', { id: 's.id', name: 's.name' })} AS systems,
    ${jsonList('cm', { id: 'cm.id', ip_address_id: 'ip.id', ip: 'ip.ip_address', role: 'cm.role', server_name: 'srv.name', device_name: 'dev.name' })} AS members
  FROM clusters cl
  LEFT JOIN cluster_system cs ON cs.cluster_id = cl.id
  LEFT JOIN systems s ON s.id = cs.system_id
  LEFT JOIN cluster_members cm ON cm.cluster_id = cl.id
  LEFT JOIN ip_addresses ip ON ip.id = cm.ip_address_id
  LEFT JOIN server_ip svi ON svi.ip_id = ip.id AND svi.role = 'normal'
  LEFT JOIN servers srv ON srv.id = svi.server_id
  LEFT JOIN device_ip di ON di.ip_id = ip.id AND di.role = 'normal'
  LEFT JOIN devices dev ON dev.id = di.device_id`;

// filter: {search, role[], system_id[]}
function filterWhere({ search = '', role = [], system_id = [] }) {
  const w = new Where();
  w.search(search, ['cl.name ILIKE ?', 'cl.description ILIKE ?',
    'EXISTS (SELECT 1 FROM cluster_members x JOIN ip_addresses i ON i.id = x.ip_address_id WHERE x.cluster_id = cl.id AND i.ip_address::text ILIKE ?)']);
  const roles = [].concat(role || []).filter(Boolean);
  if (roles.length) w.add(`EXISTS (SELECT 1 FROM cluster_members x WHERE x.cluster_id = cl.id AND x.role = ANY(${w.param(roles)}))`);
  const systems = [].concat(system_id || []).filter(Boolean).map(Number);
  if (systems.length) w.add(`EXISTS (SELECT 1 FROM cluster_system x WHERE x.cluster_id = cl.id AND x.system_id = ANY(${w.param(systems)}))`);
  return w;
}

class Cluster {
  static async create({ name, description, updated_by }, client) {
    const result = await db(client).query('INSERT INTO clusters (name, description, updated_by) VALUES ($1, $2, $3) RETURNING *', [name, description || null, updated_by]);
    return result.rows[0];
  }

  static async update(id, { name, description, updated_by }, client) {
    const result = await db(client).query(
      'UPDATE clusters SET name = $1, description = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [name, description || null, updated_by, id]
    );
    return result.rows[0];
  }

  // Members and system links cascade
  static async delete(id, client) {
    await db(client).query('DELETE FROM clusters WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM clusters WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM clusters WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async findByNameExact(name) {
    const result = await pool.query('SELECT * FROM clusters WHERE LOWER(name) = LOWER($1) ORDER BY id', [name]);
    return result.rows;
  }

  static async findByIdWithRelations(id, client) {
    const result = await db(client).query(`${SELECT_WITH_LINKS} WHERE cl.id = $1 GROUP BY cl.id`, [id]);
    return result.rows[0] || null;
  }

  // Clusters serving one system (System detail)
  static async findBySystemId(systemId) {
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE EXISTS (SELECT 1 FROM cluster_system x WHERE x.cluster_id = cl.id AND x.system_id = $1) GROUP BY cl.id ORDER BY cl.id DESC`,
      [systemId]
    );
    return result.rows;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 20 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} GROUP BY cl.id ORDER BY cl.id DESC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM clusters cl WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  // Roles already used, offered as suggestions (any new role can be typed)
  static async getDistinctRoles() {
    const result = await pool.query("SELECT DISTINCT role FROM cluster_members WHERE role <> '' ORDER BY role");
    return result.rows.map((r) => r.role);
  }

  // ===== Links =====
  // members: [{ip_address_id, role, updated_by}]
  static async setMembers(clusterId, members, client) {
    const ex = db(client);
    await ex.query('DELETE FROM cluster_members WHERE cluster_id = $1', [clusterId]);
    for (const m of members || []) {
      await ex.query('INSERT INTO cluster_members (cluster_id, ip_address_id, role, updated_by) VALUES ($1, $2, $3, $4)',
        [clusterId, m.ip_address_id, m.role || null, m.updated_by || null]);
    }
  }

  static setSystems(id, ids, client) { return replaceLinks(client, 'cluster_system', 'cluster_id', id, 'system_id', ids); }
}

export default Cluster;
