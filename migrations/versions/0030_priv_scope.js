// 0030_priv_scope
// Privileged accounts: "all systems" roles / permissions, and data limited to
// the systems a user's units manage (their L2 or L3 department).
//   priv_roles.all_systems, priv_permissions.all_systems   true = for every
//       system (system_id NULL). A flag, not system_id NULL alone: a role
//       whose system was deleted already has system_id NULL and must not
//       become global. priv_permissions.system_id may now be NULL.
//   users.unit_id          the user's own (lowest-level) unit
//   user_scope_units       extra units whose systems the user may also see
//   permissions            priv_role.global (create / edit / delete the "all
//       systems" ones), priv_account.all_scope (no unit limit); granted to
//       superadmin and admin. Roles that do not exist are skipped.
//   configuration          priv_scope_enforced = off: nothing changes until an
//       administrator assigns units and turns it on.
// Existing rows keep their meaning: no role or permission becomes global.

const PERMISSIONS = [
  ['priv_role.global', 'Manage privileged roles / permissions for all systems'],
  ['priv_account.all_scope', 'See every privileged account, role and permission (no unit limit)'],
];

export async function up(db) {
  await db.query(`
    ALTER TABLE priv_roles ADD COLUMN all_systems BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE priv_roles ADD CONSTRAINT priv_roles_all_systems_no_system CHECK (NOT all_systems OR system_id IS NULL);
    CREATE UNIQUE INDEX uniq_priv_role_name_all_systems ON priv_roles (LOWER(name)) WHERE all_systems;

    ALTER TABLE priv_permissions ALTER COLUMN system_id DROP NOT NULL;
    ALTER TABLE priv_permissions ADD COLUMN all_systems BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE priv_permissions ADD CONSTRAINT priv_permissions_system_or_all CHECK ((all_systems AND system_id IS NULL) OR (NOT all_systems AND system_id IS NOT NULL));
    CREATE UNIQUE INDEX uniq_priv_permission_name_all_systems ON priv_permissions (name) WHERE all_systems;

    ALTER TABLE users ADD COLUMN unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL;
    CREATE INDEX idx_users_unit ON users (unit_id);
    CREATE TABLE user_scope_units (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, unit_id)
    );
    CREATE INDEX idx_user_scope_units_unit ON user_scope_units (unit_id);
  `);

  const { rows: created } = await db.query(
    `INSERT INTO permissions (name, description) SELECT * FROM unnest($1::text[], $2::text[])
     ON CONFLICT (name) DO NOTHING RETURNING id, name`,
    [PERMISSIONS.map((p) => p[0]), PERMISSIONS.map((p) => p[1])]);
  const { rows: roles } = await db.query(`SELECT id FROM roles WHERE name IN ('superadmin', 'admin')`);
  for (const role of roles) {
    for (const perm of created) {
      await db.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [role.id, perm.id]);
    }
  }

  await db.query(`INSERT INTO configuration (key, value, description)
    VALUES ('priv_scope_enforced', 'off', 'Limit privileged accounts / roles / permissions to the systems of the user''s units')
    ON CONFLICT (key) DO NOTHING`);
}
