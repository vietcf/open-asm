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
- **Automated Database Backup**: Scheduled PostgreSQL backups with configurable retention

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

1. **Clone the repository**:
```bash
git clone https://github.com/vietcf/open-asm.git
cd open-asm
```

2. **Create environment file**:
```bash
cp .env.docker.sample .env.docker
# Edit .env.docker with your configuration
```

3. **Start the application**:
```bash
docker compose up --build -d
```

> ⚠️ **After any rebuild** (`--build`), also restart nginx: `docker restart openasm_nginx`.
> Nginx resolves the `app` container's IP once at startup; when `app` is recreated by a
> rebuild it gets a new IP, and nginx will keep routing to the old one (502 errors) until
> it's restarted. This is not needed for a plain `docker compose up -d` with no rebuild.

4. **Access the application**:
- Web Interface: https://localhost:8443
- API Documentation: https://localhost:8443/api-docs
- PgAdmin: http://localhost:8888

### Local Development Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Setup database**:
```bash
# Create PostgreSQL database
createdb open_asm

# Fresh install: create the schema (already includes every change from
# migrations/alters/, so alters/run.js is not needed here) and seed data
node migrations/init_all_tables.js
node migrations/init_data.js
```
> `migrations/alters/run.js` is only for updating an **existing** database
> after pulling new code — see Database Management below.

3. **Configure environment**:
```bash
cp .env.sample .env
# Edit .env with your configuration
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

# Backup Configuration
BACKUP_FREQUENCY=daily
BACKUP_RETENTION=7
BACKUP_DIR=./backups

# File Upload Configuration
UPLOAD_DIR=./public/uploads
MAX_FILE_SIZE=10485760

# SSL Configuration (for HTTPS)
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem
```

### Docker Configuration

For Docker deployment, use `.env.docker` (start from `.env.docker.sample`,
see Installation above). The key difference from local development's `.env`:
`POSTGRES_HOST` must be `db` — the Postgres service name in
`docker-compose.yml` — not `localhost`/`127.0.0.1`.

## 🐳 Docker Commands

### Build and Run
```bash
# Build and start all services
docker compose up --build -d

# Restart nginx after any rebuild above — see warning in Installation section
docker restart openasm_nginx

# Build specific service
docker compose build app

# Start services
docker compose up -d

# Stop services
docker compose down
```

### Docker Image Management
```bash
# Save Docker images
./save-docker-images.sh

# Or manually save specific image (tag must match the `image:` value
# in docker-compose.yml, currently openasm_app:1.1.0)
sudo docker save openasm_app:1.1.0 | gzip > openasm_app_1.1.0.tar.gz

# Load Docker image
sudo docker load < openasm_app_1.1.0.tar.gz
```

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
| Database backup | Daily 2:00 AM | `pg_dump \| gzip` to `./backups/`, keeps the N most recent | `BACKUP_FREQUENCY`, `BACKUP_RETENTION` in `.env.docker` |
| System log cleanup | Daily 2:00 AM | Deletes `system_log` DB rows older than the retention window | `log_retention_days` in System Configuration (admin UI), default 30 |
| Temp file cleanup | Every 6 hours | Removes stale files from `public/uploads/temp` (>24h) and `public/uploads/import` (>2h) | not configurable |

Nginx/container log growth is handled separately by Docker's own logging
driver (see Logs and Monitoring above), not by an app-level job.

## 📊 API Documentation

### Base URL
- **Development**: http://localhost:3000/api/v1
- **Production**: https://localhost:8443/api/v1

### Authentication
All API endpoints require JWT authentication:

```bash
# Login to get token
curl -X POST https://localhost:8443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Use token in requests
curl -X GET https://localhost:8443/api/v1/systems \
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

```
open-asm/
├── src/
│   ├── api/                 # API routes and controllers
│   ├── controllers/         # Web controllers
│   ├── services/            # Shared business logic, used by both web and API
│   ├── models/             # Database models
│   ├── routes/             # Web routes
│   ├── middlewares/        # Custom middlewares
│   └── utils/              # Utility functions
├── public/
│   ├── html/               # EJS templates
│   ├── css/                # Stylesheets
│   ├── js/                 # Client-side JavaScript
│   └── uploads/            # File uploads
├── migrations/             # Database migrations
├── tests/                  # Test files
├── docker-compose.yml      # Docker configuration
├── Dockerfile             # Docker image definition
└── README.md              # This file
```

## 🚀 Deployment

### Production Deployment

1. **Using Docker Compose**:
```bash
# Clone repository
git clone https://github.com/vietcf/open-asm.git
cd open-asm

# Configure environment
cp .env.docker.sample .env.docker
# Edit .env.docker

# Deploy
docker compose up --build -d

# Restart nginx so it picks up the app container's IP (see warning above)
docker restart openasm_nginx
```

**Updating an existing deployment** (after pulling new code):
```bash
git pull
docker compose up --build -d   # also rebuilds/recreates the migration + app containers;
                                # migrations run automatically and are safe to re-run
docker restart openasm_nginx   # required after every rebuild, see warning above
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

### Database Management

The `migrations/` folder has two parts:

- **`create_*.js`** — the baseline schema (one file per table, `CREATE TABLE IF NOT EXISTS`). Run once via `init_all_tables.js` to set up a brand-new database with the full, up-to-date schema.
- **`alters/`** — incremental schema changes made *after* the baseline, one numbered file per change (`000N_description.js`, exporting `default async (pool) => {...}`). A `schema_migrations` table tracks which ones have already run, so `run.js` only applies files it hasn't seen yet. As of **v1.1.0**, every prior alter has been folded into the baseline `create_*.js` files and removed, so `alters/` currently only contains `run.js` — an empty skeleton, ready for the next schema change. This is verified by an actual fresh-database test (create DB → `init_all_tables.js` → `init_data.js` → `alters/run.js` reports "No new migrations to run").

```bash
# Fresh database: create all tables (baseline already includes every
# migrations/alters/ change up to the current version), then seed initial
# data (roles, admin user, config)
node migrations/init_all_tables.js
node migrations/init_data.js

# Existing/older database: apply any not-yet-run schema changes from
# migrations/alters/ (safe to re-run — it skips what's already applied,
# and is a no-op on a database that was just created fresh above)
node migrations/alters/run.js
```

In Docker, run these inside the app/migration container, e.g. `docker compose run --rm migration node migrations/alters/run.js`. The `migration` service in `docker-compose.yml` already runs all three in sequence on every `docker compose up`, so this is normally automatic — see "Updating an existing deployment" above. The `app` service's `depends_on` uses `condition: service_completed_successfully` on `migration`, so `app` won't start until migration has actually finished (exit code 0), not just started.

**Making a schema change (between releases):**
1. Add a new file `migrations/alters/000N_description.js` (start at `0001` again, since the folder was just emptied — next number after the last one once more files accumulate), exporting `default async (pool) => { await pool.query('ALTER TABLE ...'); }`. Use `IF NOT EXISTS`/`IF EXISTS` guards so it's safe to re-run.
2. Run `node migrations/alters/run.js` — it applies only the new file and records it in `schema_migrations`.
3. Also update the matching `create_*.js` baseline with the same change, so a brand-new database created via `init_all_tables.js` already has it (the `alters/` file then only matters for databases created before your change).

**Releasing a new version:**
1. Bump the version in **both** places, together — they must always match:
   - `package.json` → `"version"` field (also drives the API doc version shown at `/api-docs`, read dynamically — no separate place to update there).
   - `docker-compose.yml` → the `image: openasm_app:X.Y.Z` tag (appears twice, on the `app` and `migration` services).
2. Add a new `### Version X.Y.Z (Latest)` entry at the top of the Changelog below, and relabel the previous "(Latest)" entry.
3. Optional cleanup (do this occasionally, not every release): once accumulated `migrations/alters/*.js` files are safely folded into every baseline `create_*.js` (verify with a fresh-database test like the one described above), delete the numbered alter files and keep just `run.js` — same reset done for v1.1.0.

```bash
# Create backup
pg_dump -h localhost -U postgres -d open_asm | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore backup
gunzip -c backup_20240101_120000.sql.gz | psql -h localhost -U postgres -d open_asm
```

## 📝 Changelog

See `package.json`'s `version` field and the `image:` tag in
`docker-compose.yml` for the current released version — bump both together
when cutting a release.

### Version 1.2.0 (Latest)
- ✅ **System List Export**: Added Excel export for System List (System
  Code, System Name, Tags, Contacts — multi-value fields comma-separated),
  matching the existing IP Address List export pattern

### Version 1.1.0
- ✅ **Shared Service Layer**: Frontend and API now share one in-process
  `src/services/` layer instead of duplicating business logic per transport
- ✅ **UI Consistency Sweep**: Unified table, button, form-field, and detail
  modal styling across every menu (fixed-layout tables, consistent
  `btn-sm` sizing, one `dl`-based detail-modal layout everywhere)
- ✅ **Swagger/API Audit**: Corrected `required` fields, missing status
  codes, and stale descriptions across API route docs
- ✅ **Bug Fixes**: negative-pagination crashes, CASCADE-FK delete-in-use
  gaps, duplicate-IP creation crash, `System.findById` transaction-isolation
  bug, username format validation, `must_change_password` bypass on the API
- ✅ **Deployment/Ops**: Docker log-size caps on every container, nginx logs
  to stdout instead of an unrotated host file, corrected `.gitignore`/
  `.dockerignore` overly-broad patterns, dedicated `.env.docker.sample`

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
- **API Documentation**: https://localhost:8443/api-docs
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