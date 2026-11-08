// Permission matrix versions (priv_matrix_versions): a snapshot per version,
// and the signed PDF once uploaded.
import { pool } from '../../../config/config.js';
import { db } from '../../shared/db.js';

// List rows leave the snapshot out
const LIST_COLUMNS = `id, system_id, version, status, note, signed_at, signed_file_name, signed_uploaded_by, signed_uploaded_at, created_by, created_at,
  jsonb_array_length(snapshot->'roles') AS role_count, jsonb_array_length(snapshot->'permissions') AS permission_count`;

class PrivMatrixVersion {
  // Next number of the system, taken under a lock so two users never get the same one
  static async create({ system_id, snapshot, note, created_by }, client) {
    const ex = db(client);
    await ex.query('SELECT pg_advisory_xact_lock(4210, $1)', [system_id]);
    const result = await ex.query(
      `INSERT INTO priv_matrix_versions (system_id, version, snapshot, note, created_by)
       VALUES ($1, COALESCE((SELECT MAX(version) FROM priv_matrix_versions WHERE system_id = $1), 0) + 1, $2, $3, $4)
       RETURNING id, version`,
      [system_id, JSON.stringify(snapshot), note || null, created_by || null]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM priv_matrix_versions WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async listBySystem(systemId) {
    const result = await pool.query(`SELECT ${LIST_COLUMNS} FROM priv_matrix_versions WHERE system_id = $1 ORDER BY version DESC`, [systemId]);
    return result.rows;
  }

  static async latestSigned(systemId) {
    const result = await pool.query("SELECT * FROM priv_matrix_versions WHERE system_id = $1 AND status = 'signed' ORDER BY version DESC LIMIT 1", [systemId]);
    return result.rows[0] || null;
  }

  static async markSigned(id, { signed_at, file_path, file_name, uploaded_by, note }) {
    await pool.query(
      `UPDATE priv_matrix_versions SET status = 'signed', signed_at = $2, signed_file_path = $3, signed_file_name = $4,
         signed_uploaded_by = $5, signed_uploaded_at = CURRENT_TIMESTAMP, note = COALESCE($6, note) WHERE id = $1`,
      [id, signed_at, file_path, file_name, uploaded_by || null, note || null]
    );
  }

  static async remove(id) {
    await pool.query('DELETE FROM priv_matrix_versions WHERE id = $1', [id]);
  }
}

export default PrivMatrixVersion;
