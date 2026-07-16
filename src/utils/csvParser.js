// Minimal RFC4180-style CSV line parser: handles double-quoted fields that
// contain commas and "" as an escaped quote. Several import templates in
// this app use header text with a literal comma inside parentheses (e.g.
// "Tag (Optional, comma-separated if multiple)"), so a naive
// line.split(',') silently misaligns every column after the first quoted
// comma - this is what any spreadsheet program produces for such a header
// when saving as CSV.
export function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}
