// migrations/init_data.js
// Khởi tạo dữ liệu mẫu cho user, permission, role, configure
import { pool } from '../config/config.js';
import bcrypt from 'bcrypt';

async function seedUsers(pool) {
  // Lấy id của role superadmin
  const { rows } = await pool.query(`SELECT id FROM roles WHERE name = 'superadmin' LIMIT 1`);
  if (!rows.length) throw new Error('Role superadmin not found');
  const superadminRoleId = rows[0].id;
  // Seed admin user
  const hashedPassword = await bcrypt.hash('admin', 10);
  await pool.query(`
    INSERT INTO users (username, password_hash, email, fullname, role_id)
    VALUES ('admin', '${hashedPassword}', 'admin@example.com', 'Administrator', $1)
    ON CONFLICT (username) DO NOTHING;
  `, [superadminRoleId]);
}

async function seedPermissionsAndRoles(pool) {
  // Seed roles
  await pool.query(`
    INSERT INTO roles (name, description) VALUES
      ('superadmin', 'Full system administrator'),
      ('admin', 'System administrator'),
      ('viewer', 'Read-only user')
    ON CONFLICT (name) DO NOTHING;
  `);

  // Seed permissions
  const entities = [
    'user', 'device', 'device_type', 'domain', 'unit', 'tag', 'agent', 'contact',
    'server', 'subnet', 'platform', 'service', 'system', 'ip_address',
    'role', 'permission',
    'configuration', 'system_log',
    'priv_account', 'priv_role', 'priv_permission', 'rule'
  ];
  const actions = ['create', 'read', 'update', 'delete'];
  const permissionValues = [];
  for (const entity of entities) {
    for (const action of actions) {
      permissionValues.push(`('${entity}.${action}', '${action.charAt(0).toUpperCase() + action.slice(1)} ${entity.replace('_', ' ')}')`);
    }
  }
  await pool.query(`
    INSERT INTO permissions (name, description) VALUES
      ${permissionValues.join(',\n      ')}
    ON CONFLICT (name) DO NOTHING;
  `);

  // Map role to permission
  // Get role ids
  const { rows: roleRows } = await pool.query('SELECT id, name FROM roles');
  const { rows: permRows } = await pool.query('SELECT id, name FROM permissions');
  const roleMap = Object.fromEntries(roleRows.map(r => [r.name, r.id]));
  const permMap = Object.fromEntries(permRows.map(p => [p.name, p.id]));

  // Superadmin: all permissions
  for (const permId of Object.values(permMap)) {
    await pool.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleMap['superadmin'], permId]
    );
  }
  // Admin: all except user, role, permission
  for (const permName of Object.keys(permMap)) {
    if (!permName.startsWith('user.') && !permName.startsWith('role.') && !permName.startsWith('permission.')) {
      await pool.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleMap['admin'], permMap[permName]]
      );
    }
  }
  // Viewer: chỉ quyền đọc, trừ user, role, permission
  for (const permName of Object.keys(permMap)) {
    if (permName.endsWith('.read') && !permName.startsWith('user.') && !permName.startsWith('role.') && !permName.startsWith('permission.')) {
      await pool.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleMap['viewer'], permMap[permName]]
      );
    }
  }
}

async function seedConfiguration(pool) {
  // Thêm cấu hình mặc định nếu cần
  try {
  await pool.query(`INSERT INTO configuration (key, value, description) VALUES ('site_name', 'VCB ASM', 'Cấu hình sitename') ON CONFLICT (key) DO NOTHING;`);
  await pool.query(`INSERT INTO configuration (key, value, description) VALUES ('page_size', '10,20,50', 'Cấu hình page size') ON CONFLICT (key) DO NOTHING;`);
  await pool.query(`INSERT INTO configuration (key, value, description) VALUES ('log_level', 'info', 'Cấu hình level log') ON CONFLICT (key) DO NOTHING;`);
  await pool.query(`INSERT INTO configuration (key, value, description) VALUES ('log_retention_days', '30', 'Số ngày lưu log') ON CONFLICT (key) DO NOTHING;`);


    // Chèn trực tiếp các giá trị JSON khởi tạo cho các cấu hình động
    // Định nghĩa cấu hình động dạng JS object, dễ đọc và bảo trì
    const dynamicConfigs = [
      {
        key: 'firewall_name',
        value: [
          { key: 'USER', label: 'USER' },
          { key: 'SERVER', label: 'SERVER' },
          { key: 'INTERNET-IN', label: 'INTERNET-IN' },
          { key: 'INTERNET-OUT', label: 'INTERNET-OUT' },
          { key: 'BACKBOND', label: 'BACKBOND' },
          { key: 'DMZ', label: 'DMZ' },
          { key: 'PARTNER', label: 'PARTNER' },
          { key: 'DIGI', label: 'DIGI' }
        ],
        description: 'Tên firewall'
      },
      {
        key: 'priv_account_type',
        value: [
          { value: 'OS', label: 'Operating System (OS)' },
          { value: 'APP', label: 'Application (APP)' },
          { value: 'DB', label: 'Database (DB)' }
        ],
        description: 'Loại tài khoản'
      },
      {
        key: 'priv_account_manage_type',
        value: [
          { value: 'SELF', label: 'Self-managed' },
          { value: 'PAM', label: 'Managed by PAM' },
          { value: 'ENVELOPE', label: 'Envelope method' }
        ],
        description: 'Phương thức quản lý tài khoản'
      },
      {
        key: 'device_location',
        value: [
          { value: 'DC', label: 'Data Center DR' },
          { value: 'DR', label: 'Data Center DC' },
          { value: 'CMC', label: 'CMC Data Center' },
          { value: 'BRANCH', label: 'Branch Office' }
        ],
        description: 'Vị trí của Server hoặc Device'
      },
      {
        key: 'firewall_rule_action',
        value: [
          { value: 'ALLOW', label: 'Allow' },
          { value: 'DENY', label: 'Deny' }
        ],
        description: 'Action firewall rule'
      },
      {
        key: 'ip_address_type',
        value: [
          { value: 'STATIC', label: 'Static' },
          { value: 'DYNAMIC', label: 'Dynamic' }
        ],
        description: 'Kiểu IP address'
      },
      {
        key: 'server_type',
        value: [
          { value: 'PHYSICAL', label: 'PHYSICAL' },
          { value: 'VIRTUAL-MACHINE', label: 'VIRTUAL-MACHINE' },
          { value: 'CLOUD-INSTANCE', label: 'CLOUD-INSTANCE' }
        ],
        description: 'Kiểu máy chủ'
      },
      {
        key: 'server_status',
        value: [
          { value: 'ONLINE', label: 'ONLINE' },
          { value: 'OFFLINE', label: 'OFFLINE' },
          { value: 'MAINTENANCE', label: 'MAINTENANCE' }
        ],
        description: 'Trạng thái của máy chủ'
      },
      {
        key: 'network_domain_record_type',
        value: [
          { value: 'A', label: 'A' },
          { value: 'AAAA', label: 'AAAA' },
          { value: 'CNAME', label: 'CNAME' },
          { value: 'MX', label: 'MX' },
          { value: 'TXT', label: 'TXT' },
          { value: 'NS', label: 'NS' },
          { value: 'SRV', label: 'SRV' },
          { value: 'PTR', label: 'PTR' },
          { value: 'SOA', label: 'SOA' },
          { value: 'OTHER', label: 'Other' }
        ],
        description: 'Kiểu DNS record'
      },
      {
        key: 'system_app_type',
        value: [
          { value: 'web', label: 'Web App' },
          { value: 'mobile', label: 'Mobile App' }
        ],
        description: 'Các loại App Type selection trong menu add/edit System Components'
      },
      {
        key: 'system_level',
        value: {
          levels: [
            { value: '1', label: 'Level 1' },
            { value: '2', label: 'Level 2' },
            { value: '3', label: 'Level 3' },
            { value: '4', label: 'Level 4' },
            { value: '5', label: 'Level 5' }
          ]
        },
        description: 'Cấp độ hệ thống thông tin'
      },
      {
        key: 'ip_address_status',
        value: [
          { value: 'reserved', label: 'Reserved' },
          { value: 'assigned', label: 'Assigned' },
          { value: 'inactive', label: 'Inactive' }
        ],
        description: 'Trạng thái IP Address'
      }
    ];
    for (const conf of dynamicConfigs) {
      if (conf.description) {
        await pool.query(
          `INSERT INTO configuration (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING;`,
          [conf.key, JSON.stringify(conf.value), conf.description]
        );
      } else {
        await pool.query(
          `INSERT INTO configuration (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING;`,
          [conf.key, JSON.stringify(conf.value)]
        );
      }
    }

    console.log('Default configuration seeded.');
  } catch (err) {
    console.error('Seed configuration failed:', err);
  }
}

async function initData() {
  try {
    await seedPermissionsAndRoles(pool); // Seed roles/permissions trước
    await seedUsers(pool); // Sau đó mới seed user admin
    await seedConfiguration(pool);
    console.log('Initial data seeded for users, permissions, roles, configuration.');
  } catch (err) {
    console.error('Seeding initial data failed:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

initData();
