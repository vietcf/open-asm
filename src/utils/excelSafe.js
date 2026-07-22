// Excel/CSV formula-injection guard. A cell string that starts with
// =, +, -, @, or a tab/CR is interpreted as a formula (or triggers DDE) by
// Excel/LibreOffice/Sheets when the file is opened, regardless of the cell
// actually being written as a plain string type. Any field that ultimately
// comes from free-text user input (name, description, manufacturer, etc.)
// must be neutralized before being written to a worksheet.
const DANGEROUS_LEADING_CHARS = /^[=+\-@\t\r]/;

function sanitizeExcelValue(value) {
  if (typeof value !== 'string') return value;
  return DANGEROUS_LEADING_CHARS.test(value) ? `'${value}` : value;
}

// Sanitizes every string cell in a row array in place order (returns a new
// array) — use when calling worksheet.addRow([...]) with user-controlled
// values mixed into the row.
function sanitizeExcelRow(row) {
  return row.map(sanitizeExcelValue);
}

// Same, for the object-keyed form: worksheet.addRow({ col1: val1, ... })
// used together with worksheet.columns key definitions.
function sanitizeExcelObject(obj) {
  const out = {};
  for (const key of Object.keys(obj)) {
    out[key] = sanitizeExcelValue(obj[key]);
  }
  return out;
}

export { sanitizeExcelValue, sanitizeExcelRow, sanitizeExcelObject };
