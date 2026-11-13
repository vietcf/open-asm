import { pool } from '../../../config/config.js';

import fs from 'fs';
import path from 'path';

class FileUpload {
  // Removes the records of some objects' files inside the caller's transaction and
  // returns them; remove the stored files with unlinkFiles() once it has committed.
  static async removeRecords(object_type, object_ids, client) {
    const result = await (client || pool).query(
      'DELETE FROM file_uploads WHERE object_type = $1 AND object_id = ANY($2::int[]) RETURNING *',
      [object_type, [].concat(object_ids).map(Number)]
    );
    return result.rows;
  }

  static async removeRecordsById(ids, client) {
    const result = await (client || pool).query('DELETE FROM file_uploads WHERE id = ANY($1::int[]) RETURNING *', [ids.map(Number)]);
    return result.rows;
  }

  // Local storage only; never throws (a missing file is not an error).
  static unlinkFiles(files) {
    if (process.env.FILE_UPLOAD_DRIVER === 's3') return;
    for (const file of files || []) {
      const filePath = file && file.file_path ? FileUpload.safeLocalPath(file.file_path) : null;
      try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Failed to delete file from disk:', filePath, e);
      }
    }
  }

  static async create({ object_type, object_id, original_name, file_path, mime_type, size, uploaded_by }, client) {
    const executor = client || pool;
    const result = await executor.query(
      `INSERT INTO file_uploads (object_type, object_id, original_name, file_path, mime_type, size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [object_type, object_id, original_name, file_path, mime_type, size, uploaded_by]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(`SELECT * FROM file_uploads WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async findByObjects(object_type, object_ids) {
    const result = await pool.query(
      `SELECT * FROM file_uploads WHERE object_type = $1 AND object_id = ANY($2::int[]) ORDER BY id`,
      [object_type, object_ids]
    );
    return result.rows;
  }

  // Absolute path of a stored local file, or null if it would fall outside
  // the uploads directory (never unlink anything else).
  static safeLocalPath(file_path) {
    const uploadsDir = path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'public/uploads');
    const relPath = String(file_path || '').replace(/^\/+/, '').replace(/^uploads\//, '');
    const filePath = path.resolve(uploadsDir, relPath);
    return filePath.startsWith(uploadsDir + path.sep) ? filePath : null;
  }

  static async findByObject(object_type, object_id) {
    const result = await pool.query(
      `SELECT * FROM file_uploads WHERE object_type = $1 AND object_id = $2 ORDER BY uploaded_at DESC`,
      [object_type, object_id]
    );
    return result.rows;
  }

  // Maps object_type -> the uploads subfolder its files physically live in.
  // Add an entry here whenever a new object_type gets file attachments.
  static FOLDER_BY_OBJECT_TYPE = {
    system: 'system',
    pentest_round: 'pentest',
    customer: 'customer'
  };

  static getUrl(file) {
    if (!file) return null;
    if (process.env.FILE_UPLOAD_DRIVER === 's3') {
      return file.file_path;
    } else {
      const folder = FileUpload.FOLDER_BY_OBJECT_TYPE[file.object_type] || 'system';
      return '/uploads/' + folder + '/' + file.file_path.split('/').pop();
    }
  }

}

export default FileUpload;
