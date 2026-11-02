import { pool } from '../../../config/config.js';
import { Where, searchRank } from '../../shared/db.js';

const filterWhere = ({ search = '' }) => new Where().search(search, ['t.name ILIKE ?', 't.description ILIKE ?']);

class Tag {
  static async create({ name, description }) {
    const result = await pool.query('INSERT INTO tags (name, description) VALUES ($1, $2) RETURNING *', [name, description]);
    return result.rows[0];
  }

  static async update(id, { name, description }) {
    const result = await pool.query('UPDATE tags SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *', [name, description, id]);
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM tags WHERE id = $1', [id]);
  }

  static async findAll() {
    const result = await pool.query('SELECT * FROM tags ORDER BY name');
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM tags WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const result = await pool.query('SELECT * FROM tags WHERE id = ANY($1) ORDER BY name', [ids]);
    return result.rows;
  }

  // Case-insensitive exact match
  static async findByNameExact(name) {
    const result = await pool.query('SELECT * FROM tags WHERE LOWER(name) = LOWER($1) ORDER BY id', [name]);
    return result.rows;
  }

  static async exists(id) {
    const result = await pool.query('SELECT 1 FROM tags WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // Page of tags with how many objects use each (usage_count)
  static async findFilteredList(filter = {}) {
    const { page = 1, pageSize = 20 } = filter;
    const w = filterWhere(filter);
    const result = await pool.query(
      `SELECT t.*, (SELECT COUNT(*) FROM tag_object x WHERE x.tag_id = t.id)::int AS usage_count
       FROM tags t WHERE ${w} ORDER BY ${searchRank(['t.name'], filter.search, w)}t.name LIMIT ${w.param(pageSize)} OFFSET ${w.param((page - 1) * pageSize)}`,
      w.params
    );
    return result.rows;
  }

  static async countFiltered(filter = {}) {
    const w = filterWhere(filter);
    const result = await pool.query(`SELECT COUNT(*) FROM tags t WHERE ${w}`, w.params);
    return parseInt(result.rows[0].count, 10);
  }

  static async countUsage(id) {
    const result = await pool.query('SELECT COUNT(*) FROM tag_object WHERE tag_id = $1', [id]);
    return parseInt(result.rows[0].count, 10);
  }

  // Select2 lookup: [{id, text}]
  // Every tag as {id, text}, for selects rendered with the page
  static async options() {
    const result = await pool.query('SELECT id, name AS text FROM tags ORDER BY name');
    return result.rows;
  }

  static async select2Search(search = '') {
    const w = filterWhere({ search });
    const result = await pool.query(`SELECT t.id, t.name AS text FROM tags t WHERE ${w} ORDER BY ${searchRank(['t.name'], search, w)}t.name LIMIT 20`, w.params);
    return result.rows;
  }
}

export default Tag;
