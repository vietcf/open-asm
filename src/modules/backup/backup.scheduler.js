// Runs the scheduled backup. The schedule is read from System Configuration;
// reschedule() applies a change without restarting the app.
import cron from 'node-cron';
import * as backupService from './backup.service.js';

let task = null;

// frequency -> cron expression at `hour`:00 (weekly: Sunday, monthly: 1st)
export function cronExpression({ frequency, hour }) {
  if (frequency === 'weekly') return `0 ${hour} * * 0`;
  if (frequency === 'monthly') return `0 ${hour} 1 * *`;
  return `0 ${hour} * * *`;
}

async function runScheduled() {
  try {
    const backup = await backupService.createBackup('backup');
    console.log(`[BACKUP] Created ${backup.name} (${(backup.size / 1048576).toFixed(2)} MB)`);
  } catch (err) {
    console.error(`[BACKUP] Scheduled backup failed: ${err.message}`);
  }
}

export async function reschedule() {
  if (task) {
    task.stop();
    task = null;
  }
  const settings = await backupService.getSettings();
  if (!settings.enabled) {
    console.log('[BACKUP] Scheduled backup is off');
    return;
  }
  const expression = cronExpression(settings);
  task = cron.schedule(expression, runScheduled);
  console.log(`[BACKUP] Scheduled ${settings.frequency} at ${String(settings.hour).padStart(2, '0')}:00 (${expression}), keeping ${settings.retention}; directory ${backupService.backupDir()}`);
}

backupService.onRestore(reschedule);
