#!/bin/bash
# Trader Bias - Deploy to Production VPS
# Run: ./deploy-prod.sh

VPS_USER="c"
VPS_HOST="82.29.128.123"
VPS_PORT="22222"
VPS_PATH="/var/www/traderbias.app"

echo -e "\n[1/3] Building frontend..."
VITE_USE_BACKEND=true VITE_BACKEND_API_URL=https://traderbias.app npm run build
if [ $? -ne 0 ]; then echo "Build failed!"; exit 1; fi

echo "[2/3] Deploying to VPS..."
scp -r -P "$VPS_PORT" dist/* "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
if [ $? -ne 0 ]; then echo "Deploy failed!"; exit 1; fi

echo -e "\n[OK] Deployed to https://traderbias.app/"
echo "Run 'ssh $VPS_USER@$VPS_HOST -p $VPS_PORT' and check 'pm2 status' for backend"
