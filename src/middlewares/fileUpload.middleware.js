// Universal file upload middleware supporting local and S3, dynamic field and folder
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const FILE_UPLOAD_DRIVER = process.env.FILE_UPLOAD_DRIVER || 'local';

// Allow-list of safe, non-executable document/image types. Anything else
// (html, svg, js, exe, php, ...) is rejected — uploaded files are served
// back out via express.static, so an unrestricted extension list would let
// any authenticated uploader plant stored XSS (html/svg) or other active
// content under the app's own origin.
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.zip', '.rar', '.7z',
  '.png', '.jpg', '.jpeg', '.gif'
]);
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file

function sanitizeOriginalName(originalname) {
  // Strip any directory components (path traversal via "../" or absolute
  // paths in the client-supplied filename) — multer's diskStorage does not
  // sanitize this itself, it just path.joins(destination, filename).
  return path.basename(originalname).replace(/[\\/]/g, '');
}

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type not allowed: ${ext || '(no extension)'}`));
  }
  cb(null, true);
}

function createUploadMiddleware({ fieldName = 'file', folder = 'misc', maxCount = 10 } = {}) {
  let storage;
  if (FILE_UPLOAD_DRIVER === 's3') {
    // Dynamic import for ESM compatibility
    return (async () => {
      const multerS3 = (await import('multer-s3')).default;
      const AWS = (await import('aws-sdk')).default;
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
      });
      const s3 = new AWS.S3();
      const storage = multerS3({
        s3,
        bucket: process.env.AWS_S3_BUCKET,
        acl: 'private',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, `${folder}/` + uniqueSuffix + '-' + sanitizeOriginalName(file.originalname));
        }
      });
      const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });
      return upload.array(fieldName, maxCount);
    })();
  } else {
    storage = multer.diskStorage({
      destination: function (req, file, cb) {
        // __dirname is not available in ESM, use process.cwd()
        const dest = path.join(process.cwd(), 'public/uploads', folder);
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + sanitizeOriginalName(file.originalname));
      }
    });
  }
  const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });
  return upload.array(fieldName, maxCount);
}

export default createUploadMiddleware;
