// Single Excel file (field "file", .xlsx/.xls, max 10 MB) for the import
// endpoints, stored under <uploads>/import until the import removes it.
//   router.post('/contact/import', excelUpload, contactImport.import);
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const EXCEL_EXTENSIONS = ['.xlsx', '.xls'];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dest = path.join(process.cwd(), process.env.UPLOADS_DIR || 'public/uploads', 'import');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  // basename: a crafted original name cannot point outside the folder
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${path.basename(file.originalname).replace(/[^\w.-]+/g, '_')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (EXCEL_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
  },
}).single('file');

// Upload errors (type, size) answer 400 JSON, as the import dialog expects.
export default function excelUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}
