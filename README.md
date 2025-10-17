# Open ASM (Asset Security Management)

A comprehensive network and system management platform built with Node.js, Express, and PostgreSQL. This application provides a web-based interface for managing network devices, servers, firewall rules, and system configurations with robust authentication and authorization features.

## 🚀 Features

### Core Functionality
- **Device Management**: Monitor and manage network devices, servers, and systems
- **Network Management**: Configure and monitor network infrastructure with Zone and Environment support
- **IP Address Management**: Track and manage IP addresses with subnet information
- **Subnet Management**: Configure network subnets with Zone and Environment classification
- **Firewall Management**: Create and manage firewall rules and policies
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

## 📋 Prerequisites

### For Docker Compose (Recommended)
- **Docker** >= 20.0.0
- **Docker Compose** >= 2.0.0

### For Local Development
- **Node.js** >= 16.0.0
- **PostgreSQL** >= 12.0
- **PM2** (for production deployment)
- **Nginx** (recommended for reverse proxy)
- **pg_dump** (for database backups)
- **gzip** (for backup compression)

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd open-asm
```

### Option A: Docker Compose (Recommended)

2. **Set up environment variables**
```bash
cp .env.sample .env
# Edit .env file if needed (default values work for Docker)
```

3. **Generate SSL certificates**
```bash
./setup-self-signed-ssl.sh
```

4. **Start the application**
```bash
docker-compose up -d
```

That's it! The application will be available at `https://<your-host>:443`

### Option B: Local Development

2. **Install dependencies**
```bash
npm install
```
**Note**: Make sure you run `npm install` (not `node install`) to install the project dependencies.

3. **Set up environment variables**
Copy the sample environment file and update the values:
```bash
cp .env.sample .env
```

Then edit the `.env` file with your actual values:
```env
# Database Configuration
POSTGRES_HOST=127.0.0.1
POSTGRES_DB=openasm
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-database-password
POSTGRES_PORT=5432
POSTGRES_SSL=false

# Application Configuration
NODE_ENV=development
PORT=3000
SESSION_SECRET=your-super-secret-session-key-change-this

# Security Configuration
JWT_SECRET=your-jwt-secret-key-change-this
JWT_EXPIRES_IN=8h

# File Upload Configuration
FILE_UPLOAD_DRIVER=local
UPLOADS_DIR=public/uploads

# Backup Configuration
BACKUP_FREQUENCY=daily
BACKUP_RETENTION=7
```

4. **Database Setup**

First, create the PostgreSQL database and user:

```sql
-- 1. Create Database
CREATE DATABASE openasm;

-- 2. Create User (if not exists)
-- Note: 'postgres' user usually exists by default
-- If you want to create a custom user:
-- CREATE USER postgres WITH PASSWORD 'your-database-password';

-- 3. Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE openasm TO postgres;

-- 4. Connect to the database
\c openasm

-- 5. Grant schema privileges
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
```

Then initialize the application tables and data:

```bash
# Initialize database tables (run once for new installation)
node migrations/init_all_tables.js

# Run migrations (only when database schema changes)
node migrations/migrate_tables.js

# Seed sample data (optional - for testing/demo)
node migrations/sample/seed.js
```

## 🚦 Running the Application

### Docker Compose (Recommended)
The easiest way to run the application:

```bash
# 1. Generate SSL certificates (one-time setup)
./setup-self-signed-ssl.sh

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps

# 4. View logs
docker-compose logs -f
```

The application will be available at:
- **HTTP**: `http://<your-host>:80`
- **HTTPS**: `https://<your-host>:443`

### Development Mode (Local)
```bash
# Using nodemon for auto-restart
npm run dev

# Or direct node execution
node src/app.js
```

### Production Mode (Local)
```bash
# Using PM2 process manager
pm2 start ecosystem.config.json

# Or using the provided script
./pm2.sh
```

The application will be available at `http://<your-host>:3000` (development only)

## ⚙️ Dynamic Parameter Configuration (System Configuration UI)

The application supports dynamic configuration of system parameters directly from the web UI (Administrator → System Configuration).

### How to Use

1. **Navigate to:** `Administrator` → `System Configuration` in the web interface.
2. **Add/Edit Configuration:**
	- Click **Add Configuration** to create a new parameter.
	- Click the edit (pencil) icon to update an existing parameter.
3. **Common Parameters:**
	- `page_size`: Controls allowed page size options for all lists (e.g. `10,20,50,100` or `[10,20,50,100]`).
	- `device_page_size`: (optional) Override page size options for Device List only.
	- `system_level`: JSON object/array for system level options (see below).
	- `device_location`, `server_type`, `ip_address_status`, ...: Option lists for select fields, as JSON array or string.

### Example: Configure Page Size

| Key              | Value                | Description                        |
|------------------|----------------------|------------------------------------|
| `page_size`      | `10,20,50,100`       | Allowed page sizes for all lists   |
| `device_page_size` | `[10,20,50,100]`   | (Optional) Device List page sizes  |

### Example: Configure System Level

| Key            | Value (JSON)                                                                                 | Description                |
|----------------|---------------------------------------------------------------------------------------------|----------------------------|
| `system_level` | `{ "levels": [ { "value": "1", "label": "Level 1" }, { "value": "2", "label": "Level 2" } ] }` | System level options       |

### Notes
- Most select/multi-select option lists (device type, location, status, etc.) are loaded from the configuration table and can be managed via the UI.
- Changes take effect immediately after saving.
- For advanced options, use valid JSON for array/object values.

See also: **Administrator → System Configuration** in the app for a full list of configurable parameters.

## 📁 Project Structure

```
open-asm/
├── src/
│   ├── app.js              # Main application entry point
│   ├── api/                # API routes and controllers
│   ├── controllers/        # Business logic controllers
│   ├── middlewares/        # Custom middleware functions
│   ├── models/             # Database models
│   ├── routes/             # Express route definitions
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions (including backup job)
├── config/                 # Configuration files
├── migrations/             # Database migrations and seeds
├── public/                 # Static assets (CSS, JS, images)
├── logs/                   # Application logs
├── backups/                # Database backup files
├── uploads/                # File uploads directory
├── .env.sample             # Environment variables template
├── ecosystem.config.json   # PM2 configuration
└── docker-compose.yml      # Docker configuration
```

## 🔧 Configuration

### Database Configuration
The application uses PostgreSQL with connection pooling. Configure your database settings in the `.env` file.

### Session Configuration
Sessions are configured with Express session middleware. Update the session secret in your environment variables.

### File Upload Configuration
File uploads support both local storage and AWS S3. Configure AWS credentials for S3 integration.

## 🛡️ Security

### Authentication
- Session-based authentication with secure cookies
- Password hashing using bcrypt
- Two-factor authentication (2FA) with TOTP

### Authorization
- Role-based access control (RBAC)
- Granular permissions system
- Middleware-based route protection

### SSL/TLS
Use the provided script to set up self-signed SSL certificates:
```bash
./setup-self-signed-ssl.sh
```

## 🔥 Firewall Setup

Configure system firewall rules using the provided script:
```bash
./setup-firewall.sh
```

## 📊 API Documentation

The application includes Swagger/OpenAPI documentation for API endpoints. Access it at:
```
https://<your-host>:443/api-docs
```

## 🗄️ Database

### Initial Setup
For new installations, run these commands once:
```bash
# Create all database tables
node migrations/init_all_tables.js

# Seed sample data (optional)
node migrations/sample/seed.js
```

### Schema Updates
When database schema changes (after code updates), run:
```bash
# Apply schema changes
node migrations/migrate_tables.js
```

**Note**: Only run migrations when you've updated the code and there are database schema changes.

### Available Tables
- **Users and Authentication**: User accounts, roles, and permissions
- **Devices and Systems**: Network devices, servers, and system components
- **Networks and Subnets**: Network infrastructure with Zone and Environment support
- **IP Addresses**: IP address tracking with subnet relationships
- **Servers and Services**: Server management and service configurations
- **Firewall Rules**: Network security rules and policies
- **Permissions and Roles**: Access control and authorization
- **System Logs**: Application and system event logging
- **File Uploads**: File management and storage
- **Configuration**: Dynamic system parameter configuration
- **Contacts**: Contact information management
- **Tags**: Resource tagging system

## 🚀 Deployment

### Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# Monitor services
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart
```

### Using PM2 (Local)
```bash
# Start application
pm2 start ecosystem.config.json

# Monitor application
pm2 monit

# View logs
pm2 logs open-asm
```

### Nginx Configuration
Use the provided `nginx.conf` for reverse proxy setup.

## 📝 Logging

The application uses a comprehensive logging system:
- **Combined logs**: `logs/combined.log`
- **Error logs**: `logs/error.log`
- **Output logs**: `logs/out.log`

Logs are automatically rotated and cleaned up using scheduled jobs.

## 💾 Database Backup

The application includes an automated database backup system that creates compressed PostgreSQL dumps on a scheduled basis.

### Backup Configuration

Add these variables to your `.env` file to configure the backup job:

```env
# Backup Configuration
# Backup frequency: daily, weekly, monthly
BACKUP_FREQUENCY=daily

# Number of backups to keep (default: 7)
BACKUP_RETENTION=7

# Backup directory (default: backups folder in app root)
# BACKUP_DIR=/path/to/backup/directory
```

### Configuration Options

#### BACKUP_FREQUENCY
- **daily**: Backup every day at 2:00 AM
- **weekly**: Backup every Sunday at 2:00 AM  
- **monthly**: Backup on the 1st day of each month at 2:00 AM
- **default**: daily

#### BACKUP_RETENTION
- Number of backup files to keep
- Old backups will be automatically deleted
- **default**: 7

#### BACKUP_DIR
- Directory to store backup files
- If not specified, uses `backups/` folder in app root
- Directory will be created automatically if it doesn't exist

### Backup Files

- **Format**: `backup_YYYY-MM-DDTHH-mm-ss-sssZ.sql.gz`
- **Compression**: Compressed with gzip for smaller file size
- **Content**: Contains complete database dump

### Example Configuration

```env
BACKUP_FREQUENCY=weekly
BACKUP_RETENTION=30
BACKUP_DIR=/var/backups/open-asm
```

This will:
- Create backup every Sunday at 2:00 AM
- Keep 30 backup files
- Store backups in `/var/backups/open-asm/`

### Manual Backup

You can also create manual backups using `pg_dump`:

```bash
# Create manual backup
pg_dump -h localhost -U postgres -d openasm | gzip > backup_manual_$(date +%Y%m%d_%H%M%S).sql.gz
```

## 🔍 Monitoring

- System status monitoring
- Device health checks
- Network connectivity monitoring
- Performance metrics tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API documentation at `/api-docs`

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**Note**: This application is designed for internal network management and should be deployed behind a reverse proxy (Nginx) for production use. The application binds to localhost only for security reasons.
