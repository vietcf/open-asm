import ExcelJS from 'exceljs';

async function generateFirewallTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Firewall Rule Template');

  // Define headers using long format
  const headers = [
    'Audit Batch (Required)',
    'Firewall Name (Required)',
    'Rule Name (Required)',
    'Source Zone',
    'Source (Required)',
    'Source Detail',
    'Destination Zone',
    'Destination (Required)',
    'Destination Detail',
    'Services',
    'Application',
    'URL',
    'Action (Required)',
    'Violation Type',
    'Violation Detail',
    'OU Name',
    'Contacts (comma-separated emails)',
    'Solution Proposal',
    'Solution Confirm',
    'Work Order',
    'Status',
    'Description',
    'Raw Data',
    'Tags (comma-separated IDs)'
  ];

  // Add headers to first row
  worksheet.addRow(headers);

  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '366092' }
  };

  // Add sample data
  const sampleData = [
    {
      'Audit Batch (Required)': '2024-01',
      'Firewall Name (Required)': 'Firewall-A',
      'Rule Name (Required)': 'Allow-HTTP-Web-Server',
      'Source Zone': 'DMZ',
      'Source (Required)': '192.168.1.0/24',
      'Source Detail': 'DMZ Web Servers',
      'Destination Zone': 'Internal',
      'Destination (Required)': '10.0.1.100',
      'Destination Detail': 'Internal Web Server',
      'Services': 'TCP/80',
      'Application': 'HTTP',
      'URL': 'https://example.com',
      'Action (Required)': 'allow',
      'Violation Type': '',
      'Violation Detail': '',
      'OU Name': 'IT Department',
      'Contacts (comma-separated emails)': 'admin@company.com,webadmin@company.com',
      'Solution Proposal': 'Allow HTTP traffic from DMZ to web server',
      'Solution Confirm': 'Solution confirmed by security team',
      'Work Order': 'WO-2024-001',
      'Status': 'active',
      'Description': 'Allow HTTP traffic from DMZ to internal web server',
      'Raw Data': 'config firewall policy\n  edit 1\n    set srcintf "dmz"\n    set dstintf "internal"\n    set srcaddr "192.168.1.0/24"\n    set dstaddr "10.0.1.100"\n    set action accept\n    set service "HTTP"\n  next\nend',
      'Tags (comma-separated IDs)': ''
    },
    {
      'Audit Batch (Required)': '2024-01',
      'Firewall Name (Required)': 'Firewall-B',
      'Rule Name (Required)': 'Deny-SSH-External',
      'Source Zone': 'External',
      'Source (Required)': '0.0.0.0/0',
      'Source Detail': 'External Internet',
      'Destination Zone': 'Internal',
      'Destination (Required)': '10.0.0.0/8',
      'Destination Detail': 'Internal Network',
      'Services': 'TCP/22',
      'Application': 'SSH',
      'URL': '',
      'Action (Required)': 'deny',
      'Violation Type': 'security_violation',
      'Violation Detail': 'SSH access from external networks is not allowed',
      'OU Name': 'Security Team',
      'Contacts (comma-separated emails)': 'security@company.com',
      'Solution Proposal': 'Block SSH access from external networks',
      'Solution Confirm': 'Security team confirmed blocking',
      'Work Order': 'WO-2024-002',
      'Status': 'active',
      'Description': 'Block SSH access from external networks to internal systems',
      'Raw Data': 'config firewall policy\n  edit 2\n    set srcintf "wan1"\n    set dstintf "internal"\n    set srcaddr "all"\n    set dstaddr "10.0.0.0/8"\n    set action deny\n    set service "SSH"\n  next\nend',
      'Tags (comma-separated IDs)': ''
    }
  ];

  // Add sample data rows
  sampleData.forEach(data => {
    const row = [];
    headers.forEach(header => {
      row.push(data[header] || '');
    });
    worksheet.addRow(row);
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = Math.max(column.width || 10, 15);
  });

  // Save the file
  const filename = 'firewall_rule_template_new.xlsx';
  await workbook.xlsx.writeFile(filename);
  console.log(`Template generated: ${filename}`);
}

generateFirewallTemplate().catch(console.error);
