// src/utils/backupJob.js
// Scheduled job to backup database using node-cron
import cron from 'node-cron';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get backup configuration from environment variables
const getBackupConfig = () => {
  return {
    // Backup frequency: daily, weekly, monthly
    frequency: process.env.BACKUP_FREQUENCY || 'daily',
    // Number of backups to keep
    retention: parseInt(process.env.BACKUP_RETENTION) || 7,
    // Backup directory (default: backups folder in app root)
    backupDir: process.env.BACKUP_DIR || path.join(__dirname, '../../backups'),
    // Database connection info - use Docker service names
    dbHost: process.env.POSTGRES_HOST || 'postgres', // Docker service name
    dbUser: process.env.POSTGRES_USER || 'postgres',
    dbName: process.env.POSTGRES_DB || 'open_asm',
    dbPassword: process.env.POSTGRES_PASSWORD || '',
    dbPort: process.env.POSTGRES_PORT || '5432'
  };
};

// Create backup directory if it doesn't exist
const ensureBackupDir = (backupDir) => {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`[BACKUP] Created backup directory: ${backupDir}`);
  }
};

// Create database backup
const createBackup = async () => {
  const config = getBackupConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup_${timestamp}.sql.gz`;
  const backupPath = path.join(config.backupDir, backupFileName);
  
  // Ensure backup directory exists
  ensureBackupDir(config.backupDir);
  
  // Set PGPASSWORD environment variable for pg_dump
  const env = { ...process.env, PGPASSWORD: config.dbPassword };
  
  // Create pg_dump command for Docker container
  const command = `pg_dump -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -d ${config.dbName} --no-password | gzip > "${backupPath}"`;
  
  console.log(`[BACKUP] Executing command: ${command}`);
  
  return new Promise((resolve, reject) => {
    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[BACKUP] Command failed: ${error.message}`);
        console.error(`[BACKUP] stderr: ${stderr}`);
        reject(error);
      } else {
        // Check if backup file was created and has content
        if (fs.existsSync(backupPath)) {
          const stats = fs.statSync(backupPath);
          if (stats.size > 0) {
            resolve({
              filename: backupFileName,
              path: backupPath,
              size: stats.size,
              created_at: new Date()
            });
          } else {
            reject(new Error('Backup file is empty'));
          }
        } else {
          reject(new Error('Backup file was not created'));
        }
      }
    });
  });
};

// Clean up old backups (keep only the specified number)
const cleanupOldBackups = async () => {
  const config = getBackupConfig();
  
  if (!fs.existsSync(config.backupDir)) {
    return;
  }
  
  try {
    const files = fs.readdirSync(config.backupDir)
      .filter(file => file.startsWith('backup_') && file.endsWith('.sql.gz'))
      .map(file => {
        const filePath = path.join(config.backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          created_at: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Remove old backups if we have more than retention limit
    if (files.length > config.retention) {
      const filesToDelete = files.slice(config.retention);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`[BACKUP] Deleted old backup: ${file.filename}`);
      }
    }
  } catch (error) {
    console.error('[BACKUP] Error cleaning up old backups:', error);
  }
};

// Get cron schedule based on frequency
const getCronSchedule = (frequency) => {
  switch (frequency.toLowerCase()) {
    case 'daily':
      return '0 2 * * *'; // Every day at 2:00 AM
    case 'weekly':
      return '0 2 * * 0'; // Every Sunday at 2:00 AM
    case 'monthly':
      return '0 2 1 * *'; // First day of month at 2:00 AM
    default:
      return '0 2 * * *'; // Default to daily
  }
};

// Main backup function
const runBackup = async () => {
  try {
    const config = getBackupConfig();
    console.log(`[BACKUP] Starting database backup (${config.frequency})...`);
    
    const backup = await createBackup();
    const fileSizeMB = (backup.size / (1024 * 1024)).toFixed(2);
    
    console.log(`[BACKUP] Database backup completed successfully!`);
    console.log(`[BACKUP] File: ${backup.filename}`);
    console.log(`[BACKUP] Size: ${fileSizeMB} MB`);
    console.log(`[BACKUP] Location: ${backup.path}`);
    
    // Clean up old backups
    await cleanupOldBackups();
    
  } catch (error) {
    console.error('[BACKUP] Error creating database backup:', error);
  }
};

// Create cron job
const createBackupJob = () => {
  const config = getBackupConfig();
  const schedule = getCronSchedule(config.frequency);
  
  console.log(`[BACKUP] Backup job configured:`);
  console.log(`[BACKUP] - Frequency: ${config.frequency}`);
  console.log(`[BACKUP] - Schedule: ${schedule}`);
  console.log(`[BACKUP] - Retention: ${config.retention} backups`);
  console.log(`[BACKUP] - Directory: ${config.backupDir}`);
  
  const job = cron.schedule(schedule, runBackup);
  
  return job;
};

// Export the job with start method
const backupJob = createBackupJob();

export default {
  start: () => {
    console.log('[BACKUP] Starting backup job...');
    // Job is already started when created
    return backupJob;
  },
  stop: () => {
    console.log('[BACKUP] Stopping backup job...');
    backupJob.stop();
  }
};
