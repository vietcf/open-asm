// Attachments (file_uploads) for any object type, shared by the web
// controllers and the REST API.
//
// Upload flow: the browser uploads each file to POST /api/upload, which stores
// it in uploads/tmp and returns { url: '/uploads/tmp/<name>', originalname, ... }.
// The form then submits those tmp URLs; attachTmpUploads() moves the files to
// the object's folder and records them. Only genuine tmp files are accepted:
// a client cannot point an attachment at an arbitrary path.
import fs from 'fs';
import path from 'path';
import FileUpload from './file-upload.model.js';
import { ValidationError } from '../../shared/errors.js';

const UPLOADS_DIR = path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'public/uploads');
const TMP_URL_RE = /^\/uploads\/tmp\/([A-Za-z0-9._-]+)$/;
const isS3 = () => process.env.FILE_UPLOAD_DRIVER === 's3';

function parseJsonList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Resolves an uploaded tmp file to { tmpPath, filename, size } or throws.
function resolveTmpUpload(url) {
  if (isS3()) {
    const base = (process.env.AWS_S3_BASE_URL || '').replace(/\/+$/, '');
    if (!base || !String(url).startsWith(`${base}/tmp/`)) throw new ValidationError('Invalid uploaded file');
    return { s3Url: url };
  }
  const m = TMP_URL_RE.exec(String(url || ''));
  if (!m) throw new ValidationError('Invalid uploaded file');
  const tmpPath = path.join(UPLOADS_DIR, 'tmp', m[1]);
  if (!fs.existsSync(tmpPath)) throw new ValidationError('Uploaded file not found, please upload it again');
  return { tmpPath, filename: m[1], size: fs.statSync(tmpPath).size };
}

function moveToFolder(tmpPath, filename, folder) {
  const destDir = path.join(UPLOADS_DIR, folder);
  fs.mkdirSync(destDir, { recursive: true });
  fs.renameSync(tmpPath, path.join(destDir, filename));
  return `/uploads/${folder}/${filename}`;
}

// docs: array (or JSON string) of { url, originalname|name, mimetype } from /api/upload
export async function attachTmpUploads(objectType, objectId, docs, uploadedBy, client) {
  const folder = FileUpload.FOLDER_BY_OBJECT_TYPE[objectType] || objectType;
  const created = [];
  for (const doc of parseJsonList(docs)) {
    const resolved = resolveTmpUpload(doc && doc.url);
    const originalName = String(doc.originalname || doc.name || resolved.filename || 'file').slice(0, 255);
    const filePath = resolved.s3Url || moveToFolder(resolved.tmpPath, resolved.filename, folder);
    created.push(await FileUpload.create({
      object_type: objectType,
      object_id: objectId,
      original_name: originalName,
      file_path: filePath,
      mime_type: String(doc.mimetype || 'application/octet-stream').slice(0, 100),
      size: (resolved.size ?? Number(doc.size)) || null,
      uploaded_by: uploadedBy || null,
    }, client));
  }
  return created;
}

// Deletes only attachments that belong to the given object.
export async function deleteObjectFiles(objectType, objectId, fileIds) {
  const ids = parseJsonList(fileIds).map(Number).filter(Number.isInteger);
  if (!ids.length) return 0;
  const owned = (await FileUpload.findByObject(objectType, objectId)).map(f => f.id);
  let deleted = 0;
  for (const id of ids) {
    if (owned.includes(id)) {
      await FileUpload.deleteById(id);
      deleted++;
    }
  }
  return deleted;
}

// { id, name, url } list for views / API responses
export async function listObjectFiles(objectType, objectId) {
  const files = await FileUpload.findByObject(objectType, objectId);
  return files.map(f => ({ id: f.id, name: f.original_name, url: FileUpload.getUrl(f), size: f.size, mime_type: f.mime_type }));
}

// Batch variant for list pages: { [objectId]: [{id, name, url}] } in one query.
export async function listFilesByObjects(objectType, objectIds) {
  if (!objectIds.length) return {};
  const files = await FileUpload.findByObjects(objectType, objectIds);
  const byId = {};
  for (const f of files) {
    (byId[f.object_id] ||= []).push({ id: f.id, name: f.original_name, url: FileUpload.getUrl(f) });
  }
  return byId;
}
