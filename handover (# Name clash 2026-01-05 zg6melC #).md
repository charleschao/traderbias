# Trader Bias - Project Handover Summary

## Project Overview

**Trader Bias** is a real-time cryptocurrency trading dashboard focused on BTC, ETH, and SOL. It provides professional traders with bias signals, whale trade feeds, flow confluence analysis, and position tracking from top Hyperliquid leaderboard traders.

**Live URL:** Deployed to VPS (see `/deploy` workflow)  
**Repository:** `d:\gitprojects\traderbias`

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19.1 with Hooks |
| **Build Tool** | Vite 7.2 (Rolldown) |
| **Styling** | Tailwind CSS 4.x |
| **Real-Time Data** | WebSocket connections |
| **State Management** | React useState/useRef |
| **Notifications** | Web Notifications API |

---

## Project Structure

```
src/
├── App.jsx                 # Main application component (1200+ lines)
├── App.old.jsx             # Backup of original monolithic file
├── components/
│   ├── BiasCard.jsx        # Composite bias card with all indicators
│   ├── BiasHistoryBar.jsx  # 15-minute bias history visualization
│   ├── ConsensusSection.jsx
│   ├── DetailModal.jsx
│   ├── ExchangeComingSoon.jsx
│   ├── ExchangeSelector.jsx
│   ├── FlowConfluenceSection.jsx
│   ├── FundingRatesSection.jsx
│   ├── LiquidationMap.jsx
│   ├── MegaWhaleFeed.jsx   # Whale trade feed with filters
│   ├── OrderbookSection.jsx
│   ├── PositionCard.jsx
│   ├── Sparkline.jsx
│   ├── ThresholdSelector.jsx
│   ├── TraderRow.jsx
│   └── WhaleActivityFeed.jsx
├── config/
│   ├── exchanges.js        # Exchange configurations
│   └── whaleWsConfig.js    # WebSocket configs for 9 exchange feeds
├── hooks/
│   ├── useSparklineHistory.js
│   ├── useWhaleNotifications.js  # Browser notification handling
│   └── useWhaleWebSockets.js     # Multi-exchange WebSocket manager
└── utils/
    ├── biasCalculations.js  # All bias/confluence algorithms
    └── formatters.js        # USD, percent, address formatters
```

---

## Key Features

### 1. Composite Bias Cards
- **Flow Confluence**: Combines Price, OI, and CVD direction signals
- **Color-coded indicators**: Green (↑), Red (↓), Gray (↔)
- **OI Velocity**: Shows rate of change (accelerating, rising, stable, falling)
- **Divergence Detection**: Warns when price and CVD diverge
- **Bias History Bar**: 15-minute visual history of bias state

### 2. Mega Whale Trade Feed
- Real-time whale trades from 9 exchange feeds:
  - Binance Spot/Perps
  - OKX Spot/Perps (most stable connection)
  - Bybit Spot/Perps
  - Kraken
  - Coinbase
  - Hyperliquid
- Threshold filtering: $1M, $2M, $4M, $10M (default: $10M)
- Browser notifications for trades above threshold
- **Fixed**: OKX contract multiplier bug (was inflating trades 100x)

### 3. Timeframe Selection
- 5M, 15M, 30M timeframe buttons (updated from 1H/4H/8H)
- Historical data stored in localStorage (1 hour - extended from 30 minutes)
- Calculates % change from oldest entry in timeframe
- CVD, OI, Price, Orderbook all calculate per-timeframe
- **IMPORTANT**: BiasScores and Flow Confluence use timeframe-aware data
- Data persists across browser refreshes for 1 hour
- After 30 minutes of running, all timeframes (including 30M) have historical data

### 4. Exchange Support
| Exchange | Status | Notes |
|----------|--------|-------|
| Hyperliquid | ✅ Full | Primary exchange, all features working |
| Binance | ⚠️ Limited | API blocked in many regions (451 error) |
| Bybit | ⚠️ Limited | API connectivity issues |
| Nado | ⚠️ Partial | Archive API, limited data |
| AsterDex | ⚠️ Partial | Limited availability |

### 5. Whale Leaderboard
- Top 10 Hyperliquid traders from leaderboard API
- Position tracking with entry prices and PnL
- Consensus section showing long/short distribution

### 6. Signal Win Rate Tracking
- **Location**: DetailModal (click detail on BiasCard)
- **Tracking**: Logs flow confluence signals (STRONG_BULL, BULLISH, etc.)
- **Evaluation**: 15-minute window, +0.3% threshold for win
- **Display**: Progress bars per signal type with win/loss counts
- **Storage**: localStorage (500 signals/coin, 7-day max age)

**Files:**
- `hooks/useSignalHistory.js` - Signal logging & evaluation
- `components/SignalWinRates.jsx` - Win rate display component

---

## Algorithm Details

### Bias Calculation (`biasCalculations.js`)

**Weighted Scoring:**
```javascript
weights = {
  flow: 5,     // Flow confluence (most important)
  whale: 3,    // Whale consensus
  ob: 1,       // Orderbook imbalance
  funding: 1   // Funding rate
};
```

**New Algorithm Improvements:**
1. `calculateOIVelocity()` - Rate of change for OI
2. `calculateFundingTrend()` - Funding spike detection
3. `calculateDivergenceStrength()` - Price/CVD divergence scoring
4. `calculateLiquidationProximity()` - Liquidation zone warnings

### Flow Confluence States
| State | Condition | Signal |
|-------|-----------|--------|
| STRONG_BULL | P↑ OI↑ CVD↑ | Aggressive new longs |
| WEAK_BULL | P↑ OI↓ CVD↓ | Shorts covering |
| STRONG_BEAR | P↓ OI↑ CVD↓ | Aggressive new shorts |
| WEAK_BEAR | P↓ OI↓ CVD↑ | Longs exiting |
| DIVERGENCE | Mixed signals | Potential reversal |

---

## Platform Improvement Research Agent (DEV ONLY)

A comprehensive analysis system that runs **only in development mode** (`import.meta.env.DEV`). Provides continuous insights into platform improvements.

### Architecture

```
src/agents/
├── PlatformImprovementAgent.js    # Main agent coordinator
└── modules/
    ├── FeatureGapAnalyzer.js      # Identifies missing trading features
    ├── DataQualityValidator.js    # Validates data accuracy & freshness
    ├── UXImprovementIdentifier.js # Identifies UX/UI improvements
    └── PerformanceAnalyzer.js     # Detects performance issues
```

### Key Features

| Module | Purpose | Priority Levels |
|--------|---------|-----------------|
| **FeatureGapAnalyzer** | Compares against professional trading platforms | Edge value scoring |
| **DataQualityValidator** | Validates price, OI, CVD, funding data | Critical/High/Medium/Low |
| **UXImprovementIdentifier** | Identifies user experience gaps | Impact & effort scoring |
| **PerformanceAnalyzer** | Detects render issues, memory leaks | Performance metrics |

### How It Works

1. **Auto-start on dev load**: Agent starts when `import.meta.env.DEV === true`
2. **Data exposure**: App exposes `window.__TRADERBIAS_DATA__` for agent access
3. **Periodic analysis**: Runs every 5 minutes
4. **UI Tab**: Shows under "🔬 Platform Insights [DEV]" tab

### Agent Report Structure

```javascript
{
  timestamp: Date.now(),
  summary: { total, critical, high, medium, low },
  findings: {
    critical: [],  // Must fix - breaks trading edge
    high: [],      // Should implement - significant edge
    medium: [],    // Nice to have - moderate improvement
    low: []        // Quality of life improvements
  },
  topRecommendations: [],  // Top 5 by edge value
  quickWins: []            // High impact, low effort
}
```

### Important Notes

- **NEVER deployed to production** - Uses `import.meta.env.DEV` check
- Shows badge count for critical issues on tab
- Expandable cards with implementation details
- Effort estimates: `very_low`, `low`, `medium`, `high`, `very_high`

---

## WebSocket Architecture

### Connection Management (`useWhaleWebSockets.js`)
- Maintains connections to 9 exchange feeds
- Heartbeat/ping handling per exchange
- Auto-reconnect with backoff
- Trade deduplication by ID
- Threshold filtering ($10M default)

### Exchange-Specific Handling
- **OKX**: Ping every 15s, responds to "ping" messages
- **Bybit**: Ping every 20s with `{"op":"ping"}`
- **Kraken**: Heartbeat handling
- **Coinbase**: Subscription confirmation handling
- **Hyperliquid**: Standard WS with keepalive

### OKX Contract Multiplier Fix (Critical)

**Issue**: OKX Perpetual Swaps (`BTC-USDT-SWAP`, `ETH-USDT-SWAP`, `SOL-USDT-SWAP`) return trade sizes in **number of contracts**, not base currency amounts.

**Contract Specifications**:
- `BTC-USDT-SWAP`: 1 contract = 0.01 BTC
- `ETH-USDT-SWAP`: 1 contract = 0.1 ETH
- `SOL-USDT-SWAP`: 1 contract = 1 SOL

**Bug Impact**:
Before the fix, notional value was calculated as `sz * px`, treating contract count as BTC amount. This inflated BTC trades by **100x** (e.g., $10K trade appeared as $1M), causing only OKX trades to dominate the whale feed at all threshold levels.

**Fix** (`whaleWsConfig.js:158-183`):
```javascript
const contractSize = parseFloat(t.sz); // Number of contracts
const contractMultiplier = symbol === 'BTC' ? 0.01 :
                           symbol === 'ETH' ? 0.1 : 1;
const size = contractSize * contractMultiplier; // Actual BTC/ETH/SOL amount
const notional = price * size; // Correct USD value
```

**Other Exchanges**: Binance, Bybit, Coinbase, Kraken, and Hyperliquid all correctly report sizes in base currency (no multiplier needed).

### Timeframe System Architecture (Critical Understanding)

**The Problem (Fixed)**: Originally, BiasScores were calculated using session-based data, causing timeframe switching (5M/15M/30M) to show identical numbers.

**How It Works Now** (`App.jsx`):

1. **Data Collection** (Lines 200-930):
   - Each exchange fetch stores raw data in state: `priceData`, `oiData`, `cvdData`, `orderbookData`
   - Historical snapshots saved to `historicalDataRef.current` every fetch
   - `sessionChange` values represent change since session start (NOT timeframe-aware)

2. **Timeframe Calculation** (Lines 1145-1191):
   - **After** raw data is collected, timeframe-aware versions are calculated:
     - `timeframeOiData` - filters OI history by selected timeframe (5M/15M/30M)
     - `timeframePriceData` - filters price history by selected timeframe
     - `timeframeCvdData` - sums CVD deltas within selected timeframe
     - `timeframeOrderbookData` - averages orderbook imbalance over timeframe
   - Uses `calculateTimeframeChange()` to compute % change from oldest entry in timeframe

3. **BiasScore Calculation** (Lines 1193-1207):
   - **CRITICAL**: BiasScores calculated AFTER timeframe data preparation
   - Uses `timeframeAllData` object containing timeframe-aware data
   - Flow Confluence receives timeframe-specific OI, Price, and CVD changes

4. **Component Rendering** (Lines 1287-1293, 1236-1247):
   - `<BiasCard>` receives `timeframeOiData`, `timeframePriceData`, `timeframeCvdData`, `timeframeOrderbookData`
   - `<DetailModal>` receives same timeframe-aware data
   - Dashboard sections (`FlowConfluenceSection`, `OrderbookSection`) also use timeframe data

**Key Functions**:
- `timeframeToMinutes(tf)` - Converts '5m'/'15m'/'30m' to minutes
- `calculateTimeframeChange(currentValue, history, minutes)` - Calculates % change over timeframe
- `getAverageImbalance(history, minutes)` - Averages orderbook imbalance over timeframe

**Storage**:
- `MAX_HISTORY_AGE_MS = 60 * 60 * 1000` (1 hour)
- localStorage key: `traderBias_historicalData`
- Persists OI, Price, Orderbook history for 1 hour
- CVD history also stored for 1 hour in `cvdAccumulatorRef`

---

## Known Issues & Limitations

1. **Binance API Blocked**: Returns 451 error in many regions. Would need a proxy or VPN.

2. **Other Exchange Connections**: Bybit, Kraken, Coinbase show intermittent disconnects. OKX is the most reliable.

3. **Timeframe Data**: Requires time to accumulate. 15M/30M calculations need 15-30 minutes of data collection.

4. **Browser Notifications**: Require user permission grant.

5. **Exchange Trade Volume Variance**: Different exchanges will show different whale trade frequencies based on:
   - Connection reliability (OKX most stable, Binance blocked in some regions)
   - Actual market volume on each exchange
   - Feed lag/latency differences

---

## Configuration Files

### Exchange Config (`exchanges.js`)
```javascript
EXCHANGES = {
  hyperliquid: { name: 'Hyperliquid', status: 'active' },
  binance: { name: 'Binance', status: 'active' },
  bybit: { name: 'Bybit', status: 'active' },
  nado: { name: 'Nado', status: 'active' },
  asterdex: { name: 'AsterDex', status: 'active' }
};
```

### Whale Threshold
- Default: `$10M` (changed from $4M)
- Options: $1M, $2M, $4M, $10M
- Set in: `App.jsx`, `whaleWsConfig.js`, `useWhaleNotifications.js`

---

## Deployment

See `.agent/workflows/deploy.md` for VPS deployment instructions.

**Build Command:**
```bash
npm run build
```

**Dev Server:**
```bash
npm run dev  # Runs on localhost:5173
```

---

## Recent Changes (This Session)

1. ✅ Changed default whale threshold from $4M to $10M
2. ✅ Changed exchange name display from abbreviated to full name
3. ✅ Fixed notification hook to use threshold parameter
4. ✅ Added algorithm improvements:
   - OI Velocity (rate of change)
   - Funding Trend analysis
   - Divergence Strength scoring
   - Liquidation Proximity warnings
5. ✅ Added BiasHistoryBar component (15-minute history)
6. ✅ Added color-coded flow confluence indicators
7. ✅ Fixed bias label alignment in BiasCard
8. ✅ Removed price sparkline from header
9. ✅ Changed timeframes from 1H/4H/8H to 5M/15M/30M
10. ✅ Made CVD timeframe-aware (sums deltas per timeframe)
11. ✅ Extended CVD history from 5 min to 30 min
12. ✅ Added bias history localStorage persistence
13. ✅ Added Platform Improvement Research Agent (dev only)
14. ✅ Added Signal Win Rate Tracking (useSignalHistory hook + SignalWinRates component)
15. ✅ **CRITICAL FIX**: Fixed OKX Perpetual Swap notional calculation bug (100x inflation error)
    - OKX SWAP contracts were being calculated incorrectly
    - Contract multipliers now applied: BTC=0.01, ETH=0.1, SOL=1
    - This was causing only OKX trades to appear in whale feed at all thresholds
    - Now all exchanges show correctly when they have genuine whale trades
16. ✅ **CRITICAL FIX**: Fixed Flow Confluence timeframe-aware calculations
    - BiasScores were calculated using session-based data instead of timeframe data
    - Switching timeframes (5M/15M/30M) didn't update the numbers
    - BiasScores now calculated AFTER timeframe data preparation
    - BiasCard and DetailModal now receive timeframe-aware data (oiData, priceData, cvdData, orderbookData)
    - Flow Confluence now correctly recalculates when changing timeframes
17. ✅ Extended historical data storage from 30 minutes to 1 hour
    - Ensures 30M timeframe has data available even on fresh page loads (after 30min of running)
    - CVD history also extended to 1 hour
    - All historical data persists in localStorage for 1 hour

---

## Next Steps / Future Improvements

1. **Fix Other Exchange Connections**: Investigate Bybit/Coinbase disconnection issues
2. **Add Proxy for Binance**: To bypass geo-restrictions
3. **Aggregated Bias Mode**: Combine data from all exchanges
4. **Flash Animation**: When bias flips (bull → bear)
5. **Session High/Low Context**: Show price position in range
6. **Sound Alerts**: Audio notification for whale trades
7. **Mobile Responsiveness**: Optimize for smaller screens

---

## Contact & Support

This project was developed with AI-assisted coding. The codebase is well-documented with comments explaining the purpose of each section.

**Key Files to Understand:**
- `App.jsx` - Main state management and data flow
- `biasCalculations.js` - All bias algorithms
- `useWhaleWebSockets.js` - WebSocket management
- `whaleWsConfig.js` - Exchange-specific WS configs (includes critical OKX contract multiplier fix)
- `agents/PlatformImprovementAgent.js` - Dev-only improvement agent

**Important Notes:**
- If modifying OKX swap parsing, remember contract multipliers (BTC=0.01, ETH=0.1, SOL=1)
- Other exchanges report sizes in base currency directly (no multiplier needed)
- Test whale feed with multiple exchanges before deploying changes

