// Dashboard figures. Only the sections the user may see are queried.
import { pool } from '../../../config/config.js';
import { loadOptions } from '../../shared/service.js';

// Stat tiles: key -> [table, permission]
export const TILES = {
  systems: ['systems', 'system.read'],
  servers: ['servers', 'server.read'],
  devices: ['devices', 'device.read'],
  ipAddresses: ['ip_addresses', 'ip_address.read'],
  subnets: ['subnets', 'subnet.read'],
  domains: ['domains', 'domain.read'],
  contacts: ['contacts', 'contact.read'],
  rules: ['rulefirewall', 'rule.read'],
  pentestRounds: ['pentest_rounds', 'pentest.read'],
};

const SUBNETS_SHOWN = 6;
const toInt = (v) => parseInt(v, 10) || 0;
const share = (count, total) => (total ? Math.round((count / total) * 100) : 0);

async function countRows(keys) {
  if (!keys.length) return {};
  const { rows } = await pool.query(`SELECT ${keys.map((k) => `(SELECT COUNT(*) FROM ${TILES[k][0]}) AS "${k}"`).join(', ')}`);
  return Object.fromEntries(keys.map((k) => [k, toInt(rows[0][k])]));
}

// [{value, label, count, pct}]; a blank status is its own "not set" bucket (value '')
async function ipStatusBreakdown() {
  const [{ rows }, options] = await Promise.all([
    pool.query(`SELECT COALESCE(NULLIF(TRIM(status), ''), '') AS status, COUNT(*) AS count FROM ip_addresses GROUP BY 1 ORDER BY count DESC`),
    loadOptions('ip_address_status'),
  ]);
  const total = rows.reduce((sum, r) => sum + toInt(r.count), 0);
  return rows.map((r) => ({
    value: r.status, label: options.find((o) => o.id === r.status)?.text ?? r.status, count: toInt(r.count), pct: share(toInt(r.count), total),
  }));
}

async function deviceTypeBreakdown() {
  const { rows } = await pool.query(`
    SELECT dt.name AS type, COUNT(*) AS count
    FROM devices d LEFT JOIN device_types dt ON dt.id = d.device_type_id
    GROUP BY dt.name ORDER BY count DESC`);
  const total = rows.reduce((sum, r) => sum + toInt(r.count), 0);
  return rows.map((r) => ({ label: r.type, count: toInt(r.count), pct: share(toInt(r.count), total) }));
}

// Most used subnets: existing IP records / addresses in the subnet (same formula as the Subnet detail)
async function subnetUsage() {
  const { rows } = await pool.query(`
    SELECT s.id, s.address, s.description, used, size
    FROM (
      SELECT s.id, s.address, s.description, COUNT(ip.id) AS used,
             power(2, (CASE WHEN family(s.address) = 6 THEN 128 ELSE 32 END) - masklen(s.address)) AS size
      FROM subnets s
      LEFT JOIN ip_addresses ip ON ip.ip_address::inet <<= s.address
      GROUP BY s.id
    ) s
    ORDER BY used / size DESC, used DESC
    LIMIT $1`, [SUBNETS_SHOWN]);
  return rows.map((r) => {
    const pct = Math.min(100, share(toInt(r.used), Number(r.size)));
    return {
      id: r.id, address: r.address, description: r.description, usedCount: toInt(r.used), totalIPs: Number(r.size), pct,
      color: pct >= 90 ? 'danger' : (pct >= 70 ? 'warning' : 'success'),
    };
  });
}

// can: permission check of the current user
export async function getDashboardStats(can) {
  const [counts, ipStatus, deviceTypes, subnets] = await Promise.all([
    countRows(Object.keys(TILES).filter((k) => can(TILES[k][1]))),
    can('ip_address.read') ? ipStatusBreakdown() : null,
    can('device.read') ? deviceTypeBreakdown() : null,
    can('subnet.read') ? subnetUsage() : null,
  ]);
  return { counts, ipStatus, deviceTypes, subnets };
}
