/**
 * Spot CVD Data Collector
 * 
 * Connects to Binance spot aggTrade websocket to calculate spot CVD
 * Used to detect spot vs perp divergences (smart money vs leverage tourists)
 * 
 * Key signals:
 * - Spot CVD ↗ + Perp CVD flat = Real accumulation
 * - Perp CVD ↗ + Spot CVD ↘ = Fake pump (leverage-driven)
 */

const WebSocket = require('ws');
const dataStore = require('./dataStore');

const BINANCE_SPOT_WS = 'wss://stream.binance.com:9443/ws';
const COINS = ['BTC', 'ETH', 'SOL'];
const SPOT_PAIRS = {
    BTC: 'btcusdt',
    ETH: 'ethusdt',
    SOL: 'solusdt'
};

// CVD tracking per coin
const cvdState = {
    BTC: { cumulative: 0, rolling5m: [], rolling15m: [], rolling1h: [] },
    ETH: { cumulative: 0, rolling5m: [], rolling15m: [], rolling1h: [] },
    SOL: { cumulative: 0, rolling5m: [], rolling15m: [], rolling1h: [] }
};

// Flow tracking for exchange flow feature (BTC only)
const flowState = { buys: [], sells: [] };
const MAX_FLOW_HISTORY_MS = 60 * 60 * 1000; // 1 hour max storage
const DEFAULT_FLOW_WINDOW_MS = 15 * 60 * 1000; // 15 minutes default

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 5000;

/**
 * Calculate CVD delta from aggTrade
 * Positive = buy pressure, Negative = sell pressure
 */
function calculateCvdDelta(trade) {
    const qty = parseFloat(trade.q);
    const price = parseFloat(trade.p);
    const value = qty * price;

    // isBuyerMaker: true = seller initiated (sell), false = buyer initiated (buy)
    return trade.m ? -value : value;
}

/**
 * Connect to Binance spot websocket
 */
function connectWebsocket() {
    // Build combined stream URL
    const streams = Object.values(SPOT_PAIRS).map(pair => `${pair}@aggTrade`).join('/');
    const wsUrl = `${BINANCE_SPOT_WS}/${streams}`;

    console.log('[SpotCVD] Connecting to Binance spot stream...');

    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('[SpotCVD] Connected to Binance spot aggTrade stream');
        reconnectAttempts = 0;
    });

    ws.on('message', (data) => {
        try {
            const trade = JSON.parse(data);
            processTrade(trade);
        } catch (err) {
            // Ignore parse errors
        }
    });

    ws.on('close', () => {
        console.log('[SpotCVD] Websocket closed, attempting reconnect...');
        scheduleReconnect();
    });

    ws.on('error', (err) => {
        console.error('[SpotCVD] Websocket error:', err.message);
    });
}

/**
 * Process incoming trade
 */
function processTrade(trade) {
    // Determine which coin from the stream name
    const symbol = trade.s?.toLowerCase();
    if (!symbol) return;

    let coin = null;
    for (const [c, pair] of Object.entries(SPOT_PAIRS)) {
        if (symbol === pair) {
            coin = c;
            break;
        }
    }
    if (!coin) return;

    const now = Date.now();
    const cvdDelta = calculateCvdDelta(trade);

    // Update cumulative
    cvdState[coin].cumulative += cvdDelta;

    // Add to rolling windows
    const entry = { timestamp: now, delta: cvdDelta };
    cvdState[coin].rolling5m.push(entry);
    cvdState[coin].rolling15m.push(entry);
    cvdState[coin].rolling1h.push(entry);

    // Trim old entries (keep memory bounded)
    const fiveMinAgo = now - 5 * 60 * 1000;
    const fifteenMinAgo = now - 15 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    cvdState[coin].rolling5m = cvdState[coin].rolling5m.filter(e => e.timestamp >= fiveMinAgo);
    cvdState[coin].rolling15m = cvdState[coin].rolling15m.filter(e => e.timestamp >= fifteenMinAgo);
    cvdState[coin].rolling1h = cvdState[coin].rolling1h.filter(e => e.timestamp >= oneHourAgo);

    // Track buy/sell volumes for BTC exchange flow
    if (coin === 'BTC') {
        const qty = parseFloat(trade.q);
        const price = parseFloat(trade.p);
        const value = qty * price;
        const flowEntry = { timestamp: now, value };

        if (trade.m) {
            // isBuyerMaker = true means seller initiated (sell)
            flowState.sells.push(flowEntry);
        } else {
            flowState.buys.push(flowEntry);
        }

        // Trim flow state (keep 1h for all timeframes)
        const flowCutoff = now - MAX_FLOW_HISTORY_MS;
        flowState.buys = flowState.buys.filter(e => e.timestamp >= flowCutoff);
        flowState.sells = flowState.sells.filter(e => e.timestamp >= flowCutoff);
    }
}

/**
 * Get flow data for BTC (Binance spot)
 * @param {number} windowMs - Rolling window in ms (default 15m)
 */
function getFlow(windowMs = DEFAULT_FLOW_WINDOW_MS) {
    const now = Date.now();
    const cutoff = now - windowMs;

    const buyVol = flowState.buys
        .filter(e => e.timestamp >= cutoff)
        .reduce((sum, e) => sum + e.value, 0);
    const sellVol = flowState.sells
        .filter(e => e.timestamp >= cutoff)
        .reduce((sum, e) => sum + e.value, 0);

    return {
        buyVol,
        sellVol,
        timestamp: now
    };
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[SpotCVD] Max reconnect attempts reached, giving up');
        return;
    }

    reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1);
    console.log(`[SpotCVD] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

    setTimeout(connectWebsocket, delay);
}

/**
 * Get spot CVD data for a coin
 */
function getSpotCvd(coin) {
    const state = cvdState[coin];
    if (!state) return null;

    const sum5m = state.rolling5m.reduce((acc, e) => acc + e.delta, 0);
    const sum15m = state.rolling15m.reduce((acc, e) => acc + e.delta, 0);
    const sum1h = state.rolling1h.reduce((acc, e) => acc + e.delta, 0);

    return {
        cumulative: state.cumulative,
        rolling5mDelta: sum5m,
        rolling15mDelta: sum15m,
        rolling1hDelta: sum1h,
        dataPoints5m: state.rolling5m.length,
        dataPoints15m: state.rolling15m.length,
        dataPoints1h: state.rolling1h.length,
        timestamp: Date.now()
    };
}

/**
 * Get all spot CVD data
 */
function getAllSpotCvd() {
    const result = {};
    for (const coin of COINS) {
        result[coin] = getSpotCvd(coin);
    }
    return result;
}

/**
 * Compare spot vs perp CVD for divergence detection
 */
function detectSpotPerpDivergence(coin, perpCvdDelta) {
    const spotCvd = getSpotCvd(coin);
    if (!spotCvd) return null;

    const spotDelta = spotCvd.rolling5mDelta;
    const spotTrend = spotDelta > 10000 ? 'up' : spotDelta < -10000 ? 'down' : 'flat';
    const perpTrend = perpCvdDelta > 10000 ? 'up' : perpCvdDelta < -10000 ? 'down' : 'flat';

    let signal = 'BALANCED';
    let bias = 'neutral';
    let strength = 'weak';
    let description = 'Spot and Perp CVD aligned';

    // BULLISH: Spot rising, Perp flat/falling = Real accumulation
    if (spotTrend === 'up' && perpTrend !== 'up') {
        signal = 'SPOT_ACCUMULATION';
        bias = 'bullish';
        strength = 'strong';
        description = 'Spot buyers leading - real accumulation';
    }
    // BULLISH: Spot rising into price dump = Capitulation bottom
    else if (spotTrend === 'up' && perpTrend === 'down') {
        signal = 'CAPITULATION_BOTTOM';
        bias = 'bullish';
        strength = 'strong';
        description = 'Spot absorbing panic selling';
    }
    // BEARISH: Perp rising, Spot falling = Fake pump
    else if (perpTrend === 'up' && spotTrend === 'down') {
        signal = 'FAKE_PUMP';
        bias = 'bearish';
        strength = 'strong';
        description = 'Leverage-driven rally, spot selling';
    }
    // BEARISH: Spot falling, Perp flat = Distribution
    else if (spotTrend === 'down' && perpTrend !== 'down') {
        signal = 'DISTRIBUTION';
        bias = 'bearish';
        strength = 'moderate';
        description = 'Smart money distributing';
    }

    return {
        signal,
        bias,
        strength,
        description,
        spotCvd: spotDelta,
        perpCvd: perpCvdDelta,
        spotTrend,
        perpTrend
    };
}

/**
 * Update dataStore with spot CVD (called periodically)
 */
function updateDataStore() {
    for (const coin of COINS) {
        const spotCvd = getSpotCvd(coin);
        if (spotCvd) {
            dataStore.updateSpotCvd('binance', coin, spotCvd);
        }
    }

    // Update exchange flow for BTC
    const buyVol = flowState.buys.reduce((sum, e) => sum + e.value, 0);
    const sellVol = flowState.sells.reduce((sum, e) => sum + e.value, 0);
    dataStore.updateExchangeFlow('BTC', 'binance', 'spot', {
        buyVol,
        sellVol,
        timestamp: Date.now()
    });
}

/**
 * Start the spot data collection
 */
function startSpotDataCollection() {
    console.log('[SpotCVD] Starting Binance spot CVD collection...');
    connectWebsocket();

    // Update dataStore every 5 seconds
    setInterval(updateDataStore, 5000);
}

module.exports = {
    startSpotDataCollection,
    getSpotCvd,
    getAllSpotCvd,
    detectSpotPerpDivergence,
    getFlow
};
