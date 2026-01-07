# 🎯 Trader's Bias - Real-Time Crypto Trading Intelligence

A professional-grade cryptocurrency trading intelligence dashboard with orderflow edge detection, whale tracking, and market bias analysis across multiple exchanges.

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue)
![React](https://img.shields.io/badge/React-19.1-61dafb)
![Vite](https://img.shields.io/badge/Vite-7.2-646cff)

## 🎯 What This App Does

Trader's Bias is a **real-time trading intelligence dashboard** designed for cryptocurrency traders who want to:

1. **Detect Flow Signals** - Identify divergences, absorption, and OI patterns for potential reversals
2. **Track Whale Activity** - Monitor large trades ($4M+) across major exchanges in real-time
3. **Understand Market Bias** - See composite bias scores based on multiple data sources
4. **Follow Top Traders** - Track positions of the top 10 weekly performers on Hyperliquid
5. **Spot Market Divergences** - Identify when price and flow metrics diverge

---

## ✨ Key Features

### 🎯 Flow Signals (NEW)
Real-time orderflow edge detection:
- **CVD Divergence** - Price rising but CVD falling = hidden selling (bearish)
- **Absorption Detection** - Large selling absorbed without price drop = strong buyers
- **OI Patterns** - Coil forming, short covering, strong flow identification
- **Signal Strength** - Visual strength indicators for each signal

### 💬 Trading Quotes
Inspirational wisdom from legendary traders:
- 50 curated quotes from Druckenmiller, Livermore, Tudor Jones, Douglas, Raschke
- Randomizes on each page load

### 🐋 Mega Whale Trade Feed
- **Real-time WebSocket connections** to 5+ major exchanges
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
- **Funding Rate** - cost to hold positions
- **Sparkline charts** for visual trend tracking

### 📈 Flow Confluence Analysis
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
- Identifies "consistent winners"

### 📋 Position Tracking
- View all open positions from top traders
- Position cards show entry price, notional size, uPNL

### ⏱️ Timeframe Selection
- **5m / 15m / 30m / 1H** rolling timeframes
- Calculates OI change, price change, and orderbook averages
- Historical data persisted to localStorage

---

## 🏢 Supported Exchanges

| Exchange | Status | Data Available |
|----------|--------|----------------|
| **Hyperliquid** | ✅ Full Support | Price, OI, Funding, Orderbook, CVD, Leaderboard, Positions |
| **Binance** | ⚠️ Implemented | Price, OI, Funding, Orderbook (may have geo-restrictions) |
| **Bybit** | ⚠️ Implemented | Price, OI, Funding, Orderbook (may have geo-restrictions) |
| **Nado** | ✅ Implemented | Price, OI, Funding |
| **AsterDex** | ✅ Implemented | Price, OI, Funding, Orderbook |

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
├── App.jsx                       # Main application
├── config/
│   ├── exchanges.js              # Exchange configurations
│   └── whaleWsConfig.js          # WebSocket configurations
├── components/
│   ├── BiasCard.jsx              # Individual coin bias card
│   ├── BiasHistoryBar.jsx        # Bias history visualization
│   ├── ConsensusSection.jsx      # Whale consensus display
│   ├── DetailModal.jsx           # Expanded coin details
│   ├── ExchangeSelector.jsx      # Exchange switcher
│   ├── FlowConfluenceSection.jsx # Price/OI/CVD confluence
│   ├── FlowSignalsSection.jsx    # Edge signal detection (NEW)
│   ├── MegaWhaleFeed.jsx         # Real-time whale trade feed
│   ├── OrderbookSection.jsx      # Orderbook imbalance
│   ├── PositionCard.jsx          # Individual position display
│   ├── Sparkline.jsx             # Mini chart component
│   ├── TradingQuote.jsx          # Trading wisdom quotes (NEW)
│   ├── TraderRow.jsx             # Leaderboard row
│   └── WhaleActivityFeed.jsx     # Position changes feed
├── hooks/
│   ├── useSignalHistory.js       # Signal history tracking
│   ├── useSparklineHistory.js    # Manages sparkline data
│   ├── useWhaleNotifications.js  # Browser notification logic
│   └── useWhaleWebSockets.js     # Multi-exchange WebSocket manager
└── utils/
    ├── biasCalculations.js       # Bias scoring algorithms
    ├── flowSignals.js            # Edge signal detection (NEW)
    ├── formatters.js             # Number/address formatting
    └── helpers.js                # Utility functions
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

---

## 📡 Data Sources

### REST APIs
- **Hyperliquid** - `https://api.hyperliquid.xyz/info`
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

- **Website**: [traderbias.app](https://traderbias.app)
- **Repository**: [github.com/charleschao/traderbias](https://github.com/charleschao/traderbias)

---

*Built with ❤️ for the crypto trading community*
