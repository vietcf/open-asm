// Cleanup follow-up to migrations/alters/0006_add_device_server_ip.js: drops
// the legacy ip_addresses.device_id / ip_addresses.server_id scalar columns.
//
// By the time you run this, every read/write path (web UI, REST API, model
// layer) has already moved to device_ip/server_ip — these columns are dead
// weight, kept around only as a safety net during rollout.
//
// DELIBERATELY kept OUTSIDE migrations/alters/ so it never auto-runs via
// `node migrations/alters/run.js` (which applies every new file in that
// folder on every deploy, unconditionally). This is an irreversible,
// one-off cleanup step — it must only run when YOU explicitly invoke it:
//
//   docker exec openasm_app node migrations/manual/0007_drop_legacy_ip_owner_columns.js
//
// (or `node migrations/manual/0007_drop_legacy_ip_owner_columns.js` locally
// if connecting directly to the DB). Take a fresh backup first — this
// migration system has no down()/rollback.
import { pool } from '../../config/config.js';

async function run() {
  try {
    console.log('Dropping ip_addresses.device_id / ip_addresses.server_id...');
    await pool.query('ALTER TABLE ip_addresses DROP COLUMN IF EXISTS device_id;');
    await pool.query('ALTER TABLE ip_addresses DROP COLUMN IF EXISTS server_id;');
    console.log('Done.');
  } catch (err) {
    console.error('Failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
