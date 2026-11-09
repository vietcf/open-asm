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
- **Database Backup & Restore**: Scheduled PostgreSQL backups (schedule and retention set in the UI), on-demand backups, download, and restore from an uploaded backup file

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

- **Docker** with **Docker Compose ≥ 2.24**. Nothing else: Node.js, nginx and
  the PostgreSQL client are in the images.
- Only with an external database: **PostgreSQL 15**, an existing database
  (it may be empty) and a user that owns it. (The in-app backup uses
  `pg_dump` 15, which cannot dump a newer server.)

## 🛠️ Installation

Two ways, one command each. Then open **https://localhost** (self-signed
certificate: accept the browser warning) and sign in with the initial admin:

```bash
cat data/initial-admin-password.txt    # user "admin"; you choose a new password at first login
```

### A. Database in Docker (default)

```bash
git clone https://github.com/vietcf/open-asm.git
cd open-asm
docker compose up -d
```

No settings needed. PostgreSQL runs in the `openasm_db` container, its data
in `./pgdata/`. To set the database password, do it before the first start
(see Settings below).

### B. External database

```bash
git clone https://github.com/vietcf/open-asm.git
cd open-asm
cp .env.docker.sample .env.docker      # fill in the POSTGRES_* lines of the "External PostgreSQL" block
docker compose -f docker-compose.external-db.yml up -d
```

Only the app and nginx run in Docker. A database on the Docker host itself
is `POSTGRES_HOST=host.docker.internal`. Use the same `-f
docker-compose.external-db.yml` with every later `docker compose` command.

### Settings

None are required. To change one, copy `.env.docker.sample` to `.env.docker`
and uncomment only what you change: database, initial admin, UI language,
LDAP, S3, sign-in lockout. Defaults are in `docker/defaults.env` (do not edit
it). Everything else is set in the app: **Administrator → System
Configuration**. After changing `.env.docker`: `docker compose up -d` again.

> The database password and the initial admin are used once, on the first
> start against an empty database. Set them before that.

### What stays on the host

| Path | Content | Keep it when upgrading |
|---|---|---|
| `./pgdata/` | database (case A only) | yes |
| `./data/` | generated `SESSION_SECRET` / `JWT_SECRET`, initial admin password | yes (losing it signs everyone out and invalidates API tokens) |
| `./public/uploads/` | uploaded files | yes |
| `./backups/` | database backups | yes |
| `./ssl/` | TLS certificate (self-signed one generated on the first start) | yes |

### Common tasks

- Logs / startup errors: `docker compose logs app`
- Your own certificate: put it in `./ssl/` as `nginx-selfsigned.crt` / `nginx-selfsigned.key`, then `docker compose restart nginx`.
- Lost the admin password: `docker compose exec app npm run admin:reset-password`
- Cannot sign in after a restore: `docker compose exec app node migrations/tools/reset_admin_password.js [username] --disable-2fa`
- New version: [Upgrading an existing install](#upgrading-an-existing-install-production).
- Server without Internet: build there from an archive, see [Docker Image Management](#docker-image-management).

**Access:** web https://localhost · API docs https://localhost/api-docs ·
pgAdmin http://localhost:8888 (case A) · PostgreSQL `127.0.0.1:5432` on the
Docker host only (case A)

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

- External database (case B): back it up with `docker compose -f docker-compose.external-db.yml exec app sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > backups/before-upgrade.sql.gz`
  (or your usual tooling), and add `-f docker-compose.external-db.yml` to steps 3–5.
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

### Development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml watch   # live code sync, no rebuild per change
```

Running Node directly (`npm install`, `npm run migrate`, `npm run dev`)
also works: create `.env` from `.env.docker.sample` with `POSTGRES_HOST`
pointing at your database and `NODE_ENV=development`.

## 🔧 Configuration

### Environment Variables

See [Settings](#settings): `.env.docker` (start from `.env.docker.sample`)
over `docker/defaults.env`.

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

Option lists are stored as `[{"value": "...", "label": "..."}]`; a retired
value has `"active": false`. The **value** is what records store and never
changes; the **label** can change at any time (every page shows the new one).
Each row of the grid shows how many records use the value (**In use**) and an
**Active** switch.

| Action | Value not used (0) | Value used by records (N > 0) |
|---|---|---|
| Edit the label | saved | saved; records show the new label |
| Switch **Active** off | retired | retired: records keep it |
| **Delete** | deleted | dialog: **make it inactive** (records keep it) or **replace it with** another active value (all N records changed in the same transaction as the save, then the value is deleted; logged in the System Log) |

The server enforces the same rule: a used value posted as deleted without a
replacement is kept as inactive, so no record ever holds a value missing from
its list.

A record with a **retired value**: its lists / detail show the label with
"(inactive)"; list filters still offer it, last; its edit form shows it
selected, and saving keeps it. It can no longer be chosen: new records,
imports, the API and edits that change the field to it are refused ("… is no
longer in use"); the API option endpoints (`/…/config`) return active values
only. A Duplicate copy shows it too, but must get an active value before it
can be saved. Values removed before 1.3.0 but
still used by records were added back as retired by migration
`0020_retired_option_values.js`.

Adding a setting: declare it in `src/utils/configRegistry.js` (group, type,
limits, label; for an option list also `usedBy`, the table columns holding its
values), add its default to `migrations/lib/seed.js`, translate the label in
`src/i18n/locales/vi.json`. A change to the stored format of an existing key
needs a data migration (see `migrations/README.md`).

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
docker compose logs -f app      # app: startup, migrations, audit / application log (JSON lines)
docker compose logs -f nginx    # web access log
docker compose logs -f db
docker compose ps
```

**Size limit.** Every container uses the `json-file` driver capped at
**10 MB × 3 files, older files compressed** (`x-logging` block at the top of
`docker-compose.yml`; change `max-size` / `max-file` there, then
`docker compose up -d`). Docker rotates and deletes them itself: the logs can
never fill the disk and no logrotate is needed. Nginx logs to stdout too, so
the same cap applies. The `system_log` table is pruned by the app
(`log_retention_days`, see Scheduled Maintenance Jobs).

**App events on the console.** Every entry of the System Log (sign-in,
2FA, changes to users / roles / configuration, every data change, API debug
entries) is also printed by the app container as one JSON line:

```json
{"time":"2026-11-02T08:15:02.113Z","app":"open-asm","type":"audit","category":"security","level":"warning","action":"login","status":"failed","user":"admin","user_id":null,"src_ip":"10.1.2.3","object_type":null,"object_id":null,"description":"Login failed: invalid username or password","user_agent":"Mozilla/5.0 ..."}
```

`category` is `security` or `app`; `level` is `debug`, `info`, `warning` or
`critical`; the `log_level` setting filters the `app` category like on the
System Log page. Other console lines (startup, migrations, errors) are plain
text; collectors can keep only the lines that start with `{"time"`.

#### Forwarding to IBM QRadar (not set up by default)

Pick one; both keep the 30 MB local cap above.

**1. Docker → syslog directly (simplest).** Send the app container's log to
QRadar over syslog, in `docker-compose.yml` under `app:` (replaces
`logging: *default-logging` for this one service):

```yaml
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://QRADAR_IP:514"   # udp://… also works; tcp+tls:// with syslog-tls-* options
        syslog-format: rfc5424
        tag: "open-asm"
```

Then `docker compose up -d`. With a non-local driver Docker keeps a local
copy for `docker compose logs` (its "dual logging" cache, 5 × 20 MB by
default). If QRadar is unreachable at start the container does not start:
use `udp://`, or method 2.

**2. Host agent (keeps docker logging as is).** Have rsyslog or Filebeat on the
Docker host read
`/var/lib/docker/containers/<app container id>/*-json.log` and forward the
`log` field of each line to QRadar. Example for rsyslog
(`/etc/rsyslog.d/open-asm.conf`):

```
module(load="imfile")
input(type="imfile" File="/var/lib/docker/containers/*/*-json.log" Tag="open-asm" Severity="info" Facility="local5")
local5.* @@QRADAR_IP:514
```

(`docker inspect -f '{{.LogPath}}' openasm_app` gives the exact file;
restrict the glob to it if other containers run on the host.)

**On the QRadar side:** add a Log Source of type *Universal DSM* (or a
custom one) with protocol *Syslog*, identifier = the Docker host, and a
JSON-based custom property extraction (`$.action`, `$.status`, `$.user`,
`$.src_ip`, `$.category`, `$.level`, `$.description`). Map for example
`action=login` + `status=failed` to an authentication-failure event, and
`category=security` events to a higher severity.

### Scheduled Maintenance Jobs

The `app` container runs three background jobs on startup (`src/app.js`),
all visible in `docker compose logs -f app`:

| Job | Schedule | What it does | Config |
|---|---|---|---|
| Database backup | Daily 2:00 AM by default | `pg_dump \| gzip` to `./backups/`, keeps the N most recent scheduled backups | System Configuration > Backup (on/off, frequency, hour, number kept) |
| System log cleanup | Daily 2:00 AM | Deletes `system_log` DB rows older than the retention window | `log_retention_days` in System Configuration (admin UI), default 30 |
| Temp file cleanup | Every 6 hours | Removes stale files from `public/uploads/temp` (>24h) and `public/uploads/import` (>2h) | not configurable |

Nginx/container log growth is handled separately by Docker's own logging
driver (see Logs and Monitoring above), not by an app-level job.

## 📊 API Documentation

REST API under **`/api/v1`**, JSON in and out. The full reference is the
**Swagger UI at https://localhost/api-docs** (sign in to the web app first):
every endpoint with its parameters, bodies, responses and a "Try it out"
button. The same short guide as below is at the top of that page.

### Using Swagger UI

1. Open **/api-docs** (web sign-in required) and expand **Auth → POST /api/v1/auth/login**.
2. **Try it out**, enter a local account's username / password, **Execute**: copy the `token`.
3. Click **Authorize** (top right), paste the token (without `Bearer`), **Authorize**.
   It is kept when the page is reloaded; **Logout** in that dialog removes it.
4. Expand any endpoint → **Try it out** → **Execute**: the request is sent with the
   token; the page shows the `curl` equivalent and the response.

Use the filter box to find an endpoint by tag. Sections follow the menu:
Auth, System, Component, Server, Services, Agents, Device, Device Types,
Platforms, Cluster, IPAddress, Subnet, Domain, Rule, PentestRound, Contact,
OrganizationUnit, Tags.

### Authentication

```bash
# 1. token (local account whose first-login password change is done; LDAP accounts cannot get one)
curl -k -X POST https://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "api-user", "password": "..."}'
# -> {"token": "eyJhbGciOi..."}

# 2. every other call
curl -k https://localhost/api/v1/systems?page=1&pageSize=20 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

- The token lasts `JWT_EXPIRES_IN` (default `8h`, see `.env.docker.sample`) and
  carries the user's permissions **as they were at login**: after a role change,
  log in again. Use a dedicated account with only the permissions it needs.
- 401 = missing / invalid / expired token, 403 = permission missing.
- `-k`: the default certificate is self-signed.

### Conventions

| Topic | Rule |
|---|---|
| Lists | `?search=&page=1&pageSize=10` (max 100) → `{"data": [...], "pagination": {"page", "pageSize", "totalCount", "totalPages", "hasNext", "hasPrev"}}`; filters per endpoint (see Swagger) |
| Update | `PUT /…/{id}` is partial: fields left out keep their value; a link list that is sent (`tags`, `contacts`, `systems`…) replaces the current links |
| Errors | 400 validation · 401 token · 403 permission · 404 not found · 409 conflict (duplicate, or still in use). Body `{"success": false, "message": "…"}`, or `{"error": "…"}` for auth, IP addresses, subnets, domains |
| Configured values | status / type / location / position… are values of a System Configuration list; `GET /…/config` (devices, servers, ip-addresses, contacts, rules) returns the values that can be set. A retired value is refused, except the record's current value sent back unchanged |
| Deletes | refused (409) while the record is used, e.g. an IP address assigned to a server or used by a cluster / service mapping |
| Debugging | System Configuration › Security & Logs › **API debug log** = on logs every request with its JSON body (secrets masked) in the System Log, level debug |

### Resources

`/auth/login` · `/systems` · `/components` · `/servers` · `/services` ·
`/agents` · `/devices` · `/device-types` · `/platforms` · `/clusters` ·
`/ip-addresses` · `/subnets` · `/domains` · `/rules` · `/pentest-rounds` ·
`/contacts` · `/units` · `/tags` — 110 operations, all documented in Swagger.

### Keeping the docs right

Each module documents its routes in JSDoc `@swagger` blocks in
`src/modules/<module>/api.routes.js`, next to the route; shared parts
(security scheme, tags and their order, the guide above, the `Rule` schema)
are in `src/api/swagger.js`. Every new or changed route updates its block in
the same commit. The UI is built from these blocks when the app starts.

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

Same as [Installation](#-installation) (case A or B), then
[Upgrading an existing install](#upgrading-an-existing-install-production)
for every new version.

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
| Form | `.form-card` / `.form-section`, `partials/ui/form_actions.ejs` | `public/js/form-kit.js`: `select.js-select`, `[data-attachments]`, `input[data-unique]` |
| Unique field | `input data-unique="server.name"` (+ `data-unique-exclude`, `data-unique-scope`) | checked when left against `src/utils/uniqueChecks.js` (same rule as the save); a new unique field gets an entry there |
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
- **Back up now**, **Download** and **Delete**, in one list of the backup
  files.
- Files are in `BACKUP_DIR` (`./backups`): `backup_*` scheduled (pruned to the
  number kept), `manual_*`, `upload_*` (both kept until deleted) and
  `pre-restore_*` (the last 3 are kept).
- **Restore from file** (`backup.restore`) replaces the whole database with
  an uploaded `.sql` / `.sql.gz` made by `pg_dump` (e.g. a file downloaded
  from the list); there is no restore button on the list rows. You choose
  the file and type `RESTORE` to confirm; the file is checked and kept as
  `upload_*`, and the app first saves the current data as `pre-restore_*`, then
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

### Version 1.8.5 (Latest)
- No database migration: upgrading from 1.8.4 only needs the new image.
- 🐛 Service Mapping filter "Device holding the IP" keeps the chosen device
  after filtering (its restore endpoint `/device/api/device/ids` was missing,
  so the select showed empty although the list was filtered).

### Version 1.8.4
- No database migration: upgrading from 1.8.3 only needs the new image.
- 🐛 Export of every list follows the search and filters **on the form**:
  a multi-select emptied (tags, systems, status...) or a checkbox unticked
  before clicking Export no longer keeps the value applied before (it used to
  stay in the export query).

### Version 1.8.3
- No database migration: upgrading from 1.8.2 only needs the new image.
- 🐛 Service Flow: every text of the diagram has the same font size (titles
  bold, not bigger); IPs, partners, backends, owners and arrow labels were
  mixed sizes (nested small text shrank twice).

### Version 1.8.2
- No database migration: upgrading from 1.8.1 only needs the new image.
- ✏️ Public Exposure: the public IP is labelled just **Public IP** (no more
  "FW / LB", it may be either): the device / server holding it is still looked
  up from the asset mapping and shown under it, and its detail says what it is.

### Version 1.8.1
- No database migration: upgrading from 1.8.0 only needs the new image. The
  service mapping import template header "Partner IPs" changed (must exist):
  download the new one.
- ✏️ Service mapping **partner IPs are picked from the IP inventory** (a
  select, like the other IPs): add the IP there first. Form, import and API
  refuse a partner IP that is not in the inventory; partner IPs saved before
  that are not in it are kept as they are. Each partner (IP, port, protocol,
  domain, partner name) stays on **one line** of the form.

### Version 1.8.0
- ⬆️ Upgrading from 1.7.x: new image; migration `0036` runs (new columns
  only). The service mapping import template gains a last column "NAT
  Private IP": download the new one.
- ✨ Public Exposure can **NAT its public IP to a private IP** before the
  backends (optional): `… → Public IP:Port (FW) → NAT → private IP[:port]
  (e.g. a VIP on the LB) → backends`. The private IP is picked from the IP
  inventory (never created), its port is optional (empty = the public port),
  and the device holding it shows in the Service Flow and the detail. Form,
  export ("NAT private IP"), import (`ip` or `ip:port`), search, REST
  `nat_ip_address_id` / `nat_port`.
- Migration `0036_public_exposure_nat_ip.sql`: `virtual_servers.nat_ip_address_id`, `nat_port`.

### Version 1.7.5
- No database migration: upgrading from 1.7.4 only needs the new image. The
  service mapping import template headers changed (IPs / domain "must
  exist"): download the new one.
- ✏️ Service mappings **never create IP addresses or domains** any more
  (they used to, described "Created from service mapping"): the form only
  picks existing IPs (our IP, backends / sources) and domains, and the import
  and API refuse an IP or a domain that is not in its inventory ("add it
  there first"). The partner IPs and the internet destination domains stay
  free text (external, not part of the inventories). IPs / domains created
  that way before are kept.
- ✏️ Service mappings are an **extension** that describes the service flows:
  they never insert anything in the rest of the system. A typed partner name
  stays on its partner IP row and is **no longer added** to the System
  Configuration list `service_mapping_partner` (1.7.3 did); the dropdown still
  offers the configured partners and the names already used.

### Version 1.7.4
- No database migration: upgrading from 1.7.3 only needs the new image.
- ✏️ Public Exposure limited to partner IPs: the limit is on the CDN, or on
  the FW when there is no CDN. The form title follows the CDN / WAF field
  ("limited on the CDN" / "limited on the FW"), and so does the Service Flow.

### Version 1.7.3
- No database migration: upgrading from 1.7.2 only needs the new image.
- ✏️ Partner IP rows (one IP, one partner): the partner is picked from a
  dropdown (the configured partners and the names already used) or **typed**
  when it does not exist yet; a typed partner joins the System Configuration
  list `service_mapping_partner` on save, so it can be picked next time. A
  name matching a configured one (case-insensitive) takes its spelling; a
  retired one is refused. Same for the import and the API.

### Version 1.7.2
- No database migration: upgrading from 1.7.1 only needs the new image.
- ✏️ Service Flow shows at most **10 partners**; with more, "+N partner(s) ·
  See all" jumps to the full partner table of the detail, which scrolls, keeps
  its header and, past 10 rows, has a filter (partner, IP, domain, port).
- ✏️ Internal Exposure asks for an **IP** (any IP; it need not be a VIP on a
  load balancer): form label, Service Flow and flow path say "IP".

### Version 1.7.1
- No database migration: upgrading from 1.7.0 only needs the new image.
- ✏️ Service Mapping list: two levels of tabs, **All / Inbound / Outbound**,
  then the flows of the chosen direction (Public / Internal / Private,
  Partner / Internet); the form groups the flow cards by direction.
- ✏️ The search also matches the description (besides names, domains,
  partner names / IPs / destination domains, IPs, systems, devices, servers).
- ✨ Every IP of a service mapping (list, detail, Service Flow: our IP,
  backends / sources, partner IPs) links to the IP list searched for it, in a
  new tab, with the IP tooltip on hover.

### Version 1.7.0
- ⬆️ Upgrading from 1.6.x: new image; migrations `0034` and `0035` run (see below). The service
  mapping import template changed (NAT range and gateway columns removed,
  partner IP syntax): download the new one.
- ✏️ Service mapping flows refined:
  | Flow | Path |
  |---|---|
  | Inbound · Public Exposure | Partners (limited on the CDN) or Internet → Domain → CDN (its own port / protocol) → **Public IP:Port** (+ the device / server holding it) → NAT private IP (optional) → Backends IP:Port |
  | Inbound · **Internal Exposure** (new) | Internal users → Domain (optional) → **VIP IP:Port + protocol** on its LB → Backends IP:Port + protocol |
  | Inbound · Private Connectivity | Partner VPN IPs → VPN / lease line → **one NAT service IP:Port** → Backends IP:Port |
  | Outbound · Partner Connectivity | Internal IPs (**no port**) → **one NAT IP** → VPN / lease line → **each partner IP with its own port + protocol** |
  | Outbound · Internet Connectivity | Internal IPs (**no port**) → **one egress public IP** → **each destination IP with its own domain (optional) + port + protocol** |
  - Our IP (public / NAT service / NAT / egress) is required in every flow and
    sits on its FW / LB / NAT device, shown through the asset mapping: the
    NAT / reverse proxy and firewall / proxy IP fields and the NAT range are
    gone.
  - The VPN / lease line only carries the traffic: no provider port /
    protocol (only the CDN keeps them); Internet Connectivity has no channel.
  - Partner IPs are **single IP addresses** (no CIDR): the partner's hosts,
    kept apart from the subnet inventory (internal ranges only). A CIDR a
    mapping already had is kept until it is replaced; new ones are refused.
  - Outbound mappings have no port / protocol of their own (their partner
    IPs carry them) and no mapping domain (internet destinations carry
    theirs).
  - Import / export / API: partner IPs as `IP[Partner]` (inbound sources),
    `IP:port/protocol[Partner]` (partner connectivity),
    `IP:port/protocol@domain[Partner]` (internet); REST `partner_ips[]` gain
    `port`, `protocol`, `domain`; `nat_subnet_id` / `gateway_ip_address_id`
    are gone.
  - **Internal Exposure** (`direction` inbound, `scope` **internal**): an
    application published inside the company, not through the internet: no
    CDN, channel or partner IPs. It has its own tab, Service Flow, import /
    export (`scope` internal) and API value.
  - **Backends have a protocol** (inbound flows), e.g. HTTPS on the VIP and
    HTTP on the backends when the LB offloads TLS: form column, Service Flow,
    detail, export ("Backend Protocol"), import `ip:port/protocol`, REST
    `members[].protocol`. Existing backends have none.
- 🐛 Service mapping form: the separators between parts are the same for
  every flow (they followed the DOM order, not the order shown per flow).
- 🐛 Selects that accept a typed value (e.g. the partner name while the
  partner list is empty) always show their search box: short lists hid it,
  so nothing could be typed.
- Migration `0034_partner_ip_ports.js`: partner IPs get `port`, `protocol`,
  `domain`; the port / protocol (and, for internet connectivity, the domain)
  of every outbound mapping move to its partner IPs; outbound source ports
  are emptied; `nat_subnet_id` and `gateway_ip_address_id` (no data) are
  dropped. Counts are printed.
- Migration `0035_internal_exposure.sql`: `virtual_server_members.protocol`.

### Version 1.6.0
- ⬆️ Upgrading from 1.5.x: new image; migration `0033` runs (see below).
  The service mapping import template changed (Partner IPs header, NAT
  range and gateway columns): download the new one.
- ✨ **Service mapping flows** (Service Exposure Model). The flow is chosen
  right after Name and System; the form shows its parts in the order of the
  traffic, with their own labels:
  | Flow | Path |
  |---|---|
  | Inbound · **Public Exposure** | User / partners → Domain (opt.) → CDN (opt.) → **Public IP:Port** + protocol → NAT / reverse proxy IP (opt.) → Backends |
  | Inbound · **Private Connectivity** | **Partner VPN IPs** → VPN / lease line → **NAT service IP:Port** (in a NAT range, opt.) → Backends |
  | Outbound · **Partner Connectivity** | Internal IPs → **NAT IP** and / or **NAT range** → VPN / lease line → **Partner IPs:Port** |
  | Outbound · **Internet Connectivity** | Internal IPs → firewall / NAT gateway / proxy (opt.) → **Egress public IP** → Internet IPs and / or domain **:Port** |
  - **Partner IPs** (IP / CIDR + partner name, System Configuration list
    `service_mapping_partner`, empty = any name) replace "Allowed IPs": the
    allowed sources of Public Exposure (Access "Limited to partner IPs") and
    Private Connectivity, the destinations of the outbound flows.
  - The **NAT range** is a subnet of the inventory; a NAT IP must lie in it.
  - **Asset mapping**: every IP of the flow (our IP, gateway, backends /
    sources, partner IPs found in the inventory) shows the device, else the
    server, holding it.
  - **Service Flow** diagram drawn per flow, partner IPs grouped by partner.
  - List: one tab per flow, Flow / Partners / NAT range columns, Partner
    filter; search matches partner IPs and names. Export adds the flow,
    partner IPs (`IP[Partner]`), NAT range and gateway IP.
  - REST API: `partner_ips: [{address, partner}]`, `nat_subnet_id`,
    `gateway_ip_address_id`; `ip_address_id` is required by the flows that
    need it (not by Partner Connectivity with a NAT range); `allowed_ips` is
    still accepted (`IP` or `IP[Partner]` strings).
- Migration `0033_service_mapping_flows.js`: table
  `virtual_server_partner_ips`, columns `nat_subnet_id`,
  `gateway_ip_address_id`, `ip_address_id` may be empty; `allowed_ips` move to
  partner IPs (no name) and the column is dropped; the destination IP of
  existing outbound mappings becomes a partner IP and their IP is emptied
  (set the NAT / egress IP when editing them); list `service_mapping_partner`
  created empty. Counts are printed.

### Version 1.5.0
- ⬆️ Upgrading from 1.4.x: new image; migration `0032` runs (new table only).
- ✨ **Permission Matrix** (Privileged Accounts > Permission Matrix,
  `priv_role.read`): pick a system to see its role × permission matrix (its
  own roles and permissions, plus the "All systems" ones it uses; number of
  accounts per role), limited to the user's unit like the other privileged
  pages.
  - **Versions**: "New version (Word)" (`priv_role.update`) saves a snapshot of
    the matrix as v1, v2, v3... of the system and downloads its **Word
    document to sign** (system, L2 / L3 departments, version, date, the
    matrix, "Prepared by / Reviewed by / Approved by" signature boxes;
    landscape when it has more than 5 roles). A version's Word document is
    always built from its snapshot, so it never changes.
  - **Signed copy**: upload the **signed PDF** on the version's row (with the
    signing date; checked to be a PDF, max 25 MB): the version becomes
    *Signed*. Signed PDFs are stored in `uploads/priv-matrix` and only served
    by the matrix routes (permission and unit checked).
  - The page warns when the current matrix differs from the **last signed
    version** and lists the changes (roles / permissions added or removed,
    permissions granted or revoked).
  - Drafts can be deleted; a signed version only by superadmin.
- Migration `0032_priv_matrix_versions.sql`: table `priv_matrix_versions`
  (system, version, snapshot, status draft / signed, signed date and file).
- Dependency: `docx` (Word generation).

### Version 1.4.1
- ⬆️ Upgrading from 1.4.0: new image; migration `0031` runs.
- ✏️ User Management: one **Unit** per user and a tick **"Manages the
  privileged accounts of their unit"** (`users.priv_unit_admin`) replace
  "Unit" + "Extra units to see". While "Limit to the user's units" is on, a
  user (without the "no unit limit" permission) sees and manages the
  privileged accounts, roles and permissions of the systems whose L2 or L3
  department is their unit only when the tick is on. The User list shows the
  unit (🔑 when ticked).
- Migration `0031_user_managed_units.sql`: a user without a unit but with
  extra units gets the first of them; users who had a unit or extra units get
  the tick (same access to their own unit as before); `user_scope_units` is
  dropped.

### Version 1.4.0
- ⬆️ Upgrading from 1.3.x: new image; migrations `0025`–`0030` run (see the
  entries below). After upgrading: assign units to users (User Management)
  before turning on "Limit to the user's units"; API clients of accounts with
  2FA must send `otp` when logging in; download the new server import template.
- 🔒 Security fixes (audit of this release):
  - **RCE via restore**: a restored file is fed to `psql`, which runs
    meta-commands such as `\! <shell>`. Every backup is now lexed before it
    is accepted or restored; psql meta-commands (other than pg_dump's
    `\restrict` / `\unrestrict` and COPY data), `COPY ... TO/FROM PROGRAM` and
    `lo_import` / `lo_export` are refused.
  - **Uploaded files without login**: `/uploads/*` (attachments, pentest
    reports) was served before the login check. It now needs a signed-in user
    (2FA done) with the folder's read permission (`system.read`,
    `pentest.read`); import results are only served by their download routes.
  - **API tokens kept old rights**: tokens carried the permission list for 8
    h. The token now only names the user; each request re-reads the account
    (must be active, local) and its current role permissions. Tokens are
    signed / checked with HS256 only.
  - **API login**: same lock-out as the web login (HTTP 429), and accounts with
    2FA must send the current code (`otp`); accounts that must enrol 2FA do it
    in the web UI first.
  - **Default secrets**: without `SESSION_SECRET` / `JWT_SECRET` (outside
    Docker) a random per-process secret is used instead of a published
    default that allowed forging tokens.
  - **Privilege escalation in User / Role Management**: someone who is not
    superadmin can no longer give a role permissions they do not hold, create
    / edit / delete users whose role has more permissions than theirs (e.g.
    reset the superadmin password), or give such roles.
  - **Built-in roles** `superadmin`, `admin`, `viewer` cannot be edited or
    deleted, and their names are reserved.
  - **Pickers**: the Select2 lookups (contacts with e-mails, systems, servers,
    devices, units, tags, services, agents, service mappings...) need the
    list's read permission or some create / update permission, instead of
    any signed-in user; the contact QR code needs `contact.read`.
  - **Headers / CORS**: every response carries `X-Frame-Options: DENY`,
    `nosniff`, `Referrer-Policy: same-origin` and a CSP with
    `frame-ancestors 'none'; object-src 'none'; base-uri 'self';
    form-action 'self'` (nginx dropped its server-level headers in locations
    with their own); `X-Powered-By` is off; the development CORS rule
    (`http://127.0.0.1:5500` with credentials) is removed from
    `nginx.docker.conf`.
  - Dependencies: `npm audit fix` (express / body-parser / path-to-regexp,
    multer, jws, lodash, ws, validator...). Remaining: `xlsx` 0.18.5 (no npm
    fix; 0.20.3 is only published on cdn.sheetjs.com) and `pm2`'s agent
    chain (`pm2` is not used in the Docker image).
  - `data/` (generated secrets) is in `.gitignore`.
- ✨ System detail: each manager is shown on their own line with an **L2** or
  **L3** badge when their unit is the system's Operations (L2) or
  Development (L3) department; no badge when it matches neither (or the
  department is not set). The REST/list `contacts` items now include `unit_id`.
- ✨ A component's (sub-system's) managers are managers of its system: adding
  a manager to a component adds them to the system; taking them off the
  component, deleting the component or moving it to another system takes
  them off the system too, unless another component of that system still has
  them (`src/modules/system/system-contact-links.js`, same rule as IPs).
- ✨ Deleting a system that has components asks whether to **also delete all
  its components** (checkbox, off by default; left off, the system is not
  deleted). REST: `DELETE /api/v1/systems/:id?delete_components=true`.
- ✨ IP detail, Subnet section: lists **every** subnet the IP lies in
  (smallest first) with its Description, cut to one line (full text on
  hover). Hovering a subnet loads its details (zone, environment, gateway,
  IP count, tags) into a tooltip. Web JSON: `/network/api/subnets/containing?ip=`
  (`ip_address.read`) and `/network/api/subnets/:id/detail` (`subnet.read`).
- ✏️ IP Address export: the Subnet, Zone and Environment columns are dropped.
- ✨ Service Mapping backends show the device or server holding each backend
  IP (icon + name, same rule as the Public IP / VIP owner: device first, then
  server); an IP nothing holds shows the IP only. Flow diagram, detail table
  ("Server/Device"), form picker and export ("Server/Device" column) use it;
  members carry `owner_name` / `owner_type`.
- ✨ REST API **`/api/v1/service-mappings`** (list with filters, `find?name=`,
  get, create, partial update, delete; permissions `service_mapping.*`), for
  integrations such as F5 / Citrix ADC: create the IP addresses, domain and
  system through their own APIs, then send their **ids** (`ip_address_id`,
  `domain_id`, `system_id`, `members: [{ip_address_id, port, status}]`).
  Nothing is created on the fly; an unknown id or field is a 400. On PUT,
  `members` replaces every backend. Examples: `api-tests/service-mappings.http`.
- ✨ Service mapping **Provider / Channel** is a System Configuration list,
  `service_mapping_provider` (Network group): the form picks from it, and the
  form, Excel import and API refuse other or retired values (matched
  case-insensitively). Migration `0026` creates the list from the providers
  already in use (Akamai / Cloudflare / VPN / MPLS when none).
- ✨ Servers have an **OS Version** (free text, max 100, e.g. `22.04 LTS`)
  next to the Platform: the form suggests the versions already recorded
  (still any text allowed). List column (off by default), detail modal,
  search, export, REST API (`os_version`) and Excel import. Migration `0027`
  adds `servers.os_version`. ⚠️ The server import template gains an
  "OS Version (Optional)" column after "OS (Optional)": download the new
  template (files in the old layout are refused).
- ✏️ Add Server / Add Device: the VIP IP Address(es) spot shows a note that
  VIPs are added from Edit once the record is saved.
- ✏️ Device **Management Address**: the form explains the free-text syntax
  (comma-separated, an optional `[label]` after each address, e.g.
  `https://10.10.1.1[kvm], 10.10.1.1:22[ssh]`, max 255); the detail modal
  shows one link per address with its label as a badge.
- ✏️ Pentest history belongs to systems and sub-systems only: the Server and
  Device detail modals no longer have a "Pentest History" button (the API
  already accepted only `system` / `system_component` targets).
- ✨ Cluster ↔ System links record the **namespace** (optional) the system
  runs in on that OCP / Kubernetes cluster (`cluster_system.namespace`,
  migration `0028`; lowercase DNS label, max 63, unique within a cluster).
  The cluster form has a "System | Namespace" table; the cluster list,
  cluster detail ("System — namespace") and the system detail's Clusters
  ("cluster — namespace") show it; searching clusters or systems matches
  the namespace; the export lists "System (namespace)". REST: `systems`
  takes IDs or `{system_id, namespace}` and returns `{id, name, namespace}`.
  Excel import: `System 001[ns-payment], System 002` in the System column
  (the template layout is unchanged).
- ✨ Organization Unit list: a **Detail** button opens the unit (code,
  description, usage counts) with **every member** (contacts of the unit:
  name, email, phone, position), loaded from `/organize/api/unit/:id/members`
  (`unit.read`). The unit export gains a Members column.
- ✨ Organization units can be **nested** (`units.parent_id`, migration
  `0029`; every existing unit stays top level). Unit form: Parent unit
  (itself and its sub-units are not offered; cycles refused). Unit list:
  Parent unit (path "Division › Department") and Sub-units columns, filters
  **Parent unit** (its sub-units at every level, or top level only) and
  **Level** (has sub-units / lowest level); the export follows them and adds
  both columns; the detail shows the parent path and the direct sub-units.
  A unit with sub-units cannot be deleted. REST: `parent_id` on create /
  update, `?parent_id=&level=` on the list.
- ✏️ Elsewhere (contact, system L2 / L3 department, privileged account,
  firewall rule pickers and their filters) only **lowest-level units** (no
  sub-unit) can be picked; a record already set to a unit that later got
  sub-units keeps it. The Contact list's Organization filter offers every
  unit (as a path) and a parent unit also lists its sub-units' contacts.
- ✨ Privileged roles and permissions can be for **All systems** (tick on
  their form; `all_systems`, migration `0030`). An "All systems" role can be
  given to an account of any system and may hold any permission; an "All
  systems" permission can be held by any role. Only users with the new
  permission `priv_role.global` (admin and superadmin) can tick it or change /
  delete such roles and permissions; everyone else can still pick them.
- ✨ Privileged data **limited to the user's units**: users get a **Unit**
  and **Extra units to see** (User Management; `users.unit_id`,
  `user_scope_units`; replaced in 1.4.1 by one unit and a "manages the
  privileged accounts of their unit" tick). While System Configuration > Privileged Accounts >
  "Limit to the user's units" (`priv_scope_enforced`, **off** by default) is
  on, a user without the new permission `priv_account.all_scope` (admin and
  superadmin have it; grant it to other roles to let them see everything)
  only works on the systems whose L2 or L3 department is one of their units:
  accounts are shown when one of their systems is such a system and can be
  changed / deleted only when all of them are; roles and permissions of
  those systems, plus the "All systems" ones; the system pickers of the
  forms, the role / permission pickers, the lists, details and exports all
  follow it. The list pages say which units they are limited to, or that the
  user has no unit yet. Turn it on after assigning the units. A unit used by
  users cannot be deleted.
- ✏️ Backup & Restore lists the backup files **once** (download / delete).
  Restoring is only done by uploading a file: **Restore from file** (choose
  the `.sql` / `.sql.gz`, type `RESTORE`) uploads it and restores it in one
  step (`POST /backup/restore`, `backup.restore`). The per-row restore
  buttons, the separate Restore table and the plain "Upload backup" are gone.
- ✏️ Every list's **Export** button uses the search text and filters
  currently on screen, even when they were typed but not submitted yet.
- Migration `0025_component_contacts_in_system.js`: removes duplicate
  `system_contact` rows and adds a `(system_id, contact_id)` unique
  constraint, then adds every component manager missing from their system;
  both counts are printed.

### Version 1.3.10
- No database migration: upgrading from 1.3.9 only needs the new image.
- ✨ Pentest target: the form has a **System** (required) and a **Sub-system**
  (optional, lists only the chosen system's components; empty = the whole
  system), on add and on edit (a round can be moved to another target).
- ✨ Pentest list / quick view / export show which system a round belongs to:
  "System" or "System / Sub-system"; filtering or viewing a system also lists
  the rounds of its sub-systems, and search matches the system name.

### Version 1.3.9
- No database migration: upgrading from 1.3.8 only needs the new image.
- 🐛 Service Mapping form: Provider – port – protocol and IP address – port –
  protocol each stay on one line (with the Device field gone, the Access
  field shared their line and pushed the protocol to the next one).

### Version 1.3.8
- ⬆️ Upgrading from 1.3.x: new image; migrations `0023` and `0024` run
  (`0024` lists the mappings that lose their device, see below).
- ✨ Service Mapping: the provider / channel has its own **port and
  protocol** (e.g. Akamai on 443 HTTPS in front of an origin on 8443),
  optional and cleared when there is no provider; shown in the list, the
  detail and the flow diagram, and in Excel import / export. Migration
  `0023_service_mapping_provider_port.sql`.
- Form in the order of the traffic: Access / Allowed IPs, then Provider –
  port – protocol, then IP address – port – protocol.
- The **Device** field is gone: the device, else the server, holding the
  frontend IP (its own IP before a VIP) is shown as **IP owner** in the
  list, the detail and the flow diagram; an IP nothing holds (an external
  destination, an IP NATed elsewhere) shows the IP only. The Device filter
  and the device page list the mappings whose IP the device holds; search
  matches device and server names. Migration
  `0024_service_mapping_drop_device.js` drops the column and lists the
  mappings whose stored device did not hold their IP (to keep that link,
  add the IP to the device as a VIP).

### Version 1.3.7
- ⬆️ Upgrading from 1.3.x: new image; migration `0022` runs (see below).
- 🐛 System / component IP addresses follow one rule: **a component's IPs
  are IPs of its system**; a system may also have IPs no component uses.
  - IPs added to a component are added to its system (as before).
  - IPs taken off a component, or of a deleted component, leave the system
    too, unless another component of the system still uses them (before:
    they stayed in the system when edited, and left it even when another
    component used them when deleted).
  - A component moved to another system takes its IPs along.
  - An IP taken off a system (System form / API, or the Systems field of the
    IP address form / API) is taken off that system's components too.
  - The System and Component forms explain this under the IP field. Rules in
    `src/modules/system/system-ip-links.js`.
- Migration `0022_component_ips_in_system.js`: removes duplicate
  system / IP links and adds the missing unique constraint on `system_ip`
  (duplicates could be created before), and adds to each system the IPs of
  its components that it lacked. Counts are printed in the migration output.

### Version 1.3.6
- No database migration: upgrading from 1.3.x only needs the new image.
- ✨ Exact matches first everywhere you search, like Service Mapping in 1.3.5:
  every list page search (servers and devices also by exact IP, systems by
  name or System ID, users by username or email, contacts by name or email…)
  and the remaining pickers (servers, components, contacts, tags, units, free
  IPs, privileged roles / permissions, catalogs). Exact match, then "starts
  with", then the page's usual order; with no search the order is unchanged.
  Results are the same, only their order changes (checked on every existing
  value of every list). Subnets keep their own order when searching an IP /
  CIDR (most specific subnet first), the system log stays by time. Helper
  `searchRank()` in `src/shared/db.js`.

### Version 1.3.5
- No database migration: upgrading from 1.3.x only needs the new image.
- ✨ Search results put the best match first: exact match, then "starts
  with", then "contains" (case-insensitive; shortest first within each, so
  `10.0.0.1` comes before `10.0.0.10`). Applies to the IP address, domain,
  device, system and service mapping pickers of the Service Mapping form
  (and everywhere they are used) and to the Service Mapping list search
  (exact name / domain / frontend IP first, newest first within a rank).
  Before, results were alphabetical (or newest first) and cut at 20, so an
  exact match could come last or not be offered at all. Helpers
  `matchOrder()` / `matchRank()` in `src/shared/db.js`.

### Version 1.3.4
- No database migration: upgrading from 1.3.x only needs the new image.
- ✨ Every Add / Edit form checks its unique fields when you leave them, like
  the IP address field: already used → red "Already used by: …" with a link
  to that record and the save is blocked; free → green "Available". Same
  rule as the save (case-insensitive where the save is, within the same
  system for components / privileged roles / permissions, per firewall and
  audit batch for rule names; the record being edited is ignored). Fields:
  server, device, cluster, service mapping, system (name and System ID),
  component, contact email, unit, tag, domain, subnet address, privileged
  account / role / permission, user (username and email), role, permission,
  device type, platform, service, agent, firewall rule name. One endpoint
  (`GET /api/unique-check`) and one registry (`src/utils/uniqueChecks.js`);
  it needs the read permission of the entity.

### Version 1.3.3
- No database migration: upgrading from 1.3.x only needs the new image.
- ✨ Add IP address: leaving the address field checks every address entered
  (`GET /network/api/ip-addresses/check?addresses=a,b`): not a valid IPv4,
  entered twice, or already in the inventory (with the server / device using
  it and a link to it) in red, "new address" in green; saving is blocked
  until the addresses are fixed (the server still checks on save).
- 🐛 Add / Edit forms showed no message when a save failed: the form came
  back empty with no reason. Every rendered page now receives the pending
  success / error message (middleware in `src/app.js`), and the forms that
  had no message area got one (server, system, component, device, cluster,
  contact, unit, tag, service mapping, catalogs). Success messages stay 8 s
  (was 5 s).

### Version 1.3.2
- ⬆️ Upgrading from 1.3.x: new image; migration `0021` only adds indexes.
- ⚡ Faster pages. The server and system lists (and their edit forms) took
  about 0.7-0.9 s in the database: PostgreSQL JIT-compiled their queries,
  for about 1 ms of real work. Now:
  - JIT is off for the app's own connections (`options: '-c jit=off'` in
    `config/config.js`; no change to the PostgreSQL configuration, also for an
    external database). Server list 905 → ~20 ms, system list 818 → ~5 ms,
    privileged accounts 522 → ~3 ms (whole page handler, warm).
  - The server, system, IP address, device and privileged-account queries read
    each list (IPs, tags, contacts, systems, services, agents…) with its own
    subquery (`subList()` in `src/shared/db.js`) instead of joining all of
    them at once, which multiplied rows and made the planner expect millions
    of rows. Same results (checked record by record against the old queries);
    with JIT forced on they now take < 1 ms instead of 0.7 s.
  - Migration `0021_link_table_indexes.sql`: indexes on the link tables those
    subqueries look up (`tag_object`, `system_ip`, `system_contact`,
    `file_uploads`, `priv_user_*`).
  - Edit forms no longer jump while loading: selects keep their final height
    until Select2 is ready (they show again after 2 s if scripts fail), and
    the unused ApexCharts library (500 KB) is no longer loaded on every page.

### Version 1.3.1
- No database migration: upgrading from 1.3.0 only needs the new image.
- 🐛 Sharper text: the Source Sans 3 medium / semibold / bold faces (500,
  600, 700) are now declared in `public/css/source-sans-3.css` (the files
  were already in `public/css/files/`). Headings, labels and table headers
  were drawn with bold synthesized by the browser from the regular face,
  which looked blurry.
- 📝 Swagger (`/api-docs`): a usage guide at the top of the page (token,
  conventions, errors, configured values, debug log), sections ordered and all
  described, token kept across reloads. Fixed: the firewall `Rule` schema was
  missing from the served spec (broken references) and `GET /systems/find`,
  `GET /components/find` were sent without the token from "Try it out"; login
  is marked public. Descriptions of configured fields explain retired values;
  `GET /contacts/config` returns active positions only, like the other
  `/config` endpoints. README "API Documentation" rewritten (the listed
  `/users` endpoint, PATCH and `?sort=` never existed). Checked: the 110
  routes of `/api/v1` are all documented, no documented path is missing.

### Version 1.3.0
- ⬆️ Upgrading from 1.2.x: back up, check out `v1.3.0`, build and start
  ([Upgrading an existing install](#upgrading-an-existing-install-production)).
  Migration `0020` runs; the lines it prints list option values that were
  removed from their list but are still used, now kept as inactive. An
  existing `.env.docker` keeps working.
- ✨ External PostgreSQL: `docker compose -f docker-compose.external-db.yml up -d`
  runs only the app and nginx; the `POSTGRES_*` settings go in `.env.docker`.
- ✨ Every System Log entry is also printed by the app container as one JSON
  line (`docker compose logs app`), for log collectors / a SIEM. README:
  forwarding to IBM QRadar (docs only, nothing set up by default).
- 🔧 Container logs: rotated files are now gzip-compressed (cap unchanged:
  10 MB × 3 per container).
- 🧹 Settings: `.env.sample` removed; `.env.docker.sample` keeps only what
  can be changed (database, initial admin, language, secrets, sign-in
  lockout, LDAP, S3, certificate name), all commented out. Removed from it:
  `NODE_ENV`, `PORT`, `UPLOADS_DIR`, `BACKUP_DIR` (fixed by the container
  and its volumes), `SITE_NAME` and backup schedule (set in the app).
  Existing `.env.docker` files keep working.
- 📝 README installation rewritten: case A (database in Docker) and case B
  (external database), one command each.
- ✨ Option lists (System Configuration): values used by records can no
  longer be deleted silently. Each value shows how many records use it and
  can be made **inactive** (records keep it, it can no longer be chosen) or,
  on delete, **replaced** by another value on all those records. Edit forms
  keep a record's retired value instead of clearing it on save (before, saving
  any form blanked a value removed from its list); new records / imports / API
  cannot use retired values. Migration `0020_retired_option_values.js` adds
  values already removed but still used back as retired. Server type and DNS
  record type are now validated like the other lists.

### Version 1.2.2
- ✨ `scripts/docker-export.sh` / `scripts/docker-import.sh`: build the
  images on one machine and load them on a server without registry /
  Internet access (archive `openasm_<version>_<time>.tar.gz` + `.sha256`;
  the import loads the newest one of the current directory). They never
  start, stop or change a container. See
  [Docker Image Management](#docker-image-management).
- No database migration: upgrading from 1.2.1 only needs the new image.

### Version 1.2.1
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