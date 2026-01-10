# Backend Architecture Review

## Executive Summary

Your backend is well-architected with proper VPN routing through Gluetun for geo-restricted APIs. However, there's **critical duplication** between backend and frontend bias calculations that needs to be addressed before implementing the 6 quick fixes.

---

## Architecture Overview

### 1. Network Layer (Gluetun VPN)

**docker-compose.yml Configuration:**
```yaml
gluetun (VPN Container)
├── ProtonVPN (Singapore node)
├── Exposes port 3001
└── Routes all backend traffic through VPN

traderbias-backend (App Container)
├── network_mode: "service:gluetun"
├── Shares gluetun's network stack
└── All API calls go through VPN
```

**Why Singapore?**
- Binance & Bybit friendly region
- Low latency to Asian markets
- Bypasses US/EU geo-restrictions

**VPN Credentials** (in docker-compose.yml):
```
User: 6PbK1i90BTwe1b0e
Pass: Er8kjlJqvbSIc1fvv8MKdqTdUUBajnzw
```
⚠️ **SECURITY NOTE:** Credentials are hardcoded in docker-compose.yml (should use .env file)

---

## Data Collection Architecture

### 2. REST API Polling (dataCollector.js)

**Polling Intervals:**
- Hyperliquid: Every 10s
- Binance: Every 10s
- Bybit: Every 10s
- Nado: Every 60s (slower API)
- AsterDex: Every 10s

**Data Points Collected Per Exchange:**
```
Price       → Latest mark price
OI          → Total open interest (USD value)
Funding     → Current funding rate
Orderbook   → Top 10 levels (bid/ask imbalance)
CVD         → Last 100 trades (buy vol - sell vol)
```

**Storage:**
- In-memory arrays with 24h retention
- Persisted to JSON file every 1 minute (`server/data/datastore.json`)
- Survives Docker container restarts
- Automatic cleanup of data older than 24h

---

### 3. WebSocket Feeds (whaleWatcher.js)

**7 Exchange Connections:**
```
SPOT Markets:
├── Binance Spot      (wss://stream.binance.com)
├── Coinbase          (wss://advanced-trade-ws.coinbase.com)
└── Kraken            (wss://ws.kraken.com/v2)

PERP Markets:
├── Binance Futures   (wss://fstream.binance.com)
├── Bybit Linear      (wss://stream.bybit.com/v5/public/linear)
├── OKX Swap          (wss://ws.okx.com:8443/ws/v5/public)
└── Hyperliquid       (wss://api.hyperliquid.xyz/ws)
```

**Whale Trade Threshold:**
- Current: **$500k+ notional** stored in memory
- Frontend filters to $4M+ for display
- Max 500 trades stored (FIFO queue)
- Deduplicated by `exchange + tradeId + symbol`

**Reconnection Logic:**
- Auto-reconnect with 5s delay on disconnect
- Ping/pong keep-alive (15-30s intervals)
- Error handling with exponential backoff

---

### 4. Data Storage (dataStore.js)

**In-Memory Structure:**
```javascript
{
  hyperliquid: {
    price: { BTC: [{timestamp, value}], ETH: [], SOL: [] },
    oi: { BTC: [{timestamp, value}], ETH: [], SOL: [] },
    funding: { BTC: [{timestamp, rate}], ETH: [], SOL: [] },
    orderbook: { BTC: [{timestamp, imbalance, bidDepth, askDepth}], ... },
    cvd: { BTC: [{time, delta}], ETH: [], SOL: [] },
    current: { price: {BTC, ETH, SOL}, oi: {...}, ... }
  },
  binance: {...},
  bybit: {...},
  nado: {...},
  asterdex: {...},
  whaleTrades: [...],
  spotCvd: { BTC: {...}, ETH: {...}, SOL: {...} }
}
```

**Persistence:**
- Saves to `server/data/datastore.json` every 1 minute
- On SIGTERM/SIGINT (Docker stop)
- Restores on startup (filters expired data)
- Typical size: 2-5MB for 24h of data

---

## Bias Calculation Duplication Problem

### 5. Backend Bias Logic (biasProjection.js)

**Sophisticated Algorithm:**
```javascript
Weighted Components:
├── Funding Z-Score (20%) - Extreme positioning detection
├── OI Rate of Change (20%) - Leverage dynamics
├── CVD Persistence (20%) - Sustained pressure
├── Market Regime (20%) - OI + Funding confluence
├── Whale Consensus (10%) - Hyperliquid leaderboard
└── Cross-Exchange Confluence (10%)

Bonus Multipliers:
├── RSI Divergence (±20%) - Bullish/bearish reversals
├── Spot-Perp Divergence (±25%) - Accumulation/distribution
├── All Factors Aligned (+10%)
└── Capitulation Bottom (+20%)
```

**Exposed via:**
- `GET /api/btc/projection`
- `GET /api/eth/projection`
- `GET /api/sol/projection`

**Current Usage:** Only used for "8-12hr Outlook" section (not main bias cards)

---

### 6. Frontend Bias Logic (biasCalculations.js)

**Simpler Algorithm:**
```javascript
Components:
├── OI Velocity - Rate of change over timeframe
├── Funding Trend - 1H funding rate change
├── Divergence Strength - Price vs CVD direction mismatch
├── Liquidation Proximity - Distance to whale liq zones
└── Composite Bias - Averages multiple signals (BROKEN)
```

**Current Usage:** Main bias cards (BTC/ETH/SOL)

**Problems:**
1. ❌ Composite bias averages signals (dilutes best signal)
2. ❌ CVD threshold $1k (laughable for BTC)
3. ❌ Whale threshold $4M+ (too high for ETH/SOL)
4. ❌ Funding only contrarian (misses bullish trends)
5. ❌ No volatility adaptation

---

## API Endpoints

### 7. Backend Server (server.js)

**Production URL:** `https://traderbias.app/api/...`

**Endpoints:**
```
GET /api/health                  → Server health check
GET /api/data/all                → All exchanges (4h history)
GET /api/data/:exchange          → Single exchange (4h history)
GET /api/snapshot/:exchange      → Current values only (fast)
GET /api/whale-trades?limit=100  → Recent whale trades
GET /api/spot-cvd/:coin          → Spot vs perp CVD comparison
GET /api/:coin/projection        → 8-12h bias projection
GET /api/stats                   → Backend statistics
```

**Frontend Configuration (.env):**
```bash
VITE_BACKEND_API_URL=https://traderbias.app
VITE_USE_BACKEND=true
```

---

## Implementation Plan for 6 Quick Fixes

### Where to Apply Fixes:

#### ✅ Option 1: Use Backend Projection (Recommended)
**Pros:**
- Backend already has sophisticated logic (RSI divergence, Z-scores, spot-perp)
- Centralized calculations (consistent for all users)
- Can leverage 24h of historical data server-side
- Less frontend computation

**Changes Needed:**
1. Update `server/biasProjection.js`:
   - Fix CVD thresholds (BTC=$50k, ETH=$20k, SOL=$5k)
   - Fix whale thresholds (coin-specific)
   - Add momentum funding mode
   - Add win rate tracking
2. Expose win rates via API endpoint
3. Update frontend to use `/api/:coin/projection` for main bias cards
4. Remove duplicate logic from `src/utils/biasCalculations.js`

**Deployment:**
```bash
# On VPS
cd /var/www/traderbias/server
git pull
docker compose down
docker compose up -d --build
```

---

#### ⚠️ Option 2: Fix Frontend Only
**Pros:**
- Simpler deployment (just frontend changes)
- Works without backend

**Cons:**
- Still have duplication
- Frontend can't leverage 24h backend history
- More computation in browser

**Changes Needed:**
1. Update `src/utils/biasCalculations.js` with all 6 fixes
2. Keep backend projection as-is (for 8-12h outlook)

---

#### ❌ Option 3: Fix Both (Not Recommended)
**Cons:**
- Maintains duplication
- Double the work
- Risk of divergence between implementations

---

## Recommendations

### Immediate Actions (Before Implementing Fixes):

1. **Decision Required:** Choose Option 1 or Option 2 above

2. **Security Fix:**
   ```bash
   # Move VPN credentials to .env file
   server/.env:
   PROTONVPN_USER=6PbK1i90BTwe1b0e
   PROTONVPN_PASS=Er8kjlJqvbSIc1fvv8MKdqTdUUBajnzw
   ```

3. **Backend Threshold Update (Regardless of Option):**
   ```javascript
   // whaleWatcher.js line 6
   MIN_STORE_THRESHOLD: 500_000  → 200_000
   ```
   This lets backend store $200k+ trades, then frontend filters display threshold per coin

### Architecture Strengths:

✅ VPN routing through Gluetun (excellent for geo-restricted APIs)
✅ Data persistence with Docker volume mounting
✅ Multi-exchange WebSocket aggregation
✅ Memory-efficient circular buffers
✅ Automatic reconnection with exponential backoff
✅ Health check endpoints for monitoring

### Architecture Weaknesses:

❌ Hardcoded VPN credentials in docker-compose.yml
❌ Bias calculation duplication (backend vs frontend)
❌ Backend projection not used for main UI
❌ Fixed whale thresholds (not coin-specific)
❌ No rate limiting on API endpoints
❌ No authentication/CORS protection in production

---

## Performance Metrics

**Current Backend Stats (from /api/stats):**
```
Data Points: ~50,000 (24h of 10s intervals × 5 exchanges × 5 metrics × 3 coins)
Memory Usage: ~3.3 MB (66 bytes per data point)
Uptime: Continuous since last restart
Latency: ~100-200ms per API call
```

**Optimization Opportunities:**
1. Add Redis caching for frequently accessed data
2. Implement GraphQL for selective field fetching
3. Add CDN for static data (funding rates update slowly)
4. Compress historical data with sampling (10s → 1min for data >1h old)

---

## Deployment Workflow

**Current Process (from CLAUDE.md):**
```bash
# Development (preview at https://newdev.traderbias.app)
./deploy-dev.ps1

# Production (live at https://traderbias.app)
./deploy-prod.ps1

# Backend updates (VPS via SSH)
cd /var/www/traderbias/server
git pull
docker compose down
docker compose up -d --build
```

**Git Workflow:**
```bash
git add -A
git commit -m "Fix: implement 6 quick fixes"
git push
```

---

## Next Steps

1. **Choose implementation option** (1 or 2)
2. **Review QUICK_FIXES_CODE.md** with backend context
3. **Decide which files to update** (backend vs frontend)
4. **Plan deployment strategy** (frontend-only or full stack)
5. **Implement fixes** with proper testing
6. **Deploy to dev environment** first
7. **Validate with real data** before production push

---

## Questions to Answer:

1. **Do you want to use backend projection for main bias cards?** (Recommended)
   - If yes → Update backend + integrate frontend
   - If no → Update frontend calculations only

2. **Should whale feed threshold be lowered?**
   - Current: $500k stored, $4M displayed
   - Recommended: $200k stored, coin-specific display ($4M BTC, $500k ETH, $200k SOL)

3. **Priority: Speed vs Features?**
   - Speed → Option 2 (frontend-only fixes)
   - Features → Option 1 (use backend projection)

4. **Testing approach?**
   - Deploy to dev environment first?
   - Test with historical data replay?
   - A/B test old vs new bias logic?

---

**Ready to proceed with implementation once you decide on Option 1 or Option 2.**
