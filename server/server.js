/**
 * Trader Bias Backend Server
 *
 * Centralized data collection and caching server
 * Optimized for 1GB RAM VPS
 */

const express = require('express');
const cors = require('cors');
const dataStore = require('./dataStore');
const { startDataCollection, getHyperliquidFlow, getBinancePerpFlow, getBybitPerpFlow } = require('./dataCollector');
const { startSpotDataCollection, getSpotCvd, getAllSpotCvd, detectSpotPerpDivergence, getFlow: getBinanceSpotFlow } = require('./spotDataCollector');
const coinbaseSpotCollector = require('./coinbaseSpotCollector');
const bybitSpotCollector = require('./bybitSpotCollector');
const binancePerpCollector = require('./binancePerpCollector');
const bybitPerpCollector = require('./bybitPerpCollector');
const { startEtfFlowCollection, getCollectorStatus: getEtfStatus } = require('./etfFlowCollector');
const liquidationCollector = require('./liquidationCollector');
const liquidationZoneCalculator = require('./liquidationZoneCalculator');
const whaleWatcher = require('./whaleWatcher');
const biasProjection = require('./biasProjection');
const dailyBiasProjection = require('./dailyBiasProjection');
const fourHrBiasProjection = require('./fourHrBiasProjection');
const winRateTracker = require('./winRateTracker');
const backtestApi = require('./backtestApi');
const vwapCalculator = require('./vwapCalculator');
const componentSignals = require('./componentSignals');

const app = express();
const PORT = process.env.PORT || 3001;

// ============== BIAS PROJECTION CACHE ==============
// Cache bias projections to avoid regenerating on every request
// Daily bias: 4hr cache, 12hr bias: 1hr cache
const biasCache = {
  daily: {}, // { BTC: { data: {...}, generatedAt: timestamp }, ... }
  '12hr': {},
  '4hr': {}
};
const CACHE_TTL = {
  daily: 4 * 60 * 60 * 1000,  // 4 hours
  '12hr': 60 * 60 * 1000,     // 1 hour
  '4hr': 30 * 60 * 1000       // 30 minutes
};

// VWAP refresh interval (10 minutes)
const VWAP_REFRESH_MS = 10 * 60 * 1000;

// ============== MIDDLEWARE ==============

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============== API ENDPOINTS ==============

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  const stats = dataStore.getStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: {
      used: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB',
      total: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      dataStore: stats.memoryUsageMB + ' MB'
    },
    dataStore: stats
  });
});

/**
 * Get data for all exchanges (full historical data)
 * GET /api/data/all
 *
 * Returns all exchange data (larger payload)
 * NOTE: This route MUST be defined BEFORE /api/data/:exchange
 */
app.get('/api/data/all', (req, res) => {
  const allData = {
    hyperliquid: dataStore.getExchangeData('hyperliquid'),
    binance: dataStore.getExchangeData('binance'),
    bybit: dataStore.getExchangeData('bybit'),
    nado: dataStore.getExchangeData('nado'),
    asterdex: dataStore.getExchangeData('asterdex')
  };
  res.json(allData);
});

/**
 * Get historical data for a specific exchange
 * GET /api/data/:exchange
 *
 * Returns 4 hours of historical data for all coins
 */
app.get('/api/data/:exchange', (req, res) => {
  const { exchange } = req.params;

  const validExchanges = ['hyperliquid', 'binance', 'bybit', 'nado', 'asterdex'];
  if (!validExchanges.includes(exchange)) {
    return res.status(400).json({
      error: 'Invalid exchange',
      validExchanges
    });
  }

  const data = dataStore.getExchangeData(exchange);
  res.json(data);
});

/**
 * Get current snapshot only (no history) for an exchange
 * GET /api/snapshot/:exchange
 *
 * Returns current values only (faster response, smaller payload)
 */
app.get('/api/snapshot/:exchange', (req, res) => {
  const { exchange } = req.params;

  const validExchanges = ['hyperliquid', 'binance', 'bybit', 'nado', 'asterdex'];
  if (!validExchanges.includes(exchange)) {
    return res.status(400).json({
      error: 'Invalid exchange',
      validExchanges
    });
  }

  const snapshot = dataStore.getCurrentSnapshot(exchange);
  res.json(snapshot);
});

/**
 * Get recent whale trades
 * GET /api/whale-trades
 */
app.get('/api/whale-trades', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const trades = dataStore.getWhaleTrades(limit);
  res.json(trades);
});

/**
 * Get VWAP levels for a coin
 * GET /api/vwap/:coin
 */
app.get('/api/vwap/:coin', (req, res) => {
  const { coin } = req.params;
  const validCoins = ['btc'];

  if (!validCoins.includes(coin.toLowerCase())) {
    return res.status(400).json({
      error: 'Invalid coin',
      validCoins: ['btc']
    });
  }

  const vwapData = dataStore.getVwap(coin.toUpperCase());
  if (!vwapData) {
    return res.status(503).json({
      error: 'VWAP data not yet available',
      message: 'Data is being calculated, try again shortly'
    });
  }

  res.json(vwapData);
});

/**
 * Get server statistics
 * GET /api/stats
 */
app.get('/api/stats', (req, res) => {
  const stats = dataStore.getStats();
  const memUsage = process.memoryUsage();

  res.json({
    server: {
      uptime: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform
    },
    memory: {
      heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
      heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
      external: (memUsage.external / 1024 / 1024).toFixed(2) + ' MB'
    },
    dataStore: stats
  });
});

/**
 * Get 8-12 hour bias projection for a coin
 * GET /api/:coin/projection
 *
 * Returns predictive bias analysis for BTC, ETH, or SOL
 * Cached for 1 hour to preserve accurate generatedAt timestamps
 */
app.get('/api/:coin/projection', (req, res) => {
  const { coin } = req.params;
  const upperCoin = coin.toUpperCase();
  const validCoins = ['btc', 'eth', 'sol'];

  if (!validCoins.includes(coin.toLowerCase())) {
    return res.status(400).json({
      error: 'Invalid coin',
      validCoins: validCoins.map(c => c.toUpperCase())
    });
  }

  try {
    const now = Date.now();
    const cached = biasCache['12hr'][upperCoin];

    // Check if cache is valid
    if (cached && (now - cached.generatedAt) < CACHE_TTL['12hr']) {
      // Return cached projection with updated freshness info
      const projection = { ...cached.data };
      projection.historicalPerformance = winRateTracker.getStats(upperCoin);
      return res.json(projection);
    }

    // Generate new projection
    const projection = biasProjection.generateProjection(upperCoin, dataStore);

    // Cache the projection (only if ACTIVE status)
    if (projection.status === 'ACTIVE') {
      biasCache['12hr'][upperCoin] = {
        data: projection,
        generatedAt: projection.generatedAt || now
      };
      winRateTracker.recordPrediction(upperCoin, projection);

      // Record 4hr composite (same projection, shorter eval window)
      winRateTracker.recordPrediction(upperCoin, projection, '4hr');

      // Record standalone component signals
      const oiSignal = componentSignals.generateOISignal(upperCoin, dataStore);
      if (oiSignal) {
        const oiProjection = componentSignals.formatAsProjection(oiSignal);
        winRateTracker.recordPrediction(upperCoin, oiProjection, 'oi-4hr');
      }

      const cvdSignal = componentSignals.generateCVDSignal(upperCoin, dataStore);
      if (cvdSignal) {
        const cvdProjection = componentSignals.formatAsProjection(cvdSignal);
        winRateTracker.recordPrediction(upperCoin, cvdProjection, 'cvd-2hr');
      }
    }

    // Add win rate stats to response
    projection.historicalPerformance = winRateTracker.getStats(upperCoin);

    res.json(projection);
  } catch (error) {
    console.error('[Projection Error]', error);
    res.status(500).json({
      error: 'Failed to generate projection',
      message: error.message
    });
  }
});

/**
 * Get 4-hour bias projection (BTC only)
 * GET /api/:coin/4hr-bias
 *
 * Returns quick directional bias for scalping/day trading
 * Cached for 30 minutes
 */
app.get('/api/:coin/4hr-bias', (req, res) => {
  const { coin } = req.params;
  const upperCoin = coin.toUpperCase();

  // BTC only
  if (upperCoin !== 'BTC') {
    return res.json({
      error: '4hr Bias available for BTC only',
      coin: upperCoin,
      supported: false
    });
  }

  try {
    const now = Date.now();
    const cached = biasCache['4hr'][upperCoin];

    // Check if cache is valid
    if (cached && (now - cached.generatedAt) < CACHE_TTL['4hr']) {
      return res.json(cached.data);
    }

    // Generate new 4hr bias
    const fourHrBias = fourHrBiasProjection.generate4HrBias(upperCoin, dataStore);

    // Cache the bias (only if ACTIVE status)
    if (fourHrBias.status === 'ACTIVE') {
      biasCache['4hr'][upperCoin] = {
        data: fourHrBias,
        generatedAt: fourHrBias.generatedAt || now
      };
      winRateTracker.recordPrediction(upperCoin, fourHrBias, '4hr-composite');
    }

    res.json(fourHrBias);
  } catch (error) {
    console.error('[4hr Bias Error]', error);
    res.status(500).json({
      error: 'Failed to generate 4hr bias',
      message: error.message
    });
  }
});

/**
 * Get 24-hour Daily Bias projection for a coin
 * GET /api/:coin/daily-bias
 *
 * Returns daily directional bias optimized for day traders
 * Cached for 4 hours to preserve accurate generatedAt timestamps
 */
app.get('/api/:coin/daily-bias', (req, res) => {
  const { coin } = req.params;
  const upperCoin = coin.toUpperCase();
  const validCoins = ['btc', 'eth', 'sol'];

  if (!validCoins.includes(coin.toLowerCase())) {
    return res.status(400).json({
      error: 'Invalid coin',
      validCoins: validCoins.map(c => c.toUpperCase())
    });
  }

  try {
    const now = Date.now();
    const cached = biasCache.daily[upperCoin];

    // Check if cache is valid
    if (cached && (now - cached.generatedAt) < CACHE_TTL.daily) {
      // Return cached daily bias
      return res.json(cached.data);
    }

    // Generate new daily bias
    const dailyBias = dailyBiasProjection.generateDailyBias(upperCoin, dataStore);

    // Cache the bias (only if ACTIVE status)
    if (dailyBias.status === 'ACTIVE') {
      biasCache.daily[upperCoin] = {
        data: dailyBias,
        generatedAt: dailyBias.generatedAt || now
      };
      winRateTracker.recordPrediction(upperCoin, dailyBias, 'daily');
    }

    res.json(dailyBias);
  } catch (error) {
    console.error('[Daily Bias Error]', error);
    res.status(500).json({
      error: 'Failed to generate daily bias',
      message: error.message
    });
  }
});

/**
 * Get liquidation zones for a coin
 * GET /api/:coin/liquidation-zones
 *
 * Returns estimated liquidation cascade zones with:
 * - Long liquidation zone (price level where long cascade triggers)
 * - Short liquidation zone (price level where short squeeze triggers)
 * - Probability assessment (LOW/MEDIUM/HIGH)
 * - OI at risk estimates
 */
app.get('/api/:coin/liquidation-zones', (req, res) => {
  const { coin } = req.params;
  const upperCoin = coin.toUpperCase();
  const validCoins = ['btc', 'eth', 'sol'];

  if (!validCoins.includes(coin.toLowerCase())) {
    return res.status(400).json({
      error: 'Invalid coin',
      validCoins: validCoins.map(c => c.toUpperCase())
    });
  }

  try {
    const zones = liquidationZoneCalculator.calculateLiquidationZones(upperCoin);
    const liqSignal = liquidationCollector.calculateLiquidationSignal(upperCoin);
    const collectorStatus = liquidationCollector.getStatus();

    res.json({
      ...zones,
      realtimeLiquidations: {
        signal: liqSignal.signal,
        velocity: liqSignal.velocity,
        cascade: liqSignal.cascade,
        description: liqSignal.description
      },
      collectorStatus
    });
  } catch (error) {
    console.error('[Liquidation Zones Error]', error);
    res.status(500).json({
      error: 'Failed to calculate liquidation zones',
      message: error.message
    });
  }
});

/**
 * Get win rate statistics for predictions
 * GET /api/win-rates/:coin?
 *
 * Returns historical prediction accuracy stats
 */
app.get('/api/win-rates/:coin?', (req, res) => {
  const { coin } = req.params;

  if (coin) {
    const validCoins = ['BTC', 'ETH', 'SOL'];
    const upperCoin = coin.toUpperCase();
    if (!validCoins.includes(upperCoin)) {
      return res.status(400).json({
        error: 'Invalid coin',
        validCoins
      });
    }
    res.json(winRateTracker.getStats(upperCoin));
  } else {
    // Return all coin stats
    res.json(winRateTracker.getStats());
  }
});

/**
 * Get recent predictions with outcomes
 * GET /api/predictions/:coin?
 *
 * Returns list of recent predictions and their outcomes
 */
app.get('/api/predictions/:coin?', (req, res) => {
  const { coin } = req.params;
  const limit = parseInt(req.query.limit) || 20;

  const predictions = winRateTracker.getRecentPredictions(
    coin ? coin.toUpperCase() : null,
    limit
  );

  res.json({
    count: predictions.length,
    predictions
  });
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Trader Bias Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      data: 'GET /api/data/:exchange',
      snapshot: 'GET /api/snapshot/:exchange',
      whaleTrades: 'GET /api/whale-trades',
      spotCvd: 'GET /api/spot-cvd/:coin?',
      etfFlows: 'GET /api/etf-flows',
      projection: 'GET /api/:coin/projection',
      dailyBias: 'GET /api/:coin/daily-bias',
      winRates: 'GET /api/win-rates/:coin?',
      predictions: 'GET /api/predictions/:coin?',
      all: 'GET /api/data/all',
      stats: 'GET /api/stats'
    },
    exchanges: ['hyperliquid', 'binance', 'bybit', 'nado', 'asterdex']
  });
});

/**
 * Get spot CVD data (from Binance spot trades)
 * GET /api/spot-cvd/:coin?
 * 
 * Returns spot CVD data for comparison with perp CVD
 */
app.get('/api/spot-cvd/:coin?', (req, res) => {
  const { coin } = req.params;

  if (coin) {
    const validCoins = ['BTC', 'ETH', 'SOL'];
    const upperCoin = coin.toUpperCase();
    if (!validCoins.includes(upperCoin)) {
      return res.status(400).json({
        error: 'Invalid coin',
        validCoins
      });
    }

    const spotCvd = getSpotCvd(upperCoin);
    if (!spotCvd) {
      return res.json({
        coin: upperCoin,
        status: 'collecting',
        message: 'Spot CVD data is being collected, please wait...'
      });
    }

    // Get perp CVD for comparison
    const perpCvd = dataStore.getExchangeData('hyperliquid')?.current?.cvd?.[upperCoin];
    const divergence = detectSpotPerpDivergence(upperCoin, perpCvd?.cvdDelta || 0);

    return res.json({
      coin: upperCoin,
      spotCvd,
      perpCvd: perpCvd || null,
      divergence
    });
  }

  // Return all coins
  const allSpotCvd = getAllSpotCvd();
  res.json(allSpotCvd);
});

/**
 * Get per-exchange flow data (buy/sell volumes)
 * GET /api/exchange-flow/:coin?
 *
 * Query params:
 *   window: 5, 15, or 60 (minutes) - defaults to 15
 *
 * Returns spot and perp buy/sell volumes per exchange (BTC only for now)
 */
app.get('/api/exchange-flow/:coin?', (req, res) => {
  const coin = (req.params.coin || 'BTC').toUpperCase();

  if (coin !== 'BTC') {
    return res.status(400).json({
      error: 'Only BTC supported for exchange flow',
      validCoins: ['BTC']
    });
  }

  // Parse window parameter (5, 15, or 60 minutes)
  const windowMinutes = parseInt(req.query.window) || 15;
  const validWindows = [5, 15, 60];
  const windowMs = validWindows.includes(windowMinutes)
    ? windowMinutes * 60 * 1000
    : 15 * 60 * 1000;

  // Get flow data from each collector with the specified window
  const coinbaseFlow = coinbaseSpotCollector.getFlow(windowMs);
  const bybitSpotFlow = bybitSpotCollector.getFlow(windowMs);
  const binanceSpotFlow = getBinanceSpotFlow(windowMs);
  const binancePerpFlow = getBinancePerpFlow(windowMs);
  const bybitPerpFlow = getBybitPerpFlow(windowMs);
  const hyperliquidFlow = getHyperliquidFlow(windowMs);

  res.json({
    coin,
    timestamp: Date.now(),
    window: windowMinutes,
    exchanges: {
      coinbase: {
        spot: coinbaseFlow,
        perp: { buyVol: 0, sellVol: 0, timestamp: Date.now() } // Coinbase has no perp
      },
      binance: {
        spot: binanceSpotFlow,
        perp: binancePerpFlow
      },
      bybit: {
        spot: bybitSpotFlow,
        perp: bybitPerpFlow
      },
      hyperliquid: {
        spot: { buyVol: 0, sellVol: 0, timestamp: Date.now() }, // Hyperliquid has no spot
        perp: hyperliquidFlow
      }
    }
  });
});

/**
 * Get ETF flow data
 * GET /api/etf-flows
 *
 * Returns current ETF flow data from SoSoValue
 */
app.get('/api/etf-flows', (req, res) => {
  const etfData = dataStore.getEtfFlows();
  const status = getEtfStatus();

  res.json({
    status,
    data: etfData,
    history: dataStore.getEtfFlowHistory()
  });
});

/**
 * Get liquidation data
 * GET /api/liquidations/:coin
 *
 * Returns liquidation velocity, cascade detection, and signal
 */
app.get('/api/liquidations/:coin?', (req, res) => {
  const { coin } = req.params;
  const validCoins = ['BTC', 'ETH', 'SOL'];

  if (coin) {
    const upperCoin = coin.toUpperCase();
    if (!validCoins.includes(upperCoin)) {
      return res.status(400).json({ error: 'Invalid coin', validCoins });
    }

    const signal = liquidationCollector.calculateLiquidationSignal(upperCoin);
    const liqs = dataStore.getLiquidations(upperCoin);

    return res.json({
      coin: upperCoin,
      signal,
      recentLiquidations: liqs.slice(-20),
      status: liquidationCollector.getStatus()
    });
  }

  // Return all coins
  const allSignals = {};
  validCoins.forEach(c => {
    allSignals[c] = liquidationCollector.calculateLiquidationSignal(c);
  });

  res.json({
    signals: allSignals,
    status: liquidationCollector.getStatus()
  });
});

// ============== BACKTEST API ENDPOINTS ==============

/**
 * Get filtered predictions for backtest analysis
 * GET /api/backtest/predictions
 */
app.get('/api/backtest/predictions', (req, res) => {
  try {
    const { coin, type, from, to, outcome, limit } = req.query;
    const predictions = backtestApi.filterPredictions({
      coin,
      type,
      from,
      to,
      outcome,
      limit: limit ? parseInt(limit, 10) : 1000
    });
    res.json({
      count: predictions.length,
      predictions
    });
  } catch (error) {
    console.error('[Backtest Error]', error);
    res.status(500).json({ error: 'Failed to fetch predictions', message: error.message });
  }
});

/**
 * Get aggregated backtest statistics
 * GET /api/backtest/stats
 */
app.get('/api/backtest/stats', (req, res) => {
  try {
    const { coin, type, from, to } = req.query;
    const stats = backtestApi.calculateStats({ coin, type, from, to });
    res.json(stats);
  } catch (error) {
    console.error('[Backtest Error]', error);
    res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
  }
});

/**
 * Get equity curve for charting
 * GET /api/backtest/equity-curve
 */
app.get('/api/backtest/equity-curve', (req, res) => {
  try {
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
  } catch (error) {
    console.error('[Backtest Error]', error);
    res.status(500).json({ error: 'Failed to generate equity curve', message: error.message });
  }
});

/**
 * Get win/loss streak analysis
 * GET /api/backtest/streaks
 */
app.get('/api/backtest/streaks', (req, res) => {
  try {
    const { coin, type, from, to } = req.query;
    const streaks = backtestApi.calculateStreaks({ coin, type, from, to });
    res.json(streaks);
  } catch (error) {
    console.error('[Backtest Error]', error);
    res.status(500).json({ error: 'Failed to fetch streaks', message: error.message });
  }
});

// ============== ERROR HANDLING ==============

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// ============== HELPER FUNCTIONS ==============

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
}

// ============== SERVER START ==============

function startServer() {
  // Start data collection workers
  startDataCollection();

  // Start whale watcher
  whaleWatcher.start();

  // Start spot CVD collector (Binance spot trades)
  startSpotDataCollection();

  // Start Coinbase spot collector
  coinbaseSpotCollector.start();

  // Start Bybit spot collector
  bybitSpotCollector.start();

  // Start Binance perp CVD collector
  binancePerpCollector.start();

  // Start Bybit perp CVD collector
  bybitPerpCollector.start();

  // Start ETF flow collector (SoSoValue API)
  startEtfFlowCollection();

  // Start liquidation collector (Binance forced orders)
  liquidationCollector.start();

  // ============== VWAP REFRESH ==============

  async function refreshVwapData() {
    try {
      const vwapData = await vwapCalculator.calculateAllVwaps('BTCUSDT');
      dataStore.updateVwap('BTC', vwapData);
      console.log('[VWAP] BTC VWAP levels updated');
    } catch (error) {
      console.error('[VWAP] Failed to refresh VWAP data:', error.message);
    }
  }

  // Start VWAP refresh
  refreshVwapData(); // Initial fetch
  setInterval(refreshVwapData, VWAP_REFRESH_MS);
  console.log(`[VWAP] Refresh interval started (${VWAP_REFRESH_MS / 1000 / 60} minutes)`);

  // Start Express server
  app.listen(PORT, () => {
    console.log('');
    console.log('================================================');
    console.log('  Trader Bias Backend Server');
    console.log('================================================');
    console.log(`  Server running on port ${PORT}`);
    console.log(`  API URL: http://localhost:${PORT}`);
    console.log('');
    console.log('  Endpoints:');
    console.log(`    Health:   GET http://localhost:${PORT}/api/health`);
    console.log(`    Data:     GET http://localhost:${PORT}/api/data/:exchange`);
    console.log(`    Snapshot: GET http://localhost:${PORT}/api/snapshot/:exchange`);
    console.log(`    SpotCVD:  GET http://localhost:${PORT}/api/spot-cvd/:coin`);
    console.log(`    Stats:    GET http://localhost:${PORT}/api/stats`);
    console.log('');
    console.log('  Exchanges: hyperliquid, binance, bybit, nado, asterdex');
    console.log('================================================');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down gracefully...');
    process.exit(0);
  });
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
