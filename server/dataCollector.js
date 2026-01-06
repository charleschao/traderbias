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

// ============== HYPERLIQUID WORKER ==============

async function fetchHyperliquidData() {
  try {
    // Fetch prices
    const midsRes = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' })
    });
    const mids = await midsRes.json();

    // Fetch OI and funding
    const metaRes = await fetch(HYPERLIQUID_API, {
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
      const obRes = await fetch(HYPERLIQUID_API, {
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

      dataStore.addOrderbook('hyperliquid', coin, imbalance);
    }

    // Fetch CVD (recent trades)
    for (const coin of COINS) {
      const tradesRes = await fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'recentTrades', coin })
      });
      const trades = await tradesRes.json();

      let buyVol = 0, sellVol = 0;
      (trades || []).forEach(trade => {
        const vol = parseFloat(trade.sz) * parseFloat(trade.px);
        if (trade.side === 'B') buyVol += vol;
        else if (trade.side === 'A') sellVol += vol;
      });

      const delta = buyVol - sellVol;
      dataStore.addCVD('hyperliquid', coin, delta);
    }

    console.log('[Hyperliquid] Data fetched successfully');
  } catch (error) {
    console.error('[Hyperliquid] Fetch error:', error.message);
  }
}

// ============== BINANCE WORKER ==============

async function fetchBinanceData() {
  try {
    const symbolMap = { 'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT' };

    for (const coin of COINS) {
      const symbol = symbolMap[coin];

      // Fetch ticker (price)
      const tickerRes = await fetch(`${BINANCE_API_BASE}/fapi/v1/ticker/24hr?symbol=${symbol}`);
      const ticker = await tickerRes.json();
      const price = parseFloat(ticker.lastPrice);

      if (price > 0) {
        dataStore.addPrice('binance', coin, price);
      }

      // Fetch funding
      const fundingRes = await fetch(`${BINANCE_API_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`);
      const fundingInfo = await fundingRes.json();
      const rate = parseFloat(fundingInfo.lastFundingRate);
      dataStore.addFunding('binance', coin, rate);

      // Fetch OI
      const oiRes = await fetch(`${BINANCE_API_BASE}/fapi/v1/openInterest?symbol=${symbol}`);
      const oiInfo = await oiRes.json();
      const oiValue = parseFloat(oiInfo.openInterest) * price;
      if (oiValue > 0) {
        dataStore.addOI('binance', coin, oiValue);
      }

      // Fetch orderbook
      const depthRes = await fetch(`${BINANCE_API_BASE}/fapi/v1/depth?symbol=${symbol}&limit=10`);
      const depth = await depthRes.json();

      let bidVol = 0, askVol = 0;
      if (depth.bids) {
        depth.bids.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
        depth.asks.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));
      }

      const totalVol = bidVol + askVol;
      const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;
      dataStore.addOrderbook('binance', coin, imbalance);
    }

    console.log('[Binance] Data fetched successfully');
  } catch (error) {
    console.error('[Binance] Fetch error:', error.message);
  }
}

// ============== BYBIT WORKER ==============

async function fetchBybitData() {
  try {
    const symbolMap = { 'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT' };

    for (const coin of COINS) {
      const symbol = symbolMap[coin];

      // Fetch ticker
      const tickerRes = await fetch(`${BYBIT_API_BASE}/v5/market/tickers?category=linear&symbol=${symbol}`);
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
      const depthRes = await fetch(`${BYBIT_API_BASE}/v5/market/orderbook?category=linear&symbol=${symbol}&limit=10`);
      const depthData = await depthRes.json();

      if (depthData.retCode === 0 && depthData.result) {
        const depth = depthData.result;
        let bidVol = 0, askVol = 0;
        depth.b.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
        depth.a.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));

        const totalVol = bidVol + askVol;
        const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;
        dataStore.addOrderbook('bybit', coin, imbalance);
      }
    }

    console.log('[Bybit] Data fetched successfully');
  } catch (error) {
    console.error('[Bybit] Fetch error:', error.message);
  }
}

// ============== NADO WORKER ==============

async function fetchNadoData() {
  try {
    const productMap = { 'BTC': 2, 'ETH': 4, 'SOL': 8 };

    // Fetch prices
    const priceRes = await fetch(NADO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perp_prices: { product_ids: Object.values(productMap) } })
    });
    const priceData = await priceRes.json();

    // Fetch funding
    const fundingRes = await fetch(NADO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funding_rates: { product_ids: Object.values(productMap) } })
    });
    const fundingData = await fundingRes.json();

    // Fetch OI (market snapshots)
    const snapshotRes = await fetch(NADO_API, {
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
    console.error('[Nado] Fetch error:', error.message);
  }
}

// ============== ASTERDEX WORKER ==============

async function fetchAsterDexData() {
  try {
    const symbolMap = { 'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT' };

    for (const coin of COINS) {
      const symbol = symbolMap[coin];

      // Fetch ticker
      const tickerRes = await fetch(`${ASTERDEX_API}/fapi/v1/ticker/24hr?symbol=${symbol}`);
      const ticker = await tickerRes.json();

      // Fetch funding
      const fundingRes = await fetch(`${ASTERDEX_API}/fapi/v1/premiumIndex?symbol=${symbol}`);
      const fundingInfo = await fundingRes.json();

      // Fetch OI
      const oiRes = await fetch(`${ASTERDEX_API}/fapi/v1/openInterest?symbol=${symbol}`);
      const oiInfo = await oiRes.json();

      // Fetch orderbook
      const depthRes = await fetch(`${ASTERDEX_API}/fapi/v1/depth?symbol=${symbol}&limit=10`);
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
        dataStore.addOrderbook('asterdex', coin, imbalance);
      }
    }

    console.log('[AsterDex] Data fetched successfully');
  } catch (error) {
    console.error('[AsterDex] Fetch error:', error.message);
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
  setInterval(fetchHyperliquidData, 60000); // Every 60 seconds
  setInterval(fetchBinanceData, 60000);     // Every 60 seconds
  setInterval(fetchBybitData, 60000);       // Every 60 seconds
  setInterval(fetchNadoData, 120000);       // Every 120 seconds (slower API)
  setInterval(fetchAsterDexData, 60000);    // Every 60 seconds

  console.log('[DataCollector] Workers started successfully');
}

module.exports = {
  startDataCollection
};
