# 🎯 Trader's Bias - Directional Bias for Intraday Trading

Get your **directional bias** for BTC, ETH, and SOL. A quantitative trading intelligence dashboard that tells you whether to lean bullish or bearish before you start your trading session, with both **8-12 hour** and **Daily (24H)** outlooks.

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue)
![React](https://img.shields.io/badge/React-19.1-61dafb)
![Vite](https://img.shields.io/badge/Vite-7.2-646cff)

**Live:** [traderbias.app](https://traderbias.app)

---

## 🎯 What This App Does

**Trader's Bias answers one question: What's the likely direction for the next 8-12 hours?**

Instead of staring at charts trying to figure out the bias, this dashboard synthesizes multiple data sources into a clear directional signal:

- **BULLISH** - Flow data suggests upside. Look for long setups.
- **BEARISH** - Flow data suggests downside. Look for short setups.
- **NEUTRAL** - Mixed signals. Wait for clarity or reduce size.

### Core Philosophy

1. **Start your session with a bias** - Check the 8-12 hour outlook before trading
2. **Trade in the direction of flow** - Don't fight the data
3. **Know when you're wrong** - Clear invalidation levels included

---

## ✨ Key Features

### 📊 Dual Bias Projections

**12Hr Bias** - An 8-12 hour outlook optimized for session traders:
- **Primary Signal**: Flow Confluence (55% weight) - Price + OI + CVD alignment
- **Bias direction** (Bullish/Bearish/Neutral)
- **Confidence level** (High/Medium/Low)
- **Key factors** driving the bias
- **Invalidation level** - the price where the thesis is wrong

**Daily Bias** - A 24-hour outlook optimized for day traders:
- **Primary Signal**: Spot/Perp CVD Divergence (35% weight) - Institutional flow detection
- Extended lookback windows (6-8H) for noise reduction
- 90-day funding baseline for true statistical extremes
- Signal freshness decay over time

### 🔄 Flow Confluence Analysis

Combines three critical flow indicators:
- **Price** - Direction of market movement
- **Open Interest** - Leveraged position changes
- **CVD (Cumulative Volume Delta)** - Net buyer/seller aggression

When all three align → **STRONG confluence** (highest conviction)

### 🐋 Large Whale Orders

Real-time tracking of $4M+ trades across major exchanges:
- Hyperliquid, Binance, Bybit, OKX, Kraken
- Browser notifications for whale alerts
- Aggregated BUY/SELL volume per coin

### 📈 Orderbook Imbalance

Visual bid/ask pressure analysis:
- Real-time L2 depth comparison
- Net imbalance percentage
- Interpretation text explaining what it means

---

## 🏢 Supported Exchanges

| Exchange | Status | Features |
|----------|--------|----------|
| **Hyperliquid** | ✅ Full Support | All features + whale tracking |
| **Binance** | ✅ Supported | Price, OI, Funding, Orderbook |
| **Bybit** | ✅ Supported | Price, OI, Funding, Orderbook |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/charleschao/traderbias.git
cd traderbias

# Install
npm install

# Run
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 📁 Project Structure

```
src/
├── App.jsx                       # Main application (~2,008 lines)
├── components/
│   ├── BiasCard.jsx              # Individual coin bias card
│   ├── BiasProjection.jsx        # 8-12 hour outlook display
│   ├── BiasProjectionTabs.jsx    # Tab switcher (12Hr/Daily)
│   ├── DailyBiasTab.jsx          # 24-hour daily bias display
│   ├── FlowConfluenceSection.jsx # Price/OI/CVD confluence
│   ├── MegaWhaleFeed.jsx         # Large whale order feed
│   ├── OrderbookSection.jsx      # Orderbook imbalance
│   ├── WhaleActivityFeed.jsx     # Whale position changes
│   └── ThemeToggle.jsx           # Light/dark mode
├── hooks/
│   ├── useSignalHistory.js       # Signal tracking
│   └── useWhaleWebSockets.js     # Multi-exchange WebSocket
└── utils/
    ├── biasCalculations.js       # Composite bias algorithms
    ├── flowSignals.js            # Edge signal detection
    └── formatters.js             # Number formatting
```

---

## 🔧 Tech Stack

- **Frontend:** React 19.1
- **Build:** Vite 7.2 (Rolldown)
- **Styling:** Tailwind CSS 4.x
- **Real-Time:** WebSocket connections
- **Font:** Inter



---

## ⚠️ Disclaimer

**NOT FINANCIAL ADVICE**

This is for informational purposes only. Cryptocurrency trading involves significant risk. Do your own research.

See [DISCLAIMER.md](DISCLAIMER.md) and [TERMS.md](TERMS.md) for full legal information.

---

## 📄 License

**Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)**

- ✅ Share and adapt freely
- 📛 NonCommercial use only
- 📝 Attribution required

---

## 📧 Contact

- **Website:** [traderbias.app](https://traderbias.app)
- **GitHub:** [github.com/charleschao/traderbias](https://github.com/charleschao/traderbias)

---

*Built for intraday traders who want a clear directional bias before every session.*
