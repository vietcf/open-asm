// 0024_service_mapping_drop_device
// A service mapping no longer stores a device: the device (or server) is the
// one holding the mapping's frontend IP (device_ip / server_ip), looked up when
// read; an IP nothing holds just shows the IP. The device_id column is dropped.
// Mappings whose stored device does not hold their IP lose that link; they are
// listed in the migration output (link the IP to the device as a VIP on the
// device page to show it again).

export async function up(db) {
  const { rows: lost } = await db.query(`
    SELECT vs.name AS mapping, d.name AS device, ip.ip_address
      FROM virtual_servers vs JOIN devices d ON d.id = vs.device_id JOIN ip_addresses ip ON ip.id = vs.ip_address_id
     WHERE NOT EXISTS (SELECT 1 FROM device_ip di WHERE di.device_id = vs.device_id AND di.ip_id = vs.ip_address_id)
     ORDER BY vs.name`);
  if (lost.length) {
    console.log(`0024: ${lost.length} service mapping(s) had a device that does not hold their IP (link dropped):`);
    for (const r of lost) console.log(`  ${r.mapping}: ${r.device} (IP ${r.ip_address})`);
  }
  await db.query('DROP INDEX IF EXISTS idx_vs_device');
  await db.query('ALTER TABLE virtual_servers DROP COLUMN device_id');
}
