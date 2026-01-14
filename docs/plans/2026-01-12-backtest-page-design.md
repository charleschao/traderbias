# Backtest Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/backtest` page that displays 1 year of prediction accuracy data with win rate analytics, performance charts, and filterable history.

**Architecture:** Backend stores predictions to JSON file with 365-day retention. New `/api/backtest/*` endpoints serve filtered/aggregated data. Standalone React page fetches and displays analytics.

**Tech Stack:** Express.js (backend), React 19, SVG charts (no external library), Tailwind CSS

---

## Task 1: Fix winRateTracker to support projection types

**Files:**
- Modify: `server/winRateTracker.js`

**Step 1: Update constants and add type-specific evaluation delays**

At top of file, change:
```js
const MAX_HISTORY_DAYS = 30;
```
to:
```js
const MAX_HISTORY_DAYS = 365;
const EVALUATION_DELAYS = {
  '12hr': 10 * 60 * 60 * 1000,  // 10 hours
  'daily': 20 * 60 * 60 * 1000  // 20 hours
};
```

**Step 2: Update recordPrediction method signature and logic**

Replace existing `recordPrediction` method:
```js
recordPrediction(coin, projection, projectionType = '12hr') {
  const prediction = {
    id: `${coin}_${projectionType}_${Date.now()}`,
    coin,
    projectionType,
    timestamp: Date.now(),
    initialPrice: projection.currentPrice,
    predictedBias: projection.prediction.bias,
    predictedDirection: projection.prediction.direction,
    score: projection.prediction.score,
    strength: projection.prediction.strength,
    grade: projection.prediction.grade,
    confidence: projection.confidence.level,
    evaluated: false,
    outcome: null
  };

  this.predictions.push(prediction);
  console.log(`[WinRateTracker] Recorded ${coin} ${projectionType} prediction: ${prediction.predictedBias} @ $${projection.currentPrice}`);
}
```

**Step 3: Update evaluatePredictions to use type-specific delays**

Replace the `evaluatePredictions` method:
```js
evaluatePredictions() {
  const now = Date.now();

  // Find unevaluated predictions that are due based on their type
  const duePredictions = this.predictions.filter(p => {
    if (p.evaluated) return false;
    const delay = EVALUATION_DELAYS[p.projectionType] || EVALUATION_DELAYS['12hr'];
    return p.timestamp <= (now - delay);
  });

  if (duePredictions.length === 0) {
    return;
  }

  console.log(`[WinRateTracker] Evaluating ${duePredictions.length} predictions...`);

  for (const pred of duePredictions) {
    this.evaluateSinglePrediction(pred);
  }

  this.recalculateStats();
  this.saveToFile();
}
```

**Step 4: Verify changes**

Run: `node -e "const w = require('./server/winRateTracker'); console.log('Loaded OK')"`
Expected: "Loaded OK" with no errors

**Step 5: Commit**

```bash
git add server/winRateTracker.js
git commit -m "feat: extend winRateTracker to 365 days with projection types"
```

---

## Task 2: Create backtestApi helper module

**Files:**
- Create: `server/backtestApi.js`

**Step 1: Create the helper module**

```js
/**
 * Backtest API Helpers
 *
 * Filtering, aggregation, and analysis functions for backtest data
 */

const winRateTracker = require('./winRateTracker');

/**
 * Filter predictions by criteria
 */
function filterPredictions({ coin, type, from, to, outcome, limit = 1000 }) {
  let predictions = winRateTracker.predictions || [];

  if (coin) {
    predictions = predictions.filter(p => p.coin === coin.toUpperCase());
  }

  if (type) {
    predictions = predictions.filter(p => p.projectionType === type);
  }

  if (from) {
    const fromTs = new Date(from).getTime();
    predictions = predictions.filter(p => p.timestamp >= fromTs);
  }

  if (to) {
    const toTs = new Date(to).getTime() + 24 * 60 * 60 * 1000; // End of day
    predictions = predictions.filter(p => p.timestamp <= toTs);
  }

  if (outcome) {
    predictions = predictions.filter(p => p.outcome === outcome);
  }

  // Sort by timestamp descending
  predictions = predictions.sort((a, b) => b.timestamp - a.timestamp);

  return predictions.slice(0, limit);
}

/**
 * Calculate aggregated statistics
 */
function calculateStats({ coin, type, from, to }) {
  const predictions = filterPredictions({ coin, type, from, to, limit: 100000 });
  const evaluated = predictions.filter(p => p.evaluated && p.outcome !== 'inconclusive');

  const calcWinRate = (preds) => {
    const total = preds.length;
    const correct = preds.filter(p => p.outcome === 'correct').length;
    return {
      total,
      correct,
      winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 0
    };
  };

  // Overall stats
  const overall = calcWinRate(evaluated);

  // By strength
  const byStrength = {};
  for (const strength of ['STRONG', 'MODERATE', 'WEAK']) {
    byStrength[strength] = calcWinRate(evaluated.filter(p => p.strength === strength));
  }

  // By confidence
  const byConfidence = {};
  for (const conf of ['HIGH', 'MEDIUM', 'LOW']) {
    byConfidence[conf] = calcWinRate(evaluated.filter(p => p.confidence === conf));
  }

  // By coin
  const byCoin = {};
  for (const c of ['BTC', 'ETH', 'SOL']) {
    byCoin[c] = calcWinRate(evaluated.filter(p => p.coin === c));
  }

  // By type
  const byType = {};
  for (const t of ['12hr', 'daily']) {
    byType[t] = calcWinRate(evaluated.filter(p => p.projectionType === t));
  }

  return { overall, byStrength, byConfidence, byCoin, byType };
}

/**
 * Generate equity curve from predictions
 */
function generateEquityCurve({ coin, type, from, to, initialCapital = 10000 }) {
  const predictions = filterPredictions({ coin, type, from, to, limit: 100000 });
  const evaluated = predictions
    .filter(p => p.evaluated && p.outcome !== 'inconclusive')
    .sort((a, b) => a.timestamp - b.timestamp);

  if (evaluated.length === 0) {
    return [];
  }

  let equity = initialCapital;
  const curve = [{ timestamp: evaluated[0].timestamp, equity, prediction: null }];

  for (const pred of evaluated) {
    // Simple model: win = +2%, lose = -1.5%
    if (pred.outcome === 'correct') {
      equity *= 1.02;
    } else {
      equity *= 0.985;
    }
    curve.push({
      timestamp: pred.evaluatedAt || pred.timestamp,
      equity: Math.round(equity * 100) / 100,
      prediction: {
        id: pred.id,
        coin: pred.coin,
        direction: pred.predictedDirection,
        outcome: pred.outcome
      }
    });
  }

  return curve;
}

/**
 * Calculate win/loss streaks
 */
function calculateStreaks({ coin, type, from, to }) {
  const predictions = filterPredictions({ coin, type, from, to, limit: 100000 });
  const evaluated = predictions
    .filter(p => p.evaluated && p.outcome !== 'inconclusive')
    .sort((a, b) => a.timestamp - b.timestamp);

  if (evaluated.length === 0) {
    return {
      currentStreak: { type: 'none', count: 0 },
      longestWin: 0,
      longestLoss: 0,
      streakDistribution: { wins: {}, losses: {} }
    };
  }

  let currentStreak = { type: null, count: 0 };
  let longestWin = 0;
  let longestLoss = 0;
  let tempStreak = 0;
  let tempType = null;
  const winStreaks = [];
  const lossStreaks = [];

  for (const pred of evaluated) {
    const isWin = pred.outcome === 'correct';

    if (tempType === null) {
      tempType = isWin ? 'win' : 'loss';
      tempStreak = 1;
    } else if ((isWin && tempType === 'win') || (!isWin && tempType === 'loss')) {
      tempStreak++;
    } else {
      // Streak ended
      if (tempType === 'win') {
        winStreaks.push(tempStreak);
        longestWin = Math.max(longestWin, tempStreak);
      } else {
        lossStreaks.push(tempStreak);
        longestLoss = Math.max(longestLoss, tempStreak);
      }
      tempType = isWin ? 'win' : 'loss';
      tempStreak = 1;
    }
  }

  // Final streak
  if (tempType === 'win') {
    winStreaks.push(tempStreak);
    longestWin = Math.max(longestWin, tempStreak);
  } else if (tempType === 'loss') {
    lossStreaks.push(tempStreak);
    longestLoss = Math.max(longestLoss, tempStreak);
  }

  currentStreak = { type: tempType, count: tempStreak };

  return {
    currentStreak,
    longestWin,
    longestLoss,
    totalPredictions: evaluated.length
  };
}

module.exports = {
  filterPredictions,
  calculateStats,
  generateEquityCurve,
  calculateStreaks
};
```

**Step 2: Verify module loads**

Run: `node -e "const b = require('./server/backtestApi'); console.log(Object.keys(b))"`
Expected: `[ 'filterPredictions', 'calculateStats', 'generateEquityCurve', 'calculateStreaks' ]`

**Step 3: Commit**

```bash
git add server/backtestApi.js
git commit -m "feat: add backtestApi helper module"
```

---

## Task 3: Add backtest routes to server

**Files:**
- Modify: `server/server.js`

**Step 1: Import backtestApi at top of file (after other requires)**

Add after line 18:
```js
const backtestApi = require('./backtestApi');
```

**Step 2: Add backtest endpoints before the 404 handler**

Add before line 396 (`// 404 handler`):
```js
// ============== BACKTEST API ENDPOINTS ==============

/**
 * Get filtered predictions for backtest analysis
 * GET /api/backtest/predictions
 */
app.get('/api/backtest/predictions', (req, res) => {
  const { coin, type, from, to, outcome, limit } = req.query;
  const predictions = backtestApi.filterPredictions({
    coin,
    type,
    from,
    to,
    outcome,
    limit: limit ? parseInt(limit) : 1000
  });
  res.json({
    count: predictions.length,
    predictions
  });
});

/**
 * Get aggregated backtest statistics
 * GET /api/backtest/stats
 */
app.get('/api/backtest/stats', (req, res) => {
  const { coin, type, from, to } = req.query;
  const stats = backtestApi.calculateStats({ coin, type, from, to });
  res.json(stats);
});

/**
 * Get equity curve for charting
 * GET /api/backtest/equity-curve
 */
app.get('/api/backtest/equity-curve', (req, res) => {
  const { coin, type, from, to, initialCapital } = req.query;
  const curve = backtestApi.generateEquityCurve({
    coin,
    type,
    from,
    to,
    initialCapital: initialCapital ? parseFloat(initialCapital) : 10000
  });
  res.json({
    points: curve.length,
    curve
  });
});

/**
 * Get win/loss streak analysis
 * GET /api/backtest/streaks
 */
app.get('/api/backtest/streaks', (req, res) => {
  const { coin, type, from, to } = req.query;
  const streaks = backtestApi.calculateStreaks({ coin, type, from, to });
  res.json(streaks);
});
```

**Step 3: Verify server starts**

Run: `cd server && node -e "require('./server');" && echo "OK"`
(Ctrl+C to stop)

**Step 4: Commit**

```bash
git add server/server.js
git commit -m "feat: add /api/backtest/* endpoints"
```

---

## Task 4: Add backtest API client functions

**Files:**
- Modify: `src/services/backendApi.js`

**Step 1: Add backtest API functions before the default export**

Add before line 170 (`// Backwards compatibility alias`):
```js
// ============== BACKTEST API ==============

/**
 * Get filtered predictions for backtest
 */
export const getBacktestPredictions = async ({ coin, type, from, to, outcome, limit } = {}) => {
  try {
    const params = new URLSearchParams();
    if (coin) params.append('coin', coin);
    if (type) params.append('type', type);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (outcome) params.append('outcome', outcome);
    if (limit) params.append('limit', limit);

    const response = await fetch(`${BACKEND_URL}/api/backtest/predictions?${params}`);
    if (!response.ok) return { count: 0, predictions: [] };
    return await response.json();
  } catch (error) {
    console.error('[BackendAPI] Failed to fetch backtest predictions:', error);
    return { count: 0, predictions: [] };
  }
};

/**
 * Get aggregated backtest statistics
 */
export const getBacktestStats = async ({ coin, type, from, to } = {}) => {
  try {
    const params = new URLSearchParams();
    if (coin) params.append('coin', coin);
    if (type) params.append('type', type);
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const response = await fetch(`${BACKEND_URL}/api/backtest/stats?${params}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('[BackendAPI] Failed to fetch backtest stats:', error);
    return null;
  }
};

/**
 * Get equity curve for charting
 */
export const getBacktestEquityCurve = async ({ coin, type, from, to, initialCapital } = {}) => {
  try {
    const params = new URLSearchParams();
    if (coin) params.append('coin', coin);
    if (type) params.append('type', type);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (initialCapital) params.append('initialCapital', initialCapital);

    const response = await fetch(`${BACKEND_URL}/api/backtest/equity-curve?${params}`);
    if (!response.ok) return { points: 0, curve: [] };
    return await response.json();
  } catch (error) {
    console.error('[BackendAPI] Failed to fetch equity curve:', error);
    return { points: 0, curve: [] };
  }
};

/**
 * Get streak analysis
 */
export const getBacktestStreaks = async ({ coin, type, from, to } = {}) => {
  try {
    const params = new URLSearchParams();
    if (coin) params.append('coin', coin);
    if (type) params.append('type', type);
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const response = await fetch(`${BACKEND_URL}/api/backtest/streaks?${params}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('[BackendAPI] Failed to fetch streaks:', error);
    return null;
  }
};
```

**Step 2: Update the default export**

Replace the default export (around line 170) with:
```js
export default {
  isBackendEnabled,
  getExchangeData,
  getExchangeSnapshot,
  getAllExchangesData,
  checkBackendHealth,
  getBackendStats,
  getBTCProjection,
  getCoinProjection,
  getDailyBias,
  getBacktestPredictions,
  getBacktestStats,
  getBacktestEquityCurve,
  getBacktestStreaks
};
```

**Step 3: Commit**

```bash
git add src/services/backendApi.js
git commit -m "feat: add backtest API client functions"
```

---

## Task 5: Create BacktestPage component

**Files:**
- Create: `src/pages/BacktestPage.jsx`

**Step 1: Create the page component**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  getBacktestStats,
  getBacktestPredictions,
  getBacktestEquityCurve,
  getBacktestStreaks
} from '../services/backendApi.js';

// ============== MAIN PAGE ==============

const BacktestPage = () => {
  const [filters, setFilters] = useState({
    coin: '',
    type: '',
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [equityCurve, setEquityCurve] = useState([]);
  const [streaks, setStreaks] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [statsData, predsData, curveData, streaksData] = await Promise.all([
      getBacktestStats(filters),
      getBacktestPredictions({ ...filters, limit: 100 }),
      getBacktestEquityCurve(filters),
      getBacktestStreaks(filters)
    ]);
    setStats(statsData);
    setPredictions(predsData?.predictions || []);
    setEquityCurve(curveData?.curve || []);
    setStreaks(streaksData);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Backtest Analytics</h1>
          <p className="text-slate-400">Prediction accuracy analysis</p>
        </header>

        <FilterBar filters={filters} setFilters={setFilters} />

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <div className="space-y-6">
            <WinRateDashboard stats={stats} streaks={streaks} />
            <EquityCurveChart curve={equityCurve} />
            <PredictionTable predictions={predictions} />
          </div>
        )}
      </div>
    </div>
  );
};

// ============== FILTER BAR ==============

const FilterBar = ({ filters, setFilters }) => {
  const handleChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-slate-900 rounded-lg p-4 mb-6 border border-slate-700">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Coin</label>
          <select
            value={filters.coin}
            onChange={(e) => handleChange('coin', e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
          >
            <option value="">All</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="SOL">SOL</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Type</label>
          <select
            value={filters.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
          >
            <option value="">All</option>
            <option value="12hr">12hr</option>
            <option value="daily">Daily</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">From</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => handleChange('from', e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">To</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => handleChange('to', e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
          />
        </div>
      </div>
    </div>
  );
};

// ============== WIN RATE DASHBOARD ==============

const WinRateDashboard = ({ stats, streaks }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Overall Win Rate"
        value={`${stats.overall?.winRate || 0}%`}
        subtitle={`${stats.overall?.correct || 0} / ${stats.overall?.total || 0} predictions`}
        color={parseFloat(stats.overall?.winRate || 0) >= 50 ? 'green' : 'red'}
      />
      <StatCard
        title="Current Streak"
        value={`${streaks?.currentStreak?.count || 0} ${streaks?.currentStreak?.type || ''}`}
        subtitle={`Longest: ${streaks?.longestWin || 0}W / ${streaks?.longestLoss || 0}L`}
        color={streaks?.currentStreak?.type === 'win' ? 'green' : 'red'}
      />
      <StatCard
        title="12hr Predictions"
        value={`${stats.byType?.['12hr']?.winRate || 0}%`}
        subtitle={`${stats.byType?.['12hr']?.total || 0} total`}
        color="blue"
      />
      <StatCard
        title="Daily Predictions"
        value={`${stats.byType?.daily?.winRate || 0}%`}
        subtitle={`${stats.byType?.daily?.total || 0} total`}
        color="purple"
      />

      {/* Breakdown by strength */}
      <div className="col-span-full">
        <h3 className="text-lg font-semibold mb-3">By Signal Strength</h3>
        <div className="grid grid-cols-3 gap-4">
          {['STRONG', 'MODERATE', 'WEAK'].map(strength => (
            <div key={strength} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-400">{strength}</div>
              <div className="text-2xl font-bold">{stats.byStrength?.[strength]?.winRate || 0}%</div>
              <div className="text-xs text-slate-500">{stats.byStrength?.[strength]?.total || 0} predictions</div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown by coin */}
      <div className="col-span-full">
        <h3 className="text-lg font-semibold mb-3">By Coin</h3>
        <div className="grid grid-cols-3 gap-4">
          {['BTC', 'ETH', 'SOL'].map(coin => (
            <div key={coin} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-400">{coin}</div>
              <div className="text-2xl font-bold">{stats.byCoin?.[coin]?.winRate || 0}%</div>
              <div className="text-xs text-slate-500">{stats.byCoin?.[coin]?.total || 0} predictions</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, color = 'blue' }) => {
  const colors = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400'
  };

  return (
    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
      <div className="text-sm text-slate-400">{title}</div>
      <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </div>
  );
};

// ============== EQUITY CURVE CHART ==============

const EquityCurveChart = ({ curve }) => {
  if (!curve || curve.length < 2) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Equity Curve</h3>
        <p className="text-slate-400">Not enough data for equity curve</p>
      </div>
    );
  }

  const width = 800;
  const height = 200;
  const padding = 40;

  const equityValues = curve.map(p => p.equity);
  const maxEquity = Math.max(...equityValues);
  const minEquity = Math.min(...equityValues);
  const range = maxEquity - minEquity || 1;

  const points = curve.map((point, index) => {
    const x = padding + (index / (curve.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((point.equity - minEquity) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const initialEquity = curve[0].equity;
  const finalEquity = curve[curve.length - 1].equity;
  const totalReturn = ((finalEquity - initialEquity) / initialEquity) * 100;

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Equity Curve</h3>
        <div className={`text-lg font-bold ${totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
        </div>
      </div>
      <svg width={width} height={height} className="w-full h-auto" viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(i => (
          <line
            key={i}
            x1={padding}
            y1={padding + i * (height - 2 * padding)}
            x2={width - padding}
            y2={padding + i * (height - 2 * padding)}
            stroke="#334155"
            strokeWidth="1"
          />
        ))}
        {/* Equity line */}
        <polyline
          points={points}
          fill="none"
          stroke={totalReturn >= 0 ? '#10b981' : '#ef4444'}
          strokeWidth="2"
        />
        {/* Start/end points */}
        <circle cx={padding} cy={height - padding - ((initialEquity - minEquity) / range) * (height - 2 * padding)} r="4" fill="#3b82f6" />
        <circle cx={width - padding} cy={height - padding - ((finalEquity - minEquity) / range) * (height - 2 * padding)} r="4" fill="#3b82f6" />
        {/* Labels */}
        <text x={padding} y={height - 10} fill="#94a3b8" fontSize="12">${initialEquity.toFixed(0)}</text>
        <text x={width - padding} y={height - 10} fill="#94a3b8" fontSize="12" textAnchor="end">${finalEquity.toFixed(0)}</text>
      </svg>
    </div>
  );
};

// ============== PREDICTION TABLE ==============

const PredictionTable = ({ predictions }) => {
  if (!predictions || predictions.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Recent Predictions</h3>
        <p className="text-slate-400">No predictions found</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
      <h3 className="text-lg font-semibold mb-4">Recent Predictions ({predictions.length})</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left">
              <th className="py-2 px-3 text-slate-400">Date</th>
              <th className="py-2 px-3 text-slate-400">Coin</th>
              <th className="py-2 px-3 text-slate-400">Type</th>
              <th className="py-2 px-3 text-slate-400">Predicted</th>
              <th className="py-2 px-3 text-slate-400">Strength</th>
              <th className="py-2 px-3 text-slate-400">Price Change</th>
              <th className="py-2 px-3 text-slate-400">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((pred, i) => (
              <tr key={pred.id || i} className="border-b border-slate-800">
                <td className="py-2 px-3 text-slate-300">
                  {new Date(pred.timestamp).toLocaleDateString()}
                </td>
                <td className="py-2 px-3 text-white font-medium">{pred.coin}</td>
                <td className="py-2 px-3 text-slate-300">{pred.projectionType || '12hr'}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    pred.predictedDirection === 'BULLISH' ? 'bg-green-900/50 text-green-400' :
                    pred.predictedDirection === 'BEARISH' ? 'bg-red-900/50 text-red-400' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {pred.predictedDirection}
                  </span>
                </td>
                <td className="py-2 px-3 text-slate-300">{pred.strength}</td>
                <td className="py-2 px-3">
                  {pred.actualPriceChange !== undefined ? (
                    <span className={pred.actualPriceChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {pred.actualPriceChange >= 0 ? '+' : ''}{pred.actualPriceChange.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </td>
                <td className="py-2 px-3">
                  {pred.evaluated ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      pred.outcome === 'correct' ? 'bg-green-900/50 text-green-400' :
                      pred.outcome === 'incorrect' ? 'bg-red-900/50 text-red-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {pred.outcome}
                    </span>
                  ) : (
                    <span className="text-slate-500">pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BacktestPage;
```

**Step 2: Verify file created**

Run: `ls src/pages/BacktestPage.jsx`

**Step 3: Commit**

```bash
git add src/pages/BacktestPage.jsx
git commit -m "feat: create BacktestPage component"
```

---

## Task 6: Add /backtest route

**Files:**
- Modify: `src/main.jsx`

**Step 1: Import BacktestPage**

Add after line 4 (`import App from './App.jsx'`):
```jsx
import BacktestPage from './pages/BacktestPage.jsx'
```

**Step 2: Add the route**

Add before the closing `</Routes>` tag (around line 12):
```jsx
<Route path="/backtest" element={<BacktestPage />} />
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "feat: add /backtest route"
```

---

## Task 7: Create pages directory

**Files:**
- Create: `src/pages/` directory

**Step 1: Ensure directory exists**

Run: `mkdir -p src/pages`

(This may already exist from Task 5)

---

## Task 8: Test end-to-end

**Step 1: Start backend**

Run: `cd server && node server.js`
(In separate terminal)

**Step 2: Start frontend**

Run: `npm run dev`

**Step 3: Visit backtest page**

Open: `http://localhost:5173/backtest`

Expected: Page loads with filter bar and empty state (no predictions yet)

**Step 4: Generate test predictions**

Visit main app and let it poll projections for a few minutes. Then check `/backtest` again.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete backtest page implementation"
```

---

## Summary

7 tasks total:
1. Update winRateTracker (365 days, projection types)
2. Create backtestApi helper module
3. Add backtest routes to server
4. Add backtest API client functions
5. Create BacktestPage component
6. Add /backtest route
7. Test end-to-end
