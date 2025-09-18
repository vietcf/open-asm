// Test script to parse Excel file
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('=== Testing Excel File Parsing ===');

// Find the latest uploaded file
const uploadsDir = 'uploads/';
if (!fs.existsSync(uploadsDir)) {
  console.log('Uploads directory does not exist');
  process.exit(1);
}

const files = fs.readdirSync(uploadsDir)
  .filter(file => file.endsWith('.xlsx'))
  .map(file => ({
    name: file,
    path: path.join(uploadsDir, file),
    stats: fs.statSync(path.join(uploadsDir, file))
  }))
  .sort((a, b) => b.stats.mtime - a.stats.mtime);

if (files.length === 0) {
  console.log('No Excel files found in uploads directory');
  process.exit(1);
}

const latestFile = files[0];
console.log('Testing file:', latestFile.name);
console.log('File path:', latestFile.path);
console.log('File size:', latestFile.stats.size, 'bytes');
console.log('File exists:', fs.existsSync(latestFile.path));

try {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(latestFile.path);
  console.log('Workbook loaded successfully');
  console.log('Sheet names:', workbook.SheetNames);
  
  if (workbook.SheetNames.length === 0) {
    console.log('No sheets found in workbook');
    process.exit(1);
  }
  
  const sheetName = workbook.SheetNames[0];
  console.log('Using sheet:', sheetName);
  
  const worksheet = workbook.Sheets[sheetName];
  console.log('Worksheet loaded successfully');
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('JSON data length:', jsonData.length);
  
  if (jsonData.length === 0) {
    console.log('No data found in sheet');
    process.exit(1);
  }
  
  console.log('Headers:', jsonData[0]);
  console.log('First data row:', jsonData[1]);
  console.log('Total rows:', jsonData.length);
  
  if (jsonData.length < 2) {
    console.log('ERROR: File has insufficient data rows');
    process.exit(1);
  }
  
  console.log('✅ Excel file parsing successful!');
  
} catch (error) {
  console.error('❌ Error parsing Excel file:', error.message);
  console.error('Error details:', {
    name: error.name,
    code: error.code,
    stack: error.stack
  });
  process.exit(1);
}
