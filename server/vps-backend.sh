#!/bin/bash
# VPS Backend Management Script
# Location: /var/www/traderbias/server/vps-backend.sh
# Usage: ./vps-backend.sh [start|stop|restart|status|logs]

cd /var/www/traderbias/server

case "$1" in
  start)
    echo "Starting backend..."
    pm2 start ecosystem.config.js
    pm2 save
    ;;
  stop)
    echo "Stopping backend..."
    pm2 stop traderbias-backend
    ;;
  restart)
    echo "Restarting backend..."
    pm2 restart traderbias-backend
    ;;
  status)
    pm2 status
    curl -s http://localhost:3001/api/health | head -c 200
    echo ""
    ;;
  logs)
    pm2 logs traderbias-backend --lines 50
    ;;
  update)
    echo "Pulling latest code and restarting..."
    git pull
    npm install --production
    pm2 restart traderbias-backend
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|update}"
    exit 1
    ;;
esac
