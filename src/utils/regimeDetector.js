/**
 * Market Regime Detector
 * Classifies market as trending or ranging using price action swing points
 */

const DEFAULT_LOOKBACK = 20;
const MIN_SWING_POINTS = 4;
const MIN_DIRECTIONAL_POINTS = 3;

/**
 * Detect swing points (local highs and lows) in price data
 * @param {number[]} prices - Array of prices
 * @returns {Array<{index: number, price: number, type: 'high' | 'low'}>}
 */
export const detectSwingPoints = (prices) => {
  if (!prices || prices.length < 3) return [];

  const swingPoints = [];

  for (let i = 1; i < prices.length - 1; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    const next = prices[i + 1];

    if (curr > prev && curr > next) {
      swingPoints.push({ index: i, price: curr, type: 'high' });
    } else if (curr < prev && curr < next) {
      swingPoints.push({ index: i, price: curr, type: 'low' });
    }
  }

  return swingPoints;
};

/**
 * Check if swing points form an ascending pattern (uptrend)
 * @param {Array<{price: number}>} points
 * @returns {boolean}
 */
const isAscending = (points) => {
  let ascendingCount = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].price > points[i - 1].price) {
      ascendingCount++;
    }
  }
  return ascendingCount >= MIN_DIRECTIONAL_POINTS - 1;
};

/**
 * Check if swing points form a descending pattern (downtrend)
 * @param {Array<{price: number}>} points
 * @returns {boolean}
 */
const isDescending = (points) => {
  let descendingCount = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].price < points[i - 1].price) {
      descendingCount++;
    }
  }
  return descendingCount >= MIN_DIRECTIONAL_POINTS - 1;
};

/**
 * Detect market regime from price history
 * @param {number[]} prices - Array of historical prices (oldest to newest)
 * @param {number} lookback - Number of candles to analyze (default 20)
 * @returns {{regime: 'trending' | 'ranging', swingPoints: Array, confidence: number}}
 */
export const detectRegime = (prices, lookback = DEFAULT_LOOKBACK) => {
  if (!prices || prices.length < 3) {
    return { regime: 'ranging', swingPoints: [], confidence: 0 };
  }

  // Use only the lookback window
  const windowPrices = prices.slice(-lookback);
  const swingPoints = detectSwingPoints(windowPrices);

  // Need minimum swing points to classify
  if (swingPoints.length < MIN_SWING_POINTS) {
    return { regime: 'ranging', swingPoints, confidence: 0.3 };
  }

  // Get the last 4 swing points for pattern analysis
  const recentSwings = swingPoints.slice(-MIN_SWING_POINTS);

  // Check for directional pattern
  const ascending = isAscending(recentSwings);
  const descending = isDescending(recentSwings);

  if (ascending || descending) {
    // Calculate confidence based on how clean the pattern is
    const directionality = ascending
      ? recentSwings.filter((p, i) => i === 0 || p.price > recentSwings[i - 1].price).length
      : recentSwings.filter((p, i) => i === 0 || p.price < recentSwings[i - 1].price).length;

    const confidence = Math.min(0.9, 0.5 + (directionality / recentSwings.length) * 0.4);

    return { regime: 'trending', swingPoints, confidence };
  }

  return { regime: 'ranging', swingPoints, confidence: 0.6 };
};

/**
 * Get regime for a specific point in historical data
 * Used by backtest engine to tag signals
 * @param {Array<{price: number}>} historicalData - Array with price field
 * @param {number} currentIndex - Current position in the data
 * @param {number} lookback - Lookback period
 * @returns {{regime: 'trending' | 'ranging', confidence: number}}
 */
export const getRegimeAtIndex = (historicalData, currentIndex, lookback = DEFAULT_LOOKBACK) => {
  if (!historicalData || currentIndex < lookback) {
    return { regime: 'ranging', confidence: 0 };
  }

  // Extract prices from historical data up to current index
  const startIndex = Math.max(0, currentIndex - lookback);
  const prices = [];

  for (let i = startIndex; i <= currentIndex; i++) {
    const entry = historicalData[i];
    if (entry && entry.price !== undefined) {
      prices.push(entry.price);
    } else if (entry && entry.data) {
      // Handle nested data structure from backtest
      const coinData = Object.values(entry.data)[0];
      if (coinData && coinData.price) {
        prices.push(coinData.price);
      }
    }
  }

  const result = detectRegime(prices, lookback);
  return { regime: result.regime, confidence: result.confidence };
};

export default {
  detectRegime,
  detectSwingPoints,
  getRegimeAtIndex
};
