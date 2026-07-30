// migrations/seed_devices.js
// Seed sample devices data
//
// device_type_id/platform_id are looked up by name rather than hardcoded,
// since IDs aren't guaranteed to start at 1 on a non-pristine database —
// same class of bug fixed in seed_servers.js.

export default async (pool) => {
  const { rows: typeRows } = await pool.query('SELECT id, name FROM device_types');
  const typeMap = {};
  typeRows.forEach(t => { typeMap[t.name] = t.id; });

  const { rows: platformRows } = await pool.query('SELECT id, name FROM platforms');
  const platformMap = {};
  platformRows.forEach(p => { platformMap[p.name] = p.id; });
  const anyPlatformId = platformRows.length > 0 ? platformRows[0].id : null;

  const devices = [
    { name: 'Router Core', serial: 'SN123456', type: 'Router', location: 'Data Center 1', mgmt: '10.0.0.1', desc: 'Core router for main site', mfr: 'Cisco', role: 'Core Router' },
    { name: 'Switch Edge', serial: 'SN654321', type: 'Switch', location: 'Branch Office', mgmt: '10.0.1.1', desc: 'Edge switch for branch', mfr: 'Juniper', role: 'Edge Switch' },
    { name: 'Firewall Main', serial: 'SN987654', type: 'Firewall', location: 'Data Center 2', mgmt: '10.0.2.1', desc: 'Main firewall', mfr: 'Fortinet', role: 'Security Gateway' },
    { name: 'Access Point', serial: 'SN111222', type: 'Network', location: 'Office Floor 3', mgmt: '10.0.3.1', desc: 'WiFi AP', mfr: 'Ubiquiti', role: 'Wireless Access Point' },
    { name: 'Server KVM', serial: 'SN333444', type: 'Server', location: 'Server Room', mgmt: '10.0.4.1', desc: 'KVM over IP device', mfr: 'Dell', role: 'Remote Management' },
  ];

  // devices has no unique constraint, so ON CONFLICT can't target
  // anything — check existence explicitly instead.
  for (const d of devices) {
    const { rows: existing } = await pool.query('SELECT id FROM devices WHERE name = $1', [d.name]);
    if (existing.length > 0) continue;
    await pool.query(
      `INSERT INTO devices (name, serial_number, device_type_id, platform_id, location, management_address, description, manufacturer, device_role, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'admin');`,
      [d.name, d.serial, typeMap[d.type] || null, anyPlatformId, d.location, d.mgmt, d.desc, d.mfr, d.role]
    );
  }
};
