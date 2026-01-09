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
      // Spot CVD from Binance (separate from perp data)
      spotCvd: {
        BTC: { current: null, history: [] },
        ETH: { current: null, history: [] },
        SOL: { current: null, history: [] }
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
   * Update spot CVD data (from Binance spot trades)
   */
  updateSpotCvd(coin, cvdData) {
    if (!this.data.spotCvd[coin]) {
      console.warn(`[DataStore] Unknown coin for spot CVD: ${coin}`);
      return;
    }

    this.data.spotCvd[coin].current = cvdData;
    this.data.spotCvd[coin].history.push({
      ...cvdData,
      timestamp: Date.now()
    });

    // Keep history bounded (1 hour of 5-second samples = 720 entries)
    if (this.data.spotCvd[coin].history.length > 800) {
      this.data.spotCvd[coin].history = this.data.spotCvd[coin].history.slice(-720);
    }

    this.isDirty = true;
  }

  /**
   * Get spot CVD data for a coin
   */
  getSpotCvd(coin) {
    if (!this.data.spotCvd[coin]) {
      return null;
    }
    return this.data.spotCvd[coin].current;
  }

  /**
   * Get all spot CVD data
   */
  getAllSpotCvd() {
    return {
      BTC: this.data.spotCvd.BTC.current,
      ETH: this.data.spotCvd.ETH.current,
      SOL: this.data.spotCvd.SOL.current
    };
  }

  /**
   * Cleanup old data points (older than 24 hours)
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - MAX_HISTORY_AGE_MS;

    let totalRemoved = 0;

    Object.keys(this.data).forEach(exchange => {
      if (exchange === 'whaleTrades') return;
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
    let totalDataPoints = 0;

    Object.keys(this.data).forEach(exchange => {
      if (exchange === 'whaleTrades') return;
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        totalDataPoints += this.data[exchange].price[coin].length;
        totalDataPoints += this.data[exchange].oi[coin].length;
        totalDataPoints += this.data[exchange].orderbook[coin].length;
        totalDataPoints += this.data[exchange].cvd[coin].length;
        totalDataPoints += this.data[exchange].funding[coin].length;
      });
    });

    const memoryUsageBytes = totalDataPoints * 66; // Approximate 66 bytes per data point
    const memoryUsageMB = (memoryUsageBytes / (1024 * 1024)).toFixed(2);

    return {
      totalDataPoints,
      memoryUsageMB,
      persistenceFile: DATA_FILE,
      exchanges: Object.keys(this.data)
        .filter(ex => ex !== 'whaleTrades')
        .map(ex => ({
          name: ex,
          lastUpdate: this.lastUpdate[ex] ? new Date(this.lastUpdate[ex]).toISOString() : 'Never',
          dataPoints: ['BTC', 'ETH', 'SOL'].reduce((sum, coin) => {
            return sum +
              this.data[ex].price[coin].length +
              this.data[ex].oi[coin].length +
              this.data[ex].orderbook[coin].length +
              this.data[ex].cvd[coin].length +
              this.data[ex].funding[coin].length;
          }, 0)
        }))
    };
  }
}

// Singleton instance
const dataStore = new DataStore();

module.exports = dataStore;
