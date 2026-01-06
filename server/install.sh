#!/bin/bash

# Trader Bias Backend - Quick Install Script
# For Ubuntu/Debian-based VPS (1GB RAM)

set -e  # Exit on error

echo "================================================"
echo "  Trader Bias Backend - Quick Install"
echo "================================================"
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ This script is for Linux only"
    echo "   For Windows, follow server/README.md manual installation"
    exit 1
fi

# Check if Node.js is installed
echo "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js $NODE_VERSION found"

    # Check if version is >= 18
    NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "⚠️  Node.js version is < 18. Upgrading recommended."
        read -p "Install Node.js 18.x? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Installing Node.js 18.x..."
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
    fi
else
    echo "❌ Node.js not found"
    read -p "Install Node.js 18.x? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing Node.js 18.x..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "Please install Node.js 18+ manually and re-run this script"
        exit 1
    fi
fi

# Install PM2 if not installed
echo ""
echo "Checking PM2 installation..."
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 found"
else
    echo "Installing PM2..."
    sudo npm install -g pm2
    echo "✅ PM2 installed"
fi

# Install dependencies
echo ""
echo "Installing backend dependencies..."
npm install --production
echo "✅ Dependencies installed"

# Create logs directory
echo ""
echo "Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory created"

# Create .env file if not exists
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Start with PM2
echo ""
echo "Starting backend server with PM2..."
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "✅ Backend server started!"
echo ""
echo "================================================"
echo "  Installation Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Check server status:"
echo "   pm2 status"
echo ""
echo "2. View logs:"
echo "   pm2 logs traderbias-backend"
echo ""
echo "3. Test the API:"
echo "   curl http://localhost:3001/api/health"
echo ""
echo "4. Enable auto-start on boot:"
echo "   pm2 startup"
echo "   (Follow the instructions printed)"
echo ""
echo "5. Configure firewall to allow port 3001:"
echo "   sudo ufw allow 3001/tcp"
echo "   sudo ufw reload"
echo ""
echo "6. Test from external:"
echo "   curl http://YOUR_VPS_IP:3001/api/health"
echo ""
echo "For full documentation, see:"
echo "  - server/README.md"
echo "  - BACKEND_DEPLOYMENT.md"
echo ""
echo "================================================"
