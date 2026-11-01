// Universal file upload middleware supporting local and S3, dynamic field and folder
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fixLatin1Filename, safeDiskName } from '../utils/filename.js';
import { ALLOWED_UPLOAD_EXTENSIONS, isAllowedUploadName } from '../utils/uploadTypes.js';

const FILE_UPLOAD_DRIVER = process.env.FILE_UPLOAD_DRIVER || 'local';

// Allow-list of document/design types (src/utils/uploadTypes.js). Anything
// else (html, svg, js, exe, archives, ...) is rejected — uploaded files are
// served back out via express.static, so an unrestricted list would let any
// authenticated uploader plant stored XSS or other active content under the
// app's own origin.
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file

// Name on disk / in the URL: ASCII only, no directory parts (multer's
// diskStorage just path.joins destination + filename, so "../" must never
// survive) and no spaces/diacritics, so it matches fileService's tmp-URL
// check. The real (Vietnamese) name stays in file.originalname.
function diskFileName(originalname) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  return uniqueSuffix + '-' + safeDiskName(originalname);
}

function fileFilter(req, file, cb) {
  // Runs before storage: every later use (disk name, response, DB) gets the
  // UTF-8 name instead of busboy's latin1 decoding.
  file.originalname = fixLatin1Filename(file.originalname);
  if (!isAllowedUploadName(file.originalname)) {
    const ext = path.extname(file.originalname).toLowerCase();
    return cb(new Error(`File type not allowed: ${ext || '(no extension)'}. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}`));
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
          cb(null, `${folder}/` + diskFileName(file.originalname));
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
        cb(null, diskFileName(file.originalname));
      }
    });
  }
  const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });
  return upload.array(fieldName, maxCount);
}

export default createUploadMiddleware;
