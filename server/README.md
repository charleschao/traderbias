# Trader Bias Backend Server

Centralized data collection and caching server for Trader Bias. Optimized for 1GB RAM VPS with in-memory storage.

## Features

- **Centralized Data Collection**: Fetches data from 5 exchanges every 60 seconds
- **In-Memory Caching**: Stores 4 hours of historical data (OI, price, funding, orderbook, CVD)
- **Shared Data**: All users see the same data instantly (no per-user waiting)
- **Memory Optimized**: Uses ~120MB RAM with automatic cleanup
- **Auto-Restart**: PM2 process manager with daily cron restart
- **REST API**: Simple endpoints for frontend consumption

## System Requirements

- **RAM**: 1GB minimum (uses ~120MB, leaves 650MB+ headroom)
- **Storage**: 30GB (uses ~6GB with logs)
- **Node.js**: v18.0.0 or higher
- **OS**: Linux (Ubuntu/Debian recommended), Windows (development)

## Installation

### 1. Install Node.js (if not already installed)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x or higher
npm --version
```

### 2. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### 3. Install Dependencies

```bash
cd server
npm install
```

### 4. Configure Environment (Optional)

```bash
cp .env.example .env
# Edit .env if needed (default PORT=3001 works for most setups)
```

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode with PM2

```bash
# Start the server
npm run pm2:start

# View logs
npm run pm2:logs

# Monitor resources
pm2 monit

# Restart server
npm run pm2:restart

# Stop server
npm run pm2:stop
```

## API Endpoints

### Health Check
```http
GET http://localhost:3001/api/health

Response:
{
  "status": "ok",
  "uptime": 3600,
  "memory": {
    "used": "115.23 MB",
    "total": "150.45 MB",
    "dataStore": "2.34 MB"
  },
  "dataStore": {
    "totalDataPoints": 15432,
    "memoryUsageMB": "2.34",
    "exchanges": [...]
  }
}
```

### Get Exchange Data (Historical)
```http
GET http://localhost:3001/api/data/hyperliquid

Response:
{
  "oi": {
    "BTC": [
      { "timestamp": 1704556800000, "value": 1234567890 },
      ...
    ],
    ...
  },
  "price": { ... },
  "orderbook": { ... },
  "cvd": { ... },
  "funding": { ... },
  "current": { ... },
  "lastUpdate": 1704556800000
}
```

### Get Current Snapshot (Faster, No History)
```http
GET http://localhost:3001/api/snapshot/binance

Response:
{
  "current": {
    "price": { "BTC": 45000, "ETH": 2500, "SOL": 100 },
    "oi": { "BTC": 1234567890, ... },
    "funding": { ... },
    "orderbook": { ... },
    "cvd": { ... }
  },
  "lastUpdate": 1704556800000
}
```

### Get All Exchanges
```http
GET http://localhost:3001/api/data/all

Response:
{
  "hyperliquid": { ... },
  "binance": { ... },
  "bybit": { ... },
  "nado": { ... },
  "asterdex": { ... }
}
```

### Server Statistics
```http
GET http://localhost:3001/api/stats

Response:
{
  "server": {
    "uptime": 3600,
    "uptimeFormatted": "1h 0m 0s",
    "nodeVersion": "v18.17.0",
    "platform": "linux"
  },
  "memory": { ... },
  "dataStore": { ... }
}
```

## VPS Deployment

### 1. Upload Files to VPS

```bash
# On your local machine
scp -r server/* user@your-vps-ip:/home/user/traderbias-backend/

# Or use git
ssh user@your-vps-ip
cd /home/user
git clone https://github.com/your-repo/traderbias.git
cd traderbias/server
```

### 2. Install Dependencies

```bash
cd /home/user/traderbias-backend
npm install --production
```

### 3. Start with PM2

```bash
pm2 start ecosystem.config.js

# Save PM2 process list (persists across reboots)
pm2 save

# Setup PM2 startup script (auto-start on boot)
pm2 startup
# Follow the instructions printed (copy/paste the command shown)
```

### 4. Configure Firewall (Allow Port 3001)

```bash
# Ubuntu/Debian with ufw
sudo ufw allow 3001/tcp
sudo ufw reload

# Or use your VPS provider's firewall dashboard
```

### 5. Test Backend

```bash
# On VPS
curl http://localhost:3001/api/health

# From your local machine (replace YOUR_VPS_IP)
curl http://YOUR_VPS_IP:3001/api/health
```

## Frontend Integration

Update your React app to use the backend API:

```javascript
// In App.jsx or config file
const BACKEND_API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Replace direct exchange API calls with backend calls
const fetchMarketData = async () => {
  const res = await fetch(`${BACKEND_API}/api/data/hyperliquid`);
  const data = await res.json();

  // Data is already formatted with historical arrays
  // Just set state directly
  setPriceData(data.current.price);
  setOiData(data.current.oi);
  // etc...
};
```

## Memory Management

The server is optimized for 1GB RAM VPS:

- **Data Retention**: 4 hours (auto-pruned every 10 minutes)
- **Max Memory Usage**: ~150MB (with headroom)
- **Auto-Restart**: Daily at 4 AM (clears any memory leaks)
- **Safety Limit**: PM2 restarts if >800MB used

### Monitoring Memory

```bash
# PM2 monitoring dashboard
pm2 monit

# View memory stats via API
curl http://localhost:3001/api/stats

# System memory (Linux)
free -h
```

## Logs

Logs are stored in `server/logs/`:

```bash
# View logs
pm2 logs traderbias-backend

# View error logs only
pm2 logs traderbias-backend --err

# Clear logs
pm2 flush
```

## Troubleshooting

### Server won't start

```bash
# Check Node.js version
node --version  # Should be 18+

# Check for port conflicts
sudo lsof -i :3001

# Check PM2 status
pm2 list
pm2 logs traderbias-backend --lines 100
```

### High memory usage

```bash
# Check memory stats
pm2 monit

# Restart server
pm2 restart traderbias-backend

# Check for memory leaks
curl http://localhost:3001/api/stats
```

### Data not updating

```bash
# Check logs for API errors
pm2 logs traderbias-backend

# Verify exchange APIs are accessible
curl -X POST https://api.hyperliquid.xyz/info \
  -H "Content-Type: application/json" \
  -d '{"type":"allMids"}'
```

### Frontend can't connect

```bash
# Check firewall
sudo ufw status

# Check server is running
curl http://localhost:3001/api/health

# Check CORS settings (if cross-domain)
# Edit server.js and update CORS config
```

## Maintenance

### Daily Tasks
- Monitor via `pm2 monit` or `/api/stats` endpoint
- Check logs for errors: `pm2 logs traderbias-backend`

### Weekly Tasks
- Review disk space: `df -h`
- Clear old logs: `pm2 flush`

### Monthly Tasks
- Update dependencies: `npm update`
- Review memory trends: `pm2 monit`

## Upgrading

```bash
# Pull latest code
git pull

# Install new dependencies
npm install --production

# Restart server
pm2 restart traderbias-backend
```

## Uninstalling

```bash
# Stop and remove from PM2
pm2 stop traderbias-backend
pm2 delete traderbias-backend
pm2 save

# Remove files
rm -rf /home/user/traderbias-backend
```

## Support

For issues or questions, refer to the main project README or create an issue on GitHub.
