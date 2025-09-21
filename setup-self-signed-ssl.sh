#!/bin/bash

echo "🔐 Creating self-signed SSL certificate for default server..."

# Remove existing ssl directory if owned by root and create new one
if [ -d "./ssl" ] && [ "$(stat -c %U ./ssl)" = "root" ]; then
    echo "⚠️  Removing existing ssl directory owned by root..."
    sudo rm -rf ./ssl
fi

# Create ssl directory if it doesn't exist
mkdir -p ./ssl

# Create self-signed certificate in ./ssl directory
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ./ssl/nginx-selfsigned.key \
    -out ./ssl/nginx-selfsigned.crt \
    -subj "/C=VN/ST=HCM/L=HoChiMinh/O=OpenASM/OU=IT/CN=localhost"

# Set proper permissions
chmod 600 ./ssl/nginx-selfsigned.key
chmod 644 ./ssl/nginx-selfsigned.crt

echo "✅ Self-signed certificate created successfully!"
echo "📁 Certificate: ./ssl/nginx-selfsigned.crt"
echo "🔑 Private key: ./ssl/nginx-selfsigned.key"
echo ""
echo "⚠️  Note: This is a self-signed certificate."
echo "   Browsers will show security warnings."
echo "   For production, use a proper SSL certificate from Let's Encrypt or CA."
