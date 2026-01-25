/**
 * Long/Short Ratio Collector
 *
 * Fetches BTC long/short positioning from Binance Futures:
 * - All Accounts ratio (retail sentiment)
 * - Top Traders ratio (smart money)
 *
 * Polls every 15 minutes, tracks daily high/low extremes, resets at midnight UTC
 */

const axios = require('axios');
const dataStore = require('./dataStore');

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const BINANCE_FUTURES_BASE = 'https://fapi.binance.com';

let pollInterval = null;
let lastFetchTime = null;

/**
 * Fetch all accounts long/short ratio from Binance
 */
async function fetchAllAccountsRatio() {
  try {
    const response = await axios.get(`${BINANCE_FUTURES_BASE}/futures/data/globalLongShortAccountRatio`, {
      params: {
        symbol: 'BTCUSDT',
        period: '1h',
        limit: 1
      },
      timeout: 10000
    });

    if (response.data && response.data.length > 0) {
      const latest = response.data[0];
      return {
        longPct: parseFloat(latest.longAccount) * 100,
        shortPct: parseFloat(latest.shortAccount) * 100,
        ratio: parseFloat(latest.longShortRatio),
        timestamp: latest.timestamp
      };
    }
    return null;
  } catch (error) {
    console.error('[L/S Collector] Failed to fetch all accounts ratio:', error.message);
    return null;
  }
}

/**
 * Fetch top traders long/short ratio (by position) from Binance
 */
async function fetchTopTradersRatio() {
  try {
    const response = await axios.get(`${BINANCE_FUTURES_BASE}/futures/data/topLongShortPositionRatio`, {
      params: {
        symbol: 'BTCUSDT',
        period: '1h',
        limit: 1
      },
      timeout: 10000
    });

    if (response.data && response.data.length > 0) {
      const latest = response.data[0];
      return {
        longPct: parseFloat(latest.longAccount) * 100,
        shortPct: parseFloat(latest.shortAccount) * 100,
        ratio: parseFloat(latest.longShortRatio),
        timestamp: latest.timestamp
      };
    }
    return null;
  } catch (error) {
    console.error('[L/S Collector] Failed to fetch top traders ratio:', error.message);
    return null;
  }
}

/**
 * Check if we need to reset daily extremes (midnight UTC)
 */
function shouldResetDaily(currentResetAt) {
  if (!currentResetAt) return true;

  const now = new Date();
  const resetDate = new Date(currentResetAt);

  // Reset if we're past the reset time
  return now >= resetDate;
}

/**
 * Calculate next midnight UTC
 */
function getNextMidnightUTC() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow.toISOString();
}

/**
 * Update daily extremes
 */
function updateDailyExtremes(daily, source, longPct) {
  if (!daily[source]) {
    daily[source] = { highLongPct: longPct, lowLongPct: longPct };
  } else {
    daily[source].highLongPct = Math.max(daily[source].highLongPct, longPct);
    daily[source].lowLongPct = Math.min(daily[source].lowLongPct, longPct);
  }
}

/**
 * Main update function - fetches both ratios and updates dataStore
 */
async function updateLongShortData() {
  console.log('[L/S Collector] Fetching long/short ratios...');

  const [allAccounts, topTraders] = await Promise.all([
    fetchAllAccountsRatio(),
    fetchTopTradersRatio()
  ]);

  if (!allAccounts && !topTraders) {
    console.warn('[L/S Collector] Both fetches failed');
    return false;
  }

  // Get current data to preserve daily extremes
  let currentData = dataStore.getLongShortData();

  // Check if we need to reset daily extremes
  if (!currentData || shouldResetDaily(currentData.resetAt)) {
    console.log('[L/S Collector] Resetting daily extremes (midnight UTC)');
    currentData = {
      allAccounts: null,
      topTraders: null,
      daily: {},
      resetAt: getNextMidnightUTC()
    };
  }

  const now = new Date().toISOString();

  // Update all accounts data
  if (allAccounts) {
    currentData.allAccounts = {
      longPct: allAccounts.longPct,
      shortPct: allAccounts.shortPct,
      ratio: allAccounts.ratio,
      updatedAt: now
    };
    updateDailyExtremes(currentData.daily, 'allAccounts', allAccounts.longPct);
    console.log(`[L/S Collector] All Accounts: ${allAccounts.longPct.toFixed(1)}% long`);
  }

  // Update top traders data
  if (topTraders) {
    currentData.topTraders = {
      longPct: topTraders.longPct,
      shortPct: topTraders.shortPct,
      ratio: topTraders.ratio,
      updatedAt: now
    };
    updateDailyExtremes(currentData.daily, 'topTraders', topTraders.longPct);
    console.log(`[L/S Collector] Top Traders: ${topTraders.longPct.toFixed(1)}% long`);
  }

  // Calculate divergence
  if (currentData.allAccounts && currentData.topTraders) {
    const diff = currentData.allAccounts.longPct - currentData.topTraders.longPct;
    currentData.divergence = {
      pctDiff: parseFloat(diff.toFixed(2)),
      signal: Math.abs(diff) >= 5 ? 'DIVERGENT' : 'ALIGNED'
    };
    console.log(`[L/S Collector] Divergence: ${diff.toFixed(1)}% (${currentData.divergence.signal})`);
  }

  // Store the updated data
  dataStore.updateLongShortData(currentData);
  lastFetchTime = Date.now();

  return true;
}

/**
 * Start the collector
 */
function startLongShortCollection() {
  console.log('[L/S Collector] Starting long/short ratio collection...');
  console.log(`[L/S Collector] Poll interval: ${POLL_INTERVAL_MS / 60000} minutes`);

  // Initial fetch
  updateLongShortData();

  // Set up polling
  pollInterval = setInterval(() => {
    updateLongShortData();
  }, POLL_INTERVAL_MS);

  console.log('[L/S Collector] Collection started');
}

/**
 * Stop the collector
 */
function stopLongShortCollection() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[L/S Collector] Collection stopped');
  }
}

/**
 * Get collector status
 */
function getCollectorStatus() {
  return {
    running: pollInterval !== null,
    lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    pollIntervalMinutes: POLL_INTERVAL_MS / 60000
  };
}

/**
 * Manual fetch for testing
 */
async function fetchNow() {
  return await updateLongShortData();
}

module.exports = {
  startLongShortCollection,
  stopLongShortCollection,
  getCollectorStatus,
  fetchNow
};
