/**
 * Liquidation Collector Module
 *
 * Collects forced liquidation data from Binance + Bybit Futures
 * Calculates velocity, directional pressure, and cascade detection
 * Used for 8-12H bias projection (10% weight)
 *
 * Multi-exchange aggregation for better accuracy:
 * - Binance: ~40% of BTC perp volume
 * - Bybit: ~30% of BTC perp volume
 */

const WebSocket = require('ws');
const dataStore = require('./dataStore');

// Configuration
const BINANCE_LIQ_URL = 'wss://fstream.binance.com/ws/!forceOrder@arr';
const BYBIT_LIQ_URL = 'wss://stream.bybit.com/v5/public/linear';
const TRACKED_COINS = ['BTC', 'ETH', 'SOL'];

// Velocity thresholds (USD)
const THRESHOLDS = {
    CASCADE: 50000000,     // $50M in window = cascade forming
    SIGNIFICANT: 20000000, // $20M = significant activity
    MODERATE: 10000000     // $10M = moderate activity
};

// Time windows
const WINDOWS = {
    FIVE_MIN: 5 * 60 * 1000,
    FIFTEEN_MIN: 15 * 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    TWO_HOUR: 2 * 60 * 60 * 1000
};

// WebSocket connections
let binanceWs = null;
let bybitWs = null;
let binanceReconnectTimeout = null;
let bybitReconnectTimeout = null;
let binancePingInterval = null;
let bybitPingInterval = null;

// Legacy aliases for backward compatibility
let ws = null;
let reconnectTimeout = null;
let pingInterval = null;

/**
 * Start liquidation collection from all exchanges
 */
function start() {
    console.log('[LiqCollector] Starting multi-exchange liquidation collection...');
    connectBinance();
    connectBybit();
}

/**
 * Connect to Binance liquidation stream
 */
function connectBinance() {
    try {
        binanceWs = new WebSocket(BINANCE_LIQ_URL);
        ws = binanceWs; // Legacy alias

        binanceWs.on('open', () => {
            console.log('[LiqCollector] Connected to Binance liquidation stream');

            binancePingInterval = setInterval(() => {
                if (binanceWs.readyState === WebSocket.OPEN) {
                    binanceWs.ping();
                }
            }, 30000);
            pingInterval = binancePingInterval; // Legacy alias
        });

        binanceWs.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                handleBinanceLiquidation(msg);
            } catch (e) {
                // Silent catch
            }
        });

        binanceWs.on('error', (err) => {
            console.error('[LiqCollector] Binance WebSocket error:', err.message);
        });

        binanceWs.on('close', () => {
            console.log('[LiqCollector] Binance disconnected, reconnecting in 5s...');
            if (binancePingInterval) clearInterval(binancePingInterval);
            clearTimeout(binanceReconnectTimeout);
            binanceReconnectTimeout = setTimeout(connectBinance, 5000);
            reconnectTimeout = binanceReconnectTimeout; // Legacy alias
        });

    } catch (err) {
        console.error('[LiqCollector] Binance connection error:', err.message);
        binanceReconnectTimeout = setTimeout(connectBinance, 5000);
    }
}

/**
 * Connect to Bybit liquidation stream
 */
function connectBybit() {
    try {
        bybitWs = new WebSocket(BYBIT_LIQ_URL);

        bybitWs.on('open', () => {
            console.log('[LiqCollector] Connected to Bybit liquidation stream');

            // Subscribe to liquidation topics for tracked coins
            const subscribeMsg = {
                op: 'subscribe',
                args: TRACKED_COINS.map(coin => `liquidation.${coin}USDT`)
            };
            bybitWs.send(JSON.stringify(subscribeMsg));

            bybitPingInterval = setInterval(() => {
                if (bybitWs.readyState === WebSocket.OPEN) {
                    bybitWs.send(JSON.stringify({ op: 'ping' }));
                }
            }, 20000);
        });

        bybitWs.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                handleBybitLiquidation(msg);
            } catch (e) {
                // Silent catch
            }
        });

        bybitWs.on('error', (err) => {
            console.error('[LiqCollector] Bybit WebSocket error:', err.message);
        });

        bybitWs.on('close', () => {
            console.log('[LiqCollector] Bybit disconnected, reconnecting in 5s...');
            if (bybitPingInterval) clearInterval(bybitPingInterval);
            clearTimeout(bybitReconnectTimeout);
            bybitReconnectTimeout = setTimeout(connectBybit, 5000);
        });

    } catch (err) {
        console.error('[LiqCollector] Bybit connection error:', err.message);
        bybitReconnectTimeout = setTimeout(connectBybit, 5000);
    }
}

// Legacy connect function for backward compatibility
function connect() {
    connectBinance();
}

/**
 * Handle incoming Binance liquidation event
 * Binance format: { e: 'forceOrder', o: { s: 'BTCUSDT', S: 'SELL', p: '50000', q: '0.5', ... } }
 */
function handleBinanceLiquidation(msg) {
    if (msg.e !== 'forceOrder' || !msg.o) return;

    const order = msg.o;
    const symbol = order.s.replace('USDT', '');

    if (!TRACKED_COINS.includes(symbol)) return;

    const liq = {
        symbol,
        side: order.S,                           // SELL = long liquidated, BUY = short liquidated
        price: parseFloat(order.p),
        quantity: parseFloat(order.q),
        notional: parseFloat(order.p) * parseFloat(order.q),
        timestamp: order.T || Date.now(),
        exchange: 'binance'
    };

    // Store liquidation
    dataStore.addLiquidation(liq);
}

/**
 * Handle incoming Bybit liquidation event
 * Bybit format: { topic: 'liquidation.BTCUSDT', data: { symbol, side, price, size, ... } }
 */
function handleBybitLiquidation(msg) {
    // Skip pong responses and subscription confirmations
    if (msg.op === 'pong' || msg.success !== undefined) return;
    if (!msg.topic || !msg.data) return;

    const data = msg.data;
    const symbol = data.symbol?.replace('USDT', '');

    if (!symbol || !TRACKED_COINS.includes(symbol)) return;

    const liq = {
        symbol,
        side: data.side === 'Buy' ? 'BUY' : 'SELL',  // Buy = short liq, Sell = long liq
        price: parseFloat(data.price),
        quantity: parseFloat(data.size),
        notional: parseFloat(data.price) * parseFloat(data.size),
        timestamp: data.updatedTime || Date.now(),
        exchange: 'bybit'
    };

    // Store liquidation
    dataStore.addLiquidation(liq);
}

// Legacy handler for backward compatibility
function handleLiquidation(msg) {
    handleBinanceLiquidation(msg);
}

/**
 * Calculate liquidation velocity for a coin
 */
function calculateVelocity(coin, windowMs) {
    const liqs = dataStore.getLiquidations(coin);
    const cutoff = Date.now() - windowMs;

    const recent = liqs.filter(l => l.timestamp >= cutoff);

    let longLiqValue = 0;   // Longs liquidated (bearish)
    let shortLiqValue = 0;  // Shorts liquidated (bullish)

    recent.forEach(l => {
        if (l.side === 'SELL') {
            longLiqValue += l.notional;  // Long was liquidated
        } else {
            shortLiqValue += l.notional; // Short was liquidated
        }
    });

    return {
        total: longLiqValue + shortLiqValue,
        longLiqValue,
        shortLiqValue,
        count: recent.length,
        windowMs
    };
}

/**
 * Detect cascade pattern
 * Cascade = accelerating liquidation rate in same direction
 */
function detectCascade(coin) {
    const v5m = calculateVelocity(coin, WINDOWS.FIVE_MIN);
    const v15m = calculateVelocity(coin, WINDOWS.FIFTEEN_MIN);
    const v1h = calculateVelocity(coin, WINDOWS.ONE_HOUR);

    // Normalize to per-minute rate
    const rate5m = v5m.total / 5;
    const rate15m = v15m.total / 15;
    const rate1h = v1h.total / 60;

    // Cascade = recent rate significantly higher than longer-term rate
    const isAccelerating = rate5m > rate15m * 1.5 && rate15m > rate1h * 1.2;

    // Determine direction
    const longDominant5m = v5m.longLiqValue > v5m.shortLiqValue * 1.5;
    const shortDominant5m = v5m.shortLiqValue > v5m.longLiqValue * 1.5;

    let cascadeType = 'NONE';
    if (isAccelerating && longDominant5m) {
        cascadeType = 'LONG_CASCADE';  // Longs being liquidated = bearish
    } else if (isAccelerating && shortDominant5m) {
        cascadeType = 'SHORT_CASCADE'; // Shorts being liquidated = bullish
    }

    return {
        isAccelerating,
        cascadeType,
        rate5m,
        rate15m,
        rate1h,
        accelerationFactor: rate15m > 0 ? rate5m / rate15m : 0
    };
}

/**
 * Calculate liquidation signal for bias projection
 * Returns score between -1 and +1
 */
function calculateLiquidationSignal(coin = 'BTC') {
    const v1h = calculateVelocity(coin, WINDOWS.ONE_HOUR);
    const v2h = calculateVelocity(coin, WINDOWS.TWO_HOUR);
    const cascade = detectCascade(coin);

    // Not enough data
    if (v2h.total < THRESHOLDS.MODERATE / 2) {
        return {
            score: 0,
            signal: 'INSUFFICIENT_DATA',
            velocity: v1h,
            cascade,
            description: 'Waiting for liquidation data'
        };
    }

    let score = 0;
    let signal = 'NEUTRAL';
    let description = 'Normal liquidation activity';

    // Cascade in progress - strongest signal
    if (cascade.cascadeType === 'LONG_CASCADE' && v1h.total >= THRESHOLDS.CASCADE) {
        score = -0.85;
        signal = 'BEARISH_CASCADE';
        description = `Long cascade: $${(v1h.longLiqValue / 1e6).toFixed(1)}M liquidated in 1H`;
    } else if (cascade.cascadeType === 'SHORT_CASCADE' && v1h.total >= THRESHOLDS.CASCADE) {
        score = 0.85;
        signal = 'BULLISH_CASCADE';
        description = `Short squeeze: $${(v1h.shortLiqValue / 1e6).toFixed(1)}M liquidated in 1H`;
    }
    // Significant directional pressure
    else if (v1h.longLiqValue > v1h.shortLiqValue * 2 && v1h.total >= THRESHOLDS.SIGNIFICANT) {
        score = -0.55;
        signal = 'BEARISH_PRESSURE';
        description = `Long pressure: $${(v1h.longLiqValue / 1e6).toFixed(1)}M longs liquidated`;
    } else if (v1h.shortLiqValue > v1h.longLiqValue * 2 && v1h.total >= THRESHOLDS.SIGNIFICANT) {
        score = 0.55;
        signal = 'BULLISH_PRESSURE';
        description = `Short pressure: $${(v1h.shortLiqValue / 1e6).toFixed(1)}M shorts liquidated`;
    }
    // Moderate activity
    else if (v1h.longLiqValue > v1h.shortLiqValue * 1.3 && v1h.total >= THRESHOLDS.MODERATE) {
        score = -0.30;
        signal = 'MILD_BEARISH';
        description = 'More longs than shorts liquidating';
    } else if (v1h.shortLiqValue > v1h.longLiqValue * 1.3 && v1h.total >= THRESHOLDS.MODERATE) {
        score = 0.30;
        signal = 'MILD_BULLISH';
        description = 'More shorts than longs liquidating';
    }
    // Exhaustion pattern - contrarian
    else if (cascade.isAccelerating === false && v2h.total > THRESHOLDS.CASCADE) {
        // Rapid deceleration after major cascade = exhaustion
        if (v1h.longLiqValue > v1h.shortLiqValue) {
            score = 0.40; // Contrarian bullish
            signal = 'LONG_EXHAUSTION';
            description = 'Long liquidation exhaustion - potential reversal';
        } else {
            score = -0.40; // Contrarian bearish
            signal = 'SHORT_EXHAUSTION';
            description = 'Short squeeze exhaustion - potential reversal';
        }
    }

    return {
        score,
        signal,
        velocity: {
            '1h': {
                total: v1h.total,
                longs: v1h.longLiqValue,
                shorts: v1h.shortLiqValue,
                count: v1h.count
            },
            '2h': {
                total: v2h.total,
                longs: v2h.longLiqValue,
                shorts: v2h.shortLiqValue
            }
        },
        cascade,
        description
    };
}

/**
 * Generate description for display
 */
function generateLiqDescription(liqSignal) {
    if (!liqSignal || liqSignal.signal === 'INSUFFICIENT_DATA') {
        return 'Liquidation data collecting';
    }

    const v = liqSignal.velocity['1h'];
    const totalM = (v.total / 1e6).toFixed(1);

    if (liqSignal.signal.includes('CASCADE')) {
        return `⚠️ ${liqSignal.description}`;
    }

    if (v.total < THRESHOLDS.MODERATE) {
        return 'Normal liquidation activity';
    }

    return liqSignal.description;
}

/**
 * Get collector status
 */
function getStatus() {
    return {
        running: {
            binance: binanceWs !== null && binanceWs.readyState === WebSocket.OPEN,
            bybit: bybitWs !== null && bybitWs.readyState === WebSocket.OPEN
        },
        sources: ['binance', 'bybit'],
        trackedCoins: TRACKED_COINS,
        thresholds: THRESHOLDS
    };
}

/**
 * Stop collector
 */
function stop() {
    // Stop Binance
    if (binancePingInterval) clearInterval(binancePingInterval);
    if (binanceReconnectTimeout) clearTimeout(binanceReconnectTimeout);
    if (binanceWs) binanceWs.close();

    // Stop Bybit
    if (bybitPingInterval) clearInterval(bybitPingInterval);
    if (bybitReconnectTimeout) clearTimeout(bybitReconnectTimeout);
    if (bybitWs) bybitWs.close();

    console.log('[LiqCollector] Stopped all connections');
}

module.exports = {
    start,
    stop,
    calculateLiquidationSignal,
    generateLiqDescription,
    calculateVelocity,
    detectCascade,
    getStatus,
    THRESHOLDS
};
