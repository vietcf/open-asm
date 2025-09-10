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

// Thêm cột scopes (kiểu JSONB) vào bảng systems
async function addScopesToSystems() {
  try {
    await pool.query(`ALTER TABLE systems ADD COLUMN IF NOT EXISTS scopes JSONB DEFAULT NULL;`);
    console.log('Added scopes column to systems table!');
    
    // Tạo GIN index cho performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_systems_scopes ON systems USING GIN (scopes);`);
    console.log('Created GIN index on scopes column!');
  } catch (err) {
    console.error('Add scopes column failed:', err);
  }
}

// Thêm cột architecture (kiểu JSONB) vào bảng systems
async function addArchitectureToSystems() {
  try {
    await pool.query(`ALTER TABLE systems ADD COLUMN IF NOT EXISTS architecture JSONB DEFAULT NULL;`);
    console.log('Added architecture column to systems table!');
    
    // Tạo GIN index cho performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_systems_architecture ON systems USING GIN (architecture);`);
    console.log('Created GIN index on architecture column!');
  } catch (err) {
    console.error('Add architecture column failed:', err);
  }
}

// Thêm cột updated_at và updated_by vào bảng subnets
async function addUpdatedFieldsToSubnets() {
  try {
    await pool.query(`ALTER TABLE subnets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
    console.log('Added updated_at column to subnets table!');
    
    await pool.query(`ALTER TABLE subnets ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255) DEFAULT NULL;`);
    console.log('Added updated_by column to subnets table!');
    
    // Tạo index cho updated_at để tối ưu sorting
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_subnets_updated_at ON subnets (updated_at DESC);`);
    console.log('Created index on updated_at column!');
  } catch (err) {
    console.error('Add updated fields to subnets failed:', err);
  }
}

// Thêm cột device_role vào bảng devices
async function addDeviceRoleToDevices() {
  try {
    await pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_role VARCHAR(255) DEFAULT NULL;`);
    console.log('Added device_role column to devices table!');
    
    // Tạo index cho device_role để tối ưu filtering
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_devices_device_role ON devices (device_role);`);
    console.log('Created index on device_role column!');
  } catch (err) {
    console.error('Add device_role column to devices failed:', err);
  }
}

(async () => {
  try {
    await addFqdnToSystems();
    await addScopesToSystems();
    await addArchitectureToSystems();
    await addUpdatedFieldsToSubnets();
    await addDeviceRoleToDevices();
  } catch (err) {
    console.error('Error running alter statements:', err);
  } finally {
    await pool.end();
  }
})();

