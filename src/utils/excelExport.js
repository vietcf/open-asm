// One-sheet Excel download used by every list's "Export" button.
//   await sendExcel(res, {
//     filename: 'system-list', sheet: 'System List',
//     columns: [{ header: req.t('Name'), value: s => s.name, width: 30 }, ...],
//     rows: systems,
//   });
// Cell strings are guarded against formula injection; the date is appended
// to the file name.
import ExcelJS from 'exceljs';
import { sanitizeExcelValue } from './excelSafe.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Lists become "a, b"; dates YYYY-MM-DD HH:mm:ss; null/undefined empty.
function cellValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return sanitizeExcelValue(value.filter(v => v !== null && v !== undefined && v !== '').join(', '));
  if (value instanceof Date) return value.toISOString().replace('T', ' ').slice(0, 19);
  return sanitizeExcelValue(value);
}

export async function sendExcel(res, { filename, sheet, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheet);
  worksheet.columns = columns.map((c, i) => ({ header: c.header, key: `c${i}`, width: c.width || 25 }));
  worksheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    const record = {};
    columns.forEach((c, i) => { record[`c${i}`] = cellValue(c.value(row)); });
    worksheet.addRow(record);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}-${stamp}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}
