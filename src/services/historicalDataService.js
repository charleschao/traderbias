// ============== HISTORICAL DATA SERVICE ==============
// Data collection and management for backtesting

import { createBacktestConfig } from '../utils/backtestEngine.js';

// ============== CONFIGURATION ==============

export const HISTORICAL_DATA_SOURCES = {
    // Primary sources for real historical data
    hyperliquid: {
        name: 'Hyperliquid',
        baseUrl: 'https://api.hyperliquid.xyz',
        endpoints: {
            candles: '/info/candles',
            trades: '/info/trades',
            funding: '/info/funding',
            openInterest: '/info/openinterest'
        },
        features: ['price', 'volume', 'funding', 'oi'],
        resolution: ['1m', '5m', '15m', '1h', '4h', '1d']
    },

    // Alternative sources
    binance: {
        name: 'Binance Futures',
        baseUrl: 'https://fapi.binance.com',
        endpoints: {
            klines: '/fapi/v1/klines',
            funding: '/fapi/v1/fundingRate',
            openInterest: '/fapi/v1/openInterest'
        },
        features: ['price', 'volume', 'funding', 'oi'],
        resolution: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']
    },

    // For whale data
    nado: {
        name: 'Nado',
        baseUrl: 'https://archive.prod.nado.xyz',
        endpoints: {
            trades: '/v1/trades',
            liquidations: '/v1/liquidations'
        },
        features: ['trades', 'liquidations'],
        whaleThreshold: 4000000 // $4M+
    }
};

export const SUPPORTED_COINS = {
    BTC: {
        symbol: 'BTC',
        exchanges: ['hyperliquid', 'binance'],
        decimals: 1,
        minTick: 0.1
    },
    ETH: {
        symbol: 'ETH',
        exchanges: ['hyperliquid', 'binance'],
        decimals: 2,
        minTick: 0.01
    },
    SOL: {
        symbol: 'SOL',
        exchanges: ['hyperliquid', 'binance'],
        decimals: 2,
        minTick: 0.01
    }
};

// ============== DATA COLLECTION SERVICE ==============

class HistoricalDataService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.isCollecting = false;
        this.collectionProgress = null;
    }

    // Main method to collect historical data
    async collectHistoricalData(startDate, endDate, coins = Object.keys(SUPPORTED_COINS), resolution = '5m') {
        const cacheKey = `${startDate}-${endDate}-${coins.join(',')}-${resolution}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log('📊 Using cached historical data');
                return cached.data;
            }
        }

        if (this.isCollecting) {
            throw new Error('Data collection already in progress');
        }

        this.isCollecting = true;
        this.collectionProgress = { total: 0, completed: 0, current: 'Starting...' };

        try {
            console.log('📊 Starting historical data collection...');

            const allData = [];
            const interval = this.getIntervalMs(resolution);
            let currentTimestamp = startDate;

            while (currentTimestamp <= endDate) {
                this.collectionProgress.current = `Collecting data for ${new Date(currentTimestamp).toLocaleDateString()}`;

                const timePointData = await this.collectTimePointData(currentTimestamp, coins, resolution);

                if (timePointData) {
                    allData.push({
                        timestamp: currentTimestamp,
                        data: timePointData
                    });
                }

                currentTimestamp += interval;
                this.collectionProgress.completed++;

                // Update progress
                const totalPoints = Math.floor((endDate - startDate) / interval);
                this.collectionProgress.total = totalPoints;

                // Yield control to prevent blocking
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            // Cache the results
            this.cache.set(cacheKey, {
                data: allData,
                timestamp: Date.now()
            });

            // Also store in localStorage for persistence
            this.storeInLocalStorage(allData, cacheKey);

            console.log(`✅ Collected ${allData.length} data points`);
            return allData;

        } catch (error) {
            console.error('❌ Data collection failed:', error);
            throw error;
        } finally {
            this.isCollecting = false;
            this.collectionProgress = null;
        }
    }

    // Collect data for a specific time point
    async collectTimePointData(timestamp, coins, resolution) {
        const timePointData = {};

        for (const coin of coins) {
            const coinConfig = SUPPORTED_COINS[coin];
            if (!coinConfig) continue;

            try {
                // Collect from multiple sources and merge
                const hyperliquidData = await this.collectFromHyperliquid(coin, timestamp, resolution);
                const binanceData = await this.collectFromBinance(coin, timestamp, resolution);

                // Merge data (prefer Hyperliquid for primary data)
                const mergedData = this.mergeDataSources(hyperliquidData, binanceData);

                if (mergedData) {
                    timePointData[coin] = mergedData;
                }

            } catch (error) {
                console.warn(`Failed to collect data for ${coin} at ${timestamp}:`, error);
                // Continue with other coins
            }
        }

        return Object.keys(timePointData).length > 0 ? timePointData : null;
    }

    // Collect from Hyperliquid
    async collectFromHyperliquid(coin, timestamp, resolution) {
        try {
            // Convert timestamp to Hyperliquid format
            const endTime = Math.floor(timestamp / 1000);
            const startTime = endTime - this.getIntervalSeconds(resolution);

            const response = await fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'candle',
                    coin: coin,
                    interval: resolution,
                    startTime: startTime * 1000,
                    endTime: endTime * 1000
                })
            });

            if (!response.ok) {
                throw new Error(`Hyperliquid API error: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.length > 0) {
                const candle = data[0];
                return {
                    price: candle.close,
                    priceChange: ((candle.close - candle.open) / candle.open) * 100,
                    volume: candle.volume,
                    high: candle.high,
                    low: candle.low,
                    open: candle.open,
                    close: candle.close,
                    source: 'hyperliquid'
                };
            }

        } catch (error) {
            console.warn(`Hyperliquid data collection failed for ${coin}:`, error);
        }

        return null;
    }

    // Collect from Binance
    async collectFromBinance(coin, timestamp, resolution) {
        try {
            const symbol = `${coin}USDT`;
            const interval = this.mapResolutionToBinance(resolution);

            // Convert timestamp to Binance format
            const endTime = Math.floor(timestamp / 1000) * 1000;
            const startTime = endTime - this.getIntervalSeconds(resolution) * 1000;

            const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Binance API error: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.length > 0) {
                const kline = data[0];
                return {
                    price: parseFloat(kline[4]),
                    priceChange: ((parseFloat(kline[4]) - parseFloat(kline[1])) / parseFloat(kline[1])) * 100,
                    volume: parseFloat(kline[5]),
                    high: parseFloat(kline[2]),
                    low: parseFloat(kline[3]),
                    open: parseFloat(kline[1]),
                    close: parseFloat(kline[4]),
                    source: 'binance'
                };
            }

        } catch (error) {
            console.warn(`Binance data collection failed for ${coin}:`, error);
        }

        return null;
    }

    // Collect funding rate data
    async collectFundingData(coin, timestamp) {
        try {
            // Try Hyperliquid first
            const hyperliquidFunding = await this.getHyperliquidFunding(coin, timestamp);
            if (hyperliquidFunding) return hyperliquidFunding;

            // Fallback to Binance
            const binanceFunding = await this.getBinanceFunding(coin, timestamp);
            return binanceFunding;

        } catch (error) {
            console.warn(`Funding data collection failed for ${coin}:`, error);
            return null;
        }
    }

    // Get Hyperliquid funding rate
    async getHyperliquidFunding(coin, timestamp) {
        try {
            const response = await fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'funding',
                    coin: coin
                })
            });

            if (!response.ok) return null;

            const data = await response.json();
            if (data && data.length > 0) {
                // Find the funding rate closest to our timestamp
                const closest = data.reduce((prev, curr) => {
                    return Math.abs(curr.time - timestamp) < Math.abs(prev.time - timestamp) ? curr : prev;
                });

                return {
                    rate: closest.fundingRate,
                    timestamp: closest.time,
                    source: 'hyperliquid'
                };
            }

        } catch (error) {
            console.warn(`Hyperliquid funding data failed:`, error);
        }

        return null;
    }

    // Get Binance funding rate
    async getBinanceFunding(coin, timestamp) {
        try {
            const symbol = `${coin}USDT`;
            const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`;

            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    rate: parseFloat(data[0].fundingRate),
                    timestamp: data[0].fundingTime,
                    source: 'binance'
                };
            }

        } catch (error) {
            console.warn(`Binance funding data failed:`, error);
        }

        return null;
    }

    // Merge data from multiple sources
    mergeDataSources(primary, secondary) {
        if (!primary && !secondary) return null;
        if (!secondary) return primary;
        if (!primary) return secondary;

        // Merge with preference for primary source
        return {
            ...primary,
            ...secondary, // Secondary source fills gaps
            sources: [primary.source, secondary.source].filter(Boolean)
        };
    }

    // Store data in localStorage
    storeInLocalStorage(data, key) {
        try {
            const storageKey = `traderBias_historical_${key}`;
            const compressed = this.compressData(data);
            localStorage.setItem(storageKey, JSON.stringify(compressed));
        } catch (error) {
            console.warn('Failed to store data in localStorage:', error);
        }
    }

    // Load data from localStorage
    loadFromLocalStorage(key) {
        try {
            const storageKey = `traderBias_historical_${key}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const compressed = JSON.parse(stored);
                return this.decompressData(compressed);
            }
        } catch (error) {
            console.warn('Failed to load data from localStorage:', error);
        }
        return null;
    }

    // Compress data for storage
    compressData(data) {
        // Simple compression - remove redundant fields and round numbers
        return data.map(point => ({
            t: point.timestamp,
            d: Object.keys(point.data).reduce((acc, coin) => {
                const coinData = point.data[coin];
                acc[coin] = {
                    p: Math.round(coinData.price * 100) / 100,
                    c: Math.round(coinData.priceChange * 100) / 100,
                    v: Math.round(coinData.volume),
                    s: coinData.source
                };
                return acc;
            }, {})
        }));
    }

    // Decompress data from storage
    decompressData(compressed) {
        return compressed.map(point => ({
            timestamp: point.t,
            data: Object.keys(point.d).reduce((acc, coin) => {
                const coinData = point.d[coin];
                acc[coin] = {
                    price: coinData.p,
                    priceChange: coinData.c,
                    volume: coinData.v,
                    source: coinData.s
                };
                return acc;
            }, {})
        }));
    }

    // Utility methods
    getIntervalMs(resolution) {
        const intervals = {
            '1m': 60 * 1000,
            '3m': 3 * 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '30m': 30 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '2h': 2 * 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '8h': 8 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '3d': 3 * 24 * 60 * 60 * 1000,
            '1w': 7 * 24 * 60 * 60 * 1000
        };
        return intervals[resolution] || intervals['5m'];
    }

    getIntervalSeconds(resolution) {
        return this.getIntervalMs(resolution) / 1000;
    }

    mapResolutionToBinance(resolution) {
        const mapping = {
            '1m': '1m',
            '3m': '3m',
            '5m': '5m',
            '15m': '15m',
            '30m': '30m',
            '1h': '1h',
            '2h': '2h',
            '4h': '4h',
            '6h': '6h',
            '8h': '8h',
            '12h': '12h',
            '1d': '1d',
            '3d': '3d',
            '1w': '1w'
        };
        return mapping[resolution] || '5m';
    }

    // Get collection progress
    getProgress() {
        return this.collectionProgress;
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        // Also clear localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('traderBias_historical_')) {
                localStorage.removeItem(key);
            }
        });
    }

    // Get available data ranges
    async getAvailableDataRanges() {
        // This would check what data is available from each source
        // For now, return mock ranges
        return {
            hyperliquid: {
                BTC: { start: new Date('2023-01-01').getTime(), end: Date.now() },
                ETH: { start: new Date('2023-01-01').getTime(), end: Date.now() },
                SOL: { start: new Date('2023-06-01').getTime(), end: Date.now() }
            },
            binance: {
                BTC: { start: new Date('2020-01-01').getTime(), end: Date.now() },
                ETH: { start: new Date('2020-01-01').getTime(), end: Date.now() },
                SOL: { start: new Date('2021-01-01').getTime(), end: Date.now() }
            }
        };
    }
}

// Export singleton instance
export const historicalDataService = new HistoricalDataService();

// Export convenience functions
export const collectHistoricalData = (startDate, endDate, coins, resolution) =>
    historicalDataService.collectHistoricalData(startDate, endDate, coins, resolution);

export const getCollectionProgress = () =>
    historicalDataService.getProgress();

export const clearHistoricalDataCache = () =>
    historicalDataService.clearCache();

export default historicalDataService;