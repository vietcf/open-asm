import { pool } from '../../config/config.js';

const TABLE = 'configuration';

// Key -> text value. Written only through the System Configuration tabs
// (validated by src/utils/configRegistry.js) and the seeds.
class Configuration {
  static async findById(key) {
    const res = await pool.query(`SELECT * FROM ${TABLE} WHERE key = $1`, [key]);
    return res.rows[0];
  }

  static async findByKey(key) {
    return await this.findById(key);
  }

  static async findByKeys(keys) {
    const res = await pool.query(`SELECT * FROM ${TABLE} WHERE key = ANY($1)`, [keys]);
    return res.rows;
  }

  // Insert or update by key; the description is only used when inserting.
  static async upsert(key, { value, description = '', updatedBy = null }, client) {
    const res = await (client || pool).query(
      `INSERT INTO ${TABLE} (key, value, description, updated_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP, updated_by = EXCLUDED.updated_by
       RETURNING *`,
      [key, value, description, updatedBy]
    );
    return res.rows[0];
  }

  static async remove(key, client) {
    await (client || pool).query(`DELETE FROM ${TABLE} WHERE key = $1`, [key]);
  }
}

export default Configuration;
