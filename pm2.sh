#!/bin/bash

# PM2 Management Script for Open ASM
# Detect actual user (in case running with sudo)
ACTUAL_USER=${SUDO_USER:-$USER}

case "$1" in
  start)
    echo "🚀 Starting Open ASM with PM2 (user: $ACTUAL_USER)..."
    sudo -u $ACTUAL_USER pm2 start ecosystem.config.json --env production
    ;;
  stop)
    echo "⏹️  Stopping Open ASM..."
    sudo -u $ACTUAL_USER pm2 stop open-asm
    ;;
  restart)
    echo "🔄 Restarting Open ASM..."
    sudo -u $ACTUAL_USER pm2 restart open-asm
    ;;
  reload)
    echo "♻️  Reloading Open ASM (zero downtime)..."
    sudo -u $ACTUAL_USER pm2 reload open-asm
    ;;
  delete)
    echo "🗑️  Deleting Open ASM from PM2..."
    sudo -u $ACTUAL_USER pm2 delete open-asm
    ;;
  status)
    echo "📊 PM2 Status (user: $ACTUAL_USER):"
    sudo -u $ACTUAL_USER pm2 status
    ;;
  logs)
    echo "📄 PM2 Logs:"
    sudo -u $ACTUAL_USER pm2 logs open-asm --lines 50
    ;;
  monit)
    echo "📊 PM2 Monitor:"
    sudo -u $ACTUAL_USER pm2 monit
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
