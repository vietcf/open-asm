import fs from 'fs';
import path from 'path';
import { contentDisposition } from './filename.js';

// Extension -> MIME map for inline preview, restricted to the same safe
// allow-list enforced at upload time (fileUpload.middleware.js). We
// deliberately never trust a file_uploads row's stored mime_type here: it
// comes straight from the client-supplied multipart Content-Type at upload
// time, unchecked — so a malicious uploader could have paired a "safe" .pdf
// extension with a declared mime_type of text/html. Serving inline with an
// attacker-chosen Content-Type would reopen the stored-XSS hole the
// forced-download behavior (src/app.js /uploads static route) exists to close.
export const SAFE_INLINE_MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif'
};

// Serve a previously-uploaded attachment inline (opens in a new browser tab)
// instead of the forced download every /uploads/* file gets from the global
// static middleware (src/app.js). Only extensions in the safe allow-list are
// ever served inline; anything else falls back to attachment.
//
// `file` is a file_uploads row. `folder` is the uploads subfolder the file
// physically lives in (e.g. 'system', 'pentest') — resolved strictly within
// that folder, ignoring whatever directory components file.file_path
// happens to carry (it's stored inconsistently as either an absolute multer
// path or a "/uploads/<folder>/..." URL depending on which upload flow
// created it) — only the basename is trusted.
export function serveFileInline(res, { file, folder }) {
  const basename = path.basename(file.file_path);
  const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
  const baseDir = path.resolve(process.cwd(), uploadsDir, folder);
  const absPath = path.resolve(baseDir, basename);
  if (!absPath.startsWith(baseDir + path.sep)) {
    return res.status(400).send('Invalid file path');
  }
  if (!fs.existsSync(absPath)) return res.status(404).send('File not found on disk');

  const ext = path.extname(basename).toLowerCase();
  const safeMime = SAFE_INLINE_MIME_BY_EXT[ext];
  const disposition = safeMime ? 'inline' : 'attachment';

  res.setHeader('Content-Type', safeMime || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // UTF-8 names (e.g. Vietnamese) via filename*=, ASCII fallback in filename=
  res.setHeader('Content-Disposition', contentDisposition(disposition, file.original_name || basename));
  res.sendFile(absPath);
}
