/**
 * Coinbase Spot CVD Collector
 *
 * Connects to Coinbase Advanced Trade WebSocket for spot trade data
 * Tracks rolling 5m buy/sell volumes for exchange flow breakdown
 */

const WebSocket = require('ws');
const dataStore = require('./dataStore');

const COINBASE_WS = 'wss://advanced-trade-ws.coinbase.com';
const PRODUCT = 'BTC-USD';

// Flow tracking (rolling 5m window)
const flowState = { buys: [], sells: [] };

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 5000;
const ROLLING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

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

  if (side === 'BUY') {
    flowState.buys.push(entry);
  } else if (side === 'SELL') {
    flowState.sells.push(entry);
  }

  // Trim old entries
  const cutoff = now - ROLLING_WINDOW_MS;
  flowState.buys = flowState.buys.filter(e => e.timestamp >= cutoff);
  flowState.sells = flowState.sells.filter(e => e.timestamp >= cutoff);
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
 */
function getFlow() {
  const buyVol = flowState.buys.reduce((sum, e) => sum + e.value, 0);
  const sellVol = flowState.sells.reduce((sum, e) => sum + e.value, 0);

  return {
    buyVol,
    sellVol,
    timestamp: Date.now()
  };
}

/**
 * Update dataStore with flow data
 */
function updateDataStore() {
  const flow = getFlow();
  dataStore.updateExchangeFlow('BTC', 'coinbase', 'spot', flow);
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
  getFlow
};
