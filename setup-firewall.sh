#!/bin/bash

echo "🔥 Configuring UFW Firewall..."

# Enable UFW
sudo ufw --force enable

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct access to Node.js app port
sudo ufw deny 3000/tcp

# Show status
sudo ufw status verbose

echo "🔒 Firewall configured successfully!"
echo "✅ Only ports 22 (SSH), 80 (HTTP), 443 (HTTPS) are open"
echo "❌ Port 3000 is blocked from external access"
