// migrations/rm_tables.js
// Script to drop all tables in the connected database

import { pool } from '../config/config.js';

async function dropAllTables() {
  try {
    // Lấy danh sách tất cả các bảng trong schema public
    const result = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const tables = result.rows.map(row => row.tablename);
    // Disable triggers (tương tự disable FK check)
    await pool.query('SET session_replication_role = replica;');
    for (const table of tables) {
      await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
      console.log(`Dropped table: ${table}`);
    }
    // Enable triggers lại
    await pool.query('SET session_replication_role = DEFAULT;');
    console.log('All tables dropped successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error dropping tables:', err);
    process.exit(1);
  }
}

dropAllTables();
