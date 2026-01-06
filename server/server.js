/**
 * Trader Bias Backend Server
 *
 * Centralized data collection and caching server
 * Optimized for 1GB RAM VPS
 */

const express = require('express');
const cors = require('cors');
const dataStore = require('./dataStore');
const { startDataCollection } = require('./dataCollector');

const app = express();
const PORT = process.env.PORT || 3001;

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
 * Get data for all exchanges (full historical data)
 * GET /api/data/all
 *
 * Returns all exchange data (larger payload)
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
      all: 'GET /api/data/all',
      stats: 'GET /api/stats'
    },
    exchanges: ['hyperliquid', 'binance', 'bybit', 'nado', 'asterdex']
  });
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
