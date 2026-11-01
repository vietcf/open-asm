// File types accepted for attachments (system/component documents, pentest
// reports). One list for the server check (fileUpload.middleware.js) and the
// <input type="file" accept="..."> of every form (app.locals.uploadAccept).
//
// Documents and design files only. Deliberately left out: anything that can
// run in a browser when served back from the app's origin (html, svg, js),
// executables and archives (zip/rar/7z hide their content from the check).
export const ALLOWED_UPLOAD_EXTENSIONS = [
  '.pdf',
  '.doc', '.docx',            // Word
  '.xls', '.xlsx', '.csv',    // Excel
  '.vsd', '.vsdx',            // Visio
  '.drawio',                  // draw.io / diagrams.net
  '.txt',
  '.png', '.jpg', '.jpeg',    // exported diagrams / screenshots
];

const ALLOWED = new Set(ALLOWED_UPLOAD_EXTENSIONS);

export function isAllowedUploadName(name) {
  const lower = String(name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot > 0 && ALLOWED.has(lower.slice(dot));
}

// Value for accept="..."
export const UPLOAD_ACCEPT = ALLOWED_UPLOAD_EXTENSIONS.join(',');
