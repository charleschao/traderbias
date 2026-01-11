/**
 * ETF Flow Collector Module
 *
 * Scrapes Bitcoin ETF flow data from farside.co.uk
 * Tracks IBIT, FBTC, ARKB, BITB, GBTC and Total net flows
 * Polls every 30 minutes with aggressive caching
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const dataStore = require('./dataStore');

// Configuration
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const FARSIDE_URL = 'https://farside.co.uk/btc/';
const JSON_FALLBACK_PATH = path.join(__dirname, 'data', 'etf-flows.json');
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

// Column mapping for farside.co.uk table (0-indexed)
// Columns: Date, Total, IBIT, FBTC, BITB, ARKB, BTCO, EZBC, BRRR, HODL, BTCW, GBTC, BTC
const ETF_COLUMNS = {
  DATE: 0,
  TOTAL: 1,
  IBIT: 2,
  FBTC: 3,
  BITB: 4,
  ARKB: 5,
  GBTC: 11  // GBTC is further right
};

const TRACKED_ETFS = ['IBIT', 'FBTC', 'ARKB', 'BITB', 'GBTC'];

// ETF flow thresholds (in USD millions - farside reports in millions)
const FLOW_THRESHOLDS = {
  STRONG: 200,    // $200M
  MODERATE: 100,  // $100M
  MILD: 50        // $50M
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
 * Parse flow value from table cell
 * Handles formats: "123.4", "(123.4)" for negative, "-", empty
 */
function parseFlowValue(text) {
  if (!text) return 0;

  const cleaned = text.trim();
  if (cleaned === '-' || cleaned === '' || cleaned === '−') return 0;

  // Check for parentheses (negative) and clean
  const isNegative = cleaned.includes('(') && cleaned.includes(')');
  const numStr = cleaned.replace(/[\(\),]/g, '').trim();

  const value = parseFloat(numStr);
  if (isNaN(value)) return 0;

  return isNegative ? -value : value;
}

/**
 * Scrape ETF flow data from farside.co.uk
 */
async function fetchEtfFlows() {
  try {
    console.log('[ETF Collector] Scraping farside.co.uk/btc/...');

    const { data } = await axios.get(FARSIDE_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TraderBiasBot/1.0)'
      }
    });

    const $ = cheerio.load(data);
    const flows = [];

    // Find the main data table
    $('table tbody tr').each((i, row) => {
      const cols = $(row).find('td');
      if (cols.length < 10) return; // Skip header or invalid rows

      const dateStr = $(cols[ETF_COLUMNS.DATE]).text().trim();

      // Only rows with date like "09 Jan 2026"
      if (!dateStr.match(/\d{2} \w{3} \d{4}/)) return;

      // Parse individual ETF flows (values in millions USD)
      const rowData = {
        date: dateStr,
        total: parseFlowValue($(cols[ETF_COLUMNS.TOTAL]).text()),
        IBIT: parseFlowValue($(cols[ETF_COLUMNS.IBIT]).text()),
        FBTC: parseFlowValue($(cols[ETF_COLUMNS.FBTC]).text()),
        BITB: parseFlowValue($(cols[ETF_COLUMNS.BITB]).text()),
        ARKB: parseFlowValue($(cols[ETF_COLUMNS.ARKB]).text()),
        GBTC: cols.length > ETF_COLUMNS.GBTC ? parseFlowValue($(cols[ETF_COLUMNS.GBTC]).text()) : 0
      };

      flows.push(rowData);
    });

    if (flows.length === 0) {
      console.error('[ETF Collector] No data rows found in farside table');
      return null;
    }

    // Reverse so newest (top of table) comes first
    flows.reverse();

    console.log(`[ETF Collector] Scraped ${flows.length} rows from farside.co.uk`);
    console.log(`[ETF Collector] Latest: ${flows[0]?.date} | Total: $${flows[0]?.total}M`);

    return flows;

  } catch (error) {
    console.error('[ETF Collector] Scrape failed:', error.message);
    if (error.response) {
      console.error('[ETF Collector] HTTP status:', error.response.status);
    }
    return null;
  }
}

/**
 * Parse and normalize ETF flow data from scrape result
 */
function parseEtfFlowData(flows) {
  if (!flows || flows.length === 0) {
    console.log('[ETF Collector] No flows data');
    return null;
  }

  // Get the most recent day's data (first row after reverse)
  const latest = flows[0];

  // Build breakdown object (values are in millions from farside)
  const breakdown = {};
  for (const etf of TRACKED_ETFS) {
    if (latest[etf] !== undefined && latest[etf] !== 0) {
      breakdown[etf] = {
        flow: latest[etf] * 1000000  // Convert millions to USD
      };
    }
  }

  // Net flow in USD (farside reports in millions)
  const netFlow = (latest.total || 0) * 1000000;

  console.log(`[ETF Collector] Parsed: date=${latest.date} netFlow=$${latest.total}M`);

  // Log individual ETF flows
  const etfSummary = TRACKED_ETFS
    .filter(etf => latest[etf] !== 0)
    .map(etf => `${etf}:$${latest[etf]}M`)
    .join(', ');
  if (etfSummary) {
    console.log(`[ETF Collector] Breakdown: ${etfSummary}`);
  }

  return {
    today: {
      ...breakdown,
      netFlow,
      netFlowM: latest.total,
      date: latest.date,
      source: 'farside'
    },
    history: flows.slice(0, 7).map(f => ({
      date: f.date,
      netFlow: f.total * 1000000,
      netFlowM: f.total,
      IBIT: f.IBIT * 1000000,
      FBTC: f.FBTC * 1000000,
      ARKB: f.ARKB * 1000000,
      GBTC: f.GBTC * 1000000
    })),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Load ETF data from fallback JSON file
 */
function loadFromJsonFallback() {
  try {
    if (!fs.existsSync(JSON_FALLBACK_PATH)) {
      console.log('[ETF Collector] No JSON fallback file found');
      return null;
    }

    const jsonData = JSON.parse(fs.readFileSync(JSON_FALLBACK_PATH, 'utf8'));
    console.log(`[ETF Collector] Loaded from JSON fallback: ${jsonData.today?.date}`);

    // Convert to same format as scraped data
    const today = jsonData.today;
    const breakdown = {};

    for (const etf of TRACKED_ETFS) {
      if (today[etf] !== undefined && today[etf] !== 0) {
        breakdown[etf] = {
          flow: today[etf] * 1000000  // Convert millions to USD
        };
      }
    }

    return {
      today: {
        ...breakdown,
        netFlow: today.netFlowM * 1000000,
        netFlowM: today.netFlowM,
        date: today.date,
        source: 'json-fallback'
      },
      history: (jsonData.history || []).map(h => ({
        date: h.date,
        netFlow: h.netFlowM * 1000000,
        netFlowM: h.netFlowM,
        IBIT: (h.IBIT || 0) * 1000000,
        FBTC: (h.FBTC || 0) * 1000000,
        ARKB: (h.ARKB || 0) * 1000000,
        GBTC: (h.GBTC || 0) * 1000000
      })),
      lastUpdated: jsonData.lastUpdated
    };
  } catch (error) {
    console.error('[ETF Collector] Failed to load JSON fallback:', error.message);
    return null;
  }
}

/**
 * Update ETF flow data in dataStore
 * Priority: JSON file first (updated via git), scraping as fallback
 */
async function updateEtfFlows() {
  console.log('[ETF Collector] Loading ETF flow data...');

  let parsedData = null;

  // Try JSON file first (this is the primary source on VPS)
  parsedData = loadFromJsonFallback();

  if (parsedData) {
    console.log('[ETF Collector] Using JSON file data');
  } else {
    // Only try scraping if JSON not available (for local dev)
    console.log('[ETF Collector] No JSON file, trying farside.co.uk scrape...');
    const rawData = await fetchEtfFlows();
    if (rawData) {
      parsedData = parseEtfFlowData(rawData);
    }
  }

  if (!parsedData) {
    console.warn('[ETF Collector] No data available from any source');
    return false;
  }


  const now = Date.now();
  const marketStatus = getMarketStatus();

  // Update dataStore
  dataStore.updateEtfFlows({
    lastUpdated: now,
    marketStatus,
    today: parsedData.today,
    history: parsedData.history,
    apiTimestamp: parsedData.lastUpdated
  });

  lastSuccessfulFetch = now;

  const netFlowM = parsedData.today.netFlowM;
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
  const netFlowM = netFlow / 1000000; // Convert to millions for threshold comparison

  let score = 0;
  let signal = 'NEUTRAL';

  // Calculate score based on thresholds (values in millions)
  if (netFlowM >= FLOW_THRESHOLDS.STRONG) {
    score = 0.85;
    signal = 'STRONG_INFLOW';
  } else if (netFlowM >= FLOW_THRESHOLDS.MODERATE) {
    score = 0.60;
    signal = 'MODERATE_INFLOW';
  } else if (netFlowM >= FLOW_THRESHOLDS.MILD) {
    score = 0.30;
    signal = 'MILD_INFLOW';
  } else if (netFlowM <= -FLOW_THRESHOLDS.STRONG) {
    score = -0.85;
    signal = 'STRONG_OUTFLOW';
  } else if (netFlowM <= -FLOW_THRESHOLDS.MODERATE) {
    score = -0.60;
    signal = 'MODERATE_OUTFLOW';
  } else if (netFlowM <= -FLOW_THRESHOLDS.MILD) {
    score = -0.30;
    signal = 'MILD_OUTFLOW';
  }

  return {
    score,
    signal,
    netFlow,
    netFlowM,
    date: etfData.today.date,
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
  const { netFlow, breakdown, signal, date } = etfSignal;

  if (signal === 'NO_DATA' || signal === 'STALE_DATA') {
    return signal === 'NO_DATA' ? 'ETF data unavailable' : 'ETF data stale - using last known';
  }

  const netFlowStr = formatFlowAmount(netFlow);
  const parts = [`${date}: ${netFlowStr}`];

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
  console.log('[ETF Collector] Starting ETF flow collection (farside.co.uk)...');
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
    source: 'farside.co.uk',
    lastFetch: lastSuccessfulFetch ? new Date(lastSuccessfulFetch).toISOString() : null,
    hasData: etfData !== null && etfData.today !== null && etfData.today.netFlow !== undefined,
    latestDate: etfData?.today?.date || null,
    marketStatus: getMarketStatus(),
    trackedEtfs: TRACKED_ETFS,
    pollIntervalMinutes: POLL_INTERVAL_MS / 60000
  };
}

/**
 * Manual trigger for testing
 */
async function fetchNow() {
  return await updateEtfFlows();
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
  fetchNow,
  FLOW_THRESHOLDS,
  TRACKED_ETFS
};
