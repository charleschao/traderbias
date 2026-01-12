# External Integrations

**Analysis Date:** 2026-01-12

## APIs & External Services

**Cryptocurrency Exchange APIs:**

- **Hyperliquid** - Primary data source (main exchange)
  - REST: `https://api.hyperliquid.xyz/info`
  - WebSocket: `wss://api.hyperliquid.xyz/ws`
  - Leaderboard: `https://stats-data.hyperliquid.xyz/Mainnet/leaderboard`
  - Auth: None required (public API)
  - Used for: Market data, OI, funding, CVD, leaderboard, whales

- **Binance Futures** - Secondary data source
  - REST: `https://fapi.binance.com` (proxied via `/api/binance` in dev)
  - WebSocket: `wss://fstream.binance.com/ws`
  - Auth: None for public data
  - Used for: Market data, whale trades
  - Note: Geo-restricted (requires VPN in backend)

- **Bybit** - Secondary data source
  - REST: `https://api.bybit.com` (proxied via `/api/bybit` in dev)
  - WebSocket: `wss://stream.bybit.com/v5/public/linear`
  - Auth: None for public data
  - Used for: Market data, whale trades

- **OKX** - Whale trade tracking
  - WebSocket: `wss://ws.okx.com:8443/ws/v5/public`
  - Used for: BTC mega whale trades ($4M+)

- **Kraken** - Whale trade tracking
  - WebSocket: `wss://ws.kraken.com/v2`
  - Used for: BTC mega whale trades ($4M+)

- **Nado Archive** - Historical data
  - REST: `https://archive.prod.nado.xyz/v1`
  - Used for: Historical market data

- **AsterDex** - Market data
  - REST: `https://fapi.asterdex.com`
  - Used for: Additional market data

**ETF Flow Data:**
- Web scraping via Cheerio (`server/etfFlowCollector.js`)
- Data source: Not specified (scraped from public pages)
- Used for: Bitcoin ETF inflow/outflow tracking

## Data Storage

**Databases:**
- JSON file persistence (`server/data/`)
- Files: `historical-data.json`, `spot-cvd-history.json`, `predictions.json`
- No traditional database

**Caching:**
- In-memory caching in `server/dataStore.js`
- 24-hour rolling window for historical data
- localStorage for frontend historical data (60min retention for OI/price, 15min for bias history)

## Authentication & Identity

**Auth Provider:**
- None - Public dashboard, no user accounts

**API Keys:**
- VPN credentials for Gluetun (ProtonVPN)
- No exchange API keys required (public endpoints only)

## Monitoring & Observability

**Error Tracking:**
- Console logging only
- No external error tracking service

**Analytics:**
- None configured

**Logs:**
- Console.log/console.error in code
- PM2 logs for backend (`pm2 logs traderbias-backend`)

## CI/CD & Deployment

**Hosting:**
- Frontend: Static build deployable anywhere (`npm run build` -> `dist/`)
- Backend: Docker on VPS with Gluetun VPN (`server/docker-compose.yml`)

**CI Pipeline:**
- None configured
- Manual deployment via PowerShell scripts (`deploy.ps1`, `deploy-prod.ps1`)

## Environment Configuration

**Development:**
- Required env vars: `VITE_BACKEND_API_URL`, `VITE_USE_BACKEND`
- Secrets location: `.env` (gitignored)
- Vite proxy handles CORS for Binance/Bybit in dev mode

**Production:**
- Frontend: Build and deploy static files
- Backend: Docker with Gluetun VPN
  - `VPN_SERVICE_PROVIDER=protonvpn`
  - `OPENVPN_USER`, `OPENVPN_PASSWORD`
  - `SERVER_COUNTRIES=Singapore`

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Network Architecture

```
Production Data Flow:
┌─────────────────────────────────────────────────────────┐
│ VPS (Docker)                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Gluetun Container (ProtonVPN Singapore)             │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ traderbias-backend Container                    │ │ │
│ │ │ - Express server on port 3001                   │ │ │
│ │ │ - All outbound traffic routed through VPN       │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
          │
          ▼ VPN Tunnel
    ┌─────────────┐
    │ Singapore   │
    │ Exit Node   │
    └─────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│ Exchange APIs (Binance, Bybit, Hyperliquid, etc.)       │
└─────────────────────────────────────────────────────────┘
```

---

*Integration audit: 2026-01-12*
*Update when adding/removing external services*
