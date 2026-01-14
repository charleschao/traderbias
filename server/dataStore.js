/**
 * In-Memory Data Store for Trader Bias
 *
 * Stores 24 hours of historical data for all exchanges
 * Memory-optimized with circular buffers and automatic cleanup
 * Now with JSON file persistence for Docker restarts
 */

const fs = require('fs');
const path = require('path');

const MAX_HISTORY_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const DATA_FILE = path.join(__dirname, 'data', 'datastore.json');
const SAVE_INTERVAL_MS = 60 * 1000; // Save every 1 minute

class DataStore {
  constructor() {
    this.data = {
      hyperliquid: this.createEmptyExchangeData(),
      binance: this.createEmptyExchangeData(),
      bybit: this.createEmptyExchangeData(),
      nado: this.createEmptyExchangeData(),
      asterdex: this.createEmptyExchangeData(),
      whaleTrades: [],
      // Spot CVD per exchange (for aggregation)
      spotCvd: {
        binance: {
          BTC: { current: null, history: [] },
          ETH: { current: null, history: [] },
          SOL: { current: null, history: [] }
        },
        bybit: {
          BTC: { current: null, history: [] },
          ETH: { current: null, history: [] },
          SOL: { current: null, history: [] }
        },
        coinbase: {
          BTC: { current: null, history: [] },
          ETH: { current: null, history: [] },
          SOL: { current: null, history: [] }
        }
      },
      // ETF flow data from SoSoValue (BTC only)
      etfFlows: {
        lastUpdated: null,
        marketStatus: null,
        today: null,
        history: []  // 7-day rolling history
      },
      // Liquidation data from Binance (for cascade detection)
      liquidations: {
        BTC: [],
        ETH: [],
        SOL: []
      },
      // Per-exchange flow data (buy/sell volumes for spot and perp)
      exchangeFlow: {
        BTC: this.createEmptyExchangeFlow(),
        ETH: this.createEmptyExchangeFlow(),
        SOL: this.createEmptyExchangeFlow()
      },
      // VWAP levels cache
      vwap: {
        BTC: null,
        ETH: null,
        SOL: null
      }
    };

    this.lastUpdate = {
      hyperliquid: null,
      binance: null,
      bybit: null,
      nado: null,
      asterdex: null
    };

    this.isDirty = false; // Track if data has changed since last save

    // Try to load persisted data
    this.loadFromFile();

    // Start cleanup interval (every 10 minutes)
    setInterval(() => this.cleanup(), 10 * 60 * 1000);

    // Start save interval (every 1 minute)
    setInterval(() => this.saveToFile(), SAVE_INTERVAL_MS);

    // Save on process exit
    process.on('SIGTERM', () => this.saveToFile(true));
    process.on('SIGINT', () => this.saveToFile(true));
  }

  createEmptyExchangeData() {
    return {
      oi: { BTC: [], ETH: [], SOL: [] },
      price: { BTC: [], ETH: [], SOL: [] },
      orderbook: { BTC: [], ETH: [], SOL: [] },
      cvd: { BTC: [], ETH: [], SOL: [] },
      funding: { BTC: [], ETH: [], SOL: [] },
      // Current snapshot for quick access
      current: {
        price: { BTC: null, ETH: null, SOL: null },
        oi: { BTC: null, ETH: null, SOL: null },
        funding: { BTC: null, ETH: null, SOL: null },
        orderbook: { BTC: null, ETH: null, SOL: null },
        cvd: { BTC: null, ETH: null, SOL: null }
      }
    };
  }

  createEmptyExchangeFlow() {
    return {
      coinbase: { spot: null },
      binance: { spot: null, perp: null },
      bybit: { spot: null, perp: null },
      hyperliquid: { perp: null }
    };
  }

  /**
   * Load data from JSON file
   */
  loadFromFile() {
    try {
      if (!fs.existsSync(DATA_FILE)) {
        console.log('[DataStore] No persisted data found, starting fresh');
        return;
      }

      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const saved = JSON.parse(raw);

      if (!saved || !saved.data) {
        console.log('[DataStore] Invalid persisted data format, starting fresh');
        return;
      }

      // Restore data
      const now = Date.now();
      const cutoff = now - MAX_HISTORY_AGE_MS;
      let restoredPoints = 0;
      let expiredPoints = 0;

      // Merge saved data, filtering out expired entries
      Object.keys(saved.data).forEach(exchange => {
        if (exchange === 'whaleTrades') {
          // Restore whale trades (keep last 100)
          this.data.whaleTrades = (saved.data.whaleTrades || []).slice(0, 100);
          return;
        }

        if (!this.data[exchange]) return;

        ['BTC', 'ETH', 'SOL'].forEach(coin => {
          // Restore price data
          if (saved.data[exchange]?.price?.[coin]) {
            const fresh = saved.data[exchange].price[coin].filter(e => e.timestamp >= cutoff);
            expiredPoints += saved.data[exchange].price[coin].length - fresh.length;
            this.data[exchange].price[coin] = fresh;
            restoredPoints += fresh.length;
          }

          // Restore OI data
          if (saved.data[exchange]?.oi?.[coin]) {
            const fresh = saved.data[exchange].oi[coin].filter(e => e.timestamp >= cutoff);
            expiredPoints += saved.data[exchange].oi[coin].length - fresh.length;
            this.data[exchange].oi[coin] = fresh;
            restoredPoints += fresh.length;
          }

          // Restore CVD data
          if (saved.data[exchange]?.cvd?.[coin]) {
            const fresh = saved.data[exchange].cvd[coin].filter(e => e.time >= cutoff);
            expiredPoints += saved.data[exchange].cvd[coin].length - fresh.length;
            this.data[exchange].cvd[coin] = fresh;
            restoredPoints += fresh.length;
          }

          // Restore funding data
          if (saved.data[exchange]?.funding?.[coin]) {
            const fresh = saved.data[exchange].funding[coin].filter(e => e.timestamp >= cutoff);
            expiredPoints += saved.data[exchange].funding[coin].length - fresh.length;
            this.data[exchange].funding[coin] = fresh;
            restoredPoints += fresh.length;
          }

          // Restore orderbook data
          if (saved.data[exchange]?.orderbook?.[coin]) {
            const fresh = saved.data[exchange].orderbook[coin].filter(e => e.timestamp >= cutoff);
            expiredPoints += saved.data[exchange].orderbook[coin].length - fresh.length;
            this.data[exchange].orderbook[coin] = fresh;
            restoredPoints += fresh.length;
          }

          // Restore current values if available
          if (saved.data[exchange]?.current) {
            this.data[exchange].current = saved.data[exchange].current;
          }
        });
      });

      // Restore lastUpdate timestamps
      if (saved.lastUpdate) {
        this.lastUpdate = { ...this.lastUpdate, ...saved.lastUpdate };
      }

      const savedAt = saved.savedAt ? new Date(saved.savedAt).toISOString() : 'unknown';
      console.log(`[DataStore] ✓ Restored ${restoredPoints} data points (${expiredPoints} expired) from ${savedAt}`);

    } catch (error) {
      console.error('[DataStore] Error loading persisted data:', error.message);
    }
  }

  /**
   * Save data to JSON file
   */
  saveToFile(force = false) {
    if (!this.isDirty && !force) return;

    try {
      // Ensure data directory exists
      const dataDir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const saveData = {
        savedAt: Date.now(),
        data: this.data,
        lastUpdate: this.lastUpdate
      };

      fs.writeFileSync(DATA_FILE, JSON.stringify(saveData), 'utf8');
      this.isDirty = false;

      const stats = this.getStats();
      console.log(`[DataStore] ✓ Saved ${stats.totalDataPoints} data points to disk`);

    } catch (error) {
      console.error('[DataStore] Error saving data:', error.message);
    }
  }

  /**
   * Add price data point
   */
  addPrice(exchange, coin, value) {
    const timestamp = Date.now();
    this.data[exchange].price[coin].push({ timestamp, value: parseFloat(value) });
    this.data[exchange].current.price[coin] = parseFloat(value);
    this.lastUpdate[exchange] = timestamp;
    this.isDirty = true;
  }

  /**
   * Add OI data point
   */
  addOI(exchange, coin, value) {
    const timestamp = Date.now();
    this.data[exchange].oi[coin].push({ timestamp, value: parseFloat(value) });
    this.data[exchange].current.oi[coin] = parseFloat(value);
    this.lastUpdate[exchange] = timestamp;
    this.isDirty = true;
  }

  /**
   * Add funding rate data point
   */
  addFunding(exchange, coin, rate) {
    const timestamp = Date.now();
    this.data[exchange].funding[coin].push({ timestamp, rate: parseFloat(rate) });
    this.data[exchange].current.funding[coin] = parseFloat(rate);
    this.lastUpdate[exchange] = timestamp;
    this.isDirty = true;
  }

  /**
   * Add orderbook imbalance data point
   */
  addOrderbook(exchange, coin, imbalance, bidDepth = 0, askDepth = 0) {
    const timestamp = Date.now();
    this.data[exchange].orderbook[coin].push({
      timestamp,
      imbalance: parseFloat(imbalance),
      bidDepth: parseFloat(bidDepth),
      askDepth: parseFloat(askDepth)
    });
    this.data[exchange].current.orderbook[coin] = {
      imbalance: parseFloat(imbalance),
      bidDepth: parseFloat(bidDepth),
      askDepth: parseFloat(askDepth)
    };
    this.lastUpdate[exchange] = timestamp;
    this.isDirty = true;
  }

  /**
   * Add CVD data point
   */
  addCVD(exchange, coin, delta) {
    const timestamp = Date.now();
    this.data[exchange].cvd[coin].push({ time: timestamp, delta: parseFloat(delta) });
    this.data[exchange].current.cvd[coin] = parseFloat(delta);
    this.lastUpdate[exchange] = timestamp;
    this.isDirty = true;
  }

  /**
   * Add a whale trade
   */
  addWhaleTrade(trade) {
    // Dedupe
    const exists = this.data.whaleTrades.some(t =>
      t.exchange === trade.exchange &&
      t.tradeId === trade.tradeId &&
      t.symbol === trade.symbol
    );
    if (exists) return;

    // Add to front
    this.data.whaleTrades.unshift(trade);

    // Keep max 500
    if (this.data.whaleTrades.length > 500) {
      this.data.whaleTrades = this.data.whaleTrades.slice(0, 500);
    }

    this.isDirty = true;
  }

  /**
   * Get recent whale trades
   */
  getWhaleTrades(limit = 100) {
    return this.data.whaleTrades.slice(0, limit);
  }

  /**
   * Get exchange data
   */
  getExchangeData(exchange) {
    if (!this.data[exchange]) {
      return this.createEmptyExchangeData();
    }
    return {
      ...this.data[exchange],
      lastUpdate: this.lastUpdate[exchange]
    };
  }

  /**
   * Get current snapshot only (no history)
   */
  getCurrentSnapshot(exchange) {
    if (!this.data[exchange]) {
      return null;
    }
    return {
      current: this.data[exchange].current,
      lastUpdate: this.lastUpdate[exchange]
    };
  }

  /**
   * Update spot CVD data for a specific exchange
   * @param {string} exchange - binance, bybit, coinbase
   * @param {string} coin - BTC, ETH, SOL
   * @param {object} cvdData - CVD data with delta field
   */
  updateSpotCvd(exchange, coin, cvdData) {
    if (!this.data.spotCvd[exchange]) {
      console.warn(`[DataStore] Unknown exchange for spot CVD: ${exchange}`);
      return;
    }
    if (!this.data.spotCvd[exchange][coin]) {
      console.warn(`[DataStore] Unknown coin for spot CVD: ${coin}`);
      return;
    }

    this.data.spotCvd[exchange][coin].current = cvdData;
    this.data.spotCvd[exchange][coin].history.push({
      ...cvdData,
      time: Date.now()
    });

    // Keep history bounded (6 hours of 5-second samples = 4320 entries)
    if (this.data.spotCvd[exchange][coin].history.length > 5000) {
      this.data.spotCvd[exchange][coin].history = this.data.spotCvd[exchange][coin].history.slice(-4320);
    }

    this.isDirty = true;
  }

  /**
   * Get spot CVD data for a coin from a specific exchange
   */
  getSpotCvd(exchange, coin) {
    if (!this.data.spotCvd[exchange]?.[coin]) {
      return null;
    }
    return this.data.spotCvd[exchange][coin].current;
  }

  /**
   * Get spot CVD history for a coin from a specific exchange
   */
  getSpotCvdHistory(exchange, coin) {
    if (!this.data.spotCvd[exchange]?.[coin]) {
      return [];
    }
    return this.data.spotCvd[exchange][coin].history || [];
  }

  /**
   * Get aggregated spot CVD history across all spot exchanges
   * Merges Binance, Bybit, Coinbase spot CVD into time-bucketed deltas
   * @param {string} coin - BTC, ETH, SOL
   * @returns {Array} - [{ time, delta }, ...] aggregated across exchanges
   */
  getAggregatedSpotCvdHistory(coin) {
    const exchanges = ['binance', 'bybit', 'coinbase'];
    const bucketMs = 5000; // 5-second buckets
    const buckets = new Map();

    for (const exchange of exchanges) {
      const history = this.data.spotCvd[exchange]?.[coin]?.history || [];
      for (const entry of history) {
        if (!entry || !entry.time) continue;
        const bucketKey = Math.floor(entry.time / bucketMs) * bucketMs;
        const existing = buckets.get(bucketKey) || { time: bucketKey, delta: 0 };
        existing.delta += entry.delta || 0;
        buckets.set(bucketKey, existing);
      }
    }

    return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Get aggregated perp CVD history across all perp exchanges
   * Merges Hyperliquid, Binance, Bybit perp CVD into time-bucketed deltas
   * @param {string} coin - BTC, ETH, SOL
   * @returns {Array} - [{ time, delta }, ...] aggregated across exchanges
   */
  getAggregatedPerpCvdHistory(coin) {
    const exchanges = ['hyperliquid', 'binance', 'bybit'];
    const bucketMs = 5000; // 5-second buckets
    const buckets = new Map();

    for (const exchange of exchanges) {
      const history = this.data[exchange]?.cvd?.[coin] || [];
      for (const entry of history) {
        if (!entry || !entry.time) continue;
        const bucketKey = Math.floor(entry.time / bucketMs) * bucketMs;
        const existing = buckets.get(bucketKey) || { time: bucketKey, delta: 0 };
        existing.delta += entry.delta || 0;
        buckets.set(bucketKey, existing);
      }
    }

    return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Get all spot CVD data (current values from all exchanges)
   */
  getAllSpotCvd() {
    const result = {};
    for (const coin of ['BTC', 'ETH', 'SOL']) {
      result[coin] = {
        binance: this.data.spotCvd.binance[coin]?.current,
        bybit: this.data.spotCvd.bybit[coin]?.current,
        coinbase: this.data.spotCvd.coinbase[coin]?.current
      };
    }
    return result;
  }

  /**
   * Update ETF flow data (from SoSoValue)
   */
  updateEtfFlows(etfData) {
    if (!etfData) return;

    this.data.etfFlows.lastUpdated = etfData.lastUpdated || Date.now();
    this.data.etfFlows.marketStatus = etfData.marketStatus || null;
    this.data.etfFlows.today = etfData.today || null;

    // Add to history (keep 7 days)
    if (etfData.today && etfData.today.netFlow !== undefined) {
      const historyEntry = {
        date: new Date().toISOString().split('T')[0],
        netFlow: etfData.today.netFlow,
        timestamp: Date.now()
      };

      // Avoid duplicate entries for same day
      const existingIndex = this.data.etfFlows.history.findIndex(
        h => h.date === historyEntry.date
      );

      if (existingIndex >= 0) {
        this.data.etfFlows.history[existingIndex] = historyEntry;
      } else {
        this.data.etfFlows.history.push(historyEntry);
      }

      // Keep only last 7 days
      if (this.data.etfFlows.history.length > 7) {
        this.data.etfFlows.history = this.data.etfFlows.history.slice(-7);
      }
    }

    this.isDirty = true;
  }

  /**
   * Get ETF flow data
   */
  getEtfFlows() {
    return this.data.etfFlows;
  }

  /**
   * Get ETF flow history (7 days)
   */
  getEtfFlowHistory() {
    return this.data.etfFlows.history || [];
  }

  /**
   * Add a liquidation event
   */
  addLiquidation(liq) {
    const coin = liq.symbol;
    if (!this.data.liquidations[coin]) return;

    this.data.liquidations[coin].push(liq);

    // Keep 2 hours of data (max 1000 entries per coin)
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    this.data.liquidations[coin] = this.data.liquidations[coin]
      .filter(l => l.timestamp >= twoHoursAgo)
      .slice(-1000);

    this.isDirty = true;
  }

  /**
   * Get liquidations for a coin
   */
  getLiquidations(coin) {
    if (!this.data.liquidations[coin]) return [];
    return this.data.liquidations[coin];
  }

  /**
   * Update exchange flow data (buy/sell volumes)
   * @param {string} coin - BTC, ETH, SOL
   * @param {string} exchange - coinbase, binance, bybit, hyperliquid
   * @param {string} type - spot or perp
   * @param {object} flowData - { buyVol, sellVol, timestamp }
   */
  updateExchangeFlow(coin, exchange, type, flowData) {
    if (!this.data.exchangeFlow[coin]) {
      console.warn(`[DataStore] Unknown coin for exchange flow: ${coin}`);
      return;
    }
    if (!this.data.exchangeFlow[coin][exchange]) {
      console.warn(`[DataStore] Unknown exchange for flow: ${exchange}`);
      return;
    }

    this.data.exchangeFlow[coin][exchange][type] = {
      buyVol: flowData.buyVol || 0,
      sellVol: flowData.sellVol || 0,
      timestamp: flowData.timestamp || Date.now()
    };
    this.isDirty = true;
  }

  /**
   * Get exchange flow for a coin (all exchanges)
   */
  getExchangeFlow(coin) {
    if (!this.data.exchangeFlow[coin]) {
      return this.createEmptyExchangeFlow();
    }
    return this.data.exchangeFlow[coin];
  }

  /**
   * Get all exchange flow data
   */
  getAllExchangeFlow() {
    return this.data.exchangeFlow;
  }

  /**
   * Update VWAP levels for a coin
   */
  updateVwap(coin, vwapData) {
    if (this.data.vwap[coin] === undefined) {
      console.warn(`[DataStore] Unknown coin for VWAP: ${coin}`);
      return;
    }
    this.data.vwap[coin] = {
      ...vwapData,
      updatedAt: Date.now()
    };
    this.isDirty = true;
  }

  /**
   * Get VWAP levels for a coin
   */
  getVwap(coin) {
    return this.data.vwap[coin] || null;
  }

  /**
   * Cleanup old data points (older than 24 hours)
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - MAX_HISTORY_AGE_MS;

    let totalRemoved = 0;

    const exchanges = ['hyperliquid', 'binance', 'bybit', 'nado', 'asterdex'];
    exchanges.forEach(exchange => {
      if (!this.data[exchange]) return;
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        // Clean price
        const priceBefore = this.data[exchange].price[coin].length;
        this.data[exchange].price[coin] = this.data[exchange].price[coin].filter(e => e.timestamp >= cutoff);
        totalRemoved += priceBefore - this.data[exchange].price[coin].length;

        // Clean OI
        const oiBefore = this.data[exchange].oi[coin].length;
        this.data[exchange].oi[coin] = this.data[exchange].oi[coin].filter(e => e.timestamp >= cutoff);
        totalRemoved += oiBefore - this.data[exchange].oi[coin].length;

        // Clean orderbook
        const obBefore = this.data[exchange].orderbook[coin].length;
        this.data[exchange].orderbook[coin] = this.data[exchange].orderbook[coin].filter(e => e.timestamp >= cutoff);
        totalRemoved += obBefore - this.data[exchange].orderbook[coin].length;

        // Clean CVD
        const cvdBefore = this.data[exchange].cvd[coin].length;
        this.data[exchange].cvd[coin] = this.data[exchange].cvd[coin].filter(e => e.time >= cutoff);
        totalRemoved += cvdBefore - this.data[exchange].cvd[coin].length;

        // Clean funding
        const fundingBefore = this.data[exchange].funding[coin].length;
        this.data[exchange].funding[coin] = this.data[exchange].funding[coin].filter(e => e.timestamp >= cutoff);
        totalRemoved += fundingBefore - this.data[exchange].funding[coin].length;
      });
    });

    if (totalRemoved > 0) {
      console.log(`[DataStore] Cleanup: Removed ${totalRemoved} old data points`);
      this.isDirty = true;
    }
  }

  /**
   * Get memory usage statistics
   */
  getStats() {
    const EXCHANGES = ['hyperliquid', 'binance', 'bybit', 'nado', 'asterdex'];
    let totalDataPoints = 0;

    EXCHANGES.forEach(exchange => {
      if (!this.data[exchange]?.price) return;
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        totalDataPoints += this.data[exchange].price[coin]?.length || 0;
        totalDataPoints += this.data[exchange].oi[coin]?.length || 0;
        totalDataPoints += this.data[exchange].orderbook[coin]?.length || 0;
        totalDataPoints += this.data[exchange].cvd[coin]?.length || 0;
        totalDataPoints += this.data[exchange].funding[coin]?.length || 0;
      });
    });

    const memoryUsageBytes = totalDataPoints * 66; // Approximate 66 bytes per data point
    const memoryUsageMB = (memoryUsageBytes / (1024 * 1024)).toFixed(2);

    return {
      totalDataPoints,
      memoryUsageMB,
      persistenceFile: DATA_FILE,
      exchanges: EXCHANGES
        .filter(ex => this.data[ex]?.price)
        .map(ex => ({
          name: ex,
          lastUpdate: this.lastUpdate[ex] ? new Date(this.lastUpdate[ex]).toISOString() : 'Never',
          dataPoints: ['BTC', 'ETH', 'SOL'].reduce((sum, coin) => {
            return sum +
              (this.data[ex].price[coin]?.length || 0) +
              (this.data[ex].oi[coin]?.length || 0) +
              (this.data[ex].orderbook[coin]?.length || 0) +
              (this.data[ex].cvd[coin]?.length || 0) +
              (this.data[ex].funding[coin]?.length || 0);
          }, 0)
        }))
    };
  }
}

// Singleton instance
const dataStore = new DataStore();

module.exports = dataStore;
