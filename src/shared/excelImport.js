// Excel import shared by every list with an "Import" button:
// template download -> validate (dry run, result file) -> import (result file).
//
//   const contactImport = excelImport({
//     name: 'contact',
//     columns: [{ header: 'Name (Require)', key: 'name' }, ...],
//     sample: async () => [{ name: 'John Doe', ... }],          // template rows
//     prepare: async (req) => ({ ... }),                          // optional: shared lookups, user
//     check: async (row, ctx) => ({ errors: [...], skip: 'reason' }), // per row, no writes
//     save: async (row, client, ctx) => {},                       // import one row
//     duplicateKeys: (row) => [row.email.toLowerCase()],          // optional: once per file
//     groupBy: (row) => row.cluster.toLowerCase(),                // optional: rows saved together,
//     checkGroup: async (rows, ctx) => [...errors],               //   all or nothing; save(rows, client, ctx)
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

// Template download: header row + sample rows -> <name>_import_template.xlsx
export async function sendTemplate(res, name, headers, rows) {
  fs.mkdirSync(tempDir(), { recursive: true });
  const filePath = path.join(tempDir(), `template_${name}_${Date.now()}.xlsx`);
  await writeWorkbook(filePath, `${name} template`, headers, rows, null);
  res.download(filePath, `${name}_import_template.xlsx`, () => removeQuietly(filePath));
}

export function excelImport({ name, columns, sample, prepare = async () => ({}), check, save, duplicateKeys, groupBy, checkGroup, resultUrl }) {
  const headers = columns.map((c) => c.header);

  async function resultFile(file, suffix, sheet, extraHeaders, rows) {
    fs.mkdirSync(tempDir(), { recursive: true });
    const base = path.basename(file.originalname).replace(/\.[^/.]+$/, '').replace(/[^\w.-]+/g, '_');
    const fileName = `${Date.now()}_${base}_${suffix}.xlsx`;
    await writeWorkbook(path.join(tempDir(), fileName), sheet, [...headers, ...extraHeaders], rows, headers.length);
    return resultUrl(fileName);
  }

  // Checks every row; returns the units saved together: one per row, or one
  // per group (groupBy) where any error fails the whole group.
  async function assess(rows, ctx) {
    const seen = new Set();
    for (const row of rows) {
      const { errors = [], skip } = await check(row, ctx);
      Object.assign(row, { __errors: errors, __skip: skip });
      const keys = duplicateKeys ? duplicateKeys(row).filter(Boolean) : [];
      row.__duplicate = keys.some((k) => seen.has(k));
      keys.forEach((k) => seen.add(k));
    }
    if (!groupBy) return rows.map((row) => ({ rows: [row], errors: [] }));
    const groups = new Map();
    rows.forEach((row, i) => {
      const key = groupBy(row) || `__row${i}`;
      if (!groups.has(key)) groups.set(key, { rows: [], errors: [] });
      groups.get(key).rows.push(row);
    });
    for (const unit of groups.values()) unit.errors = checkGroup ? await checkGroup(unit.rows, ctx) : [];
    return [...groups.values()];
  }

  function reasonsOf(unit, row) {
    const reasons = [...unit.errors, ...row.__errors];
    if (row.__skip) reasons.push(row.__skip);
    if (row.__duplicate) reasons.push('Duplicate within this file');
    const unitFails = unit.errors.length || unit.rows.some((r) => r.__errors.length || r.__skip || r.__duplicate);
    if (!reasons.length && unitFails) reasons.push('Not imported: another row of this group has an error');
    return reasons;
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
        await sendTemplate(res, name, headers, (await sample()).map((r) => columns.map((c) => r[c.key] ?? '')));
      } catch (err) {
        fail(res, err, 'Template');
      }
    },

    async validate(req, res) {
      try {
        const rows = readRows(req.file, columns);
        const units = await assess(rows, await prepare(req));
        const results = [];
        for (const unit of units) {
          for (const row of unit.rows) {
            const reasons = reasonsOf(unit, row);
            results.push([...columns.map((c) => row[c.key]), reasons.length ? 'Fail' : 'Pass', reasons.join('; ')]);
          }
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
        const ctx = await prepare(req);
        const units = await assess(rows, ctx);
        const outcome = new Map(); // row -> [status, reason]
        await client.query('BEGIN');
        for (const [i, unit] of units.entries()) {
          const failed = unit.errors.length || unit.rows.some((r) => r.__errors.length);
          const skipped = unit.rows.some((r) => r.__skip || r.__duplicate);
          if (failed || skipped) {
            for (const row of unit.rows) {
              const reasons = reasonsOf(unit, row);
              const status = unit.errors.length || row.__errors.length || (failed && !row.__skip && !row.__duplicate) ? 'Failed' : 'Skipped';
              outcome.set(row, [status, reasons.join('; ')]);
            }
            continue;
          }
          const savepoint = `import_unit_${i}`;
          try {
            await client.query(`SAVEPOINT ${savepoint}`);
            await save(groupBy ? unit.rows : unit.rows[0], client, ctx);
            await client.query(`RELEASE SAVEPOINT ${savepoint}`);
            unit.rows.forEach((row) => outcome.set(row, ['Success', 'Imported']));
          } catch (err) {
            await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            if (!(err instanceof ServiceError)) console.error(`${name} import:`, err);
            unit.rows.forEach((row) => outcome.set(row, ['Failed', err.message || 'Unknown error']));
          }
        }
        await client.query('COMMIT');
        const results = rows.map((row) => [...columns.map((c) => row[c.key]), ...outcome.get(row)]);
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

// "a, b,c" -> ['a', 'b', 'c']
export const splitList = (value) => String(value || '').split(',').map((s) => s.trim()).filter(Boolean);

// Names -> ids with a finder returning matching rows; unknown names are
// reported as `${label} "name"` in missing.
export async function resolveNames(names, find, label, missing) {
  const ids = [];
  for (const name of names) {
    const rows = await find(name);
    if (rows && rows.length) ids.push(rows[0].id);
    else missing.push(`${label} "${name}"`);
  }
  return ids;
}
