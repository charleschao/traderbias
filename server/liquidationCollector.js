/**
 * Liquidation Collector Module
 * 
 * Collects forced liquidation data from Binance Futures
 * Calculates velocity, directional pressure, and cascade detection
 * Used for 8-12H bias projection (10% weight)
 */

const WebSocket = require('ws');
const dataStore = require('./dataStore');

// Configuration
const BINANCE_LIQ_URL = 'wss://fstream.binance.com/ws/!forceOrder@arr';
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

let ws = null;
let reconnectTimeout = null;
let pingInterval = null;

/**
 * Start liquidation collection
 */
function start() {
    console.log('[LiqCollector] Starting Binance liquidation collection...');
    connect();
}

/**
 * Connect to Binance liquidation stream
 */
function connect() {
    try {
        ws = new WebSocket(BINANCE_LIQ_URL);

        ws.on('open', () => {
            console.log('[LiqCollector] Connected to Binance liquidation stream');

            // Keep-alive ping
            pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                }
            }, 30000);
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                handleLiquidation(msg);
            } catch (e) {
                // Silent catch
            }
        });

        ws.on('error', (err) => {
            console.error('[LiqCollector] WebSocket error:', err.message);
        });

        ws.on('close', () => {
            console.log('[LiqCollector] Disconnected, reconnecting in 5s...');
            if (pingInterval) clearInterval(pingInterval);
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connect, 5000);
        });

    } catch (err) {
        console.error('[LiqCollector] Connection error:', err.message);
        reconnectTimeout = setTimeout(connect, 5000);
    }
}

/**
 * Handle incoming liquidation event
 * Binance format: { e: 'forceOrder', o: { s: 'BTCUSDT', S: 'SELL', p: '50000', q: '0.5', ... } }
 */
function handleLiquidation(msg) {
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
        running: ws !== null && ws.readyState === WebSocket.OPEN,
        source: 'binance',
        trackedCoins: TRACKED_COINS,
        thresholds: THRESHOLDS
    };
}

/**
 * Stop collector
 */
function stop() {
    if (pingInterval) clearInterval(pingInterval);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (ws) ws.close();
    console.log('[LiqCollector] Stopped');
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
