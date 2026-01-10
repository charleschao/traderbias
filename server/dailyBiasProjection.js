/**
 * Daily Bias Projection Module (24H Optimized)
 *
 * Calculates 24-hour forward-looking directional bias for BTC
 * Optimized for day traders wanting "direction for today"
 *
 * Key differences from 8-12H algorithm:
 * - Spot/Perp CVD Divergence is PRIMARY signal (35% weight)
 * - Extended lookback windows (8H momentum, 6H spot/perp, 90-day funding)
 * - Signal freshness decay over time
 * - Multi-timeframe RSI divergence (4H + 1D)
 */

// Weight distribution optimized for 24H prediction
const WEIGHTS_24H = {
    spotPerpDivergence: 0.35,      // PRIMARY - institutional flows
    fundingMeanReversion: 0.25,    // Extended 90-day baseline
    oiPriceMomentum: 0.20,         // 8H window momentum
    crossExchangeConfluence: 0.10, // Veto mechanism
    whales: 0.05                   // Limited data quality
};

// Bonus multipliers (additive after weighted sum)
const BONUSES_24H = {
    rsiDivergenceDual: 0.15,       // 4H + 1D RSI divergence alignment
    rsiDivergenceSingle: 0.08,     // Single timeframe only
    allFactorsAligned: 0.10,
    extremeFunding: 0.10           // Z > 3.0
};

// Extended timeframes for 24H prediction
const TIMEFRAMES_24H = {
    MOMENTUM_WINDOW: 8 * 60 * 60 * 1000,      // 8H (was 1H)
    SPOT_PERP_WINDOW: 6 * 60 * 60 * 1000,     // 6H (was 2H)
    SWING_LEVELS: 8 * 60 * 60 * 1000,         // 8H (was 4H)
    FUNDING_BASELINE_PERIODS: 2160,            // 90 days of 8H funding
    MIN_DATA_POINTS: 288,                      // 24H of 5-min data
    REFRESH_INTERVAL: 4 * 60 * 60 * 1000,     // 4H refresh cycle
    SIGNAL_VALIDITY: 24 * 60 * 60 * 1000      // 24H validity
};

// Coin-specific CVD thresholds (same as 8-12H)
const CVD_THRESHOLDS = {
    BTC: { strong: 50000, moderate: 20000, weak: 5000 },
    ETH: { strong: 20000, moderate: 8000, weak: 2000 },
    SOL: { strong: 5000, moderate: 2000, weak: 500 }
};

// Data completeness thresholds for confidence
const DATA_COMPLETENESS = {
    DISABLED: 0.25,      // < 25% = no predictions
    LOW_MAX: 0.50,       // 25-50% = LOW confidence max
    MEDIUM_MAX: 0.75,    // 50-75% = MEDIUM confidence max
    FULL: 1.0            // 75%+ = full confidence available
};

/**
 * Calculate Spot/Perp CVD Divergence (PRIMARY SIGNAL for 24H)
 * Uses 6H window for institutional flow detection
 */
function calculateSpotPerpDivergence(spotCvdHistory, perpCvdHistory, coin = 'BTC') {
    const now = Date.now();
    const sixHoursAgo = now - TIMEFRAMES_24H.SPOT_PERP_WINDOW;

    // Calculate 6H spot CVD delta
    const spotCvd6H = spotCvdHistory.filter(e => e && e.time >= sixHoursAgo);
    const spotDelta = spotCvd6H.reduce((sum, e) => sum + (e.delta || 0), 0);

    // Calculate 6H perp CVD delta
    const perpCvd6H = perpCvdHistory.filter(e => e && e.time >= sixHoursAgo);
    const perpDelta = perpCvd6H.reduce((sum, e) => sum + (e.delta || 0), 0);

    if (spotCvd6H.length < 10 || perpCvd6H.length < 10) {
        return {
            score: 0,
            signal: 'INSUFFICIENT_DATA',
            spotDelta: 0,
            perpDelta: 0,
            description: 'Waiting for 6H of spot/perp data'
        };
    }

    const thresholds = CVD_THRESHOLDS[coin] || CVD_THRESHOLDS.BTC;

    // Determine trends
    const spotTrend = spotDelta > thresholds.weak ? 'up' : spotDelta < -thresholds.weak ? 'down' : 'flat';
    const perpTrend = perpDelta > thresholds.weak ? 'up' : perpDelta < -thresholds.weak ? 'down' : 'flat';

    let score = 0;
    let signal = 'NEUTRAL';
    let description = 'No clear spot/perp divergence';

    // BULLISH: Spot accumulation (smart money buying)
    if (spotTrend === 'up' && perpTrend !== 'up') {
        score = 0.85;
        signal = 'SPOT_ACCUMULATION';
        description = 'Institutional spot buying - bullish 24H';
    }
    // BULLISH: Capitulation bottom (spot absorbing perp panic)
    else if (spotTrend === 'up' && perpTrend === 'down') {
        score = 0.75;
        signal = 'CAPITULATION_BOTTOM';
        description = 'Spot absorbing perp selling - reversal signal';
    }
    // BEARISH: Fake pump (leverage without spot conviction)
    else if (perpTrend === 'up' && spotTrend === 'down') {
        score = -0.85;
        signal = 'FAKE_PUMP';
        description = 'Leverage rally without spot support - bearish 24H';
    }
    // BEARISH: Distribution (smart money selling)
    else if (spotTrend === 'down' && perpTrend !== 'down') {
        score = -0.70;
        signal = 'DISTRIBUTION';
        description = 'Institutional spot selling - bearish 24H';
    }
    // ALIGNED: Both moving same direction
    else if (spotTrend === perpTrend && spotTrend !== 'flat') {
        score = spotTrend === 'up' ? 0.50 : -0.50;
        signal = spotTrend === 'up' ? 'ALIGNED_BULL' : 'ALIGNED_BEAR';
        description = `Spot and perp aligned ${spotTrend} - trend continuation`;
    }

    return {
        score,
        signal,
        spotDelta,
        perpDelta,
        spotTrend,
        perpTrend,
        description,
        window: '6H'
    };
}

/**
 * Calculate Funding Mean Reversion with 90-day baseline
 * Extended lookback for true statistical extremes
 */
function calculateFundingMeanReversion(fundingHistory, priceHistory) {
    if (!fundingHistory || fundingHistory.length < 30) {
        return {
            score: 0,
            zScore: 0,
            mode: 'insufficient_data',
            baselineDays: 0,
            description: 'Waiting for funding history'
        };
    }

    const rates = fundingHistory.map(f => f.rate).filter(r => r !== undefined && !isNaN(r));
    if (rates.length < 30) {
        return { score: 0, zScore: 0, mode: 'insufficient_data', baselineDays: 0 };
    }

    // Use all available data up to 90 days
    const baselineRates = rates.slice(-TIMEFRAMES_24H.FUNDING_BASELINE_PERIODS);
    const baselineDays = Math.floor(baselineRates.length / 3); // 3 funding periods per day

    const mean = baselineRates.reduce((a, b) => a + b, 0) / baselineRates.length;
    const variance = baselineRates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / baselineRates.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) {
        return { score: 0, zScore: 0, mean, stddev: 0, mode: 'stable', baselineDays };
    }

    const currentRate = rates[rates.length - 1];
    const zScore = (currentRate - mean) / stddev;
    const annualized = currentRate * 3 * 365 * 100;

    // Adaptive thresholds based on data availability
    const thresholds = getZScoreThresholds(baselineDays);

    let score = 0;
    let zone = 'normal';
    let mode = 'contrarian';

    // CONTRARIAN: Extreme funding = mean reversion within 24-48H
    if (zScore >= thresholds.extreme) {
        score = -0.90;
        zone = 'extreme_long_bias';
        mode = 'contrarian';
    } else if (zScore >= thresholds.high) {
        score = -0.65;
        zone = 'high_long_bias';
        mode = 'contrarian';
    } else if (zScore >= thresholds.moderate) {
        score = -0.35;
        zone = 'moderate_long_bias';
        mode = 'contrarian';
    } else if (zScore <= -thresholds.extreme) {
        score = 0.90;
        zone = 'extreme_short_bias';
        mode = 'contrarian';
    } else if (zScore <= -thresholds.high) {
        score = 0.65;
        zone = 'high_short_bias';
        mode = 'contrarian';
    } else if (zScore <= -thresholds.moderate) {
        score = 0.35;
        zone = 'moderate_short_bias';
        mode = 'contrarian';
    }

    return {
        score,
        zScore,
        mean,
        stddev,
        current: currentRate,
        annualized,
        zone,
        mode,
        baselineDays,
        description: `Funding Z=${zScore.toFixed(2)} (${baselineDays}d baseline)`
    };
}

/**
 * Adaptive Z-score thresholds based on data availability
 */
function getZScoreThresholds(baselineDays) {
    if (baselineDays >= 90) {
        return { extreme: 2.5, high: 2.0, moderate: 1.5 }; // Full precision
    } else if (baselineDays >= 30) {
        return { extreme: 3.0, high: 2.5, moderate: 2.0 }; // Conservative
    } else {
        return { extreme: 3.5, high: 3.0, moderate: 2.5 }; // Very conservative
    }
}

/**
 * Calculate 8H OI + Price Momentum
 * Extended window for 24H prediction stability
 */
function calculateOIPriceMomentum(oiHistory, priceHistory) {
    if (!oiHistory || oiHistory.length < 20 || !priceHistory || priceHistory.length < 20) {
        return { score: 0, trend: 'insufficient_data' };
    }

    const now = Date.now();
    const eightHoursAgo = now - TIMEFRAMES_24H.MOMENTUM_WINDOW;

    // 8H price change
    const recentPrices = priceHistory.filter(e => e && e.timestamp >= eightHoursAgo);
    let priceChange = 0;
    if (recentPrices.length >= 2 && recentPrices[0].value > 0) {
        priceChange = ((recentPrices[recentPrices.length - 1].value - recentPrices[0].value) / recentPrices[0].value) * 100;
    }

    // 8H OI change
    const recentOI = oiHistory.filter(e => e && e.timestamp >= eightHoursAgo);
    let oiChange = 0;
    if (recentOI.length >= 2 && recentOI[0].value > 0) {
        oiChange = ((recentOI[recentOI.length - 1].value - recentOI[0].value) / recentOI[0].value) * 100;
    }

    let score = 0;
    let trend = 'neutral';
    let description = 'No clear 8H momentum';

    // Strong bullish momentum: Price up >2% + OI up >3%
    if (priceChange > 2 && oiChange > 3) {
        score = 0.75;
        trend = 'strong_bullish';
        description = `Strong bullish 8H momentum (P:+${priceChange.toFixed(1)}%, OI:+${oiChange.toFixed(1)}%)`;
    }
    // Strong bearish momentum: Price down >2% + OI up >3%
    else if (priceChange < -2 && oiChange > 3) {
        score = -0.75;
        trend = 'strong_bearish';
        description = `Strong bearish 8H momentum (P:${priceChange.toFixed(1)}%, OI:+${oiChange.toFixed(1)}%)`;
    }
    // Moderate bullish: Price up + OI up
    else if (priceChange > 1 && oiChange > 1) {
        score = 0.45;
        trend = 'moderate_bullish';
        description = 'Moderate bullish 8H trend';
    }
    // Moderate bearish: Price down + OI up
    else if (priceChange < -1 && oiChange > 1) {
        score = -0.45;
        trend = 'moderate_bearish';
        description = 'Moderate bearish 8H trend';
    }
    // Capitulation: Price down + OI down sharply
    else if (priceChange < -2 && oiChange < -3) {
        score = 0.50; // Contrarian bullish
        trend = 'capitulation';
        description = 'Capitulation pattern - potential reversal';
    }
    // Squeeze exhaustion: Price up + OI down
    else if (priceChange > 2 && oiChange < -3) {
        score = -0.50; // Contrarian bearish
        trend = 'squeeze_exhaustion';
        description = 'Short squeeze exhaustion';
    }

    return {
        score,
        trend,
        priceChange,
        oiChange,
        description,
        window: '8H'
    };
}

/**
 * Calculate cross-exchange confluence (4H window for 24H prediction)
 */
function calculateCrossExchangeConfluence(dataStore, coin = 'BTC') {
    const exchanges = ['hyperliquid', 'binance', 'bybit'];
    const biases = [];
    const now = Date.now();
    const fourHoursAgo = now - (4 * 60 * 60 * 1000);

    for (const exchange of exchanges) {
        const data = dataStore.getExchangeData(exchange);
        if (!data?.price?.[coin]) continue;

        const priceHistory = data.price[coin] || [];
        const recentPrices = priceHistory.filter(e => e && e.timestamp >= fourHoursAgo);

        if (recentPrices.length >= 2 && recentPrices[0].value > 0) {
            const change = ((recentPrices[recentPrices.length - 1].value - recentPrices[0].value) / recentPrices[0].value) * 100;
            biases.push({
                exchange,
                bias: change > 0.5 ? 'bullish' : change < -0.5 ? 'bearish' : 'neutral',
                change
            });
        }
    }

    if (biases.length < 2) {
        return { score: 0, agreement: 0, shouldVeto: false };
    }

    const bullishCount = biases.filter(b => b.bias === 'bullish').length;
    const bearishCount = biases.filter(b => b.bias === 'bearish').length;
    const dominantBias = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral';
    const maxCount = Math.max(bullishCount, bearishCount);
    const agreement = maxCount / biases.length;

    // VETO: If <70% agreement, signal is unreliable for 24H
    const shouldVeto = agreement < 0.7;

    let score = 0;
    if (agreement >= 0.9) {
        score = dominantBias === 'bullish' ? 0.70 : dominantBias === 'bearish' ? -0.70 : 0;
    } else if (agreement >= 0.7) {
        score = dominantBias === 'bullish' ? 0.40 : dominantBias === 'bearish' ? -0.40 : 0;
    }

    return {
        score,
        agreement,
        dominantBias,
        shouldVeto,
        details: biases,
        window: '4H'
    };
}

/**
 * Calculate whale alignment (unchanged from 8-12H)
 */
function calculateWhaleAlignment(consensus) {
    if (!consensus || !consensus.BTC) {
        return { score: 0, longPct: 0.5, hasData: false };
    }

    const btcData = consensus.BTC;
    const totalPositions = (btcData.longs?.length || 0) + (btcData.shorts?.length || 0);

    if (totalPositions < 3) {
        return { score: 0, longPct: 0.5, hasData: false };
    }

    const longPct = btcData.longs.length / totalPositions;
    const score = (longPct - 0.5) * 2;

    return {
        score: Math.max(-1, Math.min(1, score)),
        longPct,
        hasData: true
    };
}

/**
 * Calculate signal freshness decay
 * Confidence degrades over time: 100% → 90% → 75% → 60%
 */
function calculateSignalFreshness(generatedAt, currentTime = Date.now()) {
    const ageMs = currentTime - generatedAt;
    const ageHours = ageMs / (60 * 60 * 1000);

    // Exponential decay: 100% at T=0, ~90% at T+8H, ~75% at T+16H, ~60% at T+24H
    const freshness = Math.exp(-0.025 * ageHours);

    return {
        freshness: Math.max(0.60, Math.min(1.0, freshness)),
        ageHours: Math.round(ageHours * 10) / 10,
        shouldRefresh: ageHours >= 4,
        isStale: ageHours >= 8
    };
}

/**
 * Calculate data completeness for confidence capping
 */
function calculateDataCompleteness(hlData, coin) {
    const priceCount = hlData.price?.[coin]?.length || 0;
    const oiCount = hlData.oi?.[coin]?.length || 0;
    const cvdCount = hlData.cvd?.[coin]?.length || 0;
    const fundingCount = hlData.funding?.[coin]?.length || 0;

    const priceComplete = Math.min(1, priceCount / TIMEFRAMES_24H.MIN_DATA_POINTS);
    const oiComplete = Math.min(1, oiCount / TIMEFRAMES_24H.MIN_DATA_POINTS);
    const cvdComplete = Math.min(1, cvdCount / TIMEFRAMES_24H.MIN_DATA_POINTS);
    const fundingComplete = Math.min(1, fundingCount / 720); // 30 days minimum for funding

    const overall = (priceComplete + oiComplete + cvdComplete + fundingComplete) / 4;

    let maxConfidence = 'HIGH';
    let status = 'READY';

    if (overall < DATA_COMPLETENESS.DISABLED) {
        maxConfidence = 'DISABLED';
        status = 'WARMING_UP';
    } else if (overall < DATA_COMPLETENESS.LOW_MAX) {
        maxConfidence = 'LOW';
        status = 'LIMITED_DATA';
    } else if (overall < DATA_COMPLETENESS.MEDIUM_MAX) {
        maxConfidence = 'MEDIUM';
        status = 'BUILDING';
    }

    return {
        overall,
        price: priceComplete,
        oi: oiComplete,
        cvd: cvdComplete,
        funding: fundingComplete,
        maxConfidence,
        status,
        percentComplete: Math.round(overall * 100)
    };
}

/**
 * Calculate 8H swing levels for invalidation
 */
function findSwingLevels8H(priceHistory) {
    if (!priceHistory || priceHistory.length < 20) {
        return { swingLow: 0, swingHigh: 0, currentPrice: 0 };
    }

    const now = Date.now();
    const eightHoursAgo = now - TIMEFRAMES_24H.SWING_LEVELS;
    const relevantPrices = priceHistory.filter(p => p && p.timestamp >= eightHoursAgo);

    if (relevantPrices.length < 5) {
        return { swingLow: 0, swingHigh: 0, currentPrice: 0 };
    }

    const prices = relevantPrices.map(p => p.value).filter(v => v > 0);
    const swingLow = Math.min(...prices);
    const swingHigh = Math.max(...prices);
    const currentPrice = priceHistory[priceHistory.length - 1]?.value || 0;

    return { swingLow, swingHigh, currentPrice };
}

/**
 * Calculate ATR for invalidation buffer
 */
function calculateATR8H(priceHistory) {
    if (!priceHistory || priceHistory.length < 20) {
        return 0;
    }

    const now = Date.now();
    const eightHoursAgo = now - TIMEFRAMES_24H.SWING_LEVELS;
    const relevantPrices = priceHistory.filter(p => p && p.timestamp >= eightHoursAgo);

    if (relevantPrices.length < 5) {
        return 0;
    }

    const trueRanges = [];
    for (let i = 1; i < relevantPrices.length; i++) {
        const curr = relevantPrices[i].value;
        const prev = relevantPrices[i - 1].value;
        if (curr > 0 && prev > 0) {
            trueRanges.push(Math.abs(curr - prev));
        }
    }

    if (trueRanges.length === 0) return 0;

    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
}

/**
 * Calculate invalidation level for 24H bias
 */
function calculateInvalidation24H(priceHistory, bias) {
    const ATR_MULTIPLIER = 0.75; // Slightly wider for 24H

    const { swingLow, swingHigh, currentPrice } = findSwingLevels8H(priceHistory);
    const atr = calculateATR8H(priceHistory);

    if (currentPrice === 0 || swingLow === 0 || swingHigh === 0) {
        return null;
    }

    const biasUpper = bias?.toUpperCase() || '';

    if (biasUpper.includes('BULL')) {
        const invalidationPrice = swingLow - (atr * ATR_MULTIPLIER);
        const distance = ((currentPrice - invalidationPrice) / currentPrice) * 100;

        return {
            price: Math.round(invalidationPrice),
            type: 'below',
            distance: Math.round(distance * 10) / 10,
            description: `Daily bias invalidated below $${invalidationPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        };
    } else if (biasUpper.includes('BEAR')) {
        const invalidationPrice = swingHigh + (atr * ATR_MULTIPLIER);
        const distance = ((invalidationPrice - currentPrice) / currentPrice) * 100;

        return {
            price: Math.round(invalidationPrice),
            type: 'above',
            distance: Math.round(distance * 10) / 10,
            description: `Daily bias invalidated above $${invalidationPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        };
    }

    return {
        type: 'range',
        rangeLow: Math.round(swingLow),
        rangeHigh: Math.round(swingHigh),
        description: 'Watch for breakout from current range'
    };
}

/**
 * Get current UTC date string for "valid for" display
 */
function getCurrentUTCDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

/**
 * Main Daily Bias Projection Generator
 */
function generateDailyBias(coin, dataStore, consensus = null) {
    const validCoins = ['BTC', 'ETH', 'SOL'];
    if (!validCoins.includes(coin)) {
        return {
            error: `Daily Bias available for ${validCoins.join(', ')} only`,
            coin,
            supported: false
        };
    }

    const now = Date.now();
    const hlData = dataStore.getExchangeData('hyperliquid');

    // Check data completeness
    const dataCompleteness = calculateDataCompleteness(hlData, coin);

    if (dataCompleteness.status === 'WARMING_UP') {
        return {
            coin,
            horizon: '24H',
            biasType: 'DAILY',
            status: 'WARMING_UP',
            message: `Collecting baseline data for Daily Bias...`,
            dataCompleteness,
            generatedAt: now
        };
    }

    // Get spot CVD history
    const spotCvdHistory = dataStore.getSpotCvdHistory ? dataStore.getSpotCvdHistory(coin) : [];
    const perpCvdHistory = hlData.cvd?.[coin] || [];

    // Calculate all components
    const spotPerpDivergence = calculateSpotPerpDivergence(spotCvdHistory, perpCvdHistory, coin);
    const fundingMeanReversion = calculateFundingMeanReversion(hlData.funding?.[coin], hlData.price?.[coin]);
    const oiPriceMomentum = calculateOIPriceMomentum(hlData.oi?.[coin], hlData.price?.[coin]);
    const confluence = calculateCrossExchangeConfluence(dataStore, coin);
    const whales = calculateWhaleAlignment(consensus);

    // Check for veto condition
    if (confluence.shouldVeto) {
        return {
            coin,
            horizon: '24H',
            biasType: 'DAILY',
            status: 'VETO',
            message: 'Cross-exchange disagreement - no reliable daily signal',
            prediction: {
                bias: 'NO_SIGNAL',
                strength: 'NONE',
                score: 0,
                grade: 'N/A'
            },
            vetoReason: `Only ${Math.round(confluence.agreement * 100)}% exchange agreement (need 70%+)`,
            vetoDetails: {
                agreement: Math.round(confluence.agreement * 100),
                exchangeBiases: confluence.details,
                recommendation: confluence.agreement < 0.50
                    ? "High disagreement - stand aside completely"
                    : "Moderate disagreement - watch for 70%+ agreement to form"
            },
            generatedAt: now
        };
    }

    // Calculate weighted score
    let totalWeight = WEIGHTS_24H.spotPerpDivergence + WEIGHTS_24H.fundingMeanReversion +
                      WEIGHTS_24H.oiPriceMomentum + WEIGHTS_24H.crossExchangeConfluence;

    let weightedScore = (
        (spotPerpDivergence.score * WEIGHTS_24H.spotPerpDivergence) +
        (fundingMeanReversion.score * WEIGHTS_24H.fundingMeanReversion) +
        (oiPriceMomentum.score * WEIGHTS_24H.oiPriceMomentum) +
        (confluence.score * WEIGHTS_24H.crossExchangeConfluence)
    );

    // Add whale factor if available
    if (whales.hasData) {
        totalWeight += WEIGHTS_24H.whales;
        weightedScore += whales.score * WEIGHTS_24H.whales;
    }

    // Normalize
    let normalizedScore = weightedScore / totalWeight;

    // Add bonuses
    // Extreme funding bonus
    if (Math.abs(fundingMeanReversion.zScore) >= 3.0) {
        normalizedScore += fundingMeanReversion.score > 0 ? BONUSES_24H.extremeFunding : -BONUSES_24H.extremeFunding;
    }

    // All factors aligned bonus
    const allBullish = spotPerpDivergence.score > 0.3 && fundingMeanReversion.score > 0 && oiPriceMomentum.score > 0;
    const allBearish = spotPerpDivergence.score < -0.3 && fundingMeanReversion.score < 0 && oiPriceMomentum.score < 0;
    if (allBullish || allBearish) {
        normalizedScore += allBullish ? BONUSES_24H.allFactorsAligned : -BONUSES_24H.allFactorsAligned;
    }

    // Clamp score
    normalizedScore = Math.max(-1, Math.min(1, normalizedScore));

    // Calculate range metrics for low-score scenarios
    const { swingLow, swingHigh, currentPrice: swingCurrentPrice } = findSwingLevels8H(hlData.price?.[coin]);
    const atr = calculateATR8H(hlData.price?.[coin]);
    const rangeWidth = (swingHigh > 0 && swingLow > 0 && swingCurrentPrice > 0)
        ? ((swingHigh - swingLow) / swingCurrentPrice) * 100
        : 0;

    // Determine bias with enhanced low-score handling
    let bias, strength, marketState = null;
    const absScore = Math.abs(normalizedScore);

    if (absScore >= 0.60) {
        bias = normalizedScore > 0 ? 'STRONG_BULL' : 'STRONG_BEAR';
        strength = 'STRONG';
    } else if (absScore >= 0.35) {
        bias = normalizedScore > 0 ? 'BULLISH' : 'BEARISH';
        strength = 'MODERATE';
    } else if (absScore >= 0.15) {
        bias = normalizedScore > 0 ? 'LEAN_BULL' : 'LEAN_BEAR';
        strength = 'WEAK';
    } else if (absScore >= 0.08) {
        // NEW: Micro directional lean (scalpers only)
        bias = normalizedScore > 0 ? 'MICRO_BULL' : 'MICRO_BEAR';
        strength = 'MINIMAL';
        marketState = 'LOW_CONVICTION';
    } else {
        // Very low score - distinguish CONSOLIDATION from true NEUTRAL
        if (rangeWidth > 0 && rangeWidth < 2.5) {
            bias = 'CONSOLIDATION';
            strength = 'RANGE';
            marketState = 'TIGHT_RANGE';
        } else if (rangeWidth >= 2.5) {
            bias = 'NEUTRAL';
            strength = 'NONE';
            marketState = 'CHOPPY';
        } else {
            bias = 'NEUTRAL';
            strength = 'NONE';
        }
    }

    // Calculate grade
    let grade;
    if (absScore >= 0.70) grade = 'A+';
    else if (absScore >= 0.55) grade = 'A';
    else if (absScore >= 0.40) grade = 'B+';
    else if (absScore >= 0.25) grade = 'B';
    else grade = 'C';

    // Calculate confidence (capped by data completeness)
    let confidenceScore = 0.50;
    if (confluence.agreement >= 0.9) confidenceScore += 0.15;
    if (Math.abs(fundingMeanReversion.zScore) >= 2.5) confidenceScore += 0.10;
    if (spotPerpDivergence.signal !== 'NEUTRAL' && spotPerpDivergence.signal !== 'INSUFFICIENT_DATA') {
        confidenceScore += 0.15;
    }
    if (whales.hasData) confidenceScore += 0.05;

    confidenceScore = Math.min(1, confidenceScore);

    // Apply data completeness cap
    if (dataCompleteness.maxConfidence === 'LOW') {
        confidenceScore = Math.min(0.40, confidenceScore);
    } else if (dataCompleteness.maxConfidence === 'MEDIUM') {
        confidenceScore = Math.min(0.60, confidenceScore);
    }

    const confidenceLevel = confidenceScore >= 0.70 ? 'HIGH' : confidenceScore >= 0.50 ? 'MEDIUM' : 'LOW';

    // Build key drivers
    const keyDrivers = [
        {
            name: spotPerpDivergence.signal === 'SPOT_ACCUMULATION' ? 'Spot Accumulation' :
                  spotPerpDivergence.signal === 'FAKE_PUMP' ? 'Fake Pump Warning' :
                  spotPerpDivergence.signal === 'DISTRIBUTION' ? 'Distribution' :
                  'Spot/Perp Flow',
            weight: WEIGHTS_24H.spotPerpDivergence,
            signal: spotPerpDivergence.score > 0.1 ? 'bullish' : spotPerpDivergence.score < -0.1 ? 'bearish' : 'neutral',
            description: spotPerpDivergence.description
        },
        {
            name: `Funding Z=${fundingMeanReversion.zScore?.toFixed(1) || '0'}`,
            weight: WEIGHTS_24H.fundingMeanReversion,
            signal: fundingMeanReversion.score > 0.1 ? 'bullish' : fundingMeanReversion.score < -0.1 ? 'bearish' : 'neutral',
            description: fundingMeanReversion.description
        },
        {
            name: '8H Momentum',
            weight: WEIGHTS_24H.oiPriceMomentum,
            signal: oiPriceMomentum.score > 0.1 ? 'bullish' : oiPriceMomentum.score < -0.1 ? 'bearish' : 'neutral',
            description: oiPriceMomentum.description
        }
    ];

    // Calculate invalidation
    const invalidation = calculateInvalidation24H(hlData.price?.[coin], bias);

    // Get current price
    const priceHistory = hlData.price?.[coin] || [];
    const currentPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].value : 0;

    // Calculate freshness
    const freshness = calculateSignalFreshness(now, now);

    // Calculate next refresh time
    const nextRefresh = now + TIMEFRAMES_24H.REFRESH_INTERVAL;
    const refreshInHours = TIMEFRAMES_24H.REFRESH_INTERVAL / (60 * 60 * 1000);

    // Build range analysis for low-score scenarios
    const rangeAnalysis = (absScore < 0.15 && swingLow > 0 && swingHigh > 0) ? {
        swingLow: Math.round(swingLow),
        swingHigh: Math.round(swingHigh),
        midpoint: Math.round((swingLow + swingHigh) / 2),
        rangeWidth: Math.round(rangeWidth * 100) / 100,
        atr: Math.round(atr),
        tradingGuidance: rangeWidth < 2.5
            ? `Tight ${rangeWidth.toFixed(1)}% range - trade support/resistance`
            : `Wide ${rangeWidth.toFixed(1)}% range - choppy, reduce exposure`
    } : null;

    return {
        coin,
        horizon: '24H',
        biasType: 'DAILY',
        status: 'ACTIVE',
        validFor: getCurrentUTCDate(),
        currentPrice,
        prediction: {
            bias,
            strength,
            score: Math.round(normalizedScore * 1000) / 1000,
            grade,
            direction: normalizedScore > 0 ? 'BULLISH' : normalizedScore < 0 ? 'BEARISH' : 'NEUTRAL',
            marketState
        },
        confidence: {
            level: confidenceLevel,
            score: Math.round(confidenceScore * 100) / 100,
            maxAllowed: dataCompleteness.maxConfidence
        },
        freshness: {
            ...freshness,
            generatedAt: now
        },
        invalidation,
        rangeAnalysis,
        keyDrivers,
        dataCompleteness: {
            percentComplete: dataCompleteness.percentComplete,
            status: dataCompleteness.status
        },
        components: {
            spotPerpDivergence,
            fundingMeanReversion,
            oiPriceMomentum,
            confluence,
            whales
        },
        generatedAt: now,
        validUntil: now + TIMEFRAMES_24H.SIGNAL_VALIDITY,
        nextRefresh,
        refreshIn: `${refreshInHours} hours`
    };
}

module.exports = {
    generateDailyBias,
    calculateSpotPerpDivergence,
    calculateFundingMeanReversion,
    calculateOIPriceMomentum,
    calculateCrossExchangeConfluence,
    calculateWhaleAlignment,
    calculateSignalFreshness,
    calculateDataCompleteness,
    WEIGHTS_24H,
    TIMEFRAMES_24H,
    CVD_THRESHOLDS
};
