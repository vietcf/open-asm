// Firewall rules (rulefirewall) with unit, contacts and tags.
import { pool } from '../../../config/config.js';
import { db, Where, replaceLinks, replaceTags, jsonList, searchRank } from '../../shared/db.js';

export const COLUMNS = ['rulename', 'firewall_name', 'src_zone', 'src', 'src_detail', 'dst_zone', 'dst', 'dst_detail', 'services', 'application', 'url',
  'action', 'ou_id', 'status', 'violation_type', 'violation_detail', 'solution_proposal', 'solution_confirm', 'description', 'audit_batch',
  'work_order', 'raw_data', 'updated_by'];

const SELECT_WITH_LINKS = `
  SELECT rf.*, u.name AS ou_name,
    ${jsonList('t', { id: 't.id', name: 't.name' })} AS tags,
    ${jsonList('c', { id: 'c.id', name: 'c.name', email: 'c.email' })} AS contacts
  FROM rulefirewall rf
  LEFT JOIN units u ON u.id = rf.ou_id
  LEFT JOIN tag_object tobj ON tobj.object_type = 'rulefirewall' AND tobj.object_id = rf.id
  LEFT JOIN tags t ON t.id = tobj.tag_id
  LEFT JOIN rulefirewall_contact rfc ON rfc.rule_id = rf.id
  LEFT JOIN contacts c ON c.id = rfc.contact_id`;
const GROUP_BY = 'GROUP BY rf.id, u.name';
const SEARCHED = ['rulename', 'firewall_name', 'src_zone', 'src', 'src_detail', 'dst_zone', 'dst', 'dst_detail', 'services', 'application', 'url',
  'action', 'violation_type', 'violation_detail', 'solution_proposal', 'solution_confirm', 'status', 'description', 'updated_by', 'work_order'];

// filter: {search, ou_id, firewall_name[], action[], status[], violation_type[], tags[] (all), contacts[] (all), audit_batch ("a, b": any), work_order}
function filterWhere({ search = '', ou_id, firewall_name = [], action = [], status = [], violation_type = [], tags = [], contacts = [], audit_batch, work_order }) {
  const w = new Where();
  w.search(search, [...SEARCHED.map((c) => `rf.${c} ILIKE ?`), 'EXISTS (SELECT 1 FROM units x WHERE x.id = rf.ou_id AND x.name ILIKE ?)',
    "EXISTS (SELECT 1 FROM tag_object x JOIN tags tg ON tg.id = x.tag_id WHERE x.object_type = 'rulefirewall' AND x.object_id = rf.id AND tg.name ILIKE ?)",
    'EXISTS (SELECT 1 FROM rulefirewall_contact x JOIN contacts ct ON ct.id = x.contact_id WHERE x.rule_id = rf.id AND ct.name ILIKE ?)']);
  if (ou_id) w.add(`rf.ou_id = ${w.param(Number(ou_id))}`);
  for (const [col, values] of [['firewall_name', firewall_name], ['action', action], ['status', status], ['violation_type', violation_type]]) {
    const list = [].concat(values).filter(Boolean);
    if (list.length) w.add(`rf.${col} = ANY(${w.param(list)})`);
  }
  // every selected tag / contact
  if (tags.length) w.add(`(SELECT COUNT(DISTINCT x.tag_id) FROM tag_object x WHERE x.object_type = 'rulefirewall' AND x.object_id = rf.id AND x.tag_id = ANY(${w.param(tags.map(Number))})) = ${w.param(new Set(tags).size)}`);
  if (contacts.length) w.add(`(SELECT COUNT(DISTINCT x.contact_id) FROM rulefirewall_contact x WHERE x.rule_id = rf.id AND x.contact_id = ANY(${w.param(contacts.map(Number))})) = ${w.param(new Set(contacts).size)}`);
  const batches = String(audit_batch || '').split(',').map((b) => b.trim()).filter(Boolean);
  if (batches.length) w.add(`rf.audit_batch ILIKE ANY(${w.param(batches.map((b) => `%${b}%`))})`);
  if (work_order) w.add(`rf.work_order ILIKE ${w.param(`%${work_order}%`)}`);
  return w;
}

class RuleFirewall {
  static async create(data, client) {
    const result = await db(client).query(
      `INSERT INTO rulefirewall (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      COLUMNS.map((c) => data[c] ?? null)
    );
    return result.rows[0].id;
  }

  // Only the given columns change
  static async update(id, data, client) {
    const keys = COLUMNS.filter((c) => data[c] !== undefined);
    if (!keys.length) return;
    await db(client).query(
      `UPDATE rulefirewall SET ${keys.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
      [...keys.map((c) => data[c]), id]
    );
  }

  // rulefirewall_contact cascades; tags are polymorphic
  static async remove(id, client) {
    await replaceTags(client, 'rulefirewall', id, []);
    await db(client).query('DELETE FROM rulefirewall WHERE id = $1', [id]);
  }

  static async findById(id) {
    const result = await pool.query(`${SELECT_WITH_LINKS} WHERE rf.id = $1 ${GROUP_BY}`, [id]);
    return result.rows[0] || null;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM rulefirewall WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // The unique key: firewall + rule name + audit batch
  static async findByKey(firewallName, ruleName, auditBatch, client) {
    const result = await db(client).query(
      'SELECT * FROM rulefirewall WHERE firewall_name = $1 AND rulename = $2 AND audit_batch = $3 LIMIT 1',
      [firewallName, ruleName, auditBatch]
    );
    return result.rows[0] || null;
  }

  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 10 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `${SELECT_WITH_LINKS} WHERE ${w} ${GROUP_BY} ORDER BY ${searchRank(['rf.rulename'], filter.search, w)}rf.id ASC LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM rulefirewall rf WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  static setContacts(id, ids, client) { return replaceLinks(client, 'rulefirewall_contact', 'rule_id', id, 'contact_id', ids); }
  static setTags(id, ids, client) { return replaceTags(client, 'rulefirewall', id, ids); }
}

export default RuleFirewall;
