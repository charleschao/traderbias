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

  if (side === 'Buy') {
    flowState.buys.push(entry);
  } else if (side === 'Sell') {
    flowState.sells.push(entry);
  }

  // Trim entries older than 1h
  const cutoff = now - MAX_HISTORY_MS;
  flowState.buys = flowState.buys.filter(e => e.timestamp >= cutoff);
  flowState.sells = flowState.sells.filter(e => e.timestamp >= cutoff);
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
 * Update dataStore with flow data
 */
function updateDataStore() {
  const flow = getFlow();
  dataStore.updateExchangeFlow('BTC', 'bybit', 'spot', flow);
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
  getFlow
};
