/**
 * Bybit Spot CVD Collector
 *
 * Connects to Bybit spot WebSocket for trade data
 * Tracks rolling buy/sell volumes for exchange flow breakdown
 * BTC only
 */

const WebSocket = require('ws');
const dataStore = require('./dataStore');

const BYBIT_WS = 'wss://stream.bybit.com/v5/public/spot';
const SYMBOL = 'BTCUSDT';

// Flow tracking - store 1h of trades to support all timeframes
const flowState = { buys: [], sells: [] };

// CVD tracking with rolling windows
const cvdState = {
  cumulative: 0,
  rolling5m: [],
  rolling15m: [],
  rolling1h: []
};

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 5000;
const MAX_HISTORY_MS = 60 * 60 * 1000; // 1 hour max storage
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes default

/**
 * Connect to Bybit WebSocket
 */
function connectWebsocket() {
  console.log('[BybitSpot] Connecting to Bybit spot stream...');

  ws = new WebSocket(BYBIT_WS);

  ws.on('open', () => {
    console.log('[BybitSpot] Connected, subscribing to publicTrade...');
    reconnectAttempts = 0;

    // Subscribe to public trades
    const subscribeMsg = {
      op: 'subscribe',
      args: [`publicTrade.${SYMBOL}`]
    };
    ws.send(JSON.stringify(subscribeMsg));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      processMessage(msg);
    } catch (err) {
      // Ignore parse errors
    }
  });

  ws.on('close', () => {
    console.log('[BybitSpot] WebSocket closed, reconnecting...');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('[BybitSpot] WebSocket error:', err.message);
  });

  // Ping to keep alive
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op: 'ping' }));
    }
  }, 20000);
}

/**
 * Process incoming WebSocket message
 */
function processMessage(msg) {
  // Handle subscription confirmations
  if (msg.op === 'subscribe' && msg.success) {
    console.log('[BybitSpot] Subscribed successfully');
    return;
  }

  // Handle trade data
  if (msg.topic === `publicTrade.${SYMBOL}` && msg.data) {
    for (const trade of msg.data) {
      processTrade(trade);
    }
  }
}

/**
 * Process a single trade
 */
function processTrade(trade) {
  const now = Date.now();
  const size = parseFloat(trade.v || 0); // volume in base currency
  const price = parseFloat(trade.p || 0);
  const value = size * price;

  if (value <= 0) return;

  // Bybit trade.S: 'Buy' or 'Sell' (taker side)
  const side = trade.S;
  const entry = { timestamp: now, value };

  // CVD delta: positive for buys, negative for sells
  const cvdDelta = side === 'Buy' ? value : -value;

  // Update CVD tracking
  cvdState.cumulative += cvdDelta;
  const cvdEntry = { timestamp: now, delta: cvdDelta };
  cvdState.rolling5m.push(cvdEntry);
  cvdState.rolling15m.push(cvdEntry);
  cvdState.rolling1h.push(cvdEntry);

  // Flow tracking
  if (side === 'Buy') {
    flowState.buys.push(entry);
  } else if (side === 'Sell') {
    flowState.sells.push(entry);
  }

  // Trim entries older than their windows
  const cutoff1h = now - MAX_HISTORY_MS;
  const cutoff15m = now - 15 * 60 * 1000;
  const cutoff5m = now - 5 * 60 * 1000;

  flowState.buys = flowState.buys.filter(e => e.timestamp >= cutoff1h);
  flowState.sells = flowState.sells.filter(e => e.timestamp >= cutoff1h);
  cvdState.rolling1h = cvdState.rolling1h.filter(e => e.timestamp >= cutoff1h);
  cvdState.rolling15m = cvdState.rolling15m.filter(e => e.timestamp >= cutoff15m);
  cvdState.rolling5m = cvdState.rolling5m.filter(e => e.timestamp >= cutoff5m);
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[BybitSpot] Max reconnect attempts reached');
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1);
  console.log(`[BybitSpot] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

  setTimeout(connectWebsocket, delay);
}

/**
 * Get flow data for BTC
 * @param {number} windowMs - Rolling window in ms (default 15m)
 */
function getFlow(windowMs = DEFAULT_WINDOW_MS) {
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
 * Get spot CVD data for BTC
 */
function getSpotCvd() {
  const sum5m = cvdState.rolling5m.reduce((acc, e) => acc + e.delta, 0);
  const sum15m = cvdState.rolling15m.reduce((acc, e) => acc + e.delta, 0);
  const sum1h = cvdState.rolling1h.reduce((acc, e) => acc + e.delta, 0);

  return {
    cumulative: cvdState.cumulative,
    delta: sum5m, // Use 5m delta as the primary delta for aggregation
    rolling5mDelta: sum5m,
    rolling15mDelta: sum15m,
    rolling1hDelta: sum1h,
    dataPoints5m: cvdState.rolling5m.length,
    dataPoints15m: cvdState.rolling15m.length,
    dataPoints1h: cvdState.rolling1h.length,
    timestamp: Date.now()
  };
}

/**
 * Update dataStore with flow and CVD data
 */
function updateDataStore() {
  const flow = getFlow();
  dataStore.updateExchangeFlow('BTC', 'bybit', 'spot', flow);

  // Update spot CVD
  const spotCvd = getSpotCvd();
  dataStore.updateSpotCvd('bybit', 'BTC', spotCvd);
}

/**
 * Start collection
 */
function start() {
  console.log('[BybitSpot] Starting Bybit spot flow collection...');
  connectWebsocket();

  // Update dataStore every 5 seconds
  setInterval(updateDataStore, 5000);
}

module.exports = {
  start,
  getFlow,
  getSpotCvd
};
