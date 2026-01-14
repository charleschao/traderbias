/**
 * Coinbase Spot CVD Collector
 *
 * Connects to Coinbase Advanced Trade WebSocket for spot trade data
 * Tracks rolling buy/sell volumes for exchange flow breakdown
 */

const WebSocket = require('ws');
const dataStore = require('./dataStore');

const COINBASE_WS = 'wss://advanced-trade-ws.coinbase.com';
const PRODUCT = 'BTC-USD';

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
 * Connect to Coinbase WebSocket
 */
function connectWebsocket() {
  console.log('[CoinbaseSpot] Connecting to Coinbase Advanced Trade...');

  ws = new WebSocket(COINBASE_WS);

  ws.on('open', () => {
    console.log('[CoinbaseSpot] Connected, subscribing to market_trades...');
    reconnectAttempts = 0;

    // Subscribe to market_trades channel
    const subscribeMsg = {
      type: 'subscribe',
      product_ids: [PRODUCT],
      channel: 'market_trades'
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
    console.log('[CoinbaseSpot] WebSocket closed, reconnecting...');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('[CoinbaseSpot] WebSocket error:', err.message);
  });
}

/**
 * Process incoming WebSocket message
 */
function processMessage(msg) {
  // Handle subscription confirmations
  if (msg.type === 'subscriptions') {
    console.log('[CoinbaseSpot] Subscribed to:', msg.channels?.map(c => c.name).join(', '));
    return;
  }

  // Handle market trades
  if (msg.channel === 'market_trades' && msg.events) {
    for (const event of msg.events) {
      if (event.type === 'update' && event.trades) {
        for (const trade of event.trades) {
          processTrade(trade);
        }
      }
    }
  }
}

/**
 * Process a single trade
 */
function processTrade(trade) {
  if (trade.product_id !== PRODUCT) return;

  const now = Date.now();
  const size = parseFloat(trade.size || 0);
  const price = parseFloat(trade.price || 0);
  const value = size * price;

  if (value <= 0) return;

  // Coinbase trade.side: 'BUY' or 'SELL' (taker side)
  const side = trade.side?.toUpperCase();
  const entry = { timestamp: now, value };

  // CVD delta: positive for buys, negative for sells
  const cvdDelta = side === 'BUY' ? value : -value;

  // Update CVD tracking
  cvdState.cumulative += cvdDelta;
  const cvdEntry = { timestamp: now, delta: cvdDelta };
  cvdState.rolling5m.push(cvdEntry);
  cvdState.rolling15m.push(cvdEntry);
  cvdState.rolling1h.push(cvdEntry);

  // Flow tracking
  if (side === 'BUY') {
    flowState.buys.push(entry);
  } else if (side === 'SELL') {
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
    console.error('[CoinbaseSpot] Max reconnect attempts reached');
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1);
  console.log(`[CoinbaseSpot] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

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
    delta: sum5m,
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
  dataStore.updateExchangeFlow('BTC', 'coinbase', 'spot', flow);

  // Update spot CVD
  const spotCvd = getSpotCvd();
  dataStore.updateSpotCvd('coinbase', 'BTC', spotCvd);
}

/**
 * Start collection
 */
function start() {
  console.log('[CoinbaseSpot] Starting Coinbase spot flow collection...');
  connectWebsocket();

  // Update dataStore every 5 seconds
  setInterval(updateDataStore, 5000);
}

module.exports = {
  start,
  getFlow,
  getSpotCvd
};
