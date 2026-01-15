/**
 * Component-Level Signal Generators
 *
 * Generates standalone OI and CVD predictions for backtesting
 * individual signal components in isolation.
 */

const { calculateOIRoC, calculateCVDPersistence } = require('./biasProjection');

/**
 * Generate OI standalone signal (oi-4hr)
 * Uses existing OI Rate of Change logic with price context
 */
function generateOISignal(coin, dataStore) {
  const hlData = dataStore.getExchangeData('hyperliquid');

  if (!hlData || !hlData.oi?.[coin] || hlData.oi[coin].length < 10) {
    return null;
  }

  const oiRoC = calculateOIRoC(hlData.oi[coin], hlData.price[coin]);

  // Direction from existing score logic
  // oiRoC.score > 0 = bullish, < 0 = bearish
  const direction = oiRoC.score > 0.15 ? 'BULLISH'
                  : oiRoC.score < -0.15 ? 'BEARISH'
                  : 'NEUTRAL';

  const strength = Math.abs(oiRoC.score) >= 0.4 ? 'STRONG'
                 : Math.abs(oiRoC.score) >= 0.2 ? 'MODERATE'
                 : 'WEAK';

  const currentPrice = hlData.price?.[coin]?.[hlData.price[coin].length - 1]?.value || 0;

  return {
    coin,
    direction,
    strength,
    score: oiRoC.score,
    currentPrice,
    detail: {
      trend: oiRoC.trend,
      fourHourRoC: oiRoC.fourHourRoC,
      hourlyRoC: oiRoC.hourlyRoC,
      priceChange: oiRoC.priceChange
    }
  };
}

/**
 * Generate CVD standalone signal (cvd-2hr)
 * Uses existing CVD persistence logic with coin-specific thresholds
 */
function generateCVDSignal(coin, dataStore) {
  const hlData = dataStore.getExchangeData('hyperliquid');

  if (!hlData || !hlData.cvd?.[coin] || hlData.cvd[coin].length < 5) {
    return null;
  }

  const cvd = calculateCVDPersistence(hlData.cvd[coin], coin);

  const direction = cvd.score > 0.2 ? 'BULLISH'
                  : cvd.score < -0.2 ? 'BEARISH'
                  : 'NEUTRAL';

  // Map strength to standard format
  const strength = cvd.strength === 'strong' ? 'STRONG'
                 : cvd.strength === 'moderate' ? 'MODERATE'
                 : 'WEAK';

  const currentPrice = hlData.price?.[coin]?.[hlData.price[coin].length - 1]?.value || 0;

  return {
    coin,
    direction,
    strength,
    score: cvd.score,
    currentPrice,
    detail: {
      twoHourDelta: cvd.twoHourDelta,
      thirtyMinDelta: cvd.thirtyMinDelta,
      weightedDelta: cvd.weightedDelta
    }
  };
}

/**
 * Format standalone signal to match recordPrediction() expected format
 */
function formatAsProjection(signal) {
  if (!signal) return null;

  return {
    currentPrice: signal.currentPrice,
    prediction: {
      bias: signal.direction,
      direction: signal.direction,
      score: signal.score,
      strength: signal.strength,
      grade: signal.strength === 'STRONG' ? 'A' : signal.strength === 'MODERATE' ? 'B' : 'C'
    },
    confidence: {
      level: signal.strength === 'STRONG' ? 'HIGH' : signal.strength === 'MODERATE' ? 'MEDIUM' : 'LOW'
    },
    components: {
      raw: signal.detail
    }
  };
}

module.exports = {
  generateOISignal,
  generateCVDSignal,
  formatAsProjection
};
