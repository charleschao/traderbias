# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Trader Bias** is a real-time cryptocurrency trading intelligence dashboard that tracks whale activity, market bias, and trading signals across multiple exchanges. It's built with React 19 + Vite (Rolldown) using Tailwind CSS 4.x, featuring WebSocket connections to 5+ exchanges for live data.

## Development Commands

```bash
# Development server (http://localhost:5173)
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build
npm preview

# Lint code
npm run lint
```

## Architecture Overview

### Core Data Flow

The application follows a hub-and-spoke architecture where `App.jsx` (1,260 lines) acts as the central orchestrator:

1. **App.jsx** - Main coordinator that:
   - Manages all state (price, OI, funding, CVD, orderbook data)
   - Polls REST APIs for market data (prices, open interest, funding rates)
   - Coordinates multiple custom hooks (WebSockets, notifications, sparkline history)
   - Exposes data to child components via props
   - Persists historical data to localStorage for time-based calculations

2. **Data Persistence** - Historical data is stored in localStorage with automatic cleanup:
   - `traderBias_historicalData` - OI, price, orderbook time series (60min retention)
   - `traderBias_biasHistory` - Bias score history (15min retention)
   - Used for calculating changes over 1H/4H/8H timeframes

3. **Custom Hooks** handle isolated concerns:
   - `useWhaleWebSockets.js` - Manages WebSocket connections to 5+ exchanges for mega whale trades ($4M+)
   - `useWhaleNotifications.js` - Browser notification system for whale alerts
   - `useSparklineHistory.js` - Time-series data management for mini charts
   - `useSignalHistory.js` - Tracks flow confluence signal accuracy

### Exchange System

**Multi-Exchange Support** via `src/config/exchanges.js`:
- Each exchange has: id, name, icon, color, status, features, apiBase, coins
- Features array defines capabilities: `['market', 'orderbook', 'funding', 'leaderboard', 'whales', 'cvd', 'liquidations']`
- Status options: `'active'`, `'api_required'`, `'coming_soon'`
- Default exchange: Hyperliquid (full feature set)
- Add new exchanges by extending the EXCHANGES object

**Whale WebSocket Config** in `src/config/whaleWsConfig.js`:
- Defines per-exchange WebSocket connection logic
- Custom parsers for each exchange's trade message format
- Reconnection logic and ping/pong keep-alive

### Bias Calculation System

Located in `src/utils/biasCalculations.js`:

- **Composite Bias** - Combines price, OI, CVD, orderbook to generate BULLISH/BEARISH/NEUTRAL signals
- **OI Velocity** - Detects accelerating/decelerating open interest
- **Funding Trend** - Identifies crowded trades via funding rate changes
- **Divergence Strength** - Scores price/flow mismatches (0-100 scale, >60 = STRONG signal)
- **Flow Confluence** - Unifies Price + OI + CVD into actionable signals (STRONG BULL/BEAR, DIVERGENCE, NEUTRAL)

All calculations are time-aware and use rolling windows from historical data.

### Component Architecture

Components are pure presentational - they receive data via props and emit actions via callbacks:

- **BiasCard.jsx** - Individual coin card (BTC/ETH/SOL) showing price, OI, CVD, funding, bias
- **MegaWhaleFeed.jsx** - Real-time whale trade feed with aggregated volume per coin
- **ConsensusSection.jsx** - Displays whale leaderboard positions and consensus
- **FlowConfluenceSection.jsx** - Price/OI/CVD alignment analysis
- **OrderbookSection.jsx** - L2 depth bid/ask imbalance
- **LiquidationMap.jsx** - Estimated liquidation zones for whale positions
- **DetailModal.jsx** - Expanded view with full metrics and charts

### Platform Improvement Agent (Development Only)

Located in `src/agents/`:
- **PlatformImprovementAgent.js** - Orchestrates analysis modules
- **Modules:**
  - `FeatureGapAnalyzer` - Identifies missing trading features (edge value scoring)
  - `DataQualityValidator` - Monitors data freshness, API failures
  - `UXImprovementIdentifier` - UX/UI best practices analysis
  - `PerformanceAnalyzer` - Detects rendering bottlenecks, memory leaks

**IMPORTANT**: Agent only runs in development mode (`import.meta.env.DEV`). The "🔬 Platform Insights" tab is hidden in production builds.

## Key Technical Details

### WebSocket Management

- Connections auto-reconnect with exponential backoff
- Each exchange has custom message parsers in `whaleWsConfig.js`
- Trade deduplication via `exchange + tradeId` composite key
- Only tracks BTC mega trades ($4M+) to reduce noise
- Implements ping/pong keep-alive for stable connections

### Time-Based Calculations

The app calculates changes over user-selected timeframes (1H/4H/8H):
- Historical data is stored with timestamps
- On timeframe change, App.jsx filters historical arrays to compute deltas
- Example: `oiChangePercent = ((currentOI - oiAtTimeframe) / oiAtTimeframe) * 100`
- Stale data is pruned on load and periodically

### Proxy Configuration

`vite.config.js` proxies Binance/Bybit to bypass CORS:
```javascript
'/api/binance' → 'https://fapi.binance.com'
'/api/bybit' → 'https://api.bybit.com'
```
Use `/api/binance/...` in development, direct URLs may fail due to geo-restrictions.

### Data Sources

**REST APIs:**
- Hyperliquid: `https://api.hyperliquid.xyz/info` (main source)
- Hyperliquid Leaderboard: `https://stats-data.hyperliquid.xyz/Mainnet/leaderboard`
- Nado: `https://archive.prod.nado.xyz/v1`
- AsterDex: `https://fapi.asterdex.com`

**WebSocket Feeds:**
- Hyperliquid: `wss://api.hyperliquid.xyz/ws`
- OKX: `wss://ws.okx.com:8443/ws/v5/public`
- Bybit: `wss://stream.bybit.com/v5/public/linear`
- Kraken: `wss://ws.kraken.com/v2`
- Binance: `wss://fstream.binance.com/ws`

## Common Patterns

### Adding a New Metric

1. Add API fetch logic in `App.jsx` (usually in `useEffect` polling loop)
2. Store in state: `const [newMetric, setNewMetric] = useState({})`
3. Pass to relevant component: `<BiasCard newMetric={newMetric[coin]} />`
4. Update bias calculation if needed in `src/utils/biasCalculations.js`

### Adding a New Exchange

1. Add configuration to `src/config/exchanges.js`
2. Add WebSocket config to `src/config/whaleWsConfig.js` (if supporting whale trades)
3. Update API polling logic in `App.jsx` to fetch from new exchange
4. Exchange switcher will automatically detect and display it

### Extending Whale Feed to Track More Coins

Current: Only BTC tracked (defined in `useWhaleWebSockets.js:9`)
To add ETH/SOL:
```javascript
const TRACKED_SYMBOLS = ['BTC', 'ETH', 'SOL'];
```
Update threshold logic and ensure parsers handle all symbols.

## Important Notes

- **Not Git Initialized** - This directory is not a git repo. Initialize with `git init` if needed.
- **Build Tool** - Uses Rolldown (Vite fork) via `npm:rolldown-vite@7.2.5` for faster builds
- **Tailwind 4.x** - Uses new Tailwind CSS 4 syntax via `@tailwindcss/vite` plugin
- **No Tests** - No test framework configured. Add Vitest or Jest if needed.
- **License** - CC BY-NC 4.0 (non-commercial). Commercial use requires different license.
- **Legal Files** - Always review DISCLAIMER.md, TERMS.md, PRIVACY.md before distributing

## Deployment

Production deployment instructions in `PRODUCTION_DEPLOYMENT.md`. Key points:
- `npm run build` creates optimized bundle in `dist/`
- Platform Insights agent is automatically excluded from production
- Static hosting compatible (Vercel, Netlify, GitHub Pages)
- Ensure environment handles client-side routing if needed
