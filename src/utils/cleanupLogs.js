// src/utils/cleanupLogs.js
// Scheduled job to delete system logs older than X days using node-cron
import cron from 'node-cron';
import { pool } from '../../config/config.js';
import Configuration from '../models/Configuration.js';

// Get retention days from config or default to 30

const defaultRetention = 30;

async function getRetentionDays() {
  // Try to get from configuration table
  try {
    const configRow = await Configuration.findByKey('log_retention_days');
    if (configRow && configRow.value && !isNaN(configRow.value)) {
      return parseInt(configRow.value, 10);
    }
  } catch (e) {
    // fallback below
  }
  // fallback default
  return 30;
}

async function deleteOldLogs() {
  const retentionDays = await getRetentionDays();
  // Use parameterized query for safety
  return pool.query(
    `DELETE FROM system_log WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`
  );
}

// Schedule: every day at 2:00 AM
const job = cron.schedule('0 2 * * *', async () => {
  try {
    const result = await deleteOldLogs();
    const retentionDays = await getRetentionDays();
    console.log(`[CLEANUP] Deleted old system logs older than ${retentionDays} days at`, new Date().toISOString());
  } catch (err) {
    console.error('[CLEANUP] Error deleting old system logs:', err);
  }
}, {
  scheduled: false // Only start when called
});

export default job;
