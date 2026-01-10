# Deployment Guide

Complete deployment instructions for TraderBias frontend and backend.

---

## Quick Reference

| Action | Command |
|--------|---------|
| Deploy to Dev | `.\deploy-dev.ps1` |
| Deploy to Prod | `.\deploy-prod.ps1` |
| Rebuild Backend | SSH → `cd /var/www/traderbias/server && git pull && docker compose down && docker compose up -d --build` |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         VPS (82.29.128.123)                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│   │ Caddy Server    │    │ Docker Container                     │ │
│   │ (Reverse Proxy) │───▶│ traderbias-backend                   │ │
│   │                 │    │ Port 3001                            │ │
│   │ :443 HTTPS      │    │                                      │ │
│   └─────────────────┘    └─────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│   ┌─────────────────────────────────────────────────────────────┐│
│   │ Static Files                                                ││
│   │ /var/www/traderbias      → newdev.traderbias.app           ││
│   │ /var/www/traderbias.app  → traderbias.app                  ││
│   └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## Environments

| Environment | URL | Backend API | VPS Path |
|-------------|-----|-------------|----------|
| **Dev** | https://newdev.traderbias.app | https://newdev.traderbias.app | `/var/www/traderbias` |
| **Prod** | https://traderbias.app | https://traderbias.app | `/var/www/traderbias.app` |

---

## Frontend Deployment

### Deploy to Dev

```powershell
.\deploy-dev.ps1
```

What it does:
1. Updates `.env` to use dev backend URL
2. Runs `npm run build`
3. Cleans stale files on VPS
4. Uploads `dist/*` to VPS
5. Optionally purges Cloudflare cache

### Deploy to Production

```powershell
.\deploy-prod.ps1
```

What it does:
1. Updates `.env` to use production backend URL
2. Runs `npm run build`
3. Uploads `dist/*` to production path

### Manual Deployment

```powershell
# 1. Set backend URL in .env
# For dev:
VITE_BACKEND_API_URL=https://newdev.traderbias.app
# For prod:
VITE_BACKEND_API_URL=https://traderbias.app

# 2. Build
npm run build

# 3. Deploy (dev)
scp -r -P 22222 dist/* c@82.29.128.123:/var/www/traderbias/

# Or deploy (prod)
scp -r -P 22222 dist/* c@82.29.128.123:/var/www/traderbias.app/
```

---

## Backend Deployment

The backend runs in Docker on the VPS.

### Update Backend Code

```bash
# SSH into VPS
ssh c@82.29.128.123 -p 22222

# Pull latest code and rebuild
cd /var/www/traderbias/server
git pull
docker compose down
docker compose up -d --build
```

### Full Rebuild (Clear Cache)

```bash
cd /var/www/traderbias/server
git pull
docker builder prune -af
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Check Status

```bash
# Container status
docker ps

# View logs
docker logs traderbias-backend -f

# Test API
curl http://localhost:3001/api/health
curl http://localhost:3001/api/btc/projection
```

---

## Docker Configuration

**File:** `server/docker-compose.yml`

```yaml
services:
  gluetun:
    image: qmcgaw/gluetun:latest
    # VPN configuration...
    ports:
      - 3001:3001

  traderbias-backend:
    build: .
    network_mode: "service:gluetun"
    environment:
      - NODE_ENV=production
      - PORT=3001
```

**File:** `server/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY *.js ./
CMD ["node", "server.js"]
```

---

## VPS Access

```bash
# SSH connection
ssh c@82.29.128.123 -p 22222

# Key locations
/var/www/traderbias/        # Dev frontend
/var/www/traderbias.app/    # Prod frontend
/var/www/traderbias/server/ # Backend (shared)
```

---

## Common Tasks

### View Backend Logs

```bash
docker logs traderbias-backend -f
docker logs traderbias-backend --tail 100
```

### Restart Backend

```bash
docker compose restart
# Or full rebuild:
docker compose down && docker compose up -d
```

### Check Memory

```bash
docker stats traderbias-backend
free -h
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:3001/api/health

# Projection
curl http://localhost:3001/api/btc/projection | head -50

# Exchange data
curl http://localhost:3001/api/data/hyperliquid | head -50
```

---

## Troubleshooting

### Frontend Not Updating

1. Hard refresh browser (Ctrl+Shift+R)
2. Purge Cloudflare cache
3. Check VPS files: `ls -la /var/www/traderbias/`

### Backend API Errors

```bash
# Check if running
docker ps

# Check logs
docker logs traderbias-backend 2>&1 | tail -50

# Restart
docker compose down && docker compose up -d --build
```

### "Connection Refused"

1. Check docker is running: `docker ps`
2. Test locally: `curl http://localhost:3001/api/health`
3. Check Caddy proxy is running

### Build Cache Issues

```bash
docker builder prune -af
docker compose build --no-cache
```

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/health` | Server status |
| `/api/stats` | Memory/data stats |
| `/api/btc/projection` | BTC 8-12hr outlook |
| `/api/eth/projection` | ETH 8-12hr outlook |
| `/api/sol/projection` | SOL 8-12hr outlook |
| `/api/data/:exchange` | Exchange data |
| `/api/whale-trades` | Whale trades feed |
| `/api/spot-cvd/:coin` | Spot CVD data |

---

## Environment Variables

**Frontend (`.env`):**
```env
VITE_USE_BACKEND=true
VITE_BACKEND_API_URL=https://traderbias.app
```

**Backend (docker-compose.yml):**
```env
NODE_ENV=production
PORT=3001
```

---

## Deployment Checklist

### Frontend

- [ ] Code committed and pushed to GitHub
- [ ] Run `.\deploy-dev.ps1` for dev
- [ ] Test on https://newdev.traderbias.app
- [ ] Run `.\deploy-prod.ps1` for production
- [ ] Test on https://traderbias.app

### Backend

- [ ] Code committed and pushed to GitHub
- [ ] SSH into VPS
- [ ] `cd /var/www/traderbias/server && git pull`
- [ ] `docker compose down && docker compose up -d --build`
- [ ] Test: `curl http://localhost:3001/api/health`
- [ ] Verify frontend connects to backend
