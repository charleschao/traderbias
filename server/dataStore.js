/**
 * In-Memory Data Store for Trader Bias
 *
 * Stores 4 hours of historical data for all exchanges
 * Memory-optimized with circular buffers and automatic cleanup
 */

const MAX_HISTORY_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

class DataStore {
  constructor() {
    this.data = {
      hyperliquid: this.createEmptyExchangeData(),
      binance: this.createEmptyExchangeData(),
      bybit: this.createEmptyExchangeData(),
      nado: this.createEmptyExchangeData(),
      asterdex: this.createEmptyExchangeData()
    };

    this.lastUpdate = {
      hyperliquid: null,
      binance: null,
      bybit: null,
      nado: null,
      asterdex: null
    };

    // Start cleanup interval (every 10 minutes)
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
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
   * Add price data point
   */
  addPrice(exchange, coin, value) {
    const timestamp = Date.now();
    this.data[exchange].price[coin].push({ timestamp, value: parseFloat(value) });
    this.data[exchange].current.price[coin] = parseFloat(value);
    this.lastUpdate[exchange] = timestamp;
  }

  /**
   * Add OI data point
   */
  addOI(exchange, coin, value) {
    const timestamp = Date.now();
    this.data[exchange].oi[coin].push({ timestamp, value: parseFloat(value) });
    this.data[exchange].current.oi[coin] = parseFloat(value);
    this.lastUpdate[exchange] = timestamp;
  }

  /**
   * Add funding rate data point
   */
  addFunding(exchange, coin, rate) {
    const timestamp = Date.now();
    this.data[exchange].funding[coin].push({ timestamp, rate: parseFloat(rate) });
    this.data[exchange].current.funding[coin] = parseFloat(rate);
    this.lastUpdate[exchange] = timestamp;
  }

  /**
   * Add orderbook imbalance data point
   */
  addOrderbook(exchange, coin, imbalance) {
    const timestamp = Date.now();
    this.data[exchange].orderbook[coin].push({ timestamp, imbalance: parseFloat(imbalance) });
    this.data[exchange].current.orderbook[coin] = parseFloat(imbalance);
    this.lastUpdate[exchange] = timestamp;
  }

  /**
   * Add CVD data point
   */
  addCVD(exchange, coin, delta) {
    const timestamp = Date.now();
    this.data[exchange].cvd[coin].push({ time: timestamp, delta: parseFloat(delta) });
    this.data[exchange].current.cvd[coin] = parseFloat(delta);
    this.lastUpdate[exchange] = timestamp;
  }

  /**
   * Get all historical data for an exchange
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
   * Cleanup old data points (older than 4 hours)
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - MAX_HISTORY_AGE_MS;

    let totalRemoved = 0;

    Object.keys(this.data).forEach(exchange => {
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
    }
  }

  /**
   * Get memory usage statistics
   */
  getStats() {
    let totalDataPoints = 0;

    Object.keys(this.data).forEach(exchange => {
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
      exchanges: Object.keys(this.data).map(ex => ({
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
