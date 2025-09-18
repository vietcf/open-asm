// Debug script for validateImportRules
import { config, pool } from './config/config.js';
import Unit from './src/models/Unit.js';
import Contact from './src/models/Contact.js';
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

console.log('=== Debug Validate Import Rules ===');

// Test 1: Check if models are working
console.log('Testing Unit model...');
try {
  const unit = await Unit.findByName('IT Department');
  console.log('Unit model test:', unit ? 'OK' : 'No unit found');
} catch (err) {
  console.error('Unit model error:', err.message);
}

console.log('Testing Contact model...');
try {
  const contact = await Contact.findByEmailSearch('admin@company.com');
  console.log('Contact model test:', contact ? 'OK' : 'No contact found');
} catch (err) {
  console.error('Contact model error:', err.message);
}

// Test 2: Check if ExcelJS is working
console.log('Testing ExcelJS...');
try {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Test');
  worksheet.addRow(['Test', 'Data']);
  console.log('ExcelJS test: OK');
} catch (err) {
  console.error('ExcelJS error:', err.message);
}

// Test 3: Check if XLSX is working
console.log('Testing XLSX...');
try {
  const testData = [['Header1', 'Header2'], ['Data1', 'Data2']];
  const worksheet = XLSX.utils.aoa_to_sheet(testData);
  console.log('XLSX test: OK');
} catch (err) {
  console.error('XLSX error:', err.message);
}

console.log('=== Debug Complete ===');
