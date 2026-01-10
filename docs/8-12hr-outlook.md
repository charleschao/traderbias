# 8-12 Hour Bias Outlook - Implementation Documentation

Technical documentation for the forward-looking directional bias prediction system.

## Overview

The 8-12hr outlook predicts short-term directional bias for BTC, ETH, and SOL using quantitative indicators from derivatives markets. It combines multiple weighted factors with bonus signals to generate a normalized score from -1 (strong bearish) to +1 (strong bullish).

---

## Architecture

```
Frontend (App.jsx)          Backend (server.js)           Algorithm (biasProjection.js)
       │                           │                              │
       │── getCoinProjection(coin)─▶│── /api/:coin/projection ────▶│
       │                           │                              │── generateProjection()
       │◀──────── projection ───────│◀─────── result ──────────────│
       │                           │                              │
     BiasProjection.jsx          dataStore                    dataCollector
       (display)                 (storage)                      (websocket)
```

---

## Weighted Factors (100% Total)

| Factor | Weight | Data Source | Purpose |
|--------|--------|-------------|---------|
| Funding Z-Score | 20% | Hyperliquid | Detects extreme long/short crowding |
| OI Rate of Change | 20% | Hyperliquid | Measures leverage dynamics |
| CVD Persistence | 20% | Hyperliquid | Sustained buying/selling pressure |
| Market Regime | 20% | OI + Funding | Identifies overcrowded positions |
| Whale Consensus | 10% | Hyperliquid | Top trader positioning |
| Cross-Exchange Confluence | 10% | All exchanges | Agreement across venues |

---

## Bonus Signals (Additive)

| Signal | Bonus | Trigger |
|--------|-------|---------|
| RSI Divergence (Bullish) | +20% | Price makes lower low, RSI makes higher low |
| RSI Divergence (Bearish) | -20% | Price makes higher high, RSI makes lower high |
| Spot Accumulation | +25% | Spot CVD rising, Perp CVD flat/falling |
| Capitulation Bottom | +20% | Spot CVD rising, Perp CVD falling |
| Fake Pump | -25% | Perp CVD rising, Spot CVD falling |
| Distribution | -20% | Spot CVD falling, Perp CVD flat |
| All Factors Aligned | ±10% | All factor scores agree in direction |

---

## Score → Bias Mapping

| Score Range | Bias | Grade |
|-------------|------|-------|
| ≥ 0.6 | STRONG BULLISH | A+ |
| 0.3 to 0.6 | BULLISH | A/B+ |
| 0.1 to 0.3 | LEAN BULLISH | B/C |
| -0.1 to 0.1 | NEUTRAL | C |
| -0.3 to -0.1 | LEAN BEARISH | B/C |
| -0.6 to -0.3 | BEARISH | A/B+ |
| ≤ -0.6 | STRONG BEARISH | A+ |

---

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `server/biasProjection.js` | Core algorithm - all calculations |
| `server/server.js` | API endpoint `/api/:coin/projection` |
| `server/dataStore.js` | In-memory storage for historical data |
| `server/dataCollector.js` | Fetches data from exchanges |
| `server/spotDataCollector.js` | Binance spot CVD via websocket |

### Frontend

| File | Purpose |
|------|---------|
| `src/services/backendApi.js` | `getCoinProjection(coin)` API call |
| `src/components/BiasProjection.jsx` | Display component |
| `src/App.jsx` | Fetches projection on interval (30 min) |

---

## Algorithm Flow

```javascript
function generateProjection(coin, dataStore, consensus) {
    // 1. Get historical data
    const hlData = dataStore.getExchangeData('hyperliquid');
    
    // 2. Calculate individual factors
    const divergence = detectRSIDivergence(hlData.price[coin]);
    const fundingZScore = calculateFundingZScore(hlData.funding[coin]);
    const oiRoC = calculateOIRoC(hlData.oi[coin], hlData.price[coin]);
    const cvdPersistence = calculateCVDPersistence(hlData.cvd[coin]);
    const regime = detectRegime(hlData.oi[coin], hlData.funding[coin], hlData.price[coin]);
    const whales = calculateWhaleAlignment(consensus);
    const confluence = calculateCrossExchangeConfluence(dataStore, coin);
    
    // 3. Calculate weighted score
    let weightedScore = 
        (fundingZScore.score * 0.20) +
        (oiRoC.score * 0.20) +
        (cvdPersistence.score * 0.20) +
        (regime.score * 0.20) +
        (confluence.score * 0.10) +
        (whales.score * 0.10);
    
    // 4. Add bonuses
    if (divergence.detected) {
        normalizedScore += divergence.score; // ±0.20
    }
    if (spotPerpDivergence) {
        normalizedScore += spotBonus; // ±0.20 to ±0.25
    }
    
    // 5. Generate prediction
    return {
        coin,
        prediction: { bias, strength, score, grade },
        invalidation: { price, type, distance },
        keyFactors: [...],
        warnings: [...]
    };
}
```

---

## Factor Calculations

### Funding Z-Score
Measures how extreme current funding is relative to recent history.
- **Z > 2:** Extremely long-biased → contrarian bearish
- **Z < -2:** Extremely short-biased → contrarian bullish

### OI Rate of Change
Analyzes 4-hour changes in open interest vs price.
- **OI ↑ + Price ↑:** Strong trending market
- **OI ↓ + Price ↓:** Capitulation (bounce potential)

### CVD Persistence
Measures sustained buying/selling pressure over 2 hours.
- Positive CVD = net buying pressure
- Negative CVD = net selling pressure

### Market Regime
Detects overcrowded positions using OI + funding combination.
- **LONG_CROWDED:** Funding high + OI high → bearish
- **SHORT_CROWDED:** Funding negative + OI high → bullish

### Spot vs Perp CVD Divergence
Compares Binance spot CVD with Hyperliquid perp CVD.
- **Spot ↑ Perp ↓:** Smart money accumulating (bullish)
- **Spot ↓ Perp ↑:** Retail FOMO, whale distribution (bearish)

---

## API Response Structure

```json
{
    "coin": "BTC",
    "horizon": "8-12H",
    "status": "ACTIVE",
    "currentPrice": 90660.5,
    "prediction": {
        "bias": "LEAN_BULL",
        "strength": "WEAK",
        "score": 0.124,
        "grade": "C",
        "direction": "BULLISH"
    },
    "invalidation": {
        "price": 90102,
        "type": "below",
        "distance": 0.62,
        "description": "Bias flips if BTC breaks below $90,102"
    },
    "confidence": {
        "level": "MEDIUM",
        "score": 0.6,
        "factors": ["Low volatility environment"]
    },
    "keyFactors": [...],
    "warnings": [],
    "session": "🌙 Asia",
    "divergence": null,
    "components": {...},
    "generatedAt": 1768005303026
}
```

---

## Update Frequency

- **Frontend fetch:** Every 30 minutes
- **Flip-flop prevention:** Only updates if score changes by ≥0.15
- **Data collection:** Continuous via dataCollector (5-minute intervals)
- **Spot CVD:** Real-time via Binance websocket

---

## Supported Coins

| Coin | Endpoint |
|------|----------|
| BTC | `/api/btc/projection` |
| ETH | `/api/eth/projection` |
| SOL | `/api/sol/projection` |

---

## Dependencies

- **Hyperliquid API:** Price, OI, CVD, Funding
- **Binance Spot Websocket:** Real-time spot CVD
- **Binance Futures API:** Cross-exchange validation
- **Bybit API:** Cross-exchange validation
