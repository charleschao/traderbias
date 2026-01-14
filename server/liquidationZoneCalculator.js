/**
 * Liquidation Zone Calculator Module
 *
 * Estimates liquidation zones using Jump Crypto-style approach:
 * - Dynamic leverage estimation from funding rates
 * - ATR-based volatility buffers
 * - OI clustering probability assessment
 *
 * No external API dependencies - all calculated from collected data.
 */

const dataStore = require('./dataStore');

// Funding rate thresholds for leverage estimation (annualized %)
const LEVERAGE_TIERS = {
  HIGH: { threshold: 73, leverage: 17.5 },     // >0.02% per 8hr funding
  MEDIUM: { threshold: 36, leverage: 12.5 },   // 0.01-0.02% per 8hr
  LOW: { threshold: 0, leverage: 7.5 }         // <0.01% per 8hr
};

// OI velocity modifiers
const OI_VELOCITY_MODIFIERS = {
  EXTREME: { threshold: 20, bump: 5 },    // >20% daily OI rise
  HIGH: { threshold: 10, bump: 2.5 },     // 10-20% daily OI rise
  NORMAL: { threshold: 0, bump: 0 }       // <10% daily OI rise
};

// Probability thresholds
const PROBABILITY_TIERS = {
  HIGH: { oiMin: 500000000, distanceMax: 2 },    // >$500M OI, <2% distance
  MEDIUM: { oiMin: 100000000, distanceMax: 5 },  // $100-500M OI, 2-5% distance
  LOW: { oiMin: 0, distanceMax: 100 }            // <$100M OI or >5% distance
};

// ATR multiplier for volatility buffer
const ATR_BUFFER_MULTIPLIER = 1.5;

// Time windows
const WINDOWS = {
  ONE_HOUR: 60 * 60 * 1000,
  FOUR_HOURS: 4 * 60 * 60 * 1000,
  TWENTY_FOUR_HOURS: 24 * 60 * 60 * 1000
};

/**
 * Calculate average funding rate across exchanges
 */
function getAverageFunding(coin = 'BTC') {
  const exchanges = ['hyperliquid', 'binance', 'bybit'];
  const rates = [];

  for (const exchange of exchanges) {
    const data = dataStore.getExchangeData(exchange);
    const currentFunding = data?.current?.funding?.[coin];
    if (currentFunding !== null && currentFunding !== undefined && !isNaN(currentFunding)) {
      rates.push(currentFunding);
    }
  }

  if (rates.length === 0) return 0;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

/**
 * Calculate aggregated OI across exchanges
 */
function getAggregatedOI(coin = 'BTC') {
  const exchanges = ['hyperliquid', 'binance', 'bybit'];
  let totalOI = 0;

  for (const exchange of exchanges) {
    const data = dataStore.getExchangeData(exchange);
    const currentOI = data?.current?.oi?.[coin];
    if (currentOI && currentOI > 0) {
      totalOI += currentOI;
    }
  }

  return totalOI;
}

/**
 * Calculate OI velocity (24hr % change)
 */
function calculateOIVelocity(coin = 'BTC') {
  const exchanges = ['hyperliquid', 'binance', 'bybit'];
  const now = Date.now();
  const twentyFourHoursAgo = now - WINDOWS.TWENTY_FOUR_HOURS;

  let currentTotal = 0;
  let pastTotal = 0;
  let hasData = false;

  for (const exchange of exchanges) {
    const data = dataStore.getExchangeData(exchange);
    const oiHistory = data?.oi?.[coin] || [];

    // Current OI
    const currentOI = data?.current?.oi?.[coin];
    if (currentOI && currentOI > 0) {
      currentTotal += currentOI;
    }

    // OI from 24hr ago
    const pastEntries = oiHistory.filter(e => e && e.timestamp <= twentyFourHoursAgo + WINDOWS.ONE_HOUR);
    if (pastEntries.length > 0) {
      pastTotal += pastEntries[0].value || 0;
      hasData = true;
    }
  }

  if (!hasData || pastTotal === 0) return 0;
  return ((currentTotal - pastTotal) / pastTotal) * 100;
}

/**
 * Calculate 24hr ATR as percentage
 */
function calculateATRPercent(coin = 'BTC') {
  const hlData = dataStore.getExchangeData('hyperliquid');
  const priceHistory = hlData?.price?.[coin] || [];

  if (priceHistory.length < 20) return 2; // Default 2% if insufficient data

  const now = Date.now();
  const twentyFourHoursAgo = now - WINDOWS.TWENTY_FOUR_HOURS;
  const recentPrices = priceHistory.filter(p => p && p.timestamp >= twentyFourHoursAgo);

  if (recentPrices.length < 10) return 2;

  // Calculate true ranges
  const trueRanges = [];
  for (let i = 1; i < recentPrices.length; i++) {
    const curr = recentPrices[i].value;
    const prev = recentPrices[i - 1].value;
    if (curr > 0 && prev > 0) {
      trueRanges.push(Math.abs(curr - prev) / prev * 100);
    }
  }

  if (trueRanges.length === 0) return 2;

  // Average true range as percentage
  const atr = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;

  // Scale to daily equivalent (assuming ~5min intervals, ~288 per day)
  const intervalsPerDay = 288;
  const dailyATR = atr * Math.sqrt(intervalsPerDay / trueRanges.length);

  return Math.max(0.5, Math.min(10, dailyATR)); // Clamp between 0.5% and 10%
}

/**
 * Estimate average leverage from funding rate
 */
function estimateLeverage(fundingRate, oiVelocity) {
  // Convert to annualized percentage
  const annualized = Math.abs(fundingRate) * 3 * 365 * 100;

  // Base leverage from funding tier
  let leverage;
  if (annualized > LEVERAGE_TIERS.HIGH.threshold) {
    leverage = LEVERAGE_TIERS.HIGH.leverage;
  } else if (annualized > LEVERAGE_TIERS.MEDIUM.threshold) {
    leverage = LEVERAGE_TIERS.MEDIUM.leverage;
  } else {
    leverage = LEVERAGE_TIERS.LOW.leverage;
  }

  // OI velocity modifier
  if (oiVelocity > OI_VELOCITY_MODIFIERS.EXTREME.threshold) {
    leverage += OI_VELOCITY_MODIFIERS.EXTREME.bump;
  } else if (oiVelocity > OI_VELOCITY_MODIFIERS.HIGH.threshold) {
    leverage += OI_VELOCITY_MODIFIERS.HIGH.bump;
  }

  // Cap leverage at realistic bounds
  return Math.max(5, Math.min(25, leverage));
}

/**
 * Determine cascade probability
 */
function determineProbability(oiAtRisk, distancePercent) {
  if (oiAtRisk >= PROBABILITY_TIERS.HIGH.oiMin && distancePercent <= PROBABILITY_TIERS.HIGH.distanceMax) {
    return 'HIGH';
  }
  if (oiAtRisk >= PROBABILITY_TIERS.MEDIUM.oiMin && distancePercent <= PROBABILITY_TIERS.MEDIUM.distanceMax) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Calculate liquidation zones for a coin
 *
 * @param {string} coin - BTC, ETH, or SOL
 * @returns {object} Liquidation zone data
 */
function calculateLiquidationZones(coin = 'BTC') {
  // Get current price
  const hlData = dataStore.getExchangeData('hyperliquid');
  const currentPrice = hlData?.current?.price?.[coin];

  if (!currentPrice || currentPrice <= 0) {
    return {
      status: 'NO_DATA',
      message: 'Waiting for price data'
    };
  }

  // Gather inputs
  const avgFunding = getAverageFunding(coin);
  const aggregatedOI = getAggregatedOI(coin);
  const oiVelocity = calculateOIVelocity(coin);
  const atrPercent = calculateATRPercent(coin);

  // Estimate leverage
  const avgLeverage = estimateLeverage(avgFunding, oiVelocity);

  // Calculate volatility buffer
  const volBuffer = (atrPercent / 100) * ATR_BUFFER_MULTIPLIER;

  // Calculate zones with downside bias for longs
  const leverageComponent = 1 / avgLeverage;
  const longLiqPrice = currentPrice * (1 - leverageComponent - volBuffer);
  const shortLiqPrice = currentPrice * (1 + leverageComponent + volBuffer);

  // Calculate distances
  const longDistance = ((currentPrice - longLiqPrice) / currentPrice) * 100;
  const shortDistance = ((shortLiqPrice - currentPrice) / currentPrice) * 100;

  // Estimate OI at risk (simplified: assume 30% of total OI near each zone)
  const oiAtRiskLong = aggregatedOI * 0.3;
  const oiAtRiskShort = aggregatedOI * 0.3;

  // Determine probabilities
  const longProbability = determineProbability(oiAtRiskLong, longDistance);
  const shortProbability = determineProbability(oiAtRiskShort, shortDistance);

  // Overall cascade probability (worst of the two)
  const probabilityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const overallProbability = probabilityRank[longProbability] >= probabilityRank[shortProbability]
    ? longProbability
    : shortProbability;

  return {
    status: 'ACTIVE',
    coin,
    currentPrice: Math.round(currentPrice),
    zones: {
      long: {
        price: Math.round(longLiqPrice),
        distance: Math.round(longDistance * 10) / 10,
        oiAtRisk: oiAtRiskLong,
        probability: longProbability,
        description: `Long cascade zone at $${longLiqPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${longDistance.toFixed(1)}% below)`
      },
      short: {
        price: Math.round(shortLiqPrice),
        distance: Math.round(shortDistance * 10) / 10,
        oiAtRisk: oiAtRiskShort,
        probability: shortProbability,
        description: `Short squeeze zone at $${shortLiqPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${shortDistance.toFixed(1)}% above)`
      }
    },
    inputs: {
      avgFunding: avgFunding,
      avgFundingAnnualized: avgFunding * 3 * 365 * 100,
      aggregatedOI: aggregatedOI,
      oiVelocity: Math.round(oiVelocity * 10) / 10,
      atrPercent: Math.round(atrPercent * 100) / 100,
      estimatedLeverage: Math.round(avgLeverage * 10) / 10,
      volBuffer: Math.round(volBuffer * 10000) / 100 // As percentage
    },
    probability: overallProbability,
    generatedAt: Date.now()
  };
}

/**
 * Calculate liquidation signal for bias projection
 * Combines zone proximity with actual liquidation flow
 *
 * @param {string} coin - BTC, ETH, or SOL
 * @returns {object} Signal for bias calculation
 */
function calculateZoneSignal(coin = 'BTC') {
  const zones = calculateLiquidationZones(coin);

  if (zones.status !== 'ACTIVE') {
    return {
      score: 0,
      signal: 'INSUFFICIENT_DATA',
      zones: null,
      description: 'Waiting for data'
    };
  }

  const { long, short } = zones.zones;

  // Score based on proximity and probability
  // Closer to a zone = higher signal in that direction
  let score = 0;
  let signal = 'NEUTRAL';
  let description = 'No immediate cascade risk';

  // Long liq zone proximity (bearish if close)
  if (long.probability === 'HIGH') {
    score = -0.7;
    signal = 'LONG_CASCADE_IMMINENT';
    description = `High risk of long cascade at $${long.price.toLocaleString()}`;
  } else if (long.probability === 'MEDIUM' && long.distance < 3) {
    score = -0.4;
    signal = 'LONG_CASCADE_RISK';
    description = `Elevated long cascade risk at $${long.price.toLocaleString()}`;
  }

  // Short liq zone proximity (bullish if close - squeeze potential)
  if (short.probability === 'HIGH') {
    score = 0.7;
    signal = 'SHORT_SQUEEZE_IMMINENT';
    description = `High risk of short squeeze at $${short.price.toLocaleString()}`;
  } else if (short.probability === 'MEDIUM' && short.distance < 3) {
    score = 0.4;
    signal = 'SHORT_SQUEEZE_RISK';
    description = `Elevated short squeeze risk at $${short.price.toLocaleString()}`;
  }

  // Both zones at risk = high volatility expected, neutral bias
  if (long.probability === 'HIGH' && short.probability === 'HIGH') {
    score = 0;
    signal = 'VOLATILITY_EXPECTED';
    description = 'Both directions at cascade risk - high volatility expected';
  }

  return {
    score,
    signal,
    zones,
    description
  };
}

module.exports = {
  calculateLiquidationZones,
  calculateZoneSignal,
  getAverageFunding,
  getAggregatedOI,
  calculateOIVelocity,
  calculateATRPercent,
  estimateLeverage,
  determineProbability,
  LEVERAGE_TIERS,
  PROBABILITY_TIERS
};
