const { pool } = require('../config/config');
const alterTables = require('./alter');

(async () => {
  try {
    await alterTables(pool);
    console.log('All alter statements executed!');
  } catch (err) {
    console.error('Error running alter statements:', err);
  } finally {
    await pool.end();
  }
})();

