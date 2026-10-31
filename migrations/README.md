# Database migrations

Versioned, forward-only migrations for PostgreSQL. Each file in `versions/`
runs **once per database**, in version order, inside its own transaction,
and is recorded with a checksum in the `migrations_history` table.

```
migrations/
├── migrate.js            CLI: up | status | create | repair
├── versions/             the schema history, one file per change
│   ├── 0001_baseline.sql   full v1.1.0 schema (fresh installs only)
│   └── 0002_....sql        every later change ("alter")
├── lib/
│   ├── runner.js         discovery, checksums, locking, apply
│   └── seed.js           idempotent seed data + initial admin
├── tools/                reset_admin_password.js, drop_all_tables.js (dev)
├── manual/               optional one-off scripts, never run automatically
├── sample/               demo data for development
└── test/                 integration tests (npm run test:migrations)
```

## Commands

| Command | What it does |
|---|---|
| `npm run migrate` | Apply pending migrations, then seeds. Docker runs this before every app start. |
| `npm run migrate -- --dry-run` | Show what would run; changes nothing. |
| `npm run migrate:status` | List every version as `applied` / `adopted` / `pending`, plus any problem. |
| `npm run migrate:create -- add_owner_to_servers` | Create `versions/NNNN_add_owner_to_servers.sql` with the next number. |
| `node migrations/migrate.js repair` | Accept a cosmetic edit to an already-applied file (updates its checksum). |
| `npm run admin:reset-password [-- username]` | New random password for a local account, forced change at next login. |
| `npm run test:migrations` | Run the integration tests (needs a Postgres user that can `CREATE DATABASE`). |

In Docker: `docker compose exec app npm run migrate:status`, and so on.

## What `up` does

1. Waits for Postgres (`MIGRATE_CONNECT_TIMEOUT`, default 90 s). Wrong
   credentials or a missing database fail immediately.
2. Takes a Postgres advisory lock, so two containers can never migrate at
   the same time. The second one waits and then finds nothing to do.
3. **Adoption**: if the database already has the schema (`users` exists) but
   no history, it is an install from before this runner existed. Baseline
   `0001` is recorded as `adopted` without running, after checking that every
   baseline table exists. An incomplete schema is refused with the list of
   missing tables.
4. **Safety checks**, all of which block the run:
   - an applied file was edited (checksum mismatch);
   - an applied version has no file on disk (the code is older than the database);
   - a pending version is lower than the highest applied one (out of order);
   - a duplicate version number or a badly named file.
5. Applies each pending file in its own transaction. A failure rolls that
   file back completely, stops the run, and exits with code 1. Files applied
   before it stay applied.
6. Runs the seeds in one transaction: roles/permissions, default
   configuration (`ON CONFLICT DO NOTHING`, so UI edits are never
   overwritten), and the initial admin account.

## Writing a schema change (alter)

```bash
npm run migrate:create -- add_owner_to_servers
# edit migrations/versions/0002_add_owner_to_servers.sql
npm run migrate            # apply locally
npm run migrate:status
```

```sql
-- 0002_add_owner_to_servers
-- Servers get an optional owner unit (ticket ASM-123).
ALTER TABLE servers ADD COLUMN owner_unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL;
CREATE INDEX idx_servers_owner_unit ON servers (owner_unit_id);
```

Rules:

- **Never edit a migration after it has been deployed anywhere.** Fix
  mistakes with a new migration. The checksum check will stop deploys
  otherwise.
- **One logical change per file.** Name it after what it does, in
  `snake_case`.
- **No `BEGIN`/`COMMIT`.** The runner wraps the file in a transaction.
  If a statement cannot run in a transaction (e.g. `CREATE INDEX
  CONCURRENTLY`), put `-- migrate:no-transaction` on its own line in the file
  and keep that file to that single statement.
- **No need for `IF NOT EXISTS` guards.** Each file runs exactly once, and
  a plain statement fails loudly when the schema is not what you expected.
- **Don't touch `0001_baseline.sql`.** New installs replay every file
  after it.
- **Data migrations** that need code can be `.js` files:
  ```js
  // versions/0003_backfill_ip_type.js
  export async function up(db) {          // db = pg client, already in a transaction
    await db.query(`UPDATE ip_addresses SET ip_type = 'physical' WHERE ip_type IS NULL`);
  }
  // export const transaction = false;    // only if really needed
  ```
- **Two branches, same number?** The second deploy is refused as duplicate
  or out of order. Renumber the file that has not been deployed yet.
- **Rolling back:** there are no down migrations. Restore the latest backup
  (see the main README), or write a new forward migration that undoes the
  change.
- **New permission or config key?** Add it to `lib/seed.js`, not to a
  migration. Seeds run on every deploy and only insert what is missing.

## Initial admin account

Created by the seed step only when no superadmin exists, which in practice
means the first install:

- `ADMIN_USERNAME` (default `admin`) and `ADMIN_EMAIL` (default `admin@localhost`).
- `ADMIN_PASSWORD`: if empty, a random password is generated and printed
  **once** to the log. In Docker it is also saved to
  `data/initial-admin-password.txt` (via `INITIAL_ADMIN_PASSWORD_FILE`),
  which is deleted automatically on the first start after the admin has
  changed that password.
- The account is always flagged "must change password" at first login.
- Changing these variables later has no effect. Use the UI, or
  `npm run admin:reset-password` if the password is lost.

## Squashing (occasionally, not every release)

Once many files have piled up and every environment has applied them:
1. Create a fresh database with `npm run migrate`, then dump its schema
   (`pg_dump -s`). Write it as a new baseline, e.g. `0050_baseline_v2.sql`.
2. Don't delete the old files: deployed databases still have them in history,
   and the runner refuses a database whose applied files are missing. Squash
   only together with a documented upgrade path, i.e. "upgrade to vX first".
