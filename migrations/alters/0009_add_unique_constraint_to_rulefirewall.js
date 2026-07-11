// Adds the (rulename, firewall_name, audit_batch) unique constraint to
// rulefirewall. Already part of the create_rulefirewall_table.js baseline for
// fresh installs — this file only matters for databases created before that
// constraint existed.
export default async (pool) => {
  const checkResult = await pool.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'rulefirewall'
    AND constraint_name = 'unique_rule_firewall_audit'
  `);
  if (checkResult.rows.length > 0) {
    console.log('Unique constraint unique_rule_firewall_audit already exists on rulefirewall table!');
    return;
  }
  await pool.query(`
    ALTER TABLE rulefirewall
    ADD CONSTRAINT unique_rule_firewall_audit
    UNIQUE (rulename, firewall_name, audit_batch);
  `);
  console.log('Added unique constraint (rulename, firewall_name, audit_batch) to rulefirewall table!');
};
