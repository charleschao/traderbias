/**
 * VWAP Calculator
 * Fetches Binance Futures klines and calculates calendar-anchored VWAPs
 */

const BINANCE_FUTURES_URL = 'https://fapi.binance.com';

/**
 * Get start of period in UTC milliseconds
 */
function getPeriodStart(period) {
  const now = new Date();
  const utcNow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes()
  ));

  switch (period) {
    case 'daily':
      return Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate());
    case 'weekly': {
      const day = utcNow.getUTCDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = 0
      return Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate() - diff);
    }
    case 'monthly':
      return Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), 1);
    case 'quarterly': {
      const quarter = Math.floor(utcNow.getUTCMonth() / 3);
      return Date.UTC(utcNow.getUTCFullYear(), quarter * 3, 1);
    }
    case 'yearly':
      return Date.UTC(utcNow.getUTCFullYear(), 0, 1);
    default:
      throw new Error(`Unknown period: ${period}`);
  }
}

/**
 * Get appropriate kline interval for period
 */
function getIntervalForPeriod(period) {
  switch (period) {
    case 'daily': return '1m';
    case 'weekly': return '15m';
    case 'monthly': return '1h';
    case 'quarterly': return '1h';
    case 'yearly': return '4h';
    default: return '1h';
  }
}

/**
 * Fetch klines from Binance Futures
 */
async function fetchKlines(symbol, interval, startTime, endTime) {
  const url = new URL(`${BINANCE_FUTURES_URL}/fapi/v1/klines`);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('startTime', startTime.toString());
  url.searchParams.set('endTime', endTime.toString());
  url.searchParams.set('limit', '1500');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Calculate VWAP from klines
 * VWAP = Sum(typical_price * volume) / Sum(volume)
 * typical_price = (high + low + close) / 3
 */
function calculateVwapFromKlines(klines) {
  if (!klines || klines.length === 0) return null;

  let sumPriceVolume = 0;
  let sumVolume = 0;

  for (const k of klines) {
    const high = parseFloat(k[2]);
    const low = parseFloat(k[3]);
    const close = parseFloat(k[4]);
    const volume = parseFloat(k[5]);

    const typicalPrice = (high + low + close) / 3;
    sumPriceVolume += typicalPrice * volume;
    sumVolume += volume;
  }

  if (sumVolume === 0) return null;
  return sumPriceVolume / sumVolume;
}

/**
 * Calculate VWAP for a specific period
 */
async function calculatePeriodVwap(symbol, period) {
  const startTime = getPeriodStart(period);
  const endTime = Date.now();
  const interval = getIntervalForPeriod(period);

  try {
    const klines = await fetchKlines(symbol, interval, startTime, endTime);
    const vwap = calculateVwapFromKlines(klines);
    return {
      price: vwap ? Math.round(vwap * 100) / 100 : null,
      calculatedAt: Date.now(),
      period,
      startTime,
      klineCount: klines?.length || 0
    };
  } catch (error) {
    console.error(`[VWAP] Error calculating ${period} VWAP:`, error.message);

    // Fallback for Geo-Restricted users (HTTP 451/403) or other API errors
    // Returns estimated mock values relative to a base price (~95k) to allow UI testing
    if (error.message.includes('451') || error.message.includes('403') || error.message.includes('fetch failed')) {
      console.log(`[VWAP] returning mock data for ${period} (Geo-block detected)`);
      const mockBase = 96500;
      const multipliers = {
        daily: 1.002,   // Slightly above
        weekly: 0.985,  // Support below
        monthly: 0.95,  // Lower support
        quarterly: 0.85, // Deep support
        yearly: 0.75     // Macro support
      };

      return {
        price: Math.round(mockBase * (multipliers[period] || 0.9) * 100) / 100,
        calculatedAt: Date.now(),
        period,
        isMock: true
      };
    }

    return { price: null, calculatedAt: Date.now(), period, error: error.message };
  }
}

/**
 * Calculate all VWAP levels for a symbol
 */
async function calculateAllVwaps(symbol = 'BTCUSDT') {
  console.log(`[VWAP] Calculating all VWAPs for ${symbol}...`);

  const periods = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
  const results = {};

  for (const period of periods) {
    results[period] = await calculatePeriodVwap(symbol, period);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[VWAP] Calculated: D=${results.daily?.price}, W=${results.weekly?.price}, M=${results.monthly?.price}, Q=${results.quarterly?.price}, Y=${results.yearly?.price}`);
  return results;
}

module.exports = {
  calculateAllVwaps,
  calculatePeriodVwap,
  getPeriodStart
};
