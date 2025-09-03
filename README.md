# Open ASM (Asset Security Management)

A comprehensive network and system management platform built with Node.js, Express, and PostgreSQL. This application provides a web-based interface for managing network devices, servers, firewall rules, and system configurations with robust authentication and authorization features.

## 🚀 Features

### Core Functionality
- **Device Management**: Monitor and manage network devices, servers, and systems
- **Network Management**: Configure and monitor network infrastructure
- **Firewall Management**: Create and manage firewall rules and policies
- **User Authentication**: Secure login with session management
- **Two-Factor Authentication (2FA)**: Enhanced security with TOTP support
- **Role-Based Access Control**: Granular permissions and role management
- **File Upload Management**: Handle file uploads with AWS S3 integration
- **System Monitoring**: Real-time system status and logging
- **API Documentation**: Swagger/OpenAPI integration

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

- **Node.js** >= 16.0.0
- **PostgreSQL** >= 12.0
- **PM2** (for production deployment)
- **Nginx** (recommended for reverse proxy)

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd open-asm
```

2. **Install dependencies**
```bash
npm install
```
**Note**: Make sure you run `npm install` (not `node install`) to install the project dependencies.

3. **Set up environment variables**
Create a `.env` file in the root directory:
```env
# Database Configuration
PGUSER=asmuser
PGHOST=localhost
PGDATABASE=asm
PGPASSWORD=asmuser
PGPORT=5432

# Application Configuration
NODE_ENV=development
PORT=3000
SESSION_SECRET=your_session_secret

# AWS S3 Configuration (optional)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
S3_BUCKET_NAME=your_s3_bucket
```

4. **Database Setup**

First, create the PostgreSQL database and user:

```sql
-- 1. Create Database
CREATE DATABASE asm;

-- 2. Create User
CREATE USER asmuser WITH PASSWORD 'asmuser';

-- 3. Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE asm TO asmuser;

-- 4. Connect to the database
\c asm

-- 5. Grant schema privileges
GRANT ALL ON SCHEMA public TO asmuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO asmuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO asmuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO asmuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO asmuser;
```

Then initialize the application tables and data:

```bash
# Initialize database tables
node migrations/init_all_tables.js

# Run migrations
node migrations/migrate.js

# Seed sample data (optional)
node migrations/sample/seed.js
```

## 🚦 Running the Application

### Development Mode
```bash
# Using nodemon for auto-restart
npm run dev

# Or direct node execution
node src/app.js
```

### Production Mode
```bash
# Using PM2 process manager
pm2 start ecosystem.config.json

# Or using the provided script
./pm2.sh
```

The application will be available at `http://localhost:3000`

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
│   └── utils/              # Utility functions
├── config/                 # Configuration files
├── migrations/             # Database migrations and seeds
├── public/                 # Static assets (CSS, JS, images)
├── logs/                   # Application logs
└── ecosystem.config.json   # PM2 configuration
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
http://localhost:3000/api-docs
```

## 🗄️ Database

### Migrations
Run database migrations to set up the schema:
```bash
node migrations/migrate.js
```

### Seeding
Populate the database with sample data:
```bash
node migrations/sample/seed.js
```

### Available Tables
- Users and Authentication
- Devices and Systems
- Networks and Subnets
- Servers and Services
- Firewall Rules
- Permissions and Roles
- System Logs
- File Uploads

## 🚀 Deployment

### Using PM2
```bash
# Start application
pm2 start ecosystem.config.json

# Monitor application
pm2 monit

# View logs
pm2 logs open-asm
```

### Using Docker (if applicable)
```bash
# Build and run with Docker
docker-compose up -d
```

### Nginx Configuration
Use the provided `nginx.conf` for reverse proxy setup.

## 📝 Logging

The application uses a comprehensive logging system:
- **Combined logs**: `logs/combined.log`
- **Error logs**: `logs/error.log`
- **Output logs**: `logs/out.log`

Logs are automatically rotated and cleaned up using scheduled jobs.

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
