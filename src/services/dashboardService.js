import { pool } from '../../config/config.js';

// Bootstrap success/warning/danger — same tiers used for the Subnet Detail
// usage donut, kept consistent here.
function usageColor(pct) {
  return pct >= 90 ? 'danger' : (pct >= 70 ? 'warning' : 'success');
}

export async function getDashboardStats() {
  const [
    systems, servers, devices, ipAddresses, subnets, domains, contacts, rules
  ] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM systems'),
    pool.query('SELECT COUNT(*) FROM servers'),
    pool.query('SELECT COUNT(*) FROM devices'),
    pool.query('SELECT COUNT(*) FROM ip_addresses'),
    pool.query('SELECT COUNT(*) FROM subnets'),
    pool.query('SELECT COUNT(*) FROM domains'),
    pool.query('SELECT COUNT(*) FROM contacts'),
    pool.query('SELECT COUNT(*) FROM rulefirewall')
  ]);

  const counts = {
    systems: parseInt(systems.rows[0].count, 10),
    servers: parseInt(servers.rows[0].count, 10),
    devices: parseInt(devices.rows[0].count, 10),
    ipAddresses: parseInt(ipAddresses.rows[0].count, 10),
    subnets: parseInt(subnets.rows[0].count, 10),
    domains: parseInt(domains.rows[0].count, 10),
    contacts: parseInt(contacts.rows[0].count, 10),
    rules: parseInt(rules.rows[0].count, 10)
  };

  // IP status breakdown — blank/null status grouped as its own "Unset"
  // bucket rather than silently dropped, since a large share of rows here
  // actually have no status set.
  const ipStatusResult = await pool.query(`
    SELECT COALESCE(NULLIF(TRIM(status), ''), 'Unset') AS status, COUNT(*) AS count
    FROM ip_addresses
    GROUP BY 1
    ORDER BY count DESC
  `);
  const ipTotal = counts.ipAddresses || 1;
  const ipStatusBreakdown = ipStatusResult.rows.map(row => ({
    label: row.status.charAt(0).toUpperCase() + row.status.slice(1),
    count: parseInt(row.count, 10),
    pct: Math.round((parseInt(row.count, 10) / ipTotal) * 100)
  }));

  // Device type breakdown
  const deviceTypeResult = await pool.query(`
    SELECT COALESCE(dt.name, 'Unspecified') AS type, COUNT(*) AS count
    FROM devices d
    LEFT JOIN device_types dt ON d.device_type_id = dt.id
    GROUP BY dt.name
    ORDER BY count DESC
  `);
  const deviceTotal = counts.devices || 1;
  const deviceTypeBreakdown = deviceTypeResult.rows.map(row => ({
    label: row.type,
    count: parseInt(row.count, 10),
    pct: Math.round((parseInt(row.count, 10) / deviceTotal) * 100)
  }));

  // Subnet utilization — same "existing IP records / 2^(32-prefix)" formula
  // used by the Subnet Detail usage chart, computed here in one aggregate
  // query instead of one round-trip per subnet.
  const subnetUsageResult = await pool.query(`
    SELECT s.id, s.address, s.description, masklen(s.address) AS prefix, COUNT(ip.id) AS used_count
    FROM subnets s
    LEFT JOIN ip_addresses ip ON ip.ip_address::inet <<= s.address
    GROUP BY s.id
  `);
  const subnetUsage = subnetUsageResult.rows
    .map(row => {
      const prefix = parseInt(row.prefix, 10);
      const usedCount = parseInt(row.used_count, 10);
      const totalIPs = Math.pow(2, 32 - prefix);
      const pct = totalIPs > 0 ? Math.min(100, Math.round((usedCount / totalIPs) * 100)) : 0;
      return {
        id: row.id,
        address: row.address,
        description: row.description,
        usedCount,
        totalIPs,
        pct,
        color: usageColor(pct)
      };
    })
    .sort((a, b) => b.pct - a.pct || b.usedCount - a.usedCount)
    .slice(0, 6);

  return { counts, ipStatusBreakdown, deviceTypeBreakdown, subnetUsage };
}
