// Upload filename helpers.

// Busboy (under multer 2) decodes the multipart filename as latin1, so a
// UTF-8 name such as "Tài liệu.pdf" arrives as "TÃ i liá»\u0087u.pdf".
// Re-decode it as UTF-8 when that is what it is: only names made of
// latin1-range characters with at least one byte >= 0x80 that form valid
// UTF-8. Anything else (plain ASCII, real Unicode) is returned unchanged.
// Same rule as migrations/versions/0007_fix_upload_filename_encoding.js.
export function fixLatin1Filename(name) {
  const str = String(name ?? '');
  if (!/[\u0080-\u00ff]/.test(str) || /[^\u0000-\u00ff]/.test(str)) return str;
  const decoded = Buffer.from(str, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? str : decoded;
}

// "Tài liệu – Đặc tả" -> "Tai lieu _ Dac ta" (Vietnamese diacritics removed,
// other non-printable-ASCII characters replaced by "_").
function toAscii(str) {
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e]/g, '_');
}

// Name for the file on disk / in the URL: ASCII letters, digits, "." "_" "-"
// only (what attachTmpUploads accepts), extension kept. The display name
// stays in file_uploads.original_name.
export function safeDiskName(name) {
  const base = String(name ?? '').replace(/^.*[\\/]/, '');
  const ext = (base.match(/\.[A-Za-z0-9]{1,10}$/) || [''])[0].toLowerCase();
  const stem = toAscii(ext ? base.slice(0, -ext.length) : base)
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 100);
  return (stem || 'file') + ext;
}

// Content-Disposition value that keeps a Unicode filename (RFC 6266 /
// RFC 5987): ASCII fallback in filename=, the real name in filename*=.
export function contentDisposition(type, name) {
  const clean = String(name ?? '').replace(/[\r\n"\\]/g, '').trim() || 'file';
  const ascii = toAscii(clean);
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
