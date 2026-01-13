# Backtest Page Design

**Date:** 2026-01-12

## Overview

Add a `/backtest` page to analyze prediction accuracy over 1 year of historical data. Stores 12hr and daily bias projections to disk, provides API endpoints for querying, and displays win rate analytics.

## Data Storage

**Location:** `server/data/winrates.json` (extended retention)

**Retention:** 365 days (changed from 30)

**Data per prediction:**
```js
{
  id: "BTC_12hr_1736700000000",
  coin: "BTC",
  projectionType: "12hr",  // or "daily"
  timestamp: 1736700000000,
  initialPrice: 94500,
  predictedBias: "BULLISH",
  predictedDirection: "BULLISH",
  score: 72,
  strength: "STRONG",
  confidence: "HIGH",
  evaluated: true,
  outcome: "correct",
  finalPrice: 95200,
  actualPriceChange: 0.74,
  evaluatedAt: 1736736000000
}
```

**Storage estimate:** ~26MB/year

## API Endpoints

### GET /api/backtest/predictions
Query historical predictions.
```
?coin=BTC&type=12hr&from=2025-01-01&to=2025-12-31&outcome=correct&limit=1000
```

### GET /api/backtest/stats
Aggregated statistics.
```
?coin=BTC&type=12hr&from=2025-01-01&to=2025-12-31
```
Returns breakdowns by strength, confidence, coin, and type.

### GET /api/backtest/equity-curve
Simulated equity curve.
```
?coin=BTC&type=12hr&from=2025-01-01&initialCapital=10000
```

### GET /api/backtest/streaks
Win/loss streak analysis.

## Frontend Page

**Route:** `/backtest`

**Sections:**
1. Win Rate Dashboard - summary cards, breakdowns by coin/type/strength
2. Performance Charts - equity curve, win rate over time, drawdown
3. Prediction History Table - filterable, sortable, exportable

## Implementation Steps

### Backend

1. `server/winRateTracker.js`:
   - Change MAX_HISTORY_DAYS to 365
   - Add projectionType field
   - Fix recordPrediction to accept type parameter
   - Separate evaluation delays (10hr for 12hr, 20hr for daily)

2. Create `server/backtestApi.js`:
   - Filtering and aggregation helpers
   - Equity curve calculation
   - Streak analysis

3. `server/server.js`:
   - Mount /api/backtest/* routes

### Frontend

4. Create `src/pages/BacktestPage.jsx`

5. Create `src/components/backtest/`:
   - WinRateDashboard.jsx
   - PerformanceCharts.jsx
   - PredictionTable.jsx

6. `src/services/backendApi.js`:
   - Add backtest API client functions

7. `src/main.jsx`:
   - Add /backtest route

## Notes

- No external charting library needed - use existing SVG approach from Sparkline.jsx
- Completely isolated from main App.jsx state
- Reuse existing dark theme styling
