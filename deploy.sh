#!/bin/bash

echo "🚀 Deploying Open ASM with HTTPS..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install PM2 globally
echo "⚡ Installing PM2..."
sudo npm install -g pm2

# 2. Install and setup Nginx
echo "🔧 Installing and setting up Nginx..."
sudo apt update
sudo apt install -y nginx

# Start nginx service
sudo systemctl start nginx
sudo systemctl enable nginx

# Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/open-asm
sudo ln -sf /etc/nginx/sites-available/open-asm /etc/nginx/sites-enabled/

# Remove default nginx config (both symlink and original file)
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-available/default

# 3. Setup SSL (Self-signed for default server) - BEFORE testing nginx config
echo "🔒 Setting up SSL..."
chmod +x setup-self-signed-ssl.sh
sudo ./setup-self-signed-ssl.sh

# 4. Test nginx config (after SSL cert is created)
echo "🔧 Testing nginx configuration..."
sudo nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration error!"
    exit 1
fi

# Restart nginx to apply new configuration
echo "🔄 Restarting Nginx with new configuration..."
sudo systemctl restart nginx

# 5. Setup PM2 configuration
echo "⚡ Setting up PM2..."
# Stop existing PM2 processes if any
pm2 stop open-asm || echo "No existing PM2 process"
pm2 delete open-asm || echo "No existing PM2 process to delete"

# 6. Set permissions
PROJECT_DIR=$(pwd)
ACTUAL_USER=${SUDO_USER:-$USER}
echo "📁 Setting permissions for project: $PROJECT_DIR"
echo "👤 Setting owner to: $ACTUAL_USER"

sudo chown -R $ACTUAL_USER:$ACTUAL_USER "$PROJECT_DIR"
sudo chmod -R 755 "$PROJECT_DIR"

# Create necessary directories if not exists
mkdir -p "$PROJECT_DIR/public/uploads"
mkdir -p "$PROJECT_DIR/logs"

# More secure permission for uploads (owner: read/write/execute, group/others: read/execute)
sudo chmod -R 775 "$PROJECT_DIR/public/uploads"
sudo chmod -R 755 "$PROJECT_DIR/logs"

# Check if www-data group exists, if not create it or use current user group
if getent group www-data > /dev/null 2>&1; then
    echo "👥 Setting uploads group to www-data"
    sudo chown -R $ACTUAL_USER:www-data "$PROJECT_DIR/public/uploads"
    echo "📝 Setting logs owner to $ACTUAL_USER"
    sudo chown -R $ACTUAL_USER:$ACTUAL_USER "$PROJECT_DIR/logs"
else
    echo "⚠️  www-data group not found, using $ACTUAL_USER group"
    sudo chown -R $ACTUAL_USER:$ACTUAL_USER "$PROJECT_DIR/public/uploads"
    sudo chown -R $ACTUAL_USER:$ACTUAL_USER "$PROJECT_DIR/logs"
fi

# 7. Start app with PM2
echo "🚀 Starting app with PM2..."
# Switch to actual user to start PM2 (avoid running as root)
sudo -u $ACTUAL_USER pm2 start ecosystem.config.json --env production

# Save PM2 configuration and setup auto-restart for the actual user
sudo -u $ACTUAL_USER pm2 save
sudo -u $ACTUAL_USER pm2 startup
echo "⚠️  Copy and run the command above to enable PM2 auto-startup for user: $ACTUAL_USER"

# 8. Check status
echo "📊 Service status:"
sudo systemctl status nginx --no-pager
echo ""
echo "📊 PM2 status (for user $ACTUAL_USER):"
sudo -u $ACTUAL_USER pm2 status
sudo -u $ACTUAL_USER pm2 logs open-asm --lines 10

echo "✅ Deployment completed!"
echo "🌐 Your app should be available at: https://your-domain.com"
echo ""
echo "📝 Next steps:"
echo "1. App is now accessible via any hostname/IP on HTTPS"
echo "2. For production with real domain, update nginx.conf with actual domain names"
echo "3. Replace self-signed cert with real SSL certificate (Let's Encrypt/CA)"
echo "4. Update .env with your production values"
echo "5. Test the application at https://your-server-ip or https://localhost"
