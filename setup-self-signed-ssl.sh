#!/bin/bash

echo "🔐 Creating self-signed SSL certificate for default server..."

# Create self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/C=VN/ST=HCM/L=HoChiMinh/O=OpenASM/OU=IT/CN=localhost"

# Set proper permissions
sudo chmod 600 /etc/ssl/private/nginx-selfsigned.key
sudo chmod 644 /etc/ssl/certs/nginx-selfsigned.crt

echo "✅ Self-signed certificate created successfully!"
echo "📁 Certificate: /etc/ssl/certs/nginx-selfsigned.crt"
echo "🔑 Private key: /etc/ssl/private/nginx-selfsigned.key"
echo ""
echo "⚠️  Note: This is a self-signed certificate."
echo "   Browsers will show security warnings."
echo "   For production, use a proper SSL certificate from Let's Encrypt or CA."
