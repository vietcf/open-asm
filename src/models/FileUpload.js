import { pool } from '../../config/config.js';

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
      // Use UPLOADS_DIR from env, fallback to 'public/uploads'
      const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
      for (const file of files) {
        if (file.file_path) {
          // Remove leading slash if present
          const relPath = file.file_path.replace(/^\/+/, '');
          const filePath = path.resolve(process.cwd(), uploadsDir, relPath.replace(/^uploads\//, ''));
          try {
            if (fs.existsSync(filePath)) {
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
      // __dirname is not available in ESM by default, so use process.cwd()
      const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
      // Remove leading slash if present
      const relPath = file.file_path.replace(/^\/+/, '');
      const filePath = path.resolve(process.cwd(), uploadsDir, relPath.replace(/^uploads\//, ''));
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.error('Failed to delete file from disk:', filePath, e);
      }
    }
    return file;
  }

  static getUrl(file) {
    if (!file) return null;
    if (process.env.FILE_UPLOAD_DRIVER === 's3') {
      return file.file_path;
    } else {
      return '/uploads/system/' + file.file_path.split('/').pop();
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
