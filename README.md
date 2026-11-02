# Open ASM (Asset Security Management)

A comprehensive network and system management platform built with Node.js, Express, and PostgreSQL. This application provides a web-based interface for managing network devices, servers, firewall rules, and system configurations with robust authentication and authorization features.

## 🚀 Features

### Core Functionality
- **Device Management**: Monitor and manage network devices, servers, and systems
- **Network Management**: Configure and monitor network infrastructure with Zone and Environment support
- **IP Address Management**: Track and manage IP addresses with subnet information
- **Subnet Management**: Configure network subnets with Zone and Environment classification
- **Firewall Management**: Create and manage firewall rules and policies
- **System Management**: Manage systems and their components with full CRUD operations
- **User Authentication**: Secure login with session management
- **Two-Factor Authentication (2FA)**: Enhanced security with TOTP support
- **Role-Based Access Control**: Granular permissions and role management
- **File Upload Management**: Handle file uploads with AWS S3 integration
- **System Monitoring**: Real-time system status and logging
- **API Documentation**: Swagger/OpenAPI integration
- **Database Backup & Restore**: Scheduled PostgreSQL backups (schedule and retention set in the UI), on-demand backups, upload, download and one-click restore

### Security Features
- **Password Management**: Secure password hashing with bcrypt
- **Session Management**: Express session with flash messages
- **JWT Token Support**: JSON Web Token authentication
- **SSL/TLS Support**: HTTPS configuration with self-signed certificates
- **Firewall Configuration**: Built-in firewall management tools

### Administrative Features
- **User Management**: Create, edit, and manage user accounts
- **Organization Management**: Organize resources by units and departments
- **Contact Management**: Maintain contact information
- **System Configuration**: Configure application settings
- **Backup & Migration**: Database migration and seeding tools

### API Features
- **RESTful API**: Complete REST API for all resources
- **Partial Update Support**: PATCH operations for efficient updates
- **JWT Authentication**: Secure API access with JWT tokens
- **Swagger Documentation**: Interactive API documentation
- **Error Handling**: Comprehensive error handling and validation

## 📋 Prerequisites

### For Docker Compose (Recommended)
- **Docker** >= 20.0.0
- **Docker Compose** >= 2.0.0

### For Local Development
- **Node.js** >= 22.0.0
- **PostgreSQL** >= 15.0
- **PM2** (for production deployment)
- **Nginx** (recommended for reverse proxy)
- **pg_dump** (for database backups)
- **gzip** (for backup compression)

## 🛠️ Installation

### Docker Compose Installation (Recommended)

```bash
git clone https://github.com/vietcf/open-asm.git
cd open-asm
docker compose up -d
```

That's it — no configuration needed. Then open **https://localhost** (self-signed
certificate: accept the browser warning) and log in with the initial admin account:

```bash
cat data/initial-admin-password.txt
```

You must change that password at first login; the file is deleted automatically
on the next start after that. (The password is also printed once in
`docker compose logs app`.)

What happens on the first start (all automatic, all skipped on later starts):

| Step | Result |
|---|---|
| Postgres starts, healthcheck waits until it accepts connections | `./pgdata/` |
| `SESSION_SECRET` / `JWT_SECRET` generated | `./data/secrets.env` |
| Self-signed TLS certificate generated for nginx (if `./ssl/` has none) | `./ssl/nginx-selfsigned.{crt,key}` |
| Database schema (`migrations/migrate.js up`), then — empty database only — the init seed: roles, permissions, default configuration, initial admin | see [`migrations/README.md`](migrations/README.md) |
| App starts; nginx starts once the app is healthy | ports 80 → 443 |

If anything fails the app does not start: `docker compose logs app`.

**Configuration (optional).** Defaults live in `docker/defaults.env`. To change
anything — DB password, admin username/email/password, LDAP, S3, backups… —
create `.env.docker`; every variable in it overrides the default:

```bash
cp .env.docker.sample .env.docker   # then edit; only keep what you want to change
docker compose up -d
```

> Set `POSTGRES_PASSWORD` / `ADMIN_*` **before the first start**: Postgres and
> the admin account are created once, from the values present at that moment.

- Your own certificate: put it in `./ssl/` as `nginx-selfsigned.crt` / `nginx-selfsigned.key`, then `docker compose restart nginx`.
- Lost the admin password: `docker compose exec app npm run admin:reset-password`
- Cannot sign in after a restore: `docker compose exec app node migrations/tools/reset_admin_password.js [username] --disable-2fa`
- Update to a new version: see [Upgrading an existing install](#upgrading-an-existing-install-production) below.
- Requires Docker Compose ≥ 2.24 (for the optional `.env.docker`).

### Seed data: what runs when

| Data | Fresh install (empty database) | Upgrade / restart (database has data) |
|---|---|---|
| Schema changes (`migrations/versions/`) | all applied | only the new versions, automatically |
| **Init seed**: roles, permissions, default configuration, initial admin | automatic, once | **never automatic** — data a new version needs ships as a migration |
| **Sample data** (demo systems, servers, IPs…) | never automatic | never automatic |

Run them explicitly only when you want them:

```bash
docker compose exec app npm run seed          # init seed: adds missing roles/permissions/config, admin if none;
                                              # never overwrites edited values, but re-grants the default
                                              # permissions of superadmin / admin / viewer
docker compose exec app npm run seed:sample   # demo data, development only
```

### Upgrading an existing install (production)

Upgrades are migrations only: the app container applies the versions the
database does not have yet, in order, each in its own transaction, before
the app starts. Your data, users, role permissions and configuration are
kept; the init seed does not run.

```bash
# 1. Back up the database (and keep public/uploads/: files are not in the database)
docker exec openasm_db pg_dump -U postgres -d openasm | gzip > backups/before-upgrade_$(date +%Y%m%d_%H%M%S).sql.gz

# 2. Get the new version
git fetch --tags
git checkout vX.Y.Z

# 3. Optional: see which migrations will run
docker compose run --rm app node migrations/migrate.js up --dry-run

# 4. Build and start: migrations run automatically, then the app starts
docker compose up -d --build

# 5. Check the result
docker compose logs app | grep migrate
docker compose exec app npm run migrate:status
```

- A failing migration is rolled back, the app does not start, and the log
  says why. The versions applied before it stay applied: fix the cause and
  start again, or restore the backup and check out the previous version.
- New permissions of a version are granted to superadmin / admin / viewer
  by its migration. **Custom roles get nothing new**: grant them on the
  Roles page if needed.
- Read the version's Changelog entry below for anything specific to it.
- Moving to another server or keeping the old database untouched: copy the
  data into a fresh install instead, see
  [Data migration](migrations/README.md#data-migration-existing-install--fresh-install).

**Access:**
- Web Interface: https://localhost
- API Documentation: https://localhost/api-docs
- PgAdmin: http://localhost:8888
- Postgres: `127.0.0.1:5432` on the Docker host only

### Local Development Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.sample .env
# Edit .env with your configuration (POSTGRES_*, ADMIN_*)
```

3. **Setup database**:
```bash
# Create PostgreSQL database (name must match POSTGRES_DB in .env)
createdb openasm

# Create schema and apply migrations; on this empty database also the init
# seed: roles, permissions, configuration, initial admin (prints the
# generated admin password once if ADMIN_PASSWORD is empty).
# Run it again after every `git pull`: it only applies new migrations.
npm run migrate
```

4. **Start the application**:
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=open_asm
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Application Configuration
NODE_ENV=production
PORT=3000
SESSION_SECRET=your_session_secret

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# Backup directory (schedule and retention: System Configuration > Backup)
BACKUP_DIR=./backups

# File Upload Configuration
UPLOAD_DIR=./public/uploads
MAX_FILE_SIZE=10485760

# SSL Configuration (for HTTPS)
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem
```

### System Configuration (admin UI)

**Administrator → System Configuration** (`/administrator/configuration`)
holds the settings stored in the `configuration` table, one tab per area:
General, Security & Logs, System, Server & Device, Network, Firewall,
Privileged Accounts, Organization, Pentest. There is no raw key/value or
JSON editor: every key has its own editor and server-side validation.

| Editor | Keys (examples) | Rules |
|---|---|---|
| Text | `site_name` | required, max 255 characters, no control characters |
| Number | `log_retention_days` (1–3650), `session_idle_timeout_minutes` (0–10080, 0 = off), `otp_deadline_time` (1–365) | whole number within the range; empty = default for optional keys |
| Choice | `log_level` | `info`, `warning` or `critical` |
| Number list | `page_size` (used by every list, the first value is the default) | 1–10 values from 1 to 1000; stored sorted, without duplicates |
| Option grid | `system_level`, `server_type`, `firewall_name`, … | up to 200 rows; each value unique, max 100 characters, without `, < > " ' \` \`; label optional (defaults to the value) |

Option lists are stored as `[{"value": "...", "label": "..."}]`. A saved
value is fixed (records refer to it); only its label can change. Removing an
option leaves records that use it untouched, it is just no longer offered.
Values saved before these rules existed are kept as they are.

Adding a setting: declare it in `src/utils/configRegistry.js` (group, type,
limits, label), add its default to `migrations/lib/seed.js`, translate the
label in `src/i18n/locales/vi.json`. A change to the stored format of an
existing key needs a data migration (see `migrations/README.md`).

### Docker Configuration

Docker needs no configuration file: defaults come from `docker/defaults.env`,
and an optional `.env.docker` (start from `.env.docker.sample`) overrides any of
them. `POSTGRES_HOST` must stay `db` — the Postgres service name in
`docker-compose.yml` — not `localhost`/`127.0.0.1`.

## 🐳 Docker Commands

### Build and Run
```bash
# Build and start all services
docker compose up --build -d

# Build specific service
docker compose build app

# Start services
docker compose up -d

# Stop services
docker compose down
```

### Development (live reload)
```bash
# Syncs src/, config/, migrations/, public/{html,css,js} into the app
# container on every save; the app restarts itself (node --watch) and EJS
# views are re-read per request (NODE_ENV=development). Ctrl+C stops watching.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
```
Set `OPENASM_SRC` to sync from another checkout (e.g. a git worktree) while
the data, `pgdata/` and `ssl/` directories stay in the project directory.

nginx caches `/css` and `/js` for a year, so the layout links the app's own
files through `asset()` (`<%= asset('/css/custom.css') %>` adds
`?v=<file mtime>`): an edited file gets a new URL and browsers fetch it
right away. Use `asset()` for any new local stylesheet or script.

### Docker Image Management

**Build on one machine, deploy on a server without registry / Internet
access.** Both scripts only build / save / load images: they never start,
stop or change a container.

```bash
# On the build machine (project checked out at the version to ship, e.g. v1.2.1):
# builds openasm_app:<version> for linux/amd64 and saves it with postgres,
# nginx and pgadmin into ./openasm_<version>_<YYYYmmdd-HHMMSS>.tar.gz + .sha256
scripts/docker-export.sh                   # -o DIR | --app-only | --no-build | --platform linux/arm64

# Copy the .tar.gz and its .sha256 to the server, then in that directory:
scripts/docker-import.sh                   # checks the .sha256, loads the newest archive here
scripts/docker-import.sh /path/to/openasm_1.2.1_20261102-143433.tar.gz   # or a given file
```

"Newest" is the highest version, then the latest time in the file name.
After the import, start the version as described in
[Upgrading an existing install](#upgrading-an-existing-install-production)
(`docker-compose.yml` on the server must use the same `openasm_app` tag;
`docker compose up -d --no-build` uses the loaded image). Git Bash works on
Windows. `save-docker-images.sh` (save every local `openasm_app` tag) is
still there.

### Logs and Monitoring
```bash
# View logs
docker compose logs -f app
docker compose logs -f db
docker compose logs -f nginx

# Check container status
docker compose ps
```

All containers use the `json-file` logging driver capped at 10MB × 3 files
(see the `x-logging` block in `docker-compose.yml`) — Docker rotates them
automatically, no separate logrotate setup needed. Nginx logs to
stdout/stderr (the base image's default), so they show up in
`docker compose logs -f nginx` like any other container instead of being
written to a host-mounted file — this is what keeps them under Docker's
log-size cap. Database backups and old `system_log` DB rows are cleaned up
separately by the app's own scheduled jobs (see below).

### Scheduled Maintenance Jobs

The `app` container runs three background jobs on startup (`src/app.js`),
all visible in `docker compose logs -f app`:

| Job | Schedule | What it does | Config |
|---|---|---|---|
| Database backup | Daily 2:00 AM by default | `pg_dump \| gzip` to `./backups/`, keeps the N most recent scheduled backups | System Configuration > Backup (on/off, frequency, hour, number kept); `BACKUP_DIR` in `.env.docker` |
| System log cleanup | Daily 2:00 AM | Deletes `system_log` DB rows older than the retention window | `log_retention_days` in System Configuration (admin UI), default 30 |
| Temp file cleanup | Every 6 hours | Removes stale files from `public/uploads/temp` (>24h) and `public/uploads/import` (>2h) | not configurable |

Nginx/container log growth is handled separately by Docker's own logging
driver (see Logs and Monitoring above), not by an app-level job.

## 📊 API Documentation

### Base URL
- **Development**: http://localhost:3000/api/v1
- **Production**: https://localhost/api/v1

### Authentication
All API endpoints require JWT authentication:

```bash
# Login to get token
curl -X POST https://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Use token in requests
curl -X GET https://localhost/api/v1/systems \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Available Endpoints

#### Systems API
- `GET /api/v1/systems` - List all systems
- `POST /api/v1/systems` - Create new system
- `GET /api/v1/systems/:id` - Get system by ID
- `PUT /api/v1/systems/:id` - Update system
- `DELETE /api/v1/systems/:id` - Delete system
- `GET /api/v1/systems/find?name=system_name` - Find systems by name

#### Components API
- `GET /api/v1/components` - List all components
- `POST /api/v1/components` - Create new component
- `GET /api/v1/components/:id` - Get component by ID
- `PUT /api/v1/components/:id` - Update component
- `DELETE /api/v1/components/:id` - Delete component
- `GET /api/v1/components/find?name=component_name` - Find components by name

#### Other APIs
- **Devices**: `/api/v1/devices`
- **Servers**: `/api/v1/servers`
- **IP Addresses**: `/api/v1/ip-addresses`
- **Subnets**: `/api/v1/subnets`
- **Domains**: `/api/v1/domains`
- **Firewall Rules**: `/api/v1/rules`
- **Contacts**: `/api/v1/contacts`
- **Users**: `/api/v1/users`

### API Features
- **Partial Updates**: Use PATCH or PUT with only changed fields
- **Pagination**: `?page=1&pageSize=10`
- **Search**: `?search=keyword`
- **Filtering**: `?tags[]=1&tags[]=2`
- **Sorting**: `?sort=name&order=asc`

## 🔐 Security

### Authentication
- **Session-based**: For web interface
- **JWT-based**: For API access
- **Two-Factor Authentication**: TOTP support

### Authorization
- **Role-based Access Control**: Granular permissions
- **Resource-level Permissions**: Per-resource access control
- **API Key Management**: Secure API access

### Data Protection
- **Password Hashing**: bcrypt with salt
- **HTTPS**: SSL/TLS encryption
- **Input Validation**: Comprehensive validation
- **SQL Injection Protection**: Parameterized queries

## 📁 Project Structure

Code is grouped **by feature**: everything about one area (model, service,
web pages and REST API) lives in one folder under `src/modules/`. The web
pages and the REST API of a module share the same service and model, so a
rule is written once.

```
open-asm/
├── src/
│   ├── modules/
│   │   └── system/                  # one folder per feature
│   │       ├── system.model.js      #   SQL only (pg queries)
│   │       ├── system.service.js    #   validation + business rules, used by web and API
│   │       ├── system.controller.js #   web pages (EJS render, flash, redirect)
│   │       ├── system.api.js        #   REST handlers (JSON)
│   │       ├── component.*.js       #   same four files for System Components
│   │       ├── web.routes.js        #   /system/... pages + AJAX lookups
│   │       └── api.routes.js        #   /api/v1/systems, /api/v1/components (+ Swagger docs)
│   ├── shared/                      # building blocks used by every module
│   │   ├── db.js                    #   Where builder, link-table helpers, json_agg helper
│   │   ├── service.js               #   input normalization, option lists, relation validation
│   │   ├── web.js                   #   list query parsing, flash, error messages
│   │   ├── api.js                   #   REST error mapping, pagination, CRUD handlers
│   │   ├── errors.js                #   ValidationError, NotFoundError, ConflictError, ...
│   │   └── transaction.js           #   withTransaction()
│   │   (organize, server, device, cluster, network, firewall, pentest, privilege,
│   │    administrator, auth, dashboard, file: same layout)
│   ├── api/                         # /api/v1 router (index.js) and Swagger UI (swagger.js)
│   ├── i18n/                        # translations + /i18n/<lang>.js route
│   ├── middlewares/                 # Express middlewares (login, JWT, permissions, upload, audit log)
│   └── utils/                       # generic helpers (excelExport, viewHelpers, filename, ...)
├── public/
│   ├── html/                        # EJS templates (pages/, partials/ui/ = UI kit)
│   ├── css/  js/                    # stylesheets and browser scripts (UI kit: list-columns, detail-view, form-kit, ui-kit)
│   └── uploads/                     # file uploads
├── migrations/                      # schema versions + data migration
├── docker-compose.yml / Dockerfile
└── README.md
```

Adding a feature: copy the shape of `src/modules/system/`, mount
`web.routes.js` in `src/app.js` and `api.routes.js` in
`src/api/routes/index.js` (its Swagger comments are picked up automatically).

## 🚀 Deployment

### Production Deployment

1. **Using Docker Compose**:
```bash
# Clone repository
git clone https://github.com/vietcf/open-asm.git
cd open-asm

# Optional: override defaults (DB password, admin account, ...) BEFORE first start
cp .env.docker.sample .env.docker

# Deploy
docker compose up -d
```

**Updating an existing deployment** (after pulling new code):
```bash
git pull
docker compose up --build -d   # rebuilds/recreates the app container; it runs
                                # migrations automatically before starting (idempotent)
```

2. **Using PM2**:
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.json

# Save PM2 configuration
pm2 save
pm2 startup
```

3. **Using Nginx**:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🌐 Languages (Vietnamese / English)

The UI is bilingual. Users switch with the **VI / EN** menu in the header (or the
links under the login form); the choice is saved to their profile and applied at
every login. Otherwise the browser language is used, then `DEFAULT_LANGUAGE`
(`en` or `vi`). Data entered by users is never translated, and the REST API stays
in English.

How it works (gettext style — the English text is the key):

- Templates: `<%= t('Add System') %>`, with placeholders `<%= t('Showing {1} - {2} of {3} systems', { 1: from, 2: to, 3: total }) %>`.
- Server code: `req.t('...')`. Browser scripts: `window.t('...')` (loaded from `/i18n/<lang>.js`).
- Page titles, flash and error messages are translated when displayed.
- Vietnamese translations: `src/i18n/locales/vi.json` (`"English": "Tiếng Việt"`). A string without a translation simply shows in English.

After adding or changing UI text:

```bash
npm run i18n:check             # lists strings that have no Vietnamese translation
npm run i18n:check -- --write  # adds them to vi.json with an empty value, ready to translate
```

## 🔧 Development

### Running Tests

⚠️ Not currently wired up: `tests/api.test.js` is written for Jest +
Supertest using CommonJS `require()`, but neither package is installed and
the project runs as an ES module (`"type": "module"` in `package.json`), so
the file cannot run as-is. There is no `npm test` script yet.

### Code Quality

⚠️ Not currently wired up either: no ESLint config or dependency is
installed (only `.eslintignore` exists), so there is no `npm run lint`
script yet.

### UI kit (shared page templates)

Every list, form and detail modal is built from the same pieces, so a look
can be changed in one place. Use them for new pages instead of page-local
markup, CSS or scripts:

| Piece | Where | Use |
| --- | --- | --- |
| List toolbar | `partials/ui/list_toolbar.ejs` | search, Filter button, column chooser, Export, Add |
| Page frame | `partials/ui/page_header.ejs`, `flash.ejs`, `empty_state.ejs`, `pagination.ejs` | breadcrumb, messages, empty list, pager |
| Filters panel | `.list-filters` + `public/js/list-filters.js` | `select.js-filter` (Select2, `data-ajax-url`), `input.js-filter-input` (dates) |
| Column chooser | `partials/ui/columns_menu.ejs` + `public/js/list-columns.js` | `th/td[data-col]`, choice kept per browser |
| Cell helpers | `ui.*` (`src/utils/viewHelpers.js`) | `ui.text`, `ui.clip`, `ui.chips`, `ui.mono`, `ui.date`, `ui.optionLabel`, `ui.options` (static `<option>` list) |
| Mobile cards | `.table-stack` (`custom.css`) | cells need `data-label`, title cell `.stack-title` |
| Detail modal | `partials/ui/detail_modal.ejs` + `public/js/detail-view.js` | `DV.open(id, { title, subtitle, body })`, `DV.section`, `DV.rows`, `DV.chips`, ... |
| Form | `.form-card` / `.form-section`, `partials/ui/form_actions.ejs` | `public/js/form-kit.js`: `select.js-select`, `[data-attachments]` |
| Attachments | `partials/ui/file_attachments.ejs` | upload + existing files with delete |
| Confirm | `form[data-confirm="..."]` (`public/js/ui-kit.js`) | asks before submitting (deletes) |

`public/html/pages/system/` is the reference implementation. Every page of
the main layout now uses the kit; there is no page-local or layout-level
legacy CSS left (`layouts/layout.ejs` only links `custom.css`).

### Database Management

Schema changes are versioned files in `migrations/versions/` (`0001_baseline.sql`,
then one `NNNN_name.sql` per change), applied by `node migrations/migrate.js up`.
Docker runs it before every app start; it is a no-op when nothing is pending.

```bash
npm run migrate                                   # apply pending migrations (+ init seed on an empty database)
npm run seed                                      # init seed, explicitly (never automatic on existing data)
npm run seed:sample                               # demo data (development)
npm run migrate:status                            # applied / pending list
npm run migrate:create -- add_owner_to_servers    # scaffold the next migration
SOURCE_POSTGRES_DB=openasm_old npm run migrate:data   # copy an existing install into this fresh one
```

**Moving an existing system with data** (e.g. v1.1.0 from `main`) onto a
fresh install of the current version is a separate step from installing:
see [Data migration](migrations/README.md#data-migration-existing-install--fresh-install).
Any change to a table that already holds data ships with its data migration.

Each migration runs once, in its own transaction, with checksum,
ordering and locking safety checks. **Full guide, including how to write an
alter: [`migrations/README.md`](migrations/README.md).**

**Releasing a new version:**
1. Bump the version in **both** places, together — they must always match:
   - `package.json` → `"version"` field (also drives the API doc version shown at `/api-docs`, read dynamically — no separate place to update there).
   - `docker-compose.yml` → the `image: openasm_app:X.Y.Z` tag (on the `app` service).
2. Add a new `### Version X.Y.Z (Latest)` entry at the top of the Changelog below, and relabel the previous "(Latest)" entry.
3. Run `npm run test:migrations` against a local Postgres.

**Backup & Restore:**

Open **Backup & Restore** in the admin menu (permissions `backup.read`,
`backup.create`, `backup.delete`, `backup.restore`; by default only
`superadmin` has them, because a dump contains password hashes).

- **Schedule**: System Configuration > Backup (on/off, daily / weekly on
  Sunday / monthly on the 1st, hour of the day in server time, number of
  scheduled backups to keep). Changes apply immediately, no restart.
- **Back up now**, **Download**, **Delete**, and **Upload backup** (a `.sql`
  or `.sql.gz` made by `pg_dump`, checked before it is listed).
- Files are in `BACKUP_DIR` (`./backups`): `backup_*` scheduled (pruned to the
  number kept), `manual_*`, `upload_*` (both kept until deleted) and
  `pre-restore_*` (the last 3 are kept).
- **Restore** replaces the whole database with a backup. You type `RESTORE`
  to confirm; the app first saves the current data as `pre-restore_*`, then
  drops the `public` schema and loads the dump **in one transaction**, so a
  failing backup leaves the database exactly as it was. Afterwards pending
  migrations run (a backup from an older version is brought up to date) and
  the settings and schedule are reloaded. Everything saved after the backup
  was made is lost, and you may be asked to sign in again. Uploaded files
  (`public/uploads`) are not part of a database backup.

By hand, without the UI:

```bash
# Backup (Docker Compose; adjust container / database names)
docker exec openasm_db pg_dump -U postgres -d openasm | gzip > backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore: stop the app, load into a recreated database, start the app
docker compose stop app
docker exec openasm_db psql -U postgres -c "DROP DATABASE openasm;"
docker exec openasm_db psql -U postgres -c "CREATE DATABASE openasm;"
gunzip -c backups/manual_20260101_120000.sql.gz | docker exec -i openasm_db psql -U postgres -d openasm
docker compose up -d app
```

## 📝 Changelog

See `package.json`'s `version` field and the `image:` tag in
`docker-compose.yml` for the current released version — bump both together
when cutting a release.

### Version 1.2.1 (Latest)
- ⬆️ **Upgrading from 1.1.0 / 1.2.0**: follow
  [Upgrading an existing install](#upgrading-an-existing-install-production)
  with `v1.2.1`. From 1.1.0 the entrypoint adopts the database and applies
  migrations `0002` → `0019`; watch the app log for the lines `0015` /
  `0016` / `0019` print. Prefer 1.2.1 over 1.2.0 for production.
- 🐛 Upgrades no longer run the seed: `migrate.js up` seeds only an empty
  database (fresh install, no roles yet). On an existing database the seed
  re-granted the default permissions of superadmin / admin / viewer on
  every start, undoing permissions removed on the Roles page. The init
  seed now runs on demand with `npm run seed`; demo data with
  `npm run seed:sample` (never automatic).
- Migration `0019_permissions_config_since_1_1_0.js` brings what the seed
  added after 1.1.0 to upgraded databases: permissions
  `service_mapping.*` and `backup.create/read/delete/restore` (granted
  like the seed: superadmin all, admin `service_mapping.*`, viewer
  `service_mapping.read`; custom roles get nothing) and configuration
  `backup_*`, `api_debug_log` (existing values kept).
- 📝 README: "Seed data: what runs when" and "Upgrading an existing
  install (production)".

### Version 1.2.0
- ⬆️ Upgrading from 1.1.0: use 1.2.1 instead (1.2.0 seeds the database on
  every start, see above).
- ✨ Every editable object records `created_at` / `updated_at`, and every
  edit form shows "Created … | Updated … · by" in its footer (detail
  modals already show the same line). Migration
  `0014_created_updated_timestamps.sql` adds the columns to agents,
  services, domains, tags, roles, permissions, platforms, units and users
  (existing rows get the migration time) and renames `updated_date` to
  `updated_at` on `priv_users`, `priv_roles`, `priv_permissions`. All
  update queries (including the shared catalog model and
  `reset_admin_password.js`) now set `updated_at`.
- ✨ Service Mapping (`/network/service-mapping`): map an endpoint
  (domain / IP + port) to the backend IPs behind it. Each mapping has a
  **direction** (inbound: clients → our servers; outbound: our servers →
  an external destination) and a **scope** (public: Internet; private:
  NAT private IP over VPN, MPLS or another private channel). Optional
  owning System, Provider / Channel (Akamai, Cloudflare, VPN, MPLS, …),
  LB / Firewall / NAT device, and **access** Full or Limited to a list of
  allowed source IPs / CIDRs (e.g. Akamai allow-list). The list is
  optional (Limited with no IPs = restricted, sources not recorded) and
  is stored on the mapping itself (`allowed_ips TEXT[]`), not in the IP
  address inventory. One mapping is one listener (IP / domain + port);
  a domain exposing several ports gets one mapping per port, created
  quickly with the **Duplicate** row action (copies everything except
  name and port). Backends are **IP addresses** with a port and an
  active / inactive status (a pool member is IP:port; a server can have
  several IPs). The server shown next to a backend is derived from the
  IP's owner. The frontend IP, the domain and the backend IPs all come
  from the IP address / domain inventories: the form picks them from a
  list or takes a typed new value, and new IPs / domains are created in
  the inventory on save (same for Excel import, where backends are
  `ip:port`, and for API callers that send addresses / names, e.g. a
  future load-balancer sync). Choosing a domain that has an IP fills an
  empty IP field. An IP or domain used by a mapping cannot be deleted
  until it is removed from the mapping. Full CRUD, Excel
  import/export, filters, detail modal with a flow diagram that follows
  the direction, sidebar under Network. Migrations:
  `0010_virtual_servers.sql` (tables `virtual_servers`,
  `virtual_server_members`), `0011_rename_virtual_server_permissions.sql`
  (`virtual_server.*` → `service_mapping.*`),
  `0012_service_mapping_direction_scope.sql` (existing rows become
  inbound / public), `0013_service_mapping_system_access.sql` (system,
  access mode and allowed IPs; drops member weight; member statuses
  other than active become inactive),
  `0015_service_mapping_members_by_ip.js` (members point at
  `ip_addresses` instead of `servers`; existing members get their
  server's IP, members whose server has no IP are listed in the output
  and removed; the IP reference is `ON DELETE RESTRICT`),
  `0016_service_mapping_frontend_refs.js` (`virtual_servers.ip_address`
  / `domain` text become `ip_address_id` / `domain_id`, both
  `ON DELETE RESTRICT`; values not in the inventories yet are created
  there and listed in the output). The migration test now expects 55
  tables (it had not been updated for `0010`).
- ✨ REST API debug log: System Configuration > Security & Logs > **API
  debug log** (`api_debug_log`, on / off, **off by default**). While on,
  every `/api/v1` request is written to the application log with the new
  level **debug** and action `api_request`: method, URL, status, duration
  and the JSON request body (pretty-printed, cut after 16,000
  characters; values of password / token / secret / OTP / API key /
  authorization keys are masked). The System Log page expands the body
  in place. Debug entries are not affected by `log_level`; the setting
  is cached for up to 30 seconds. Migration
  `0017_system_log_debug_level.sql` adds `debug` to the level check; the
  seed adds `api_debug_log = off`.
- ✨ **Duplicate** row action (copy icon, needs the create permission) on
  the IP address, Server and Device lists, like Service Mapping: opens
  the Add form prefilled from that record, with a "Copied from …"
  notice. Fields that must be unique are left empty: the address (IP;
  an "assigned" status is dropped too), the name and own IP addresses
  (server, device), the serial number (device). VIPs are not copied (they
  are set when editing). Shared helper `duplicatePage` in
  `src/shared/web.js`, notice partial `partials/ui/copied_from.ejs`.
- 🐛 Deleting an IP address no longer silently removes it from its
  clusters: the delete is refused with the cluster names until the IP is
  removed from them. Deleting a server / device with "delete IPs" keeps
  (as reserved) the IPs still used by a cluster or a service mapping.
  Migration `0018_cluster_member_ip_restrict.sql` makes
  `cluster_members.ip_address_id` `ON DELETE RESTRICT`.
- 🐛 Device import: unknown device types are now auto-created (matching
  the Add Device form behaviour) instead of failing with "Not found".
- ✨ Backup & Restore page (`/backup`, `src/modules/backup/`): separate
  Backup section (back up now, upload, download, delete) and Restore
  section with a warning that restoring replaces the entire database and
  a CLI hint for resetting password / disabling 2FA afterwards. The
  restore is atomic (a failing dump changes nothing), takes a
  `pre-restore_*` copy first, needs the typed word `RESTORE` and the new
  `backup.restore` permission, then runs pending migrations. New
  permissions `backup.read`, `backup.create`, `backup.delete`,
  `backup.restore` (seeded for `superadmin`).
- 🔧 `reset_admin_password.js` now accepts `--disable-2fa` to turn off
  two-factor authentication when resetting a password (useful after a
  restore).
- ♻️ Backup settings moved from `.env` to System Configuration > Backup
  (on/off, frequency, hour, number kept) and apply without a restart.
  Installs that set `BACKUP_FREQUENCY` / `BACKUP_RETENTION` keep those
  values as the initial ones; `BACKUP_DIR` stays in `.env`.
- 🐛 A failed `pg_dump` was reported as a successful backup (`pg_dump | gzip`
  hides its exit code and gzip still wrote a ~20-byte file), and retention
  ordered files by `birthtime`, which Linux does not keep. Dumps are now
  written to a `.partial` file and renamed only on success; retention uses
  the modification time.
- ♻️ System Configuration: the nine groups no longer sit in one horizontal
  tab bar that scrolled sideways. They are gathered under three headings
  (Application, Assets, Security; `section` in `src/utils/configRegistry.js`)
  in a side list, and a grouped select on narrow screens.
- ♻️ Pentest rebuilt on the module template and UI kit: one Add/Edit page
  (`pentest_form.ejs`), a kit list with Target type / Status (several at
  once) / test date filters and Excel export (`/pentest/export`). The
  `/pentest/api/by-object` quick view, `/pentest/report/:id/view` and the
  `/api/v1/pentest-rounds` responses keep their shape.
- 🐛 Replacing a pentest report deleted the old file before the round was
  saved (a failed save lost both); the old file is now removed only after
  commit, and a rejected upload is cleaned up. Reports were stored with
  the absolute disk path, so deleting a round never removed its file:
  they are now stored as `/uploads/pentest/<file>` (migration `0009`
  converts existing rows; also a `migrate:data` step). Deleting a system,
  component or system attachment likewise removes files only after the
  transaction commits.
- 🐛 With `FILE_UPLOAD_DRIVER=s3` the upload middleware was a Promise, not a
  middleware, so form uploads (pentest report, system attachments) failed;
  it now resolves the S3 handler on first use.
- ♻️ Dashboard moved to `pages/dashboard/dashboard.ejs` on the kit; only
  the sections the user may read are queried (one query for all tile
  counts, top subnets ranked in SQL). New Pentest Rounds tile; IP status
  bars use the configured labels and link to the filtered IP list.
- 🧹 The legacy inline mobile CSS in `layouts/layout.ejs` (~630 lines,
  written for the pre-kit pages) is removed; the kit's own phone rules
  cover lists, forms and modals. Change Password uses the kit form. Unused
  client-side column sorting and old server-modal helpers removed from
  `custom.js`.
- ⚡ Tags, units, platforms, device types, services and agents are rendered
  with the page in every form and filter (`src/shared/options.js`,
  `options()` on the catalog models) instead of being fetched by AJAX;
  AJAX pickers remain for large tables (systems, contacts, servers, IPs,
  domains). Unused `public/js/server_add.js` and `xlsx.full.min.js`
  (client-side Excel parsing of the old import modals) removed.
- 🐛 `src/modules/firewall/api.routes.js` had a syntax error left by the
  firewall refactor (the app did not start).
- ♻️ Administrator: users, roles and permissions rebuilt on the UI kit
  (filters for role / sign-in / status / 2FA, Add/Edit pages). The role
  form shows permissions as a resource × action grid. Configuration and
  system log keep their pages, now in their own controllers
  (`configuration.controller.js`, `system-log.controller.js`).
- 🛡️ User management rules (`user.service.js`): one transaction per save
  (a wrong repeat password no longer leaves 2FA changes behind); nobody
  can delete, deactivate or change the role of their own account; at
  least one active superadmin always remains (replaces the hard-coded
  `admin` username check); usernames and emails are unique ignoring case;
  passwords set by an admin follow the change-password rule (8+
  characters, upper, lower, digit — `src/shared/password.js`).
- 🛡️ Deactivating, deleting, or changing a user's role, sign-in method,
  username, password or 2FA now ends that user's open sessions (they were
  kept with the old role until logout).
- 🛡️ The superadmin role cannot be edited, renamed to or deleted, and gets
  every new permission; a role still assigned to users cannot be deleted;
  saving a role clears only that role's cached permissions.
- ♻️ Firewall rules rebuilt on the UI kit (multi-select filters, column
  chooser, detail modal with source / destination / violation sections,
  Add/Edit page, shared importer and export). The 1750-line controller
  is gone; the rule service validates once for the form, the importer and
  the API (configured action / status / violation type / firewall name are
  matched case-insensitively and stored as configured). The unused
  `/firewall/api/batch-update-wo` endpoint was removed. The import still
  checks the audit batch format (YYYY-MM) and skips rules already in the
  same batch; its Tags column accepts tag IDs or names.
- 🔌 REST `/api/v1/rules` rows no longer carry the duplicate `tagNames`
  field (use `tags[].name`); `status`, `firewall_name`, `violation_type`
  filters accept several values.
- ♻️ Privileged accounts, roles and permissions rebuilt on the UI kit
  (filters, column chooser, detail modal, Add/Edit pages, export). Lists
  load links in one query (was up to 5 queries per account row). The
  account form shows servers for OS / DB and the URL for APP accounts; the
  role picker lists roles of the chosen systems and the permission picker
  permissions of the role's system (`data-ajax-with`).
- 🛡️ New checks: account names are unique (case-insensitive); an
  account's role must belong to one of its systems; a role holds only its
  system's permissions; a role still assigned to accounts or the system of
  a permission used by roles cannot change / be deleted (clear messages
  instead of FK errors). Existing rows that break these rules are shown as
  before and only need fixing when edited.
- 🐛 The permission list ignored the system filter; saving a privileged
  role flushed the app's own permission cache (unrelated tables).
- ♻️ Network (IP addresses, subnets, domains) rebuilt on the UI kit: one
  model / service / controller / api file per entity, Add/Edit pages
  instead of modals, shared importer and Excel export. The 3200-line
  `network.controller.js` and the unused AJAX endpoints (`/api/zones`,
  `/api/environments`, `/api/subnet-for-ip`, `/api/subnet/:id/ips`,
  `/api/subnet-addresses`, `/api/subnet-address/:id`, batch delete) are gone.
- ⚡ AJAX only where a list can grow large (IP, system, contact, domain
  pickers and the IP tooltip). Small lists (status, tags, zones,
  environments, record types) are rendered with the page (`ui.options`).
  The IP list carries each IP's subnet (zone / environment) in the list
  query instead of one query per row; subnets show their IP count and
  link to the IP list filtered by `?subnet_id=` (also in its export).
  `data-ajax-with` in `form-kit.js` sends another field's value with a
  picker's search (the subnet gateway picker lists IPs of the typed subnet).
- 🐛 IP / domain search no longer truncates the tag, contact and system
  lists of the matching rows; the IP list permission checks used
  `network.*` instead of `ip_address.*`; the domain import result file
  had no download route; the remaining network AJAX endpoints had no
  permission check.
- 🐛 `requirePermission('a.x', 'b.y')` (two full names) was read as the
  legacy `(action, resource)` pair; `app.js` still referenced the removed
  public server template route, so the app did not start.
- 🔌 REST: `GET /api/v1/domains/:id` returns `systems` as `{id, name,
  system_id}` (was the full system rows) and also `tags`; list rows of
  `/domains` carry `ip`, `systems`, `tags`. `GET /api/v1/subnets*` rows
  carry `ip_count`. `PUT /api/v1/subnets/:id` with an empty body no longer
  returns 400. No schema change, no data migration.
- ♻️ Clusters rebuilt on the UI kit (filters, column chooser, detail
  modal with members, list export, one Add/Edit page with a members
  repeater and "add from file" that reports bad rows inline). The import
  uses the shared importer, which now supports grouped rows
  (`groupBy` / `checkGroup`: a cluster is created only when all its rows
  are valid). Generic `data-repeater` rows in `form-kit.js`.
- 🐛 Cluster list searched by member IP showed only the matching member.
- ♻️ Devices rebuilt on the UI kit (filters, column chooser, detail
  modal, one Add/Edit page `device_form.ejs`, shared import and export,
  delete-with-IP choice). Device type / manufacturer / role fields accept
  new values typed in the select. Device Types and Platforms use the
  shared catalog pages (usage counts; platforms count devices and servers).
- ♻️ Primary / VIP IP ownership of servers and devices is one module
  (`src/modules/network/ip-ownership.js`): validation, linking, releasing
  or deleting IPs on delete, and the import helpers. Server and Device
  services no longer carry their own copies.
- 🔧 REST config endpoints keep the `{value, label}` option shape.
- ♻️ Servers rebuilt on the UI kit: list with filters (status, type,
  location, platform, systems, managers, services, tags) and column
  chooser, detail modal, one Add/Edit page (`server_form.ejs`), shared
  import (same template) and export. Delete asks what to do with the
  server's IPs through the shared `partials/ui/delete_ip_modal.ejs`.
  URLs: `/server/server`, `/server/service`, `/server/agent` (the old
  `.../list` paths are gone; links updated).
- ♻️ Catalog lists (Services, Agents) are one implementation:
  `src/shared/catalog.js` (model, service, REST handlers) and
  `src/shared/catalogWeb.js` with `pages/catalog/list.ejs` / `form.ejs`;
  lists show how many servers use each entry. Server model: one SELECT
  for list/detail/REST instead of four, filters built once.
- 🐛 Deleting a server left its tag links behind.
- 🔧 REST `GET /servers` items expose IPs as `ip_addresses` (with role,
  description and status) like the other server endpoints.
- ♻️ Organization (Contacts, Units, Tags) rebuilt on the UI kit: list
  toolbar, filters, column chooser, Excel export on all three, contact
  detail modal with the vCard QR code, and Add/Edit pages
  (`contact_form`, `unit_form`, `tag_form`) instead of modal forms. The
  unit list shows each unit's code and how many contacts / systems /
  privileged accounts / firewall rules use it; the tag list shows usage.
  Controllers split per entity; the REST controllers keep their response
  shapes but share the `src/shared/api.js` helpers.
- ♻️ Excel import is one shared implementation (`src/shared/excelImport.js`,
  `partials/ui/import_modal.ejs`, `public/js/import-kit.js`,
  `src/middlewares/excelUpload.middleware.js`); Contacts use it first.
  Same template, validation file and import result file as before; empty
  rows are ignored and each row is imported in its own savepoint.
- 🐛 Unit search: the count matched the code column but the rows did not.
- ♻️ Code grouped by feature: the System module (systems + components)
  now lives in `src/modules/system/` (model, service, web controller, REST
  handlers, web and API routes side by side) and shared building blocks in
  `src/shared/` (see Project Structure). Web pages and the REST API call
  the same services. Every other area followed (`src/modules/organize`,
  `server`, `device`, `cluster`, `network`, `firewall`, `pentest`,
  `privilege`, `administrator`, `auth`, `dashboard`, `file`); the old
  `src/controllers`, `src/routes`, `src/services`, `src/models` and
  `src/api/{controllers,routes}` folders are gone, and each module's REST
  routes (with their Swagger docs) are one `api.routes.js`. Duplicated code removed: list/count SQL filters built
  once, link tables saved in one statement, one Excel export helper
  (`src/utils/excelExport.js`), one REST CRUD/pagination helper, unused
  model methods and the per-row N+1 queries of the System list.
- ♻️ Component List, Add and Edit Component rebuilt on the UI kit (toolbar,
  filters panel, column chooser, detail modal, shared form); new Excel
  export. Add/Edit System render `system_form.ejs` directly.
- 🐛 Component List: the total count ignored IP-address search terms (pager
  disagreed with the rows). System form: a rejected upload redirected to a
  wrong URL.
- 🔧 REST: component IPs are `ips: [{id, ip, server_name}]` on every
  endpoint (GET /components/:id used `ip_address`).
- ♻️ Shared UI kit (see Development → UI kit): list toolbar, column
  chooser, cell helpers (`ui.*`), detail modal (`DV`), form actions,
  attachments and delete confirmation are now partials and scripts loaded
  once by the layout instead of being copied into each page. System List,
  Add/Edit System and System Log use it. Dead code removed (unused API
  auth middleware and common routes, `DeviceContact` model, swagger route,
  old header layout, IP partial, access-log middleware, `accessControl`).
- ✨ Data migration `npm run migrate:data`: copies every row of an existing
  install (e.g. v1.1.0) into a fresh install of this version, in one
  transaction, with a `--dry-run` rehearsal. See `migrations/README.md`.
- ✨ `docker-compose.dev.yml`: live code sync for development
  (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch`).
- 💄 Page header: breadcrumb only, left-aligned (no separate page title).
- ✨ System Configuration rebuilt as tabs with typed editors and an option
  grid instead of raw JSON; every value validated on the server. The raw
  key/value page (and its unused import/export routes) is gone.
- 🐛 `system_level` options were ignored (stored as `{"levels": [...]}`);
  migration `0004` stores every option list as `[{value, label}]`.
- ♻️ One page size setting for all lists: `device_page_size` removed
  (migration `0005`).
- 💄 System Detail modal reorganized into section cards (Overview, Access,
  Infrastructure, Components, Attached files), each a list of
  "label | value" rows (muted fixed-width label, emphasized value), with
  the list's neutral chips, translated labels, option labels instead of
  raw values (level, scope, architecture) and readable dates. Reusable
  `.detail-card` / `.detail-row` styles in `custom.css`.
- 💄 Add / Edit System share one form (`system_form.ejs`) in the list's
  look: breadcrumb header, one card with titled sections (General
  information, Classification, Ownership & infrastructure, Documents),
  two-column grid, actions in the footer. No more duplicate jQuery /
  Bootstrap / Select2 loads; selected values and file names are escaped.
- ✏️ "FQDN" on systems is shown as "Access URLs": the values are URLs such
  as `https://10.0.0.5:8443` or `http://example.com` (the column stays
  `fqdn`). Links keep their own scheme instead of getting `http://`
  prepended, and only http(s) values are clickable.
- ✨ Systems have two departments by support layer: **Operations department
  (L2)**, new `systems.ops_department_id` (migration `0006`), and
  **Development department (L3)**, the existing `department_id`, so every
  department recorded so far is now the L3 one. Form, detail modal, REST
  API (`ops_department_id`), unit usage count; the department filter
  matches either layer.
- ✨ System List column chooser ("Columns" button): by default only System
  Code, Name, Level, Operations (L2) and Development (L3) department and
  Tags are shown; Description, Alias, Scope, Architecture, Managers, Access
  URLs, IP Addresses and Updated can be turned on. The choice is kept per
  browser (localStorage); "Reset to default" restores the basic set. Level,
  scope and architecture show their labels instead of raw values.
- 🔒 Attachments limited to documents and design files: PDF, Word
  (`.doc`, `.docx`), Excel (`.xls`, `.xlsx`, `.csv`), Visio (`.vsd`,
  `.vsdx`), draw.io (`.drawio`), `.txt` and images (`.png`, `.jpg`,
  `.jpeg`). Archives, PowerPoint, GIF and SVG are no longer accepted. One
  list (`src/utils/uploadTypes.js`) drives the server check and every
  form's `accept`; forms show the allowed types and the reason a file was
  refused.
- 💄 Lists on phones and small tablets (up to 768px): each row becomes a
  card (name as title, actions top-right, the visible columns as
  "label | value" lines) instead of a squeezed table with cell borders and
  horizontal scrolling; reusable `.table-stack` class (cells need
  `data-label`). The list toolbar fits on two rows (search; actions with
  icon-only Columns/Export) and the search icon is back.
- 💄 Sidebar: app mark instead of the AdminLTE logo, muted section
  headers, child items on a thin guide line instead of "○" bullets, the
  current page as a soft primary tint, long labels wrap instead of being
  cut.
- 💄 System Detail: "Scope user access" moved from Overview to Access.
- ✨ System Log split into **Application log** and **Security audit** tabs
  (migration `0008`: `system_log.category` + `level`, existing rows
  classified). Every data change (POST/PUT/PATCH/DELETE) by a signed-in
  user is now logged by `auditLog.middleware.js` (who, when, IP, action,
  object, result; never the request body); users/roles/permissions/
  configuration/password/2FA go to the security audit, together with
  sign-in/out. The `log_level` setting now applies to the application log
  (security events are always kept). New filters (dates and quick ranges,
  user, action, object, result, severity, IP), column chooser, Excel
  export, list-kit layout.
- 🐛 Column chooser had no effect on screens up to 768px wide: the layout's
  mobile CSS forces table cells visible with `!important`; hidden columns
  now win.
- 🐛 Uploads with Vietnamese (or any non-ASCII) names: the name is read as
  UTF-8 instead of busboy's latin1 (no more "TÃ i liá»‡u"), saving no longer
  fails with "Invalid uploaded file" for names with spaces or diacritics
  (files are stored under an ASCII name, the real name is kept for display),
  and downloads send the name as RFC 5987 `filename*`. Migration `0007`
  repairs names already stored garbled.
- 🐛 CSS/JS changes now reach browsers: the app's own assets are linked
  with a `?v=<mtime>` version (nginx caches `/css` and `/js` for a year as
  immutable, so unversioned URLs kept serving the old files).

### Version 1.1.0
- 🎉 First tracked release of this baseline. Full asset/network/security
  management feature set (devices, servers, subnets, IP addresses,
  clusters, systems, firewall rules, privileged accounts, pentest
  rounds, contacts/units, RBAC, 2FA, REST API).
- ✨ Schema baseline reset: every incremental `migrations/alters/*.js`
  change to date has been folded into the baseline `create_*.js` files,
  verified with a fresh-database test (see Database Management below).
  `alters/` now only contains `run.js`, ready for the next schema change.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- **API Documentation**: https://localhost/api-docs
- **Swagger UI**: Interactive API documentation

### Issues
- **Bug Reports**: [GitHub Issues](https://github.com/vietcf/open-asm/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/vietcf/open-asm/discussions)

### Contact
- **Email**: support@openasm.com
- **GitHub**: [@vietcf](https://github.com/vietcf)

## 🙏 Acknowledgments

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **Bootstrap** - CSS framework
- **jQuery** - JavaScript library
- **Select2** - Enhanced select boxes
- **Swagger** - API documentation

---

**Open ASM** - Comprehensive Asset Security Management Platform