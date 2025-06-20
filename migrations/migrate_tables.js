const { pool } = require('../config/config');

async function alterTables() {
  try {
    // Thêm trường system_id và unique (name, system_id) vào bảng priv_permissions nếu chưa có
    await pool.query(`ALTER TABLE priv_permissions ADD COLUMN IF NOT EXISTS system_id INTEGER NOT NULL;`);
    await pool.query(`DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE tablename = 'priv_permissions' AND indexname = 'priv_permissions_name_system_id_key'
        ) THEN
          ALTER TABLE priv_permissions ADD CONSTRAINT priv_permissions_name_system_id_key UNIQUE (name, system_id);
        END IF;
      END
    $$;`);
  } catch (err) {
    console.error('Alter table failed:', err);
  }
}

(async () => {
  try {
    await alterTables();
    console.log('All alter statements executed!');
  } catch (err) {
    console.error('Error running alter statements:', err);
  } finally {
    await pool.end();
  }
})();

