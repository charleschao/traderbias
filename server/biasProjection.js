/**
 * Bias Projection Module
 * 
 * Calculates 8-12 hour forward-looking bias predictions for BTC
 * using multi-factor analysis across all available data sources.
 */

// Weights for each factor in the final score
const WEIGHTS = {
    momentum: 0.30,      // Time-weighted price momentum
    regime: 0.25,        // OI + Funding regime detection
    cvdPersistence: 0.20, // Sustained buying/selling pressure
    whales: 0.15,        // Whale positioning (Hyperliquid only)
    confluence: 0.10     // Cross-exchange agreement
};

// Timeframes in milliseconds
const TIMEFRAMES = {
    FIVE_MIN: 5 * 60 * 1000,
    THIRTY_MIN: 30 * 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    TWO_HOURS: 2 * 60 * 60 * 1000,
    FOUR_HOURS: 4 * 60 * 60 * 1000,
    EIGHT_HOURS: 8 * 60 * 60 * 1000
};

/**
 * Calculate time-weighted momentum score
 * Weights recent timeframes less, longer timeframes more
 * @returns {number} -1 to +1 normalized score
 */
function calculateMomentumScore(priceHistory) {
    if (!priceHistory || priceHistory.length < 2) {
        return { score: 0, details: { fiveMin: 0, thirtyMin: 0, fourHour: 0 } };
    }

    const now = Date.now();

    const getChange = (minutes) => {
        const targetTime = now - (minutes * 60 * 1000);
        const relevantEntries = priceHistory.filter(e => e && e.timestamp >= targetTime);
        if (relevantEntries.length < 2) return 0;

        const oldest = relevantEntries.reduce((o, e) => e.timestamp < o.timestamp ? e : o, relevantEntries[0]);
        const newest = priceHistory[priceHistory.length - 1];

        if (!oldest?.value || oldest.value === 0) return 0;
        return ((newest.value - oldest.value) / oldest.value) * 100;
    };

    const fiveMinChange = getChange(5);
    const thirtyMinChange = getChange(30);
    const fourHourChange = getChange(240);

    // Weighted combination (longer timeframes weighted more)
    const rawScore = (
        (0.1 * fiveMinChange) +
        (0.3 * thirtyMinChange) +
        (0.6 * fourHourChange)
    );

    // Normalize to -1 to +1 (assume ±5% as max expected move)
    const normalizedScore = Math.max(-1, Math.min(1, rawScore / 5));

    return {
        score: normalizedScore,
        details: {
            fiveMin: fiveMinChange,
            thirtyMin: thirtyMinChange,
            fourHour: fourHourChange
        }
    };
}

/**
 * Detect market regime based on OI and funding
 * @returns {object} { score, regime, description }
 */
function detectRegime(oiHistory, fundingHistory, priceHistory) {
    if (!oiHistory || oiHistory.length < 2 || !fundingHistory || fundingHistory.length < 1) {
        return { score: 0, regime: 'UNKNOWN', description: 'Insufficient data' };
    }

    const now = Date.now();
    const oneHourAgo = now - TIMEFRAMES.ONE_HOUR;

    // Calculate OI change over last hour
    const recentOI = oiHistory.filter(e => e && e.timestamp >= oneHourAgo);
    let oiChange = 0;
    if (recentOI.length >= 2) {
        const oldestOI = recentOI[0].value;
        const newestOI = recentOI[recentOI.length - 1].value;
        oiChange = oldestOI > 0 ? ((newestOI - oldestOI) / oldestOI) * 100 : 0;
    }

    // Get current funding rate
    const currentFunding = fundingHistory[fundingHistory.length - 1]?.rate || 0;
    const annualizedFunding = currentFunding * 3 * 365 * 100;

    // Regime detection logic
    let regime = 'NEUTRAL';
    let score = 0;
    let description = '';

    const oiRising = oiChange > 1;
    const oiFalling = oiChange < -1;
    const highPositiveFunding = annualizedFunding > 30;
    const highNegativeFunding = annualizedFunding < -30;
    const moderatePositiveFunding = annualizedFunding > 10 && annualizedFunding <= 30;
    const moderateNegativeFunding = annualizedFunding < -10 && annualizedFunding >= -30;

    if (oiRising && highPositiveFunding) {
        regime = 'LONG_CROWDED';
        score = -0.6; // Contrarian bearish
        description = 'Longs overcrowded - watch for squeeze';
    } else if (oiRising && highNegativeFunding) {
        regime = 'SHORT_CROWDED';
        score = 0.6; // Contrarian bullish
        description = 'Shorts overcrowded - squeeze potential';
    } else if (oiRising && moderatePositiveFunding) {
        regime = 'HEALTHY_LONG';
        score = 0.4;
        description = 'Healthy long trend building';
    } else if (oiRising && moderateNegativeFunding) {
        regime = 'HEALTHY_SHORT';
        score = -0.4;
        description = 'Healthy short trend building';
    } else if (oiFalling && Math.abs(oiChange) > 3) {
        regime = 'CAPITULATION';
        // Check price direction to determine if it's longs or shorts capitulating
        const recentPrice = priceHistory?.filter(e => e && e.timestamp >= oneHourAgo) || [];
        if (recentPrice.length >= 2) {
            const priceChange = ((recentPrice[recentPrice.length - 1].value - recentPrice[0].value) / recentPrice[0].value) * 100;
            if (priceChange < -1) {
                score = 0.3; // Longs capitulating = potential bottom
                description = 'Long capitulation - potential bottom';
            } else if (priceChange > 1) {
                score = -0.3; // Shorts capitulating = potential top
                description = 'Short squeeze exhaustion';
            }
        }
    } else {
        regime = 'NEUTRAL';
        score = 0;
        description = 'No clear regime';
    }

    return {
        score,
        regime,
        description,
        oiChange,
        annualizedFunding
    };
}

/**
 * Calculate CVD persistence (sustained buying/selling)
 * @returns {object} { score, thirtyMinDelta, twoHourDelta }
 */
function calculateCVDPersistence(cvdHistory) {
    if (!cvdHistory || cvdHistory.length < 2) {
        return { score: 0, thirtyMinDelta: 0, twoHourDelta: 0 };
    }

    const now = Date.now();

    // Sum CVD deltas over timeframes
    const thirtyMinAgo = now - TIMEFRAMES.THIRTY_MIN;
    const twoHoursAgo = now - TIMEFRAMES.TWO_HOURS;

    const thirtyMinHistory = cvdHistory.filter(e => e && e.time >= thirtyMinAgo);
    const twoHourHistory = cvdHistory.filter(e => e && e.time >= twoHoursAgo);

    const thirtyMinDelta = thirtyMinHistory.reduce((sum, e) => sum + (e.delta || 0), 0);
    const twoHourDelta = twoHourHistory.reduce((sum, e) => sum + (e.delta || 0), 0);

    // Weighted combination
    const weightedDelta = (thirtyMinDelta * 0.4) + (twoHourDelta * 0.6);

    // Normalize to -1 to +1 (assume ±$10M as significant)
    const normalizedScore = Math.max(-1, Math.min(1, weightedDelta / 10000000));

    return {
        score: normalizedScore,
        thirtyMinDelta,
        twoHourDelta
    };
}

/**
 * Calculate whale alignment score (Hyperliquid only)
 * @returns {object} { score, longPct, hasData }
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

    // Convert to -1 to +1 score
    const score = (longPct - 0.5) * 2;

    // Weight consistent winners more heavily
    const consistentLongs = btcData.longs?.filter(p => p.isConsistent).length || 0;
    const consistentShorts = btcData.shorts?.filter(p => p.isConsistent).length || 0;
    const consistentAdjust = (consistentLongs - consistentShorts) * 0.1;

    return {
        score: Math.max(-1, Math.min(1, score + consistentAdjust)),
        longPct,
        consistentLongs,
        consistentShorts,
        hasData: true
    };
}

/**
 * Calculate cross-exchange confluence
 * @returns {object} { score, agreement, exchangeCount }
 */
function calculateCrossExchangeConfluence(dataStore) {
    const exchanges = ['hyperliquid', 'binance', 'bybit'];
    const biases = [];

    for (const exchange of exchanges) {
        const data = dataStore.getExchangeData(exchange);
        if (!data?.current?.price?.BTC) continue;

        const priceHistory = data.price?.BTC || [];
        const now = Date.now();
        const oneHourAgo = now - TIMEFRAMES.ONE_HOUR;
        const recentPrices = priceHistory.filter(e => e && e.timestamp >= oneHourAgo);

        if (recentPrices.length >= 2) {
            const oldest = recentPrices[0].value;
            const newest = recentPrices[recentPrices.length - 1].value;
            const change = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0;

            biases.push({
                exchange,
                bias: change > 0.3 ? 'bullish' : change < -0.3 ? 'bearish' : 'neutral',
                change
            });
        }
    }

    if (biases.length < 2) {
        return { score: 0, agreement: 0, exchangeCount: biases.length, details: biases };
    }

    // Count dominant bias
    const bullishCount = biases.filter(b => b.bias === 'bullish').length;
    const bearishCount = biases.filter(b => b.bias === 'bearish').length;

    const dominantBias = bullishCount > bearishCount ? 'bullish' :
        bearishCount > bullishCount ? 'bearish' : 'neutral';
    const maxCount = Math.max(bullishCount, bearishCount);
    const agreement = maxCount / biases.length;

    // Score based on agreement and direction
    let score = 0;
    if (agreement >= 0.8) {
        score = dominantBias === 'bullish' ? 0.8 : dominantBias === 'bearish' ? -0.8 : 0;
    } else if (agreement >= 0.6) {
        score = dominantBias === 'bullish' ? 0.4 : dominantBias === 'bearish' ? -0.4 : 0;
    }

    return {
        score,
        agreement,
        exchangeCount: biases.length,
        dominantBias,
        details: biases
    };
}

/**
 * Calculate volatility for confidence adjustment
 */
function calculateVolatility(priceHistory) {
    if (!priceHistory || priceHistory.length < 10) {
        return { atr: 0, isHigh: false };
    }

    const now = Date.now();
    const fourHoursAgo = now - TIMEFRAMES.FOUR_HOURS;
    const recentPrices = priceHistory.filter(e => e && e.timestamp >= fourHoursAgo);

    if (recentPrices.length < 5) {
        return { atr: 0, isHigh: false };
    }

    // Simple volatility: max range / average price
    const prices = recentPrices.map(e => e.value);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    const range = ((maxPrice - minPrice) / avgPrice) * 100;

    return {
        atr: range,
        isHigh: range > 3 // More than 3% range in 4 hours is high
    };
}

/**
 * Determine trading session
 */
function detectSession() {
    const now = new Date();
    const utcHour = now.getUTCHours();

    // Asia: 00:00-08:00 UTC
    // London: 08:00-16:00 UTC
    // New York: 13:00-21:00 UTC (overlap 13-16)

    if (utcHour >= 0 && utcHour < 8) {
        return { name: 'ASIA', volatilityMultiplier: 0.9 };
    } else if (utcHour >= 8 && utcHour < 13) {
        return { name: 'LONDON', volatilityMultiplier: 1.0 };
    } else if (utcHour >= 13 && utcHour < 16) {
        return { name: 'LONDON_NY_OVERLAP', volatilityMultiplier: 1.1 };
    } else if (utcHour >= 16 && utcHour < 21) {
        return { name: 'NEW_YORK', volatilityMultiplier: 1.0 };
    } else {
        return { name: 'LATE_NY', volatilityMultiplier: 0.85 };
    }
}

/**
 * Main projection generator
 * @param {string} coin - Currently only 'BTC' supported
 * @param {object} dataStore - Reference to the data store
 * @param {object} consensus - Whale consensus data (optional)
 * @returns {object} Complete projection object
 */
function generateProjection(coin, dataStore, consensus = null) {
    if (coin !== 'BTC') {
        return {
            error: 'Projections currently only available for BTC',
            coin,
            supported: false
        };
    }

    const now = Date.now();

    // Get Hyperliquid data (primary source)
    const hlData = dataStore.getExchangeData('hyperliquid');

    if (!hlData || !hlData.price?.BTC || hlData.price.BTC.length < 10) {
        return {
            coin: 'BTC',
            horizon: '8-12H',
            status: 'COLLECTING',
            message: 'Collecting historical data. Prediction available after ~1 hour of data.',
            dataAge: hlData?.price?.BTC?.length || 0,
            generatedAt: now
        };
    }

    // Calculate all factors
    const momentum = calculateMomentumScore(hlData.price.BTC);
    const regime = detectRegime(hlData.oi.BTC, hlData.funding.BTC, hlData.price.BTC);
    const cvdPersistence = calculateCVDPersistence(hlData.cvd.BTC);
    const whales = calculateWhaleAlignment(consensus);
    const confluence = calculateCrossExchangeConfluence(dataStore);
    const volatility = calculateVolatility(hlData.price.BTC);
    const session = detectSession();

    // Calculate weighted score
    let totalWeight = WEIGHTS.momentum + WEIGHTS.regime + WEIGHTS.cvdPersistence + WEIGHTS.confluence;
    let weightedScore = (
        (momentum.score * WEIGHTS.momentum) +
        (regime.score * WEIGHTS.regime) +
        (cvdPersistence.score * WEIGHTS.cvdPersistence) +
        (confluence.score * WEIGHTS.confluence)
    );

    // Add whale factor if available
    if (whales.hasData) {
        totalWeight += WEIGHTS.whales;
        weightedScore += whales.score * WEIGHTS.whales;
    }

    // Normalize
    const normalizedScore = weightedScore / totalWeight;

    // Determine bias label
    let bias, strength;
    const absScore = Math.abs(normalizedScore);

    if (absScore >= 0.6) {
        bias = normalizedScore > 0 ? 'STRONG_BULL' : 'STRONG_BEAR';
        strength = 'STRONG';
    } else if (absScore >= 0.3) {
        bias = normalizedScore > 0 ? 'BULLISH' : 'BEARISH';
        strength = 'MODERATE';
    } else if (absScore >= 0.1) {
        bias = normalizedScore > 0 ? 'LEAN_BULL' : 'LEAN_BEAR';
        strength = 'WEAK';
    } else {
        bias = 'NEUTRAL';
        strength = 'NONE';
    }

    // Calculate grade
    let grade;
    if (absScore >= 0.7) grade = normalizedScore > 0 ? 'A+' : 'A+';
    else if (absScore >= 0.5) grade = normalizedScore > 0 ? 'A' : 'A';
    else if (absScore >= 0.3) grade = normalizedScore > 0 ? 'B+' : 'B+';
    else if (absScore >= 0.15) grade = 'B';
    else grade = 'C';

    // Calculate confidence
    const confidenceFactors = [];
    let confidenceScore = 0.5; // Base confidence

    if (confluence.agreement >= 0.8) {
        confidenceFactors.push('Strong cross-exchange alignment');
        confidenceScore += 0.15;
    }
    if (!volatility.isHigh) {
        confidenceFactors.push('Low volatility environment');
        confidenceScore += 0.1;
    }
    if (whales.hasData) {
        confidenceFactors.push('Whale data available');
        confidenceScore += 0.1;
    }
    if (Math.abs(regime.score) >= 0.4) {
        confidenceFactors.push(`Clear ${regime.regime.replace('_', ' ').toLowerCase()} regime`);
        confidenceScore += 0.1;
    }

    confidenceScore = Math.min(1, confidenceScore);
    const confidenceLevel = confidenceScore >= 0.7 ? 'HIGH' : confidenceScore >= 0.5 ? 'MEDIUM' : 'LOW';

    // Generate warnings
    const warnings = [];
    if (volatility.isHigh) {
        warnings.push('High volatility - increased uncertainty');
    }
    if (regime.regime === 'LONG_CROWDED') {
        warnings.push('Longs overcrowded - watch for liquidation cascade');
    }
    if (regime.regime === 'SHORT_CROWDED') {
        warnings.push('Shorts overcrowded - squeeze risk elevated');
    }
    if (Math.abs(regime.annualizedFunding) > 50) {
        warnings.push(`Extreme funding (${regime.annualizedFunding.toFixed(0)}% APR) - mean reversion likely`);
    }

    // Build key factors for display
    const keyFactors = [
        {
            name: '4H Momentum',
            direction: momentum.score > 0.1 ? 'bullish' : momentum.score < -0.1 ? 'bearish' : 'neutral',
            score: Math.abs(momentum.score),
            impact: Math.abs(momentum.score) > 0.5 ? 'high' : Math.abs(momentum.score) > 0.2 ? 'medium' : 'low',
            detail: `${momentum.details.fourHour > 0 ? '+' : ''}${momentum.details.fourHour.toFixed(2)}%`
        },
        {
            name: 'Market Regime',
            direction: regime.score > 0 ? 'bullish' : regime.score < 0 ? 'bearish' : 'neutral',
            score: Math.abs(regime.score),
            impact: Math.abs(regime.score) > 0.4 ? 'high' : Math.abs(regime.score) > 0.2 ? 'medium' : 'low',
            detail: regime.description
        },
        {
            name: 'CVD Flow',
            direction: cvdPersistence.score > 0.1 ? 'bullish' : cvdPersistence.score < -0.1 ? 'bearish' : 'neutral',
            score: Math.abs(cvdPersistence.score),
            impact: Math.abs(cvdPersistence.score) > 0.5 ? 'high' : Math.abs(cvdPersistence.score) > 0.2 ? 'medium' : 'low',
            detail: `$${(cvdPersistence.twoHourDelta / 1000000).toFixed(1)}M (2hr)`
        },
        {
            name: 'Exchange Confluence',
            direction: confluence.dominantBias || 'neutral',
            score: confluence.agreement,
            impact: confluence.agreement > 0.8 ? 'high' : confluence.agreement > 0.6 ? 'medium' : 'low',
            detail: `${confluence.exchangeCount} exchanges, ${(confluence.agreement * 100).toFixed(0)}% aligned`
        }
    ];

    if (whales.hasData) {
        keyFactors.push({
            name: 'Whale Consensus',
            direction: whales.score > 0.2 ? 'bullish' : whales.score < -0.2 ? 'bearish' : 'neutral',
            score: Math.abs(whales.score),
            impact: Math.abs(whales.score) > 0.5 ? 'high' : Math.abs(whales.score) > 0.2 ? 'medium' : 'low',
            detail: `${(whales.longPct * 100).toFixed(0)}% long`
        });
    }

    return {
        coin: 'BTC',
        horizon: '8-12H',
        status: 'ACTIVE',
        prediction: {
            bias,
            strength,
            score: normalizedScore,
            grade,
            direction: normalizedScore > 0 ? 'BULLISH' : normalizedScore < 0 ? 'BEARISH' : 'NEUTRAL'
        },
        confidence: {
            level: confidenceLevel,
            score: confidenceScore,
            factors: confidenceFactors
        },
        keyFactors,
        warnings,
        session: session.name,
        components: {
            momentum,
            regime,
            cvdPersistence,
            whales,
            confluence,
            volatility
        },
        generatedAt: now,
        validUntil: now + (4 * 60 * 60 * 1000), // 4 hours
        dataPointCount: hlData.price.BTC.length
    };
}

module.exports = {
    generateProjection,
    calculateMomentumScore,
    detectRegime,
    calculateCVDPersistence,
    calculateWhaleAlignment,
    calculateCrossExchangeConfluence,
    calculateVolatility,
    detectSession
};
