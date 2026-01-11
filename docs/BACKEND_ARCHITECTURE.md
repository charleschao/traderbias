# Backend Architecture Documentation

> **Last Updated:** January 2026  
> **Backend Version:** v2 (Refined Algorithm)

This document provides a comprehensive technical overview of the Trader Bias backend server architecture. For deployment instructions, see [BACKEND_DEPLOYMENT.md](./BACKEND_DEPLOYMENT.md).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Modules](#core-modules)
3. [Data Flow](#data-flow)
4. [API Endpoints](#api-endpoints)
5. [Bias Projection Algorithms](#bias-projection-algorithms)
6. [Data Collection](#data-collection)
7. [Storage & Persistence](#storage--persistence)
8. [Performance & Memory](#performance--memory)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       TRADER BIAS BACKEND                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │  dataCollector   │    │ spotDataCollector│    │  whaleWatcher │ │
│  │   (REST APIs)    │    │   (WebSocket)    │    │  (WebSocket)  │ │
│  │   10s intervals  │    │   Real-time      │    │  Real-time    │ │
│  └────────┬─────────┘    └────────┬─────────┘    └───────┬───────┘ │
│           │                       │                       │         │
│           └───────────────────────┼───────────────────────┘         │
│                                   ▼                                 │
│                        ┌──────────────────┐                         │
│                        │    dataStore     │                         │
│                        │  (In-Memory +    │                         │
│                        │   JSON Persist)  │                         │
│                        └────────┬─────────┘                         │
│                                 │                                   │
│           ┌─────────────────────┼─────────────────────┐             │
│           ▼                     ▼                     ▼             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  biasProjection  │  │dailyBiasProjection│ │  winRateTracker   │  │
│  │   (8-12H Algo)   │  │   (24H Algo)      │ │  (Accuracy Stats) │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬──────────┘  │
│           │                     │                     │             │
│           └─────────────────────┼─────────────────────┘             │
│                                 ▼                                   │
│                        ┌──────────────────┐                         │
│                        │   server.js      │                         │
│                        │ (Express API)    │                         │
│                        │   Port 3001      │                         │
│                        └──────────────────┘                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                         Frontend (React)
```

### Components Summary

| Module | Purpose | Key Function |
|--------|---------|--------------|
| `server.js` | HTTP API server | Express app, routes, endpoints |
| `dataStore.js` | Centralized data storage | In-memory + JSON persistence |
| `dataCollector.js` | REST API polling | Fetches from 5 exchanges every 10s |
| `spotDataCollector.js` | Binance spot WebSocket | Real-time spot CVD calculation |
| `whaleWatcher.js` | Multi-exchange WebSocket | Whale trade detection |
| `etfFlowCollector.js` | Bitcoin ETF flows | Farside.co.uk data (JSON file) |
| `biasProjection.js` | 8-12H bias algorithm | Primary directional bias |
| `dailyBiasProjection.js` | 24H bias algorithm | Daily outlook |
| `winRateTracker.js` | Prediction accuracy | Win rate statistics |

---

## Core Modules

### 1. server.js (Express API Server)

**Location:** `server/server.js`

The main entry point that orchestrates all backend functionality.

**Responsibilities:**
- Express HTTP server on port 3001
- CORS middleware for cross-origin requests
- Request logging
- Error handling
- Graceful shutdown (SIGTERM/SIGINT)

**Key Startup Actions:**
```javascript
startDataCollection()      // REST API polling
whaleWatcher.start()       // WebSocket whale trades
startSpotDataCollection()  // Binance spot CVD
app.listen(PORT)           // HTTP server
```

---

### 2. dataStore.js (In-Memory Storage)

**Location:** `server/dataStore.js`

Singleton class that manages all market data in memory with JSON file persistence.

**Data Structure:**
```javascript
{
  hyperliquid: {
    oi: { BTC: [], ETH: [], SOL: [] },
    price: { BTC: [], ETH: [], SOL: [] },
    orderbook: { BTC: [], ETH: [], SOL: [] },
    cvd: { BTC: [], ETH: [], SOL: [] },
    funding: { BTC: [], ETH: [], SOL: [] },
    current: { price: {}, oi: {}, funding: {}, orderbook: {}, cvd: {} }
  },
  binance: { ... },
  bybit: { ... },
  nado: { ... },
  asterdex: { ... },
  whaleTrades: [],
  spotCvd: { BTC: {}, ETH: {}, SOL: {} }
}
```

**Key Features:**
- **24-hour retention**: Data older than 24H is auto-cleaned every 10 minutes
- **File persistence**: Saves to `server/data/datastore.json` every 60 seconds
- **Graceful shutdown**: Saves on SIGTERM/SIGINT
- **Startup recovery**: Loads persisted data on restart

**Methods:**
| Method | Description |
|--------|-------------|
| `addPrice(exchange, coin, value)` | Add price data point |
| `addOI(exchange, coin, value)` | Add open interest data point |
| `addFunding(exchange, coin, rate)` | Add funding rate |
| `addCVD(exchange, coin, delta)` | Add CVD delta |
| `addOrderbook(exchange, coin, imbalance)` | Add orderbook snapshot |
| `addWhaleTrade(trade)` | Add whale trade (deduplicated) |
| `getExchangeData(exchange)` | Get all data for an exchange |
| `getCurrentSnapshot(exchange)` | Get current values only |
| `updateSpotCvd(coin, cvdData)` | Update spot CVD data |
| `getSpotCvdHistory(coin)` | Get spot CVD history |

---

### 3. dataCollector.js (REST API Polling)

**Location:** `server/dataCollector.js`

Polls REST APIs from 5 exchanges at regular intervals.

**Exchanges & Polling Intervals:**
| Exchange | Interval | API Base |
|----------|----------|----------|
| Hyperliquid | 10s | `https://api.hyperliquid.xyz/info` |
| Binance | 10s | `https://fapi.binance.com` |
| Bybit | 10s | `https://api.bybit.com` |
| Nado | 60s | `https://archive.prod.nado.xyz/v1` |
| AsterDex | 10s | `https://fapi.asterdex.com` |

**Data Collected Per Exchange:**
- **Price**: Mark/last price for BTC, ETH, SOL
- **OI**: Open interest in USD
- **Funding**: Current funding rate
- **Orderbook**: Top 10 bid/ask levels → imbalance calculation
- **CVD**: Recent trades → buy volume - sell volume

**Timeout Protection:**
```javascript
const FETCH_TIMEOUT_MS = 15000; // 15 second timeout per request
```

---

### 4. spotDataCollector.js (Spot CVD via WebSocket)

**Location:** `server/spotDataCollector.js`

Connects to Binance spot aggTrade WebSocket for real-time spot CVD calculation.

**Purpose:** Detect spot vs perp divergences (smart money vs leverage tourists).

**WebSocket URL:**
```
wss://stream.binance.com:9443/ws/btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade
```

**Rolling Windows:**
| Window | Duration | Purpose |
|--------|----------|---------|
| `rolling5m` | 5 minutes | Short-term flow |
| `rolling15m` | 15 minutes | Medium-term flow |
| `rolling1h` | 1 hour | Hourly trend |

**Key Signals:**
| Signal | Meaning |
|--------|---------|
| Spot CVD ↗ + Perp flat | Real accumulation (bullish) |
| Perp CVD ↗ + Spot ↘ | Fake pump (bearish) |
| Spot absorbing perp panic | Capitulation bottom (bullish) |

---

### 5. whaleWatcher.js (Multi-Exchange Whale Trades)

**Location:** `server/whaleWatcher.js`

Connects to 7+ exchange WebSockets to detect large trades.

**Exchanges Connected:**
| Exchange | Type | WebSocket URL |
|----------|------|---------------|
| Binance Spot | SPOT | `wss://stream.binance.com/stream` |
| Binance Futures | PERP | `wss://fstream.binance.com/stream` |
| Bybit Linear | PERP | `wss://stream.bybit.com/v5/public/linear` |
| OKX Swap | PERP | `wss://ws.okx.com:8443/ws/v5/public` |
| Hyperliquid | PERP | `wss://api.hyperliquid.xyz/ws` |
| Coinbase | SPOT | `wss://advanced-trade-ws.coinbase.com` |
| Kraken | SPOT | `wss://ws.kraken.com/v2` |

**Storage Threshold:** `$500,000+` notional (frontend filters to display threshold)

**Features:**
- Deduplication by `exchange + tradeId + symbol`
- Max 500 trades stored (FIFO queue)
- Auto-reconnect with 5s delay
- Ping/pong keep-alive

---

### 6. etfFlowCollector.js (Bitcoin ETF Flows)

**Location:** `server/etfFlowCollector.js`

Collects Bitcoin ETF flow data for use in the Daily Bias algorithm. Due to Cloudflare protection on farside.co.uk, uses a hybrid local-scrape + JSON fallback approach.

**Data Source:** [farside.co.uk/btc/](https://farside.co.uk/btc/)

**ETFs Tracked:**
| ETF | Issuer | Notes |
|-----|--------|-------|
| IBIT | BlackRock | Largest by AUM |
| FBTC | Fidelity | Second largest |
| ARKB | Ark/21Shares | |
| BITB | Bitwise | |
| GBTC | Grayscale | Often has outflows |

**How It Works:**

```
┌─────────────────────────────────────────────────────────────┐
│                  ETF FLOW DATA PIPELINE                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LOCAL MACHINE (Windows)                                    │
│  ┌─────────────────────────────────────┐                    │
│  │  node update-etf-flows.js           │                    │
│  │  - Scrapes farside.co.uk            │                    │
│  │  - Writes to data/etf-flows.json    │                    │
│  └───────────────┬─────────────────────┘                    │
│                  │                                          │
│                  ▼                                          │
│  ┌─────────────────────────────────────┐                    │
│  │  git commit && git push             │                    │
│  └───────────────┬─────────────────────┘                    │
│                  │                                          │
├──────────────────┼──────────────────────────────────────────┤
│                  ▼                                          │
│  VPS (Docker)                                               │
│  ┌─────────────────────────────────────┐                    │
│  │  git pull                           │                    │
│  │  - Gets updated etf-flows.json      │                    │
│  └───────────────┬─────────────────────┘                    │
│                  │                                          │
│                  ▼                                          │
│  ┌─────────────────────────────────────┐                    │
│  │  etfFlowCollector.js                │                    │
│  │  - Reads from JSON file (primary)   │                    │
│  │  - Falls back to scrape if missing  │                    │
│  │  - Polls every 30 minutes           │                    │
│  └───────────────┬─────────────────────┘                    │
│                  │                                          │
│                  ▼                                          │
│  ┌─────────────────────────────────────┐                    │
│  │  dailyBiasProjection.js             │                    │
│  │  - ETF flows = 10% weight           │                    │
│  │  - BTC only                         │                    │
│  └─────────────────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**JSON File Structure:** (`server/data/etf-flows.json`)
```json
{
  "source": "farside.co.uk",
  "lastUpdated": "2026-01-11T17:21:00Z",
  "today": {
    "date": "09 Jan 2026",
    "netFlowM": -252,
    "IBIT": 7.9,
    "FBTC": -5.9,
    "ARKB": 0
  },
  "history": [...]
}
```

**Signal Scoring:**
| Net Flow | Signal | Score |
|----------|--------|-------|
| ≥ $200M | STRONG_INFLOW | +0.85 |
| ≥ $100M | MODERATE_INFLOW | +0.60 |
| ≥ $50M | MILD_INFLOW | +0.30 |
| ≤ -$50M | MILD_OUTFLOW | -0.30 |
| ≤ -$100M | MODERATE_OUTFLOW | -0.60 |
| ≤ -$200M | STRONG_OUTFLOW | -0.85 |

**Update Workflow:**
```bash
# Local machine
cd server && node update-etf-flows.js
git add data/etf-flows.json && git commit -m "update etf" && git push

# VPS
git pull && docker compose restart traderbias-backend
```

---

### 7. biasProjection.js (8-12H Bias Algorithm v2)

**Location:** `server/biasProjection.js` (1,292 lines)

The core algorithm for generating 8-12 hour directional bias predictions.

**Weight Distribution (Phase 2):**
```javascript
const WEIGHTS = {
  flowConfluence: 0.55,  // PRIMARY SIGNAL (Price + OI + CVD alignment)
  fundingZScore: 0.20,   // Extreme funding detection
  confluence: 0.15,      // Cross-exchange agreement
  whales: 0.05           // Whale positioning (Hyperliquid only)
};
```

**Bonus Multipliers:**
| Bonus | Value | Condition |
|-------|-------|-----------|
| RSI Bullish Divergence | +20% | Price lower low, RSI higher low |
| RSI Bearish Divergence | -20% | Price higher high, RSI lower high |
| Spot Accumulation | +25% | Spot buying, perp flat |
| Fake Pump | -25% | Perp buying, spot selling |
| Capitulation Bottom | +20% | Spot absorbing perp panic |
| All Factors Aligned | +10% | Flow + Funding + Confluence aligned |

**Key Functions:**
| Function | Purpose |
|----------|---------|
| `generateProjection(coin, dataStore)` | Main entry point |
| `calculateFlowConfluence()` | Primary signal (Price+OI+CVD) |
| `calculateFundingZScore()` | Funding rate extremes |
| `calculateOIRoC()` | OI rate of change |
| `calculateCVDPersistence()` | CVD persistence with coin thresholds |
| `detectRSIDivergence()` | RSI bullish/bearish divergence |
| `detectRegime()` | Market regime detection |
| `calculateWhaleAlignment()` | Whale consensus (Hyperliquid) |
| `calculateCrossExchangeConfluence()` | Exchange agreement |
| `calculateInvalidation()` | Invalidation price level |

**Coin-Specific CVD Thresholds:**
```javascript
const CVD_THRESHOLDS = {
  BTC: { strong: 50000, moderate: 20000, weak: 5000 },
  ETH: { strong: 20000, moderate: 8000, weak: 2000 },
  SOL: { strong: 5000, moderate: 2000, weak: 500 }
};
```

---

### 7. dailyBiasProjection.js (24H Daily Bias)

**Location:** `server/dailyBiasProjection.js` (797 lines)

Calculates 24-hour forward-looking directional bias optimized for day traders.

**Key Differences from 8-12H:**
- Spot/Perp CVD Divergence is PRIMARY signal (35% weight)
- Extended lookback windows (8H momentum, 6H spot/perp, 90-day funding)
- Signal freshness decay over time
- Cross-exchange veto mechanism (requires 70%+ agreement)

**Weight Distribution:**
```javascript
const WEIGHTS_24H = {
  spotPerpDivergence: 0.35,      // PRIMARY - institutional flows
  fundingMeanReversion: 0.25,    // 90-day baseline
  oiPriceMomentum: 0.20,         // 8H window
  crossExchangeConfluence: 0.10, // Veto mechanism
  whales: 0.05
};
```

**Signal Freshness Decay:**
```
T+0H:  100% confidence
T+8H:  ~90% confidence
T+16H: ~75% confidence
T+24H: ~60% confidence
```

---

### 8. winRateTracker.js (Prediction Accuracy)

**Location:** `server/winRateTracker.js` (236 lines)

Tracks prediction accuracy over time to validate algorithm performance.

**How It Works:**
1. Record prediction when generated (via `/api/:coin/projection`)
2. Store initial price, predicted bias, confidence
3. After 10 hours, evaluate outcome
4. Calculate win rates per coin

**Persistence:**
- Saves to `server/data/winrates.json` every 5 minutes
- Retains 30 days of prediction history
- Loads on startup

**Statistics Tracked:**
```javascript
{
  BTC: { total, correct, winRate, strongCorrect, strongTotal, strongWinRate },
  ETH: { ... },
  SOL: { ... }
}
```

---

## API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/stats` | GET | Server statistics |
| `/api/data/all` | GET | All exchange data |
| `/api/data/:exchange` | GET | Exchange historical data |
| `/api/snapshot/:exchange` | GET | Current snapshot only |
| `/api/whale-trades` | GET | Recent whale trades |

### Projection Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/:coin/projection` | GET | 8-12H bias projection |
| `/api/:coin/daily-bias` | GET | 24H daily bias projection |
| `/api/spot-cvd/:coin?` | GET | Spot CVD data |

### Win Rate Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/win-rates/:coin?` | GET | Win rate statistics |
| `/api/predictions/:coin?` | GET | Recent predictions with outcomes |

### Valid Parameters

- **Exchanges:** `hyperliquid`, `binance`, `bybit`, `nado`, `asterdex`
- **Coins:** `btc`, `eth`, `sol` (case-insensitive)

---

## Bias Projection Response Format

### 8-12H Projection Response

```json
{
  "coin": "BTC",
  "horizon": "8-12H",
  "status": "ACTIVE",
  "algorithmVersion": "v2",
  "currentPrice": 98450,
  "prediction": {
    "bias": "STRONG_BULL",
    "strength": "STRONG",
    "score": 0.72,
    "grade": "A+",
    "direction": "BULLISH"
  },
  "confidence": {
    "level": "HIGH",
    "score": 0.85,
    "factors": ["Strong cross-exchange alignment", "Low volatility"]
  },
  "invalidation": {
    "price": 96500,
    "type": "below",
    "distance": 2.0,
    "description": "Bias flips if BTC breaks below $96,500"
  },
  "keyFactors": [
    {
      "name": "⭐ Flow Confluence",
      "direction": "bullish",
      "score": 0.9,
      "impact": "high",
      "detail": "STRONG BULL (P:up OI:up CVD:up)"
    }
  ],
  "components": {
    "flowConfluence": { ... },
    "fundingZScore": { ... },
    "oiRoC": { ... },
    "cvdPersistence": { ... },
    "regime": { ... },
    "whales": { ... },
    "confluence": { ... },
    "volumeContext": { ... },
    "spotPerpDivergence": { ... }
  },
  "historicalPerformance": {
    "total": 50,
    "correct": 31,
    "winRate": 62.0,
    "strongWinRate": 72.0
  },
  "generatedAt": 1704556800000,
  "validUntil": 1704571200000
}
```

---

## Storage & Persistence

### Data Files

| File | Purpose | Location |
|------|---------|----------|
| `datastore.json` | Market data persistence | `server/data/datastore.json` |
| `winrates.json` | Prediction history | `server/data/winrates.json` |

### Persistence Schedule

| Action | Interval | Trigger |
|--------|----------|---------|
| Market data save | 1 minute | Timer |
| Win rate save | 5 minutes | Timer |
| Cleanup old data | 10 minutes | Timer |
| Shutdown save | On exit | SIGTERM/SIGINT |

---

## Performance & Memory

### Memory Usage (1GB VPS)

```
Operating System:       ~250 MB
Node.js Backend:        ~150 MB
  ├─ Node.js runtime:      80 MB
  ├─ Historical data:      10 MB (24h of data)
  ├─ Express/WebSocket:    30 MB
  └─ Buffers/overhead:     30 MB
─────────────────────────────────
Total Used:             ~400 MB
Available:              ~600 MB ✅
```

### Data Point Calculation

```
5 exchanges × 3 coins × 24 hours
Price:     8,640 points/exchange (every 10s)
OI:        8,640 points/exchange
CVD:       8,640 points/exchange
Funding:   8,640 points/exchange
Orderbook: 8,640 points/exchange
───────────────────────────────────
Total:     ~130,000 data points
Memory:    ~66 bytes/point = ~8.6 MB
```

### Performance Optimizations

1. **Timeouts**: 15-second timeout on all API calls
2. **Circular buffers**: Auto-cleanup of old data
3. **Deduplication**: Whale trades deduplicated by ID
4. **Lazy persistence**: Only saves when data changes
5. **Efficient WebSockets**: Connection pooling and auto-reconnect

---

## Network Configuration

### Docker with Gluetun VPN

The backend runs through a Gluetun VPN container for geo-restricted API access:

```yaml
# docker-compose.yml
gluetun:
  # ProtonVPN Singapore node
  # Routes all backend traffic through VPN

traderbias-backend:
  network_mode: "service:gluetun"
  # Shares gluetun's network stack
```

**Why Singapore?**
- Binance & Bybit friendly region
- Low latency to Asian markets
- Bypasses US/EU geo-restrictions

---

## Related Documentation

- [BACKEND_DEPLOYMENT.md](./BACKEND_DEPLOYMENT.md) - Deployment guide
- [BACKEND_QUICKSTART.md](./BACKEND_QUICKSTART.md) - Quick start guide
- [BACKEND_FIXES_SUMMARY.md](./BACKEND_FIXES_SUMMARY.md) - Algorithm changes history
- [server/README.md](../server/README.md) - Server-specific documentation
