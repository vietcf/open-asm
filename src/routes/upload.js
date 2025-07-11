
import express from 'express';
import createUploadMiddleware from '../middlewares/fileUpload.middleware.js';
import requireLogin from '../middlewares/requireLogin.middleware.js';
const router = express.Router();

// Middleware: upload file to /uploads/tmp or S3 'tmp' folder
const uploadTmp = createUploadMiddleware({ fieldName: 'file', folder: 'tmp', maxCount: 10 });

// POST /api/upload - AJAX file upload (chỉ cho user đã đăng nhập)
router.post('/', requireLogin, uploadTmp, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Trả về thông tin file đã upload (có thể mở rộng lưu DB nếu muốn)
    const files = req.files.map(file => ({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: file.location || (file.path ? ('/uploads/tmp/' + file.filename) : null)
    }));
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
