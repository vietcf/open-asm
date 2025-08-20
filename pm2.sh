#!/bin/bash

# PM2 Management Script for Open ASM
# Detect actual user (in case running with sudo)
ACTUAL_USER=${SUDO_USER:-$USER}

# Prevent running as root
if [ "$EUID" -eq 0 ]; then
  echo "❌ Please run this script as a normal user, not with sudo or as root."
  exit 1
fi

case "$1" in
  start)
    echo "🚀 Starting Open ASM with PM2 (user: $ACTUAL_USER)..."
    pm2 start ecosystem.config.json --env production
    ;;
  stop)
    echo "⏹️  Stopping Open ASM..."
    pm2 stop open-asm
    ;;
  restart)
    echo "🔄 Restarting Open ASM..."
    pm2 restart open-asm
    ;;
  reload)
    echo "♻️  Reloading Open ASM (zero downtime)..."
    pm2 reload open-asm
    ;;
  delete)
    echo "🗑️  Deleting Open ASM from PM2..."
    pm2 delete open-asm
    ;;
  status)
    echo "📊 PM2 Status (user: $ACTUAL_USER):"
    pm2 status
    ;;
  logs)
    echo "📄 PM2 Logs:"
    pm2 logs open-asm --lines 50
    ;;
  monit)
    echo "📊 PM2 Monitor:"
    pm2 monit
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|reload|delete|status|logs|monit}"
    echo ""
    echo "Commands:"
    echo "  start   - Start the application"
    echo "  stop    - Stop the application"
    echo "  restart - Restart the application"
    echo "  reload  - Zero-downtime reload"
    echo "  delete  - Remove from PM2"
    echo "  status  - Show PM2 status"
    echo "  logs    - Show application logs"
    echo "  monit   - Open PM2 monitor"
    exit 1
    ;;
esac
