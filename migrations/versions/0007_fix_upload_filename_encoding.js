// 0007_fix_upload_filename_encoding
// Uploads used to store the filename as busboy decoded it, latin1, so a
// UTF-8 name like "Tài liệu.pdf" was saved as "TÃ i liá»\u0087u.pdf".
// New uploads are decoded correctly (src/utils/filename.js); this repairs
// the names already in file_uploads.original_name with the same rule: only
// names made of latin1-range characters, with at least one byte >= 0x80,
// that form valid UTF-8 once re-read. Files on disk are not renamed (the
// name is display-only; file_path is unchanged).
// Also used by migrations/data/migrate_data.js after copying older data.
function fixLatin1(name) {
  if (!/[\u0080-ÿ]/.test(name) || /[^\u0000-ÿ]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

export async function up(db) {
  const { rows } = await db.query(
    `SELECT id, original_name FROM file_uploads WHERE original_name ~ '[\\u0080-\\u00ff]'`
  );
  for (const { id, original_name } of rows) {
    const fixed = fixLatin1(original_name);
    if (fixed !== original_name) {
      await db.query('UPDATE file_uploads SET original_name = $1 WHERE id = $2', [fixed, id]);
    }
  }
}
