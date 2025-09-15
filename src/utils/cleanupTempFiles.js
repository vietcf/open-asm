import fs from 'fs';
import path from 'path';

/**
 * Clean up old temporary files from uploads/temp directory
 * This function should be called periodically to prevent disk space issues
 */
export function cleanupOldTempFiles() {
  try {
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const tempDir = path.join(process.cwd(), uploadsDir, 'temp');
    
    if (!fs.existsSync(tempDir)) {
      return;
    }
    
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    let cleanedCount = 0;
    
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      // Delete files older than 24 hours
      if (now - stats.mtime.getTime() > maxAge) {
        try {
          fs.unlinkSync(filePath);
          cleanedCount++;
          console.log(`Cleaned up old temp file: ${file}`);
        } catch (err) {
          console.error(`Error deleting temp file ${file}:`, err);
        }
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`Cleanup completed: ${cleanedCount} old temp files removed`);
    }
    
  } catch (err) {
    console.error('Error during temp files cleanup:', err);
  }
}

/**
 * Clean up old uploaded files from uploads/import directory
 * This function should be called periodically to prevent disk space issues
 */
export function cleanupOldImportFiles() {
  try {
    const uploadsDir = process.env.UPLOADS_DIR || 'public/uploads';
    const importDir = path.join(process.cwd(), uploadsDir, 'import');
    
    if (!fs.existsSync(importDir)) {
      return;
    }
    
    const files = fs.readdirSync(importDir);
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    
    let cleanedCount = 0;
    
    files.forEach(file => {
      const filePath = path.join(importDir, file);
      const stats = fs.statSync(filePath);
      
      // Delete files older than 2 hours
      if (now - stats.mtime.getTime() > maxAge) {
        try {
          fs.unlinkSync(filePath);
          cleanedCount++;
          console.log(`Cleaned up old import file: ${file}`);
        } catch (err) {
          console.error(`Error deleting import file ${file}:`, err);
        }
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`Import cleanup completed: ${cleanedCount} old import files removed`);
    }
    
  } catch (err) {
    console.error('Error during import files cleanup:', err);
  }
}

/**
 * Run both cleanup functions
 */
export function runCleanup() {
  cleanupOldTempFiles();
  cleanupOldImportFiles();
}
