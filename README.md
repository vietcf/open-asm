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
cp .env.sample .env.docker
# Edit .env.docker with your configuration
```

3. **Start the application**:
```bash
docker-compose up --build -d
```

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

# Run migrations
node migrations/init_all_tables.js
node migrations/init_data.js
```

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

For Docker deployment, use `.env.docker`:

```env
# Database Configuration
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=open_asm
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123

# Application Configuration
NODE_ENV=production
PORT=3000
SESSION_SECRET=docker_session_secret

# JWT Configuration
JWT_SECRET=docker_jwt_secret
JWT_EXPIRES_IN=24h
```

## 🐳 Docker Commands

### Build and Run
```bash
# Build and start all services
docker-compose up --build -d

# Build specific service
docker-compose build app

# Start services
docker-compose up -d

# Stop services
docker-compose down
```

### Docker Image Management
```bash
# Save Docker images
./save-docker-images.sh

# Or manually save specific image
sudo docker save openasm_app:4.0.0 | gzip > openasm_app_4.0.0.tar.gz

# Load Docker image
sudo docker load < openasm_app_4.0.0.tar.gz
```

### Logs and Monitoring
```bash
# View logs
docker-compose logs -f app
docker-compose logs -f db
docker-compose logs -f nginx

# Check container status
docker-compose ps
```

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
cp .env.sample .env.docker
# Edit .env.docker

# Deploy
docker-compose up --build -d
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
```bash
# Run all tests
npm test

# Run specific test
npm test -- --grep "API Tests"

# Run with coverage
npm run test:coverage
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Database Management
```bash
# Run migrations
node migrations/init_all_tables.js

# Seed data
node migrations/init_data.js

# Create backup
pg_dump -h localhost -U postgres -d open_asm | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore backup
gunzip -c backup_20240101_120000.sql.gz | psql -h localhost -U postgres -d open_asm
```

## 📝 Changelog

### Version 4.0.0 (Latest)
- ✅ **API Improvements**: Complete REST API with partial update support
- ✅ **UI/UX Enhancements**: Improved forms, modals, and user experience
- ✅ **System Management**: Enhanced system and component management
- ✅ **Device Management**: Improved device list with IP address display
- ✅ **Modal Behavior**: Fixed button disabling when modals are open
- ✅ **File Management**: Enhanced file upload and display
- ✅ **Code Cleanup**: Removed test files and improved project structure
- ✅ **Docker Support**: Updated Docker configuration and scripts

### Version 3.4.0
- ✅ **Firewall Management**: Enhanced firewall rule management
- ✅ **Network Management**: Improved IP address and subnet management
- ✅ **User Management**: Enhanced user and role management
- ✅ **Backup System**: Automated database backup system

### Version 3.0.0
- ✅ **Initial Release**: Core functionality implementation
- ✅ **Authentication**: User authentication and authorization
- ✅ **Device Management**: Basic device and server management
- ✅ **Network Management**: IP address and subnet management

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