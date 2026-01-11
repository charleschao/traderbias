/**
 * ETF Flow Collector Module
 *
 * Collects Bitcoin ETF flow data from SoSoValue API
 * Tracks IBIT, FBTC, ARKB (top 3 by volume, ~85% of market)
 * Polls every 30 minutes with aggressive caching
 */

const https = require('https');
const dataStore = require('./dataStore');

// Configuration
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const TRACKED_ETFS = ['IBIT', 'FBTC', 'ARKB'];
const SOSOVALUE_API_BASE = 'https://api.sosovalue.com';
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

// ETF flow thresholds (in USD)
const FLOW_THRESHOLDS = {
  STRONG: 200000000,   // $200M
  MODERATE: 100000000, // $100M
  MILD: 50000000       // $50M
};

let pollInterval = null;
let lastSuccessfulFetch = null;

/**
 * Check if US ETF market is open
 * Trading hours: 9:30 AM - 4:00 PM ET (Mon-Fri)
 */
function isMarketOpen() {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const day = etTime.getDay();
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Weekend check
  if (day === 0 || day === 6) {
    return false;
  }

  // Market hours: 9:30 AM (570 min) to 4:00 PM (960 min)
  const marketOpen = 9 * 60 + 30;  // 9:30 AM
  const marketClose = 16 * 60;      // 4:00 PM

  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}

/**
 * Get market status string
 */
function getMarketStatus() {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const day = etTime.getDay();
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  if (day === 0 || day === 6) {
    return 'weekend';
  }

  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const preMarketStart = 4 * 60; // 4:00 AM

  if (timeInMinutes < preMarketStart) {
    return 'closed';
  } else if (timeInMinutes < marketOpen) {
    return 'pre-market';
  } else if (timeInMinutes < marketClose) {
    return 'open';
  } else {
    return 'after-hours';
  }
}

/**
 * Make HTTPS request (Promise wrapper)
 */
function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'User-Agent': 'TraderBias/1.0'
      },
      timeout: 15000,
      rejectUnauthorized: false  // Allow self-signed certs
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          data,
          ok: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Fetch ETF flow data from SoSoValue API
 */
async function fetchEtfFlows() {
  const apiKey = process.env.SOSOVALUE_API_KEY;

  if (!apiKey) {
    console.warn('[ETF Collector] SOSOVALUE_API_KEY not set in environment');
    return null;
  }

  // Try multiple endpoint formats
  const endpoints = [
    {
      url: 'https://sosovalue.com/api/v1/etf/btc-spot/fund-flows-summary',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    },
    {
      url: 'https://api.sosovalue.xyz/api/v1/etf/btc-spot/fund-flows-summary',
      headers: { 'X-API-Key': apiKey }
    },
    {
      url: 'https://sosovalue.xyz/api/etf/btc/flows',
      headers: { 'apikey': apiKey }
    },
    {
      url: 'https://data.sosovalue.com/api/v1/btc-etf/flows',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`[ETF Collector] Trying: ${endpoint.url}`);

      const response = await httpsGet(endpoint.url, endpoint.headers);

      console.log(`[ETF Collector] Response: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = JSON.parse(response.data);
        console.log('[ETF Collector] Success! Got data from:', endpoint.url);
        return data;
      }

      // Log response body for debugging
      console.log(`[ETF Collector] Response body: ${response.data.substring(0, 200)}`);

    } catch (error) {
      console.error(`[ETF Collector] Error with ${endpoint.url}:`, error.message);
    }
  }

  console.error('[ETF Collector] All endpoints failed');
  return null;
}

/**
 * Parse and normalize ETF flow data from API response
 */
function parseEtfFlowData(apiResponse) {
  if (!apiResponse || !apiResponse.data) {
    return null;
  }

  const flows = {};
  let netFlow = 0;

  // Handle different API response formats
  const etfData = apiResponse.data.etfs || apiResponse.data.funds || apiResponse.data || [];

  for (const etf of etfData) {
    const ticker = etf.ticker || etf.symbol || etf.name;

    if (!TRACKED_ETFS.includes(ticker?.toUpperCase())) {
      continue;
    }

    const flow = parseFloat(etf.netFlow || etf.flow || etf.dailyFlow || 0);
    const price = parseFloat(etf.price || etf.nav || 0);

    flows[ticker.toUpperCase()] = {
      flow,
      price,
      aum: parseFloat(etf.aum || etf.totalAssets || 0)
    };

    netFlow += flow;
  }

  // If we didn't get tracked ETFs, try to extract from totals
  if (Object.keys(flows).length === 0 && apiResponse.data.totalNetFlow !== undefined) {
    return {
      today: {
        netFlow: parseFloat(apiResponse.data.totalNetFlow),
        breakdown: {},
        source: 'aggregate'
      },
      lastUpdated: apiResponse.data.date || new Date().toISOString()
    };
  }

  if (Object.keys(flows).length === 0) {
    return null;
  }

  return {
    today: {
      ...flows,
      netFlow,
      source: 'detailed'
    },
    lastUpdated: apiResponse.data.date || apiResponse.timestamp || new Date().toISOString()
  };
}

/**
 * Update ETF flow data in dataStore
 */
async function updateEtfFlows() {
  console.log('[ETF Collector] Fetching ETF flow data...');

  const rawData = await fetchEtfFlows();

  if (!rawData) {
    console.warn('[ETF Collector] No data received, using cached data if available');
    return false;
  }

  const parsedData = parseEtfFlowData(rawData);

  if (!parsedData) {
    console.warn('[ETF Collector] Failed to parse ETF data');
    return false;
  }

  const now = Date.now();
  const marketStatus = getMarketStatus();

  // Update dataStore
  dataStore.updateEtfFlows({
    lastUpdated: now,
    marketStatus,
    today: parsedData.today,
    apiTimestamp: parsedData.lastUpdated
  });

  lastSuccessfulFetch = now;

  const netFlowM = (parsedData.today.netFlow / 1000000).toFixed(1);
  console.log(`[ETF Collector] Updated: Net flow $${netFlowM}M | Market: ${marketStatus}`);

  return true;
}

/**
 * Calculate ETF flow signal for Daily Bias algorithm
 * Returns score between -1 and +1 based on flow thresholds
 */
function calculateEtfFlowSignal() {
  const etfData = dataStore.getEtfFlows();

  if (!etfData || !etfData.today) {
    return {
      score: 0,
      signal: 'NO_DATA',
      netFlow: 0,
      breakdown: {},
      dataAge: null,
      marketStatus: getMarketStatus()
    };
  }

  const now = Date.now();
  const dataAge = now - etfData.lastUpdated;
  const dataAgeMinutes = Math.round(dataAge / 60000);

  // Check for stale data during market hours
  if (isMarketOpen() && dataAge > STALE_THRESHOLD_MS) {
    return {
      score: 0,
      signal: 'STALE_DATA',
      netFlow: etfData.today.netFlow || 0,
      breakdown: extractBreakdown(etfData.today),
      dataAge: `${dataAgeMinutes} min (stale)`,
      marketStatus: getMarketStatus()
    };
  }

  const netFlow = etfData.today.netFlow || 0;
  let score = 0;
  let signal = 'NEUTRAL';

  // Calculate score based on thresholds
  if (netFlow >= FLOW_THRESHOLDS.STRONG) {
    score = 0.85;
    signal = 'STRONG_INFLOW';
  } else if (netFlow >= FLOW_THRESHOLDS.MODERATE) {
    score = 0.60;
    signal = 'MODERATE_INFLOW';
  } else if (netFlow >= FLOW_THRESHOLDS.MILD) {
    score = 0.30;
    signal = 'MILD_INFLOW';
  } else if (netFlow <= -FLOW_THRESHOLDS.STRONG) {
    score = -0.85;
    signal = 'STRONG_OUTFLOW';
  } else if (netFlow <= -FLOW_THRESHOLDS.MODERATE) {
    score = -0.60;
    signal = 'MODERATE_OUTFLOW';
  } else if (netFlow <= -FLOW_THRESHOLDS.MILD) {
    score = -0.30;
    signal = 'MILD_OUTFLOW';
  }

  return {
    score,
    signal,
    netFlow,
    breakdown: extractBreakdown(etfData.today),
    dataAge: `${dataAgeMinutes} min`,
    marketStatus: etfData.marketStatus || getMarketStatus()
  };
}

/**
 * Extract breakdown of individual ETF flows
 */
function extractBreakdown(todayData) {
  const breakdown = {};

  for (const etf of TRACKED_ETFS) {
    if (todayData[etf]) {
      breakdown[etf] = todayData[etf].flow || 0;
    }
  }

  return breakdown;
}

/**
 * Format flow amount for display
 */
function formatFlowAmount(amount) {
  const absAmount = Math.abs(amount);
  const sign = amount >= 0 ? '+' : '-';

  if (absAmount >= 1000000000) {
    return `${sign}$${(absAmount / 1000000000).toFixed(2)}B`;
  } else if (absAmount >= 1000000) {
    return `${sign}$${(absAmount / 1000000).toFixed(1)}M`;
  } else if (absAmount >= 1000) {
    return `${sign}$${(absAmount / 1000).toFixed(0)}K`;
  }

  return `${sign}$${absAmount.toFixed(0)}`;
}

/**
 * Generate description for ETF flow signal
 */
function generateFlowDescription(etfSignal) {
  const { netFlow, breakdown, signal } = etfSignal;

  if (signal === 'NO_DATA' || signal === 'STALE_DATA') {
    return signal === 'NO_DATA' ? 'ETF data unavailable' : 'ETF data stale - using last known';
  }

  const netFlowStr = formatFlowAmount(netFlow);
  const parts = [netFlowStr];

  // Add breakdown if available
  const breakdownStrs = [];
  for (const [etf, flow] of Object.entries(breakdown)) {
    if (flow !== 0) {
      breakdownStrs.push(`${etf} ${formatFlowAmount(flow)}`);
    }
  }

  if (breakdownStrs.length > 0) {
    parts.push(`(${breakdownStrs.join(', ')})`);
  }

  return `Net flow ${parts.join(' ')}`;
}

/**
 * Start ETF flow data collection
 */
function startEtfFlowCollection() {
  console.log('[ETF Collector] Starting ETF flow collection...');
  console.log(`[ETF Collector] Tracking: ${TRACKED_ETFS.join(', ')}`);
  console.log(`[ETF Collector] Poll interval: ${POLL_INTERVAL_MS / 60000} minutes`);

  // Initial fetch
  updateEtfFlows();

  // Set up polling interval
  pollInterval = setInterval(() => {
    updateEtfFlows();
  }, POLL_INTERVAL_MS);

  console.log('[ETF Collector] Collection started');
}

/**
 * Stop ETF flow data collection
 */
function stopEtfFlowCollection() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[ETF Collector] Collection stopped');
  }
}

/**
 * Get collector status
 */
function getCollectorStatus() {
  const etfData = dataStore.getEtfFlows();

  return {
    running: pollInterval !== null,
    lastFetch: lastSuccessfulFetch ? new Date(lastSuccessfulFetch).toISOString() : null,
    hasData: etfData !== null && etfData.today !== null && etfData.today.netFlow !== undefined,
    marketStatus: getMarketStatus(),
    trackedEtfs: TRACKED_ETFS,
    pollIntervalMinutes: POLL_INTERVAL_MS / 60000
  };
}

module.exports = {
  startEtfFlowCollection,
  stopEtfFlowCollection,
  calculateEtfFlowSignal,
  generateFlowDescription,
  formatFlowAmount,
  getCollectorStatus,
  isMarketOpen,
  getMarketStatus,
  FLOW_THRESHOLDS,
  TRACKED_ETFS
};
