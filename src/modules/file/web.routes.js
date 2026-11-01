
import express from 'express';
import createUploadMiddleware from '../../middlewares/fileUpload.middleware.js';
import requireLogin from '../../middlewares/requireLogin.middleware.js';
const router = express.Router();

// Middleware: upload file to /uploads/tmp or S3 'tmp' folder
const uploadTmp = createUploadMiddleware({ fieldName: 'file', folder: 'tmp', maxCount: 10 });

// Wrap multer so rejected file types / oversized files return a clean JSON
// error instead of falling through to Express's default HTML error page.
function safeUploadTmp(req, res, next) {
  uploadTmp(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload error' });
    next();
  });
}

// POST /api/upload - AJAX file upload (logged-in users only)
router.post('/', requireLogin, safeUploadTmp, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return the uploaded file info (could also be stored in the DB)
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
