// Does not truncate contacts — this is sample DATA seeding, not a reset
// script, and TRUNCATE ... CASCADE would silently wipe every real contact
// plus every table that references one (device/system/server/IP contacts).
export default async (pool) => {
  const { rows: unitRows } = await pool.query('SELECT id, code FROM units');
  const unitMap = {};
  unitRows.forEach(u => { unitMap[u.code] = u.id; });

  const contacts = [
    { name: 'Nguyen Van A', email: 'a@example.com', phone: '0901234567', unit_code: 'IT', position: 'Manager' },
    { name: 'Tran Thi B', email: 'b@example.com', phone: '0912345678', unit_code: 'HR', position: 'Staff' },
    { name: 'Le Van C', email: 'c@example.com', phone: '0923456789', unit_code: 'FIN', position: 'Accountant' },
    { name: 'Pham Thi D', email: 'd@example.com', phone: '0934567890', unit_code: 'IT', position: 'Engineer' },
    { name: 'Hoang Van E', email: 'e@example.com', phone: '0945678901', unit_code: 'HR', position: 'Technician' },
  ];
  // contacts has no unique constraint on name/email, so ON CONFLICT DO
  // NOTHING would have nothing to key off — check existence explicitly
  // instead, so re-running this seed doesn't create duplicate rows.
  for (const c of contacts) {
    const { rows: existing } = await pool.query('SELECT id FROM contacts WHERE email = $1', [c.email]);
    if (existing.length > 0) continue;
    await pool.query(
      `INSERT INTO contacts (name, email, phone, unit_id, position)
       VALUES ($1, $2, $3, $4, $5);`,
      [c.name, c.email, c.phone, unitMap[c.unit_code] || null, c.position]
    );
  }
};