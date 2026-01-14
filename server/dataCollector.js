/**
 * Data Collection Workers for All Exchanges
 *
 * Fetches market data from multiple exchanges and stores in memory
 */

const fetch = require('node-fetch');
const dataStore = require('./dataStore');

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';
const BINANCE_API_BASE = 'https://fapi.binance.com';
const BYBIT_API_BASE = 'https://api.bybit.com';
const NADO_API = 'https://archive.prod.nado.xyz/v1';
const ASTERDEX_API = 'https://fapi.asterdex.com';

const COINS = ['BTC', 'ETH', 'SOL'];
const FETCH_TIMEOUT_MS = 15000; // 15 second timeout

// Flow tracking for perp exchanges (BTC only)
const MAX_FLOW_HISTORY_MS = 60 * 60 * 1000; // 1 hour max storage
const DEFAULT_FLOW_WINDOW_MS = 15 * 60 * 1000; // 15 minutes default

const perpFlowState = {
  hyperliquid: { buys: [], sells: [], lastTradeIds: new Set() },
  binance: { buys: [], sells: [], lastTradeIds: new Set() }
};

/**
 * Fetch with timeout wrapper to prevent hung requests
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============== HYPERLIQUID WORKER ==============

async function fetchHyperliquidData() {
  try {
    // Fetch prices
    const midsRes = await fetchWithTimeout(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' })
    });
    const mids = await midsRes.json();

    // Fetch OI and funding
    const metaRes = await fetchWithTimeout(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' })
    });
    const [meta, assetCtxs] = await metaRes.json();

    // Store price, OI, funding
    for (const coin of COINS) {
      const price = parseFloat(mids[coin] || 0);
      if (price > 0) {
        dataStore.addPrice('hyperliquid', coin, price);
      }

      const idx = meta.universe.findIndex(u => u.name === coin);
      if (idx !== -1 && assetCtxs[idx]) {
        const ctx = assetCtxs[idx];
        const oiValue = parseFloat(ctx.openInterest || 0) * price;
        const fundingRate = parseFloat(ctx.funding || 0);

        if (oiValue > 0) {
          dataStore.addOI('hyperliquid', coin, oiValue);
        }
        dataStore.addFunding('hyperliquid', coin, fundingRate);
      }
    }

    // Fetch orderbooks
    for (const coin of COINS) {
      const obRes = await fetchWithTimeout(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'l2Book', coin })
      });
      const book = await obRes.json();

      let bidVol = 0, askVol = 0;
      (book.levels?.[0] || []).forEach(level => bidVol += parseFloat(level.px) * parseFloat(level.sz));
      (book.levels?.[1] || []).forEach(level => askVol += parseFloat(level.px) * parseFloat(level.sz));

      const totalVol = bidVol + askVol;
      const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;

      dataStore.addOrderbook('hyperliquid', coin, imbalance, bidVol, askVol);
    }

    // Fetch CVD (recent trades)
    for (const coin of COINS) {
      const tradesRes = await fetchWithTimeout(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'recentTrades', coin })
      });
      const trades = await tradesRes.json();

      let buyVol = 0, sellVol = 0;
      const now = Date.now();

      (trades || []).forEach(trade => {
        const vol = parseFloat(trade.sz) * parseFloat(trade.px);
        if (trade.side === 'B') buyVol += vol;
        else if (trade.side === 'A') sellVol += vol;

        // Accumulate flow history for BTC (with deduplication)
        if (coin === 'BTC' && trade.tid) {
          const tradeId = String(trade.tid);
          if (!perpFlowState.hyperliquid.lastTradeIds.has(tradeId)) {
            perpFlowState.hyperliquid.lastTradeIds.add(tradeId);
            const entry = { timestamp: now, value: vol };
            if (trade.side === 'B') {
              perpFlowState.hyperliquid.buys.push(entry);
            } else if (trade.side === 'A') {
              perpFlowState.hyperliquid.sells.push(entry);
            }
          }
        }
      });

      const delta = buyVol - sellVol;
      dataStore.addCVD('hyperliquid', coin, delta);

      // Prune old flow data for BTC
      if (coin === 'BTC') {
        const cutoff = now - MAX_FLOW_HISTORY_MS;
        perpFlowState.hyperliquid.buys = perpFlowState.hyperliquid.buys.filter(e => e.timestamp >= cutoff);
        perpFlowState.hyperliquid.sells = perpFlowState.hyperliquid.sells.filter(e => e.timestamp >= cutoff);
        // Prune old trade IDs (keep last 10000 to bound memory)
        if (perpFlowState.hyperliquid.lastTradeIds.size > 10000) {
          const idsArray = [...perpFlowState.hyperliquid.lastTradeIds];
          perpFlowState.hyperliquid.lastTradeIds = new Set(idsArray.slice(-5000));
        }
      }
    }

    console.log('[Hyperliquid] Data fetched successfully');
  } catch (error) {
    const errorType = error.name === 'AbortError' ? 'TIMEOUT' : error.name || 'ERROR';
    console.error(`[Hyperliquid] Fetch ${errorType}:`, error.message);
  }
}

// ============== BINANCE WORKER ==============

async function fetchBinanceData() {
  try {
    const symbolMap = { 'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT' };

    for (const coin of COINS) {
      const symbol = symbolMap[coin];

      // Fetch ticker (price)
      const tickerRes = await fetchWithTimeout(`${BINANCE_API_BASE}/fapi/v1/ticker/24hr?symbol=${symbol}`);
      const ticker = await tickerRes.json();
      const price = parseFloat(ticker.lastPrice);

      if (price > 0) {
        dataStore.addPrice('binance', coin, price);
      }

      // Fetch funding
      const fundingRes = await fetchWithTimeout(`${BINANCE_API_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`);
      const fundingInfo = await fundingRes.json();
      const rate = parseFloat(fundingInfo.lastFundingRate);
      dataStore.addFunding('binance', coin, rate);

      // Fetch OI
      const oiRes = await fetchWithTimeout(`${BINANCE_API_BASE}/fapi/v1/openInterest?symbol=${symbol}`);
      const oiInfo = await oiRes.json();
      const oiValue = parseFloat(oiInfo.openInterest) * price;
      if (oiValue > 0) {
        dataStore.addOI('binance', coin, oiValue);
      }

      // Fetch orderbook
      const depthRes = await fetchWithTimeout(`${BINANCE_API_BASE}/fapi/v1/depth?symbol=${symbol}&limit=10`);
      const depth = await depthRes.json();

      let bidVol = 0, askVol = 0;
      if (depth.bids) {
        depth.bids.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
        depth.asks.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));
      }

      const totalVol = bidVol + askVol;
      const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;
      dataStore.addOrderbook('binance', coin, imbalance, bidVol, askVol);

      // Fetch recent trades for CVD
      const tradesRes = await fetchWithTimeout(`${BINANCE_API_BASE}/fapi/v1/trades?symbol=${symbol}&limit=100`);
      const trades = await tradesRes.json();

      let buyVol = 0, sellVol = 0;
      const now = Date.now();

      if (Array.isArray(trades)) {
        trades.forEach(trade => {
          const vol = parseFloat(trade.price) * parseFloat(trade.qty);
          // isBuyerMaker=true means sell (taker was seller)
          if (trade.isBuyerMaker) {
            sellVol += vol;
          } else {
            buyVol += vol;
          }

          // Accumulate flow history for BTC (with deduplication)
          if (coin === 'BTC' && trade.id) {
            const tradeId = String(trade.id);
            if (!perpFlowState.binance.lastTradeIds.has(tradeId)) {
              perpFlowState.binance.lastTradeIds.add(tradeId);
              const entry = { timestamp: now, value: vol };
              if (trade.isBuyerMaker) {
                perpFlowState.binance.sells.push(entry);
              } else {
                perpFlowState.binance.buys.push(entry);
              }
            }
          }
        });
      }
      const delta = buyVol - sellVol;
      dataStore.addCVD('binance', coin, delta);

      // Prune old flow data for BTC
      if (coin === 'BTC') {
        const cutoff = now - MAX_FLOW_HISTORY_MS;
        perpFlowState.binance.buys = perpFlowState.binance.buys.filter(e => e.timestamp >= cutoff);
        perpFlowState.binance.sells = perpFlowState.binance.sells.filter(e => e.timestamp >= cutoff);
        // Prune old trade IDs (keep last 10000 to bound memory)
        if (perpFlowState.binance.lastTradeIds.size > 10000) {
          const idsArray = [...perpFlowState.binance.lastTradeIds];
          perpFlowState.binance.lastTradeIds = new Set(idsArray.slice(-5000));
        }
      }
    }

    console.log('[Binance] Data fetched successfully');
  } catch (error) {
    const errorType = error.name === 'AbortError' ? 'TIMEOUT' : error.name || 'ERROR';
    console.error(`[Binance] Fetch ${errorType}:`, error.message);
  }
}

// ============== BYBIT WORKER ==============

async function fetchBybitData() {
  try {
    const symbolMap = { 'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT' };

    for (const coin of COINS) {
      const symbol = symbolMap[coin];

      // Fetch ticker
      const tickerRes = await fetchWithTimeout(`${BYBIT_API_BASE}/v5/market/tickers?category=linear&symbol=${symbol}`);
      const tickerData = await tickerRes.json();

      if (tickerData.retCode === 0 && tickerData.result?.list?.[0]) {
        const ticker = tickerData.result.list[0];
        const price = parseFloat(ticker.lastPrice);
        const fundingRate = parseFloat(ticker.fundingRate);
        const oiValue = parseFloat(ticker.openInterest) * price;

        if (price > 0) {
          dataStore.addPrice('bybit', coin, price);
        }
        dataStore.addFunding('bybit', coin, fundingRate);
        if (oiValue > 0) {
          dataStore.addOI('bybit', coin, oiValue);
        }
      }

      // Fetch orderbook
      const depthRes = await fetchWithTimeout(`${BYBIT_API_BASE}/v5/market/orderbook?category=linear&symbol=${symbol}&limit=10`);
      const depthData = await depthRes.json();

      if (depthData.retCode === 0 && depthData.result) {
        const depth = depthData.result;
        let bidVol = 0, askVol = 0;
        depth.b.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
        depth.a.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));

        const totalVol = bidVol + askVol;
        const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;
        dataStore.addOrderbook('bybit', coin, imbalance, bidVol, askVol);
      }

      // Fetch recent trades for CVD
      const tradesRes = await fetchWithTimeout(`${BYBIT_API_BASE}/v5/market/recent-trade?category=linear&symbol=${symbol}&limit=100`);
      const tradesData = await tradesRes.json();

      let buyVol = 0, sellVol = 0;
      if (tradesData.retCode === 0 && tradesData.result?.list) {
        tradesData.result.list.forEach(trade => {
          const vol = parseFloat(trade.price) * parseFloat(trade.size);
          if (trade.side === 'Buy') {
            buyVol += vol;
          } else {
            sellVol += vol;
          }
        });
      }
      const delta = buyVol - sellVol;
      dataStore.addCVD('bybit', coin, delta);

      // Update exchange flow for BTC perp
      if (coin === 'BTC') {
        dataStore.updateExchangeFlow('BTC', 'bybit', 'perp', {
          buyVol,
          sellVol,
          timestamp: Date.now()
        });
      }
    }

    console.log('[Bybit] Data fetched successfully');
  } catch (error) {
    const errorType = error.name === 'AbortError' ? 'TIMEOUT' : error.name || 'ERROR';
    console.error(`[Bybit] Fetch ${errorType}:`, error.message);
  }
}

// ============== NADO WORKER ==============

async function fetchNadoData() {
  try {
    const productMap = { 'BTC': 2, 'ETH': 4, 'SOL': 8 };

    // Fetch prices
    const priceRes = await fetchWithTimeout(NADO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perp_prices: { product_ids: Object.values(productMap) } })
    });
    const priceData = await priceRes.json();

    // Fetch funding
    const fundingRes = await fetchWithTimeout(NADO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funding_rates: { product_ids: Object.values(productMap) } })
    });
    const fundingData = await fundingRes.json();

    // Fetch OI (market snapshots)
    const snapshotRes = await fetchWithTimeout(NADO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_snapshots: { interval: { count: 1, granularity: 3600 }, product_ids: Object.values(productMap) } })
    });
    const snapshotData = await snapshotRes.json();

    for (const coin of COINS) {
      const productId = productMap[coin];

      // Price
      const coinPrice = priceData?.[productId];
      if (coinPrice) {
        const markPx = parseFloat(coinPrice.mark_price_x18) / 1e18;
        if (markPx > 0) {
          dataStore.addPrice('nado', coin, markPx);
        }
      }

      // Funding
      const coinFunding = fundingData?.[productId];
      if (coinFunding) {
        const rate = parseFloat(coinFunding.funding_rate_x18) / 1e18 / 24;
        dataStore.addFunding('nado', coin, rate);
      }
    }

    // OI from snapshots
    if (snapshotData?.snapshots) {
      for (const snapshot of snapshotData.snapshots) {
        const productId = snapshot.product_id;
        const coin = Object.entries(productMap).find(([_, id]) => id === productId)?.[0];
        if (coin && snapshot.open_interest_x18) {
          const oiValue = parseFloat(snapshot.open_interest_x18) / 1e18;
          if (oiValue > 0) {
            dataStore.addOI('nado', coin, oiValue);
          }
        }
      }
    }

    console.log('[Nado] Data fetched successfully');
  } catch (error) {
    const errorType = error.name === 'AbortError' ? 'TIMEOUT' : error.name || 'ERROR';
    console.error(`[Nado] Fetch ${errorType}:`, error.message);
  }
}

// ============== ASTERDEX WORKER ==============

async function fetchAsterDexData() {
  try {
    const symbolMap = { 'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT' };

    for (const coin of COINS) {
      const symbol = symbolMap[coin];

      // Fetch ticker
      const tickerRes = await fetchWithTimeout(`${ASTERDEX_API}/fapi/v1/ticker/24hr?symbol=${symbol}`);
      const ticker = await tickerRes.json();

      // Fetch funding
      const fundingRes = await fetchWithTimeout(`${ASTERDEX_API}/fapi/v1/premiumIndex?symbol=${symbol}`);
      const fundingInfo = await fundingRes.json();

      // Fetch OI
      const oiRes = await fetchWithTimeout(`${ASTERDEX_API}/fapi/v1/openInterest?symbol=${symbol}`);
      const oiInfo = await oiRes.json();

      // Fetch orderbook
      const depthRes = await fetchWithTimeout(`${ASTERDEX_API}/fapi/v1/depth?symbol=${symbol}&limit=10`);
      const depth = await depthRes.json();

      const price = parseFloat(ticker.lastPrice);
      if (price > 0) {
        dataStore.addPrice('asterdex', coin, parseFloat(fundingInfo.markPrice));
      }

      const rate = parseFloat(fundingInfo.lastFundingRate);
      dataStore.addFunding('asterdex', coin, rate);

      const oiValue = parseFloat(oiInfo.openInterest) * price;
      if (oiValue > 0) {
        dataStore.addOI('asterdex', coin, oiValue);
      }

      if (depth.bids && depth.asks) {
        let bidVol = 0, askVol = 0;
        depth.bids.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
        depth.asks.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));

        const totalVol = bidVol + askVol;
        const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;
        dataStore.addOrderbook('asterdex', coin, imbalance, bidVol, askVol);
      }

      // Fetch recent trades for CVD
      const tradesRes = await fetchWithTimeout(`${ASTERDEX_API}/fapi/v1/trades?symbol=${symbol}&limit=100`);
      const trades = await tradesRes.json();

      let buyVol = 0, sellVol = 0;
      if (Array.isArray(trades)) {
        trades.forEach(trade => {
          const vol = parseFloat(trade.price) * parseFloat(trade.qty);
          if (trade.isBuyerMaker) {
            sellVol += vol;
          } else {
            buyVol += vol;
          }
        });
      }
      const cvdDelta = buyVol - sellVol;
      dataStore.addCVD('asterdex', coin, cvdDelta);
    }

    console.log('[AsterDex] Data fetched successfully');
  } catch (error) {
    const errorType = error.name === 'AbortError' ? 'TIMEOUT' : error.name || 'ERROR';
    console.error(`[AsterDex] Fetch ${errorType}:`, error.message);
  }
}

// ============== WORKER SCHEDULER ==============

function startDataCollection() {
  console.log('[DataCollector] Starting data collection workers...');

  // Initial fetch (staggered to avoid API rate limits)
  setTimeout(() => fetchHyperliquidData(), 1000);
  setTimeout(() => fetchBinanceData(), 3000);
  setTimeout(() => fetchBybitData(), 5000);
  setTimeout(() => fetchNadoData(), 7000);
  setTimeout(() => fetchAsterDexData(), 9000);

  // Set intervals for continuous collection
  setInterval(fetchHyperliquidData, 10000); // Every 10 seconds
  setInterval(fetchBinanceData, 10000);     // Every 10 seconds
  setInterval(fetchBybitData, 10000);       // Every 10 seconds
  setInterval(fetchNadoData, 60000);        // Every 60 seconds (slower API)
  setInterval(fetchAsterDexData, 10000);    // Every 10 seconds

  console.log('[DataCollector] Workers started successfully');
}

/**
 * Get flow data for Hyperliquid perp
 * @param {number} windowMs - Rolling window in ms (default 15m)
 */
function getHyperliquidFlow(windowMs = DEFAULT_FLOW_WINDOW_MS) {
  const now = Date.now();
  const cutoff = now - windowMs;

  const buyVol = perpFlowState.hyperliquid.buys
    .filter(e => e.timestamp >= cutoff)
    .reduce((sum, e) => sum + e.value, 0);
  const sellVol = perpFlowState.hyperliquid.sells
    .filter(e => e.timestamp >= cutoff)
    .reduce((sum, e) => sum + e.value, 0);

  return { buyVol, sellVol, timestamp: now };
}

/**
 * Get flow data for Binance perp
 * @param {number} windowMs - Rolling window in ms (default 15m)
 */
function getBinancePerpFlow(windowMs = DEFAULT_FLOW_WINDOW_MS) {
  const now = Date.now();
  const cutoff = now - windowMs;

  const buyVol = perpFlowState.binance.buys
    .filter(e => e.timestamp >= cutoff)
    .reduce((sum, e) => sum + e.value, 0);
  const sellVol = perpFlowState.binance.sells
    .filter(e => e.timestamp >= cutoff)
    .reduce((sum, e) => sum + e.value, 0);

  return { buyVol, sellVol, timestamp: now };
}

module.exports = {
  startDataCollection,
  getHyperliquidFlow,
  getBinancePerpFlow
};
