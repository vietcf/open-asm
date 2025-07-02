// Universal file upload middleware supporting local and S3, dynamic field and folder
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const FILE_UPLOAD_DRIVER = process.env.FILE_UPLOAD_DRIVER || 'local';

function createUploadMiddleware({ fieldName = 'file', folder = 'misc', maxCount = 10 } = {}) {
  let storage;
  if (FILE_UPLOAD_DRIVER === 's3') {
    const multerS3 = require('multer-s3');
    const AWS = require('aws-sdk');
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
    const s3 = new AWS.S3();
    storage = multerS3({
      s3,
      bucket: process.env.AWS_S3_BUCKET,
      acl: 'private',
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${folder}/` + uniqueSuffix + '-' + file.originalname);
      }
    });
  } else {
    storage = multer.diskStorage({
      destination: function (req, file, cb) {
        const dest = path.join(__dirname, '../../public/uploads', folder);
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
      }
    });
  }
  const upload = multer({ storage });
  return upload.array(fieldName, maxCount);
}

module.exports = createUploadMiddleware;
