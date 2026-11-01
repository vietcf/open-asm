// Excel import shared by every list with an "Import" button:
// template download -> validate (dry run, result file) -> import (result file).
//
//   const contactImport = excelImport({
//     name: 'contact',
//     columns: [{ header: 'Name (Require)', key: 'name' }, ...],
//     sample: async () => [{ name: 'John Doe', ... }],          // template rows
//     check: async (row, ctx) => ({ errors: [...], skip: 'reason' }), // per row, no writes
//     save: async (row, client, ctx) => {},                       // import one row
//     duplicateKeys: (row) => [row.email.toLowerCase()],          // optional: once per file
//     resultUrl: (file) => `/organize/download/contact-validation/${file}`,
//   });
//   router.get('/contact/template', contactImport.template) ...
//
// Rows are objects keyed by column `key`, values trimmed strings. A row
// whose check returns `skip` fails validation and is "Skipped" on import.
// Each imported row runs in a savepoint, so one bad row does not undo the others.
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { pool } from '../../config/config.js';
import { ServiceError } from './errors.js';
import { sanitizeExcelValue } from '../utils/excelSafe.js';

const tempDir = () => path.join(process.cwd(), process.env.UPLOADS_DIR || 'public/uploads', 'temp');
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const cellText = (v) => sanitizeExcelValue(String(v ?? '').replace(CONTROL_CHARS, ''));

const STATUS_STYLE = {
  Pass: ['FFCCFFCC', 'FF006600'], Success: ['FFCCFFCC', 'FF006600'],
  Fail: ['FFFFCCCC', 'FFCC0000'], Failed: ['FFFFCCCC', 'FFCC0000'],
  Skipped: ['FFFFFFCC', 'FFCC6600'],
};

// Thrown for a file that cannot be read as the expected template
class ImportFileError extends Error {}

function readRows(file, columns) {
  if (!file) throw new ImportFileError('No file uploaded');
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') throw new ImportFileError('Unsupported file format. Only Excel files (.xlsx, .xls) are allowed.');
  const workbook = XLSX.readFile(file.path);
  // header: 1 = arrays, so a blank optional cell cannot shift the columns
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  const headers = (data[0] || []).map((h) => String(h ?? '').trim());
  if (headers.length !== columns.length) {
    throw new ImportFileError(`Invalid file format. Expected ${columns.length} columns, got ${headers.length}`);
  }
  columns.forEach((c, i) => {
    if (headers[i] !== c.header) throw new ImportFileError(`Invalid column order. Expected "${c.header}" at position ${i + 1}, got "${headers[i]}"`);
  });
  const rows = data.slice(1)
    .filter((cells) => cells.some((v) => String(v ?? '').trim() !== ''))
    .map((cells) => Object.fromEntries(columns.map((c, i) => [c.key, String(cells[i] ?? '').trim()])));
  if (!rows.length) throw new ImportFileError('No data found in file');
  return rows;
}

async function writeWorkbook(filePath, sheetName, headers, rows, statusIndex) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  for (const values of rows) {
    const row = sheet.addRow(values.map(cellText));
    const style = statusIndex != null && STATUS_STYLE[values[statusIndex]];
    if (style) {
      row.getCell(statusIndex + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style[0] } };
      row.getCell(statusIndex + 1).font = { color: { argb: style[1] } };
    }
  }
  sheet.columns.forEach((col) => { col.width = Math.max(col.width || 10, 18); });
  await workbook.xlsx.writeFile(filePath);
}

const removeQuietly = (p) => { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* temp file */ } };

export function excelImport({ name, columns, sample, prepare = async () => ({}), check, save, duplicateKeys, resultUrl }) {
  const headers = columns.map((c) => c.header);

  async function resultFile(file, suffix, sheet, extraHeaders, rows) {
    fs.mkdirSync(tempDir(), { recursive: true });
    const base = path.basename(file.originalname).replace(/\.[^/.]+$/, '').replace(/[^\w.-]+/g, '_');
    const fileName = `${Date.now()}_${base}_${suffix}.xlsx`;
    await writeWorkbook(path.join(tempDir(), fileName), sheet, [...headers, ...extraHeaders], rows, headers.length);
    return resultUrl(fileName);
  }

  const fail = (res, err, label) => {
    if (res.headersSent) return;
    if (err instanceof ImportFileError) return res.status(400).json({ error: err.message });
    console.error(`${name} ${label} error:`, err);
    res.status(500).json({ error: `${label} failed: ${err.message}` });
  };

  return {
    async template(req, res) {
      try {
        fs.mkdirSync(tempDir(), { recursive: true });
        const filePath = path.join(tempDir(), `template_${name}_${Date.now()}.xlsx`);
        const rows = (await sample()).map((r) => columns.map((c) => r[c.key] ?? ''));
        await writeWorkbook(filePath, `${name} template`, headers, rows, null);
        res.download(filePath, `${name}_import_template.xlsx`, () => removeQuietly(filePath));
      } catch (err) {
        fail(res, err, 'Template');
      }
    },

    async validate(req, res) {
      try {
        const rows = readRows(req.file, columns);
        const ctx = await prepare();
        const seen = new Set();
        const results = [];
        for (const row of rows) {
          const { errors = [], skip } = await check(row, ctx);
          const keys = duplicateKeys ? duplicateKeys(row).filter(Boolean) : [];
          if (keys.some((k) => seen.has(k))) errors.push('Duplicate within this file');
          keys.forEach((k) => seen.add(k));
          const reasons = skip ? [...errors, skip] : errors;
          results.push([...columns.map((c) => row[c.key]), reasons.length ? 'Fail' : 'Pass', reasons.join('; ')]);
        }
        const failedRows = results.filter((r) => r[headers.length] === 'Fail').length;
        const summary = { totalRows: rows.length, passedRows: rows.length - failedRows, failedRows, allPassed: failedRows === 0 };
        const url = await resultFile(req.file, 'validation', 'Validation Results', ['Validation Status', 'Validation Reason'], results);
        res.json({ success: true, validation_file: url, summary });
      } catch (err) {
        fail(res, err, 'Validation');
      } finally {
        removeQuietly(req.file?.path);
      }
    },

    async import(req, res) {
      const client = await pool.connect();
      try {
        const rows = readRows(req.file, columns);
        const ctx = await prepare();
        const seen = new Set();
        const results = [];
        await client.query('BEGIN');
        for (const [i, row] of rows.entries()) {
          let status = 'Success';
          let reason = '';
          const { errors = [], skip } = await check(row, ctx);
          const keys = duplicateKeys ? duplicateKeys(row).filter(Boolean) : [];
          if (errors.length) { status = 'Failed'; reason = errors.join('; '); }
          else if (skip) { status = 'Skipped'; reason = skip; }
          else if (keys.some((k) => seen.has(k))) { status = 'Skipped'; reason = 'Duplicate within this file'; }
          else {
            keys.forEach((k) => seen.add(k));
            const savepoint = `import_row_${i}`;
            try {
              await client.query(`SAVEPOINT ${savepoint}`);
              await save(row, client, ctx);
              await client.query(`RELEASE SAVEPOINT ${savepoint}`);
              reason = 'Imported';
            } catch (err) {
              await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
              if (!(err instanceof ServiceError)) console.error(`${name} import row ${i + 2}:`, err);
              status = 'Failed';
              reason = err.message || 'Unknown error';
            }
          }
          results.push([...columns.map((c) => row[c.key]), status, reason]);
        }
        await client.query('COMMIT');
        const count = (s) => results.filter((r) => r[headers.length] === s).length;
        const summary = { totalRows: rows.length, successRows: count('Success'), skippedRows: count('Skipped'), failedRows: count('Failed') };
        const url = await resultFile(req.file, 'imported', 'Import Results', ['Import Status', 'Import Reason'], results);
        res.json({ success: true, import_file: url, summary });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        fail(res, err, 'Import');
      } finally {
        client.release();
        removeQuietly(req.file?.path);
      }
    },

    // Result file, deleted once downloaded
    download(req, res) {
      const fileName = path.basename(req.params.filename || '');
      const filePath = path.join(tempDir(), fileName);
      if (!fileName || !fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
      res.download(filePath, fileName, () => removeQuietly(filePath));
    },
  };
}
