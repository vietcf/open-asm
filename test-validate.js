// Test validate endpoint
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

console.log('=== Testing Validate Endpoint ===');

// Create a simple test Excel file
const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Test');

// Add headers
worksheet.addRow([
  'Audit Batch (Required)',
  'Firewall Name',
  'Rule Name',
  'Source Zone',
  'Source',
  'Source Detail',
  'Destination Zone',
  'Destination',
  'Destination Detail',
  'Services',
  'Application',
  'URL',
  'Action',
  'Violation Type',
  'Violation Detail',
  'OU Name',
  'Contacts (comma-separated emails)',
  'Solution Proposal',
  'Solution Confirm',
  'Work Order',
  'Status',
  'Description',
  'Tags'
]);

// Add sample data
worksheet.addRow([
  '2024-01',
  'Test Firewall',
  'Test Rule',
  'Internal',
  '192.168.1.0/24',
  'Test Source',
  'External',
  '0.0.0.0/0',
  'Test Destination',
  'HTTP',
  'Web',
  'https://example.com',
  'ALLOW',
  'OUT-TO-CDE',
  'Test Violation',
  'IT Department',
  'admin@company.com',
  'Test Solution',
  'Test Confirm',
  'WO-001',
  'ACTIVE',
  'Test Description',
  'Test Tag'
]);

// Save test file
const testFilePath = 'test-validate.xlsx';
await workbook.xlsx.writeFile(testFilePath);
console.log('Test file created:', testFilePath);

// Test the endpoint
try {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(testFilePath));
  
  const response = await fetch('http://localhost:3000/firewall/rule/validate-import', {
    method: 'POST',
    body: formData,
    headers: {
      'Cookie': 'connect.sid=s%3Ayour-session-id' // You'll need to replace this with a real session
    }
  });
  
  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  
  const contentType = response.headers.get('content-type');
  console.log('Content-Type:', contentType);
  
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    console.log('JSON Response:', data);
  } else {
    const text = await response.text();
    console.log('Text Response (first 500 chars):', text.substring(0, 500));
  }
  
} catch (error) {
  console.error('Request error:', error.message);
}

// Clean up
fs.unlinkSync(testFilePath);
console.log('Test file cleaned up');
