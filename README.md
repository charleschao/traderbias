# 🐋 Trader Bias - Real-Time Crypto Whale Tracker

A professional-grade cryptocurrency trading intelligence dashboard that tracks whale activity, market bias, and trading signals across multiple exchanges in real-time.

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue)
![React](https://img.shields.io/badge/React-19.1-61dafb)
![Vite](https://img.shields.io/badge/Vite-7.2-646cff)

## 🎯 What This App Does

Trader Bias is a **real-time trading intelligence dashboard** designed for cryptocurrency traders who want to:

1. **Track Whale Activity** - Monitor large trades ($4M+) across major exchanges in real-time
2. **Understand Market Bias** - See composite bias scores (Bullish/Bearish/Neutral) based on multiple data sources
3. **Follow Top Traders** - Track positions of the top 10 weekly performers on Hyperliquid
4. **Spot Market Divergences** - Identify when price and flow metrics diverge (potential reversal signals)
5. **Monitor Funding Rates** - See when markets are overcrowded (high funding = potential squeeze)

---

## ✨ Key Features

### 🐋 Mega Whale Trade Feed
- **Real-time WebSocket connections** to 5+ major exchanges (Hyperliquid, OKX, Bybit, Kraken, Binance)
- Tracks trades **$4M+ USD** instantly
- Aggregates BUY/SELL/NET volume per coin
- Browser notifications for whale alerts (configurable threshold)

### 📊 Composite Bias Cards
For BTC, ETH, and SOL, displays:
- **Current price** with session change
- **Open Interest** - total leveraged positions
- **CVD (Cumulative Volume Delta)** - net buyer/seller aggression
- **Orderbook Imbalance** - bid vs ask pressure
- **Flow Confluence** - unified signal from Price + OI + CVD
- **Funding Rate** - cost to hold positions (crowding indicator)
- **Sparkline charts** for visual trend tracking

### 🎯 Flow Confluence Analysis
Combines multiple indicators to generate actionable signals:
- **STRONG BULL/BEAR** - All indicators aligned
- **BULLISH/BEARISH** - Majority agreement
- **DIVERGENCE** - Price/flow mismatch (reversal warning)
- **NEUTRAL** - Mixed signals

### 📈 Orderbook Imbalance
- Real-time L2 depth analysis
- Bid/Ask volume comparison
- Rolling average for trend detection
- Visual bar showing pressure distribution

### 🏆 Whale Leaderboard
- Top 200 weekly performers from Hyperliquid
- Tracks positions of top 10 traders
- Shows account value, PNL, and ROI
- Identifies "consistent winners" (positive week/month/all-time)

### 📋 Position Tracking
- View all open positions from top traders
- Click any trader to see their current positions
- Position cards show entry price, notional size, uPNL, and liquidation distance

### 💀 Liquidation Map
- Estimates liquidation prices for whale positions
- Shows nearest liq levels for longs and shorts
- Helps identify potential stop-hunt zones

### ⏱️ Timeframe Selection
- **1H / 4H / 8H** rolling timeframes
- Calculates OI change, price change, and orderbook averages over selected period
- Historical data persisted to localStorage (survives page refresh)

---

## 🏢 Supported Exchanges

| Exchange | Status | Data Available |
|----------|--------|----------------|
| **Hyperliquid** | ✅ Full Support | Price, OI, Funding, Orderbook, CVD, Leaderboard, Positions |
| **Binance** | ⚠️ Implemented | Price, OI, Funding, Orderbook (may have geo-restrictions) |
| **Bybit** | ⚠️ Implemented | Price, OI, Funding, Orderbook (may have geo-restrictions) |
| **Nado** | ✅ Implemented | Price, OI, Funding |
| **AsterDex** | ✅ Implemented | Price, OI, Funding, Orderbook |

*Note: Binance/Bybit may return 451 errors in certain regions due to API restrictions.*

---

## 🛠️ Tech Stack

- **Frontend**: React 19.1 with Hooks
- **Build Tool**: Vite 7.2 (Rolldown)
- **Styling**: Tailwind CSS 4.x
- **Real-Time Data**: WebSocket connections
- **State Management**: React useState/useRef
- **Notifications**: Web Notifications API

### Project Structure

```
src/
├── App.jsx                      # Main application (1,260 lines)
├── config/
│   ├── exchanges.js             # Exchange configurations
│   └── whaleWsConfig.js         # WebSocket configurations
├── components/
│   ├── BiasCard.jsx             # Individual coin bias card
│   ├── ConsensusSection.jsx     # Whale consensus display
│   ├── DetailModal.jsx          # Expanded coin details
│   ├── ExchangeComingSoon.jsx   # Placeholder for inactive exchanges
│   ├── ExchangeSelector.jsx     # Exchange switcher
│   ├── FlowConfluenceSection.jsx# Price/OI/CVD confluence
│   ├── FundingRatesSection.jsx  # Funding rate display
│   ├── LiquidationMap.jsx       # Position liquidation zones
│   ├── MegaWhaleFeed.jsx        # Real-time whale trade feed
│   ├── OrderbookSection.jsx     # Orderbook imbalance
│   ├── PositionCard.jsx         # Individual position display
│   ├── SectionBiasHeader.jsx    # Section header component
│   ├── Sparkline.jsx            # Mini chart component
│   ├── ThresholdSelector.jsx    # Whale alert threshold
│   ├── TraderRow.jsx            # Leaderboard row
│   └── WhaleActivityFeed.jsx    # Position changes feed
├── hooks/
│   ├── useSparklineHistory.js   # Manages sparkline data
│   ├── useWhaleNotifications.js # Browser notification logic
│   └── useWhaleWebSockets.js    # Multi-exchange WebSocket manager
└── utils/
    ├── biasCalculations.js      # Bias scoring algorithms
    ├── formatters.js            # Number/address formatting
    └── helpers.js               # Utility functions
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/charleschao/traderbias.git
cd traderbias

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/`

### Production Build

```bash
npm run build
```

Static files will be generated in the `dist/` folder.

---

## 📡 Data Sources

### REST APIs
- **Hyperliquid** - `https://api.hyperliquid.xyz/info` (main data source)
- **Hyperliquid Leaderboard** - `https://api.hyperliquid.xyz/leaderboard`
- **Nado** - `https://archive.prod.nado.xyz/v1`
- **AsterDex** - `https://fapi.asterdex.com`

### WebSocket Feeds
- **Hyperliquid** - `wss://api.hyperliquid.xyz/ws`
- **OKX** - `wss://ws.okx.com:8443/ws/v5/public`
- **Bybit** - `wss://stream.bybit.com/v5/public/linear`
- **Kraken** - `wss://ws.kraken.com/v2`
- **Binance** - `wss://fstream.binance.com/ws`

---

## 🔔 Notifications

Enable browser notifications to receive alerts for whale trades:

1. Click the 🔔 icon in the Whale Feed section
2. Allow notifications when prompted
3. Set your desired threshold ($4M - $50M)
4. Receive alerts when mega trades occur

---

## ⚠️ Disclaimer

**NOT FINANCIAL ADVICE**

This application is for informational and educational purposes only. It does not constitute financial, investment, or trading advice. 

- Cryptocurrency trading involves significant risk of loss
- Past performance does not guarantee future results
- Data may be delayed, incomplete, or inaccurate
- Do your own research before making any trading decisions

See [DISCLAIMER.md](DISCLAIMER.md), [TERMS.md](TERMS.md), and [PRIVACY.md](PRIVACY.md) for full legal information.

---

## 📄 License

This project is licensed under **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

You are free to:
- ✅ Share — copy and redistribute the material
- ✅ Adapt — remix, transform, and build upon the material

Under the following terms:
- 📛 **NonCommercial** — You may not use the material for commercial purposes
- 📝 **Attribution** — You must give appropriate credit

See [LICENSE](LICENSE) for full terms.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

## 📧 Contact

- **Repository**: [github.com/charleschao/traderbias](https://github.com/charleschao/traderbias)

---

*Built with ❤️ for the crypto trading community*
