# Changelog

All notable changes to Trader Bias will be documented in this file.

## [Unreleased] - 2026-01-06

### Added - Backend Server (Option 2: Centralized Data Collection)

- **Backend Server for Shared Data**: Optional Node.js backend server for centralized data collection
  - **Instant Data for All Users**: New visitors see 4 hours of data immediately (no waiting!)
  - **Shared Historical Data**: All users see the same data (collected by backend 24/7)
  - **Memory Optimized**: Uses ~120MB RAM on 1GB VPS (leaves 650MB+ headroom)
  - **5 Exchange Support**: Hyperliquid, Binance, Bybit, Nado, AsterDex
  - **Auto-Cleanup**: Retains 4 hours of history, prunes old data every 10 minutes
  - **Location**: `server/` directory

- **Backend REST API Endpoints**:
  - `GET /api/health` - Server health check and statistics
  - `GET /api/data/:exchange` - Get 4 hours of historical data + current snapshot
  - `GET /api/snapshot/:exchange` - Get current values only (faster, smaller payload)
  - `GET /api/data/all` - Get all exchanges in one request
  - `GET /api/stats` - Detailed server statistics and memory usage

- **PM2 Process Management**:
  - Auto-restart on crash
  - Daily cron restart at 4 AM (clears memory leaks)
  - Memory limit: Auto-restart if >800MB
  - Startup script for auto-start on VPS reboot
  - Logging to `server/logs/`

- **Frontend Integration Layer**:
  - `src/services/backendApi.js` - Backend API service wrapper
  - Environment variable support: `VITE_USE_BACKEND` and `VITE_BACKEND_API_URL`
  - Optional usage (can use direct APIs or backend APIs)

- **Comprehensive Documentation**:
  - `BACKEND_DEPLOYMENT.md` - Complete deployment guide for VPS
  - `server/README.md` - Backend server documentation
  - API endpoint reference, troubleshooting, monitoring guides

### Added - Day Trading Enhancements

- **1 Hour Timeframe**: Added 1H timeframe option for day traders
  - New timeframe selector: 5m / 15m / 30m / **1H**
  - Optimal for 2-4 hour swing predictions
  - Complements existing 15m (30-60min) and 30m (1-2hr) timeframes
  - Location: `src/App.jsx:123, 1374`

- **Multi-Exchange Data Persistence**: Historical data now persisted per exchange
  - Immediate data display when switching between exchanges (Hyperliquid, Binance, Bybit, Nado, AsterDex)
  - No more waiting 30min-1hr to build historical context after switching
  - Each exchange retains 4 hours of OI, price, orderbook, and CVD data
  - Automatic localStorage sync on every API fetch
  - Location: `src/App.jsx:41-127, 1015-1057`

### Added
- **Data Availability Indicators**: Added "Warming up..." warnings on BiasCard when historical data is insufficient for selected timeframe
  - Yellow warning icons (⚠️) appear on OI Change and CVD metrics during initial data collection
  - Visual feedback helps users understand when data is based on session vs full timeframe
  - Located in: `src/components/BiasCard.jsx:106-130`

- **Timeframe Labels**: Dynamic labels now show current timeframe selection
  - "OI Change (5m)" / "OI Change (15m)" / "OI Change (30m)"
  - "CVD (5m)" / "CVD (15m)" / "CVD (30m)"
  - Makes it clear what time window the data represents

### Changed
- **Extended Historical Data Retention**: Increased from 60 minutes to 4 hours (240 minutes)
  - Provides robust historical data for all timeframes (5m/15m/30m)
  - Better data availability on page refresh
  - Reduced "warming up" period after page loads
  - Location: `src/App.jsx:38`

- **Improved Variable Naming**: Added `timeframeChange` property for clarity
  - New property clearly distinguishes timeframe-specific changes from session changes
  - `timeframeChange`: Change over selected timeframe (5m/15m/30m)
  - `sessionChange`: Change since session start (preserved for backward compatibility)
  - Location: `src/App.jsx:1200-1218`

- **Timeframe-Aware OI Velocity**: Made OI velocity calculation dynamic
  - Now adapts to user's selected timeframe (5m/15m/30m)
  - Previously hardcoded to 5-minute window
  - Function signature: `calculateOIVelocity(currentOI, historicalOI, timeframeMinutes)`
  - Location: `src/utils/biasCalculations.js:7`

### Fixed
- **Bias Calculations Using Correct Timeframe**: Updated all bias calculation functions to use `timeframeChange`
  - `calculateOIBias`: Now uses timeframe-aware OI and price changes
  - `calculateCVDBias`: Now uses timeframe-aware price changes
  - `calculateFlowConfluence`: Now uses timeframe-aware OI and price changes
  - `calculateDivergenceStrength`: Added documentation noting it should use timeframe values
  - Falls back to `sessionChange` for backward compatibility
  - Locations: `src/utils/biasCalculations.js:149-337`

- **BiasCard Display Accuracy**: Updated component to display timeframe-aware data
  - Flow Confluence indicators now use `timeframeChange` values
  - Divergence strength calculation uses timeframe-specific price changes
  - All displays synchronized with user's selected timeframe
  - Location: `src/components/BiasCard.jsx:60-150`

### Technical Details

#### Multi-Exchange Data Persistence Architecture
1. **localStorage Structure Change**:
   - Old format: `{ oi: {...}, price: {...}, orderbook: {...}, cvd: {...} }`
   - New format:
     ```javascript
     {
       hyperliquid: { oi: {...}, price: {...}, orderbook: {...}, cvd: {...} },
       binance: { ... },
       bybit: { ... },
       nado: { ... },
       asterdex: { ... }
     }
     ```
2. **Automatic Migration**: Existing localStorage data automatically migrates to new format
3. **Per-Exchange Loading**: `loadHistoricalData(exchange)` loads specific exchange data
4. **Per-Exchange Saving**: `saveHistoricalData(exchange, data)` updates specific exchange without affecting others
5. **Exchange Switching**: When switching exchanges, historical data loads immediately from localStorage (no clearing)

#### Data Flow Changes
1. `App.jsx` now creates two data objects for each metric:
   - Raw data with `sessionChange`
   - Timeframe-adjusted data with both `timeframeChange` and `sessionChange`
2. BiasCard receives timeframe-adjusted data and displays accordingly
3. All bias calculations preferentially use `timeframeChange || sessionChange`

#### Files Modified
- `src/App.jsx` - Extended retention, added `timeframeChange` property, passed timeframe to BiasCard, added 1H timeframe, implemented per-exchange data persistence
- `src/utils/biasCalculations.js` - Made OI Velocity timeframe-aware, updated all calculations to use `timeframeChange`
- `src/components/BiasCard.jsx` - Added data availability indicators, timeframe labels, updated to use new properties

#### Breaking Changes
None - all changes are backward compatible. Components gracefully fall back to `sessionChange` if `timeframeChange` is unavailable.

---

## Version History

### [1.0.0] - Initial Release
- Real-time whale tracking across 5+ exchanges
- Composite bias scoring system
- Flow confluence analysis
- Orderbook imbalance monitoring
- Whale leaderboard and position tracking
- Liquidation map visualization
- Browser notifications for whale alerts
- Multi-exchange support (Hyperliquid, Binance, Bybit, Nado, AsterDex)
