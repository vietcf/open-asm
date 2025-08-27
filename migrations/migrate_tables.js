import { pool } from '../config/config.js';

// Thêm cột fqdn (kiểu text[]) vào bảng systems
async function addFqdnToSystems() {
  try {
    await pool.query(`ALTER TABLE systems ADD COLUMN IF NOT EXISTS fqdn text[] DEFAULT '{}';`);
    console.log('Added fqdn column to systems table!');
  } catch (err) {
    console.error('Alter table failed:', err);
  }
}

(async () => {
  try {
    await addFqdnToSystems();
  } catch (err) {
    console.error('Error running alter statements:', err);
  } finally {
    await pool.end();
  }
})();

