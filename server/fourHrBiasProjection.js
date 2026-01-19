/**
 * 4-Hour Bias Projection Module (BTC Only)
 *
 * Pure flow algorithm for scalping/day trading (1-4 hour positions)
 * Factors: Flow Confluence (50%), OI RoC (25%), CVD Persistence (25%)
 * No funding, no whales, no cross-exchange - pure reactive signals
 */

const { CVD_THRESHOLDS } = require('./biasProjection');

// Weight distribution - pure flow (OI boosted based on 75% win rate backtesting)
const WEIGHTS_4HR = {
  flowConfluence: 0.40,
  oiRoC: 0.35,
  cvdPersistence: 0.25
};

// Magnitude thresholds
const THRESHOLDS = {
  price: { weak: 0.3, moderate: 0.5, strong: 0.5 },
  oi: { weak: 0.5, moderate: 1.0, strong: 1.0 },
  cvd: { weak: 0.5, moderate: 1.0, strong: 1.0 }
};

// Timeframes
const TIMEFRAMES_4HR = {
  PRIMARY_WINDOW: 1 * 60 * 60 * 1000,    // 1hr primary
  VETO_WINDOW: 2 * 60 * 60 * 1000,       // 2hr veto
  OI_CVD_WINDOW: 4 * 60 * 60 * 1000,     // 4hr for OI/CVD
  CACHE_TTL: 30 * 60 * 1000,             // 30min cache
  VALIDITY: 2 * 60 * 60 * 1000           // 2hr validity
};

/**
 * Calculate Flow Confluence with 1hr primary, 2hr veto pattern
 */
function calculateFlowConfluence4Hr(priceHistory, oiHistory, cvdHistory, coin = 'BTC') {
  if (!priceHistory || priceHistory.length < 20 || !oiHistory || oiHistory.length < 10 || !cvdHistory || cvdHistory.length < 10) {
    return { score: 0, signal: 'INSUFFICIENT_DATA', aligned: false, vetoApplied: false };
  }

  const now = Date.now();
  const oneHourAgo = now - TIMEFRAMES_4HR.PRIMARY_WINDOW;
  const twoHoursAgo = now - TIMEFRAMES_4HR.VETO_WINDOW;
  const thresholds = CVD_THRESHOLDS[coin] || CVD_THRESHOLDS.BTC;

  // === 1HR PRIMARY CALCULATION ===
  const prices1H = priceHistory.filter(e => e && e.timestamp >= oneHourAgo);
  const oi1H = oiHistory.filter(e => e && e.timestamp >= oneHourAgo);
  const cvd1H = cvdHistory.filter(e => e && e.time >= oneHourAgo);

  let price1HChange = 0, oi1HChange = 0, cvd1HDelta = 0;

  if (prices1H.length >= 2 && prices1H[0].value > 0) {
    price1HChange = ((prices1H[prices1H.length - 1].value - prices1H[0].value) / prices1H[0].value) * 100;
  }
  if (oi1H.length >= 2 && oi1H[0].value > 0) {
    oi1HChange = ((oi1H[oi1H.length - 1].value - oi1H[0].value) / oi1H[0].value) * 100;
  }
  cvd1HDelta = cvd1H.reduce((sum, e) => sum + (e.delta || 0), 0);

  // Determine directions with magnitude classification
  const getDirection = (value, thresholds) => {
    if (Math.abs(value) < thresholds.weak) return { dir: 'neutral', strength: 'none' };
    if (Math.abs(value) < thresholds.moderate) return { dir: value > 0 ? 'up' : 'down', strength: 'weak' };
    if (Math.abs(value) < thresholds.strong) return { dir: value > 0 ? 'up' : 'down', strength: 'moderate' };
    return { dir: value > 0 ? 'up' : 'down', strength: 'strong' };
  };

  const price1HDir = getDirection(price1HChange, THRESHOLDS.price);
  const oi1HDir = getDirection(oi1HChange, THRESHOLDS.oi);
  const cvd1HDir = getDirection(cvd1HDelta / thresholds.weak, { weak: 1, moderate: 2, strong: 2 });

  // === 2HR VETO CALCULATION ===
  const prices2H = priceHistory.filter(e => e && e.timestamp >= twoHoursAgo);
  const oi2H = oiHistory.filter(e => e && e.timestamp >= twoHoursAgo);
  const cvd2H = cvdHistory.filter(e => e && e.time >= twoHoursAgo);

  let price2HChange = 0, oi2HChange = 0, cvd2HDelta = 0;

  if (prices2H.length >= 2 && prices2H[0].value > 0) {
    price2HChange = ((prices2H[prices2H.length - 1].value - prices2H[0].value) / prices2H[0].value) * 100;
  }
  if (oi2H.length >= 2 && oi2H[0].value > 0) {
    oi2HChange = ((oi2H[oi2H.length - 1].value - oi2H[0].value) / oi2H[0].value) * 100;
  }
  cvd2HDelta = cvd2H.reduce((sum, e) => sum + (e.delta || 0), 0);

  const price2HDir = getDirection(price2HChange, THRESHOLDS.price);
  const oi2HDir = getDirection(oi2HChange, THRESHOLDS.oi);
  const cvd2HDir = getDirection(cvd2HDelta / thresholds.weak, { weak: 1, moderate: 2, strong: 2 });

  // === SCORING ===
  let score = 0;
  let signal = 'NEUTRAL';
  let aligned = false;
  const dirs1H = [price1HDir.dir, oi1HDir.dir, cvd1HDir.dir];
  const strengths1H = [price1HDir.strength, oi1HDir.strength, cvd1HDir.strength];

  const bullishCount = dirs1H.filter(d => d === 'up').length;
  const bearishCount = dirs1H.filter(d => d === 'down').length;
  const strongCount = strengths1H.filter(s => s === 'strong').length;

  // All 3 aligned
  if (bullishCount === 3) {
    aligned = true;
    score = strongCount === 3 ? 1.0 : strongCount >= 1 ? 0.75 : 0.5;
    signal = strongCount >= 2 ? 'STRONG_BULL' : 'MODERATE_BULL';
  } else if (bearishCount === 3) {
    aligned = true;
    score = strongCount === 3 ? -1.0 : strongCount >= 1 ? -0.75 : -0.5;
    signal = strongCount >= 2 ? 'STRONG_BEAR' : 'MODERATE_BEAR';
  }
  // 2 of 3 aligned
  else if (bullishCount === 2) {
    score = strongCount >= 1 ? 0.5 : 0.35;
    signal = 'LEAN_BULL';
  } else if (bearishCount === 2) {
    score = strongCount >= 1 ? -0.5 : -0.35;
    signal = 'LEAN_BEAR';
  }

  // === VETO CHECK ===
  let vetoApplied = false;
  const dirs2H = [price2HDir.dir, oi2HDir.dir, cvd2HDir.dir];
  const bullish2H = dirs2H.filter(d => d === 'up').length;
  const bearish2H = dirs2H.filter(d => d === 'down').length;

  // If 1hr says bull but 2hr says bear (or vice versa), apply 50% veto
  if ((score > 0 && bearish2H >= 2) || (score < 0 && bullish2H >= 2)) {
    score *= 0.5;
    vetoApplied = true;
    signal = signal.replace('STRONG', 'WEAK').replace('MODERATE', 'WEAK');
  }

  return {
    score,
    signal,
    aligned,
    vetoApplied,
    primary: { priceDir: price1HDir.dir, oiDir: oi1HDir.dir, cvdDir: cvd1HDir.dir },
    veto: { priceDir: price2HDir.dir, oiDir: oi2HDir.dir, cvdDir: cvd2HDir.dir },
    metrics: {
      price1HChange: Math.round(price1HChange * 100) / 100,
      oi1HChange: Math.round(oi1HChange * 100) / 100,
      cvd1HDelta: Math.round(cvd1HDelta)
    }
  };
}

/**
 * Calculate OI Rate of Change with 4hr window
 */
function calculateOIRoC4Hr(oiHistory, priceHistory) {
  if (!oiHistory || oiHistory.length < 10) {
    return { score: 0, trend: 'insufficient_data' };
  }

  const now = Date.now();
  const fourHoursAgo = now - TIMEFRAMES_4HR.OI_CVD_WINDOW;

  // 4hr OI change (main metric)
  const oi4H = oiHistory.filter(e => e && e.timestamp >= fourHoursAgo);
  let oi4HChange = 0;
  if (oi4H.length >= 2 && oi4H[0].value > 0) {
    oi4HChange = ((oi4H[oi4H.length - 1].value - oi4H[0].value) / oi4H[0].value) * 100;
  }

  // Price direction for context
  let priceChange = 0;
  if (priceHistory && priceHistory.length >= 2) {
    const prices4H = priceHistory.filter(p => p && p.timestamp >= fourHoursAgo);
    if (prices4H.length >= 2 && prices4H[0].value > 0) {
      priceChange = ((prices4H[prices4H.length - 1].value - prices4H[0].value) / prices4H[0].value) * 100;
    }
  }

  let score = 0;
  let trend = 'neutral';

  // Strong bullish: OI >1% up + price >0.5% up
  if (oi4HChange > 1 && priceChange > 0.5) {
    score = 0.8;
    trend = 'bullish_leverage';
  }
  // Moderate bullish: OI 0.5-1% up + price up
  else if (oi4HChange > 0.5 && oi4HChange <= 1 && priceChange > 0) {
    score = 0.5;
    trend = 'moderate_bullish';
  }
  // Bearish divergence: OI >1% up + price down (trapped longs)
  else if (oi4HChange > 1 && priceChange < -0.5) {
    score = -0.7;
    trend = 'bearish_divergence';
  }
  // Strong bearish: OI >1% down + price >0.5% down
  else if (oi4HChange < -1 && priceChange < -0.5) {
    score = -0.8;
    trend = 'bearish_capitulation';
  }

  return {
    score,
    trend,
    oi4HChange: Math.round(oi4HChange * 100) / 100,
    priceChange: Math.round(priceChange * 100) / 100
  };
}

/**
 * Calculate CVD Persistence with 4hr window
 */
function calculateCVDPersistence4Hr(cvdHistory, coin = 'BTC') {
  if (!cvdHistory || cvdHistory.length < 10) {
    return { score: 0, strength: 'none' };
  }

  const now = Date.now();
  const fourHoursAgo = now - TIMEFRAMES_4HR.OI_CVD_WINDOW;
  const thresholds = CVD_THRESHOLDS[coin] || CVD_THRESHOLDS.BTC;

  const cvd4H = cvdHistory.filter(e => e && e.time >= fourHoursAgo);
  const cvd4HDelta = cvd4H.reduce((sum, e) => sum + (e.delta || 0), 0);

  // Normalize to -1 to +1
  const normalizedScore = Math.max(-1, Math.min(1, cvd4HDelta / thresholds.strong));

  // Determine strength
  const absDelta = Math.abs(cvd4HDelta);
  let strength = 'none';
  if (absDelta >= thresholds.strong) strength = 'strong';
  else if (absDelta >= thresholds.moderate) strength = 'moderate';
  else if (absDelta >= thresholds.weak) strength = 'weak';

  return {
    score: normalizedScore,
    cvd4HDelta,
    strength,
    thresholds
  };
}

/**
 * Calculate invalidation level (auto-calc with ATR buffer)
 */
function calculateInvalidation4Hr(priceHistory, bias) {
  const ATR_MULTIPLIER = 0.5;
  const LOOKBACK_MS = 4 * 60 * 60 * 1000;

  if (!priceHistory || priceHistory.length < 20) {
    return null;
  }

  const now = Date.now();
  const relevantPrices = priceHistory.filter(p => p && p.timestamp >= now - LOOKBACK_MS);

  if (relevantPrices.length < 5) return null;

  const prices = relevantPrices.map(p => p.value).filter(v => v > 0);
  if (prices.length < 5) return null;

  const swingLow = Math.min(...prices);
  const swingHigh = Math.max(...prices);
  const currentPrice = priceHistory[priceHistory.length - 1]?.value || 0;

  // Calculate ATR
  const trueRanges = [];
  for (let i = 1; i < relevantPrices.length; i++) {
    const curr = relevantPrices[i].value;
    const prev = relevantPrices[i - 1].value;
    if (curr > 0 && prev > 0) {
      trueRanges.push(Math.abs(curr - prev));
    }
  }
  const atr = trueRanges.length > 0 ? trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length : 0;
  const atrBuffer = atr * ATR_MULTIPLIER;

  if (currentPrice === 0) return null;

  const biasUpper = bias?.toUpperCase() || '';

  if (biasUpper.includes('BULL')) {
    const invalidationPrice = swingLow - atrBuffer;
    const distance = ((currentPrice - invalidationPrice) / currentPrice) * 100;
    return {
      price: Math.round(invalidationPrice),
      type: 'below',
      distance: Math.round(distance * 10) / 10,
      description: `Bias invalidates below $${Math.round(invalidationPrice).toLocaleString()}`
    };
  } else if (biasUpper.includes('BEAR')) {
    const invalidationPrice = swingHigh + atrBuffer;
    const distance = ((invalidationPrice - currentPrice) / currentPrice) * 100;
    return {
      price: Math.round(invalidationPrice),
      type: 'above',
      distance: Math.round(distance * 10) / 10,
      description: `Bias invalidates above $${Math.round(invalidationPrice).toLocaleString()}`
    };
  }

  return {
    type: 'range',
    rangeLow: Math.round(swingLow - atrBuffer),
    rangeHigh: Math.round(swingHigh + atrBuffer),
    description: 'Watch for breakout from current range'
  };
}

/**
 * Main 4hr bias generator (BTC only)
 */
function generate4HrBias(coin, dataStore) {
  // BTC only
  if (coin !== 'BTC') {
    return {
      error: '4hr Bias available for BTC only',
      coin,
      supported: false
    };
  }

  const now = Date.now();
  const hlData = dataStore.getExchangeData('hyperliquid');

  if (!hlData || !hlData.price?.BTC || hlData.price.BTC.length < 30) {
    return {
      coin,
      horizon: '4H',
      status: 'COLLECTING',
      message: 'Collecting data for 4hr bias. Available after ~30 minutes.',
      generatedAt: now
    };
  }

  // Calculate all factors
  const flowConfluence = calculateFlowConfluence4Hr(hlData.price.BTC, hlData.oi.BTC, hlData.cvd.BTC, 'BTC');
  const oiRoC = calculateOIRoC4Hr(hlData.oi.BTC, hlData.price.BTC);
  const cvdPersistence = calculateCVDPersistence4Hr(hlData.cvd.BTC, 'BTC');

  // Calculate weighted score
  const weightedScore = (
    (flowConfluence.score * WEIGHTS_4HR.flowConfluence) +
    (oiRoC.score * WEIGHTS_4HR.oiRoC) +
    (cvdPersistence.score * WEIGHTS_4HR.cvdPersistence)
  );

  const normalizedScore = Math.max(-1, Math.min(1, weightedScore));

  // Determine bias and grade
  let bias, strength;
  const absScore = Math.abs(normalizedScore);

  if (absScore >= 0.6) {
    bias = normalizedScore > 0 ? 'STRONG_BULL' : 'STRONG_BEAR';
    strength = 'STRONG';
  } else if (absScore >= 0.35) {
    bias = normalizedScore > 0 ? 'BULLISH' : 'BEARISH';
    strength = 'MODERATE';
  } else if (absScore >= 0.15) {
    bias = normalizedScore > 0 ? 'LEAN_BULL' : 'LEAN_BEAR';
    strength = 'WEAK';
  } else {
    bias = 'NEUTRAL';
    strength = 'NONE';
  }

  // Grade calculation
  let grade;
  const allStrong = flowConfluence.aligned && oiRoC.score !== 0 && cvdPersistence.strength !== 'none';

  if (absScore >= 0.85 && allStrong) grade = 'A+';
  else if (absScore >= 0.75) grade = 'A';
  else if (absScore >= 0.65) grade = 'B+';
  else if (absScore >= 0.55) grade = 'B';
  else grade = 'C';

  // Confidence calculation
  let confidenceScore = 0.50;
  if (flowConfluence.aligned) confidenceScore += 0.20;
  if (!flowConfluence.vetoApplied) confidenceScore += 0.10;
  if (Math.abs(oiRoC.score) > 0.5) confidenceScore += 0.10;
  if (cvdPersistence.strength === 'strong') confidenceScore += 0.10;

  confidenceScore = Math.min(1, confidenceScore);
  const confidenceLevel = confidenceScore >= 0.70 ? 'HIGH' : confidenceScore >= 0.50 ? 'MEDIUM' : 'LOW';

  // Build key factors
  const keyFactors = [
    {
      name: 'Flow Confluence',
      direction: flowConfluence.score > 0.1 ? 'bullish' : flowConfluence.score < -0.1 ? 'bearish' : 'neutral',
      score: Math.abs(flowConfluence.score),
      weight: '40%',
      detail: `${flowConfluence.signal} (P:${flowConfluence.primary.priceDir} OI:${flowConfluence.primary.oiDir} CVD:${flowConfluence.primary.cvdDir})${flowConfluence.vetoApplied ? ' [VETO]' : ''}`
    },
    {
      name: 'OI RoC',
      direction: oiRoC.score > 0.1 ? 'bullish' : oiRoC.score < -0.1 ? 'bearish' : 'neutral',
      score: Math.abs(oiRoC.score),
      weight: '35%',
      detail: `${oiRoC.trend} (OI:${oiRoC.oi4HChange > 0 ? '+' : ''}${oiRoC.oi4HChange}% P:${oiRoC.priceChange > 0 ? '+' : ''}${oiRoC.priceChange}%)`
    },
    {
      name: 'CVD Persist',
      direction: cvdPersistence.score > 0.1 ? 'bullish' : cvdPersistence.score < -0.1 ? 'bearish' : 'neutral',
      score: Math.abs(cvdPersistence.score),
      weight: '25%',
      detail: `$${(cvdPersistence.cvd4HDelta / 1000000).toFixed(2)}M (4hr) - ${cvdPersistence.strength}`
    }
  ];

  // Calculate invalidation
  const invalidation = calculateInvalidation4Hr(hlData.price.BTC, bias);

  // Get current price
  const currentPrice = hlData.price.BTC[hlData.price.BTC.length - 1]?.value || 0;

  return {
    coin: 'BTC',
    horizon: '4H',
    biasType: '4HR',
    status: 'ACTIVE',
    currentPrice,
    prediction: {
      bias,
      strength,
      score: Math.round(normalizedScore * 1000) / 1000,
      grade,
      direction: normalizedScore > 0 ? 'BULLISH' : normalizedScore < 0 ? 'BEARISH' : 'NEUTRAL'
    },
    confidence: {
      level: confidenceLevel,
      score: Math.round(confidenceScore * 100) / 100
    },
    invalidation,
    keyFactors,
    components: {
      flowConfluence,
      oiRoC,
      cvdPersistence
    },
    generatedAt: now,
    validUntil: now + TIMEFRAMES_4HR.VALIDITY
  };
}

module.exports = {
  generate4HrBias,
  calculateFlowConfluence4Hr,
  calculateOIRoC4Hr,
  calculateCVDPersistence4Hr,
  calculateInvalidation4Hr,
  WEIGHTS_4HR,
  TIMEFRAMES_4HR
};
