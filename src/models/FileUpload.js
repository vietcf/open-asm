const { pool } = require('../../config/config');

const FileUpload = {
  async create({ object_type, object_id, original_name, file_path, mime_type, size, uploaded_by }) {
    const result = await pool.query(
      `INSERT INTO file_uploads (object_type, object_id, original_name, file_path, mime_type, size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [object_type, object_id, original_name, file_path, mime_type, size, uploaded_by]
    );
    return result.rows[0];
  },

  async findByObject(object_type, object_id) {
    const result = await pool.query(
      `SELECT * FROM file_uploads WHERE object_type = $1 AND object_id = $2 ORDER BY uploaded_at DESC`,
      [object_type, object_id]
    );
    return result.rows;
  },

  async deleteById(id) {
    // Remove file from DB and disk (if local)
    const result = await pool.query(
      `DELETE FROM file_uploads WHERE id = $1 RETURNING *`,
      [id]
    );
    const file = result.rows[0];
    if (file && process.env.FILE_UPLOAD_DRIVER !== 's3' && file.file_path) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../public', file.file_path);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // Log error but don't throw
        console.error('Failed to delete file from disk:', filePath, e);
      }
    }
    return file;
  },

  getUrl(file) {
    if (!file) return null;
    if (process.env.FILE_UPLOAD_DRIVER === 's3') {
      return file.file_path; // S3 URL
    } else {
      // Local: return relative URL
      return '/uploads/system/' + file.file_path.split('/').pop();
    }
  }
};

module.exports = FileUpload;
