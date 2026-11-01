import { pool } from '../../../config/config.js';

import fs from 'fs';
import path from 'path';

class FileUpload {
  /**
   * Delete all file_uploads by object_type and object_id, and remove files from disk if needed (local only).
   */
  static async deleteByObject(object_type, object_id) {
    const result = await pool.query(
      `SELECT * FROM file_uploads WHERE object_type = $1 AND object_id = $2`,
      [object_type, object_id]
    );
    const files = result.rows;
    await pool.query(
      `DELETE FROM file_uploads WHERE object_type = $1 AND object_id = $2`,
      [object_type, object_id]
    );
    if (process.env.FILE_UPLOAD_DRIVER !== 's3') {
      for (const file of files) {
        if (file.file_path) {
          const filePath = FileUpload.safeLocalPath(file.file_path);
          try {
            if (filePath && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (e) {
            console.error('Failed to delete file from disk:', filePath, e);
          }
        }
      }
    }
    return files;
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

  static async deleteById(id) {
    const result = await pool.query(
      `DELETE FROM file_uploads WHERE id = $1 RETURNING *`,
      [id]
    );
    const file = result.rows[0];
    if (file && process.env.FILE_UPLOAD_DRIVER !== 's3' && file.file_path) {
      const filePath = FileUpload.safeLocalPath(file.file_path);
      try {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.error('Failed to delete file from disk:', filePath, e);
      }
    }
    return file;
  }

  // Maps object_type -> the uploads subfolder its files physically live in.
  // Add an entry here whenever a new object_type gets file attachments.
  static FOLDER_BY_OBJECT_TYPE = {
    system: 'system',
    pentest_round: 'pentest'
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

  static moveFromTmpToSystem(url) {
    if (process.env.FILE_UPLOAD_DRIVER === 's3' || !url || !url.startsWith('/uploads/tmp/')) {
      return url;
    }
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const uploadsPrefix = process.env.UPLOADS_PREFIX || '/uploads';
    const filename = url.split('/').pop();
    const tmpPath = path.resolve(process.cwd(), uploadsDir, 'tmp', filename);
    const destDir = path.resolve(process.cwd(), uploadsDir, 'system');
    const destPath = path.join(destDir, filename);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    try {
      fs.renameSync(tmpPath, destPath);
      return `${uploadsPrefix}/system/${filename}`;
    } catch (e) {
      // If error, keep original tmp url
      return url;
    }
  }

}

export default FileUpload;
