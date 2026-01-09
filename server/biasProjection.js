/**
 * Bias Projection Module (v2 - Refined Algorithm)
 * 
 * Calculates 8-12 hour forward-looking bias predictions for BTC
 * using proven quantitative indicators:
 * - RSI with divergence detection
 * - Funding rate Z-score (extreme positioning)
 * - OI rate of change (leverage dynamics)
 * - CVD persistence (buying/selling pressure)
 * - Market regime detection
 * - Whale consensus
 * - Cross-exchange confluence
 */

// Weights distribution (RSI divergence is bonus only, not weighted)
const WEIGHTS = {
    fundingZScore: 0.20, // Z-score for extreme funding detection
    oiRoC: 0.20,         // OI rate of change (leverage dynamics)
    cvdPersistence: 0.20,// Sustained buying/selling pressure
    regime: 0.20,        // OI + Funding regime detection
    whales: 0.10,        // Whale positioning (Hyperliquid only)
    confluence: 0.10     // Cross-exchange agreement
};

// Bonus multipliers (additive after weighted sum)
const BONUSES = {
    bullishDivergence: 0.20,
    bearishDivergence: -0.20,
    allFactorsAligned: 0.10
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
 * Calculate RSI (Relative Strength Index) with Wilder's smoothing
 * Standard 14-period RSI with contrarian scoring
 * @returns {object} { score, value, zone, avgGain, avgLoss }
 */
function calculateRSI(priceHistory, period = 14) {
    if (!priceHistory || priceHistory.length < period + 1) {
        return { score: 0, value: 50, zone: 'insufficient_data', avgGain: 0, avgLoss: 0 };
    }

    // Calculate price changes
    const changes = [];
    for (let i = 1; i < priceHistory.length; i++) {
        if (priceHistory[i]?.value && priceHistory[i - 1]?.value) {
            changes.push(priceHistory[i].value - priceHistory[i - 1].value);
        }
    }

    if (changes.length < period) {
        return { score: 0, value: 50, zone: 'insufficient_data', avgGain: 0, avgLoss: 0 };
    }

    // First period: simple average
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) avgGain += changes[i];
        else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    // Subsequent periods: Wilder's smoothing
    for (let i = period; i < changes.length; i++) {
        avgGain = (avgGain * (period - 1) + (changes[i] > 0 ? changes[i] : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (changes[i] < 0 ? Math.abs(changes[i]) : 0)) / period;
    }

    // Calculate RSI
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Contrarian scoring (overbought = bearish, oversold = bullish)
    let score = 0;
    let zone = 'neutral';

    if (rsi >= 80) { score = -0.9; zone = 'extreme_overbought'; }
    else if (rsi >= 70) { score = -0.5; zone = 'overbought'; }
    else if (rsi >= 60) { score = -0.2; zone = 'bullish_momentum'; }
    else if (rsi <= 20) { score = 0.9; zone = 'extreme_oversold'; }
    else if (rsi <= 30) { score = 0.5; zone = 'oversold'; }
    else if (rsi <= 40) { score = 0.2; zone = 'bearish_momentum'; }
    else { score = 0; zone = 'neutral'; }

    return { score, value: rsi, zone, avgGain, avgLoss };
}

/**
 * Detect RSI Divergence (powerful reversal signal)
 * Bullish: Price lower lows, RSI higher lows
 * Bearish: Price higher highs, RSI lower highs
 */
function detectRSIDivergence(priceHistory, period = 14) {
    if (!priceHistory || priceHistory.length < 30) {
        return { score: 0, type: 'none', detected: false };
    }

    // Calculate RSI for each point in recent history
    const rsiHistory = [];
    for (let i = period + 1; i <= priceHistory.length; i++) {
        const slice = priceHistory.slice(0, i);
        const rsi = calculateRSI(slice, period);
        if (rsi.value !== 50 || rsi.zone !== 'insufficient_data') {
            rsiHistory.push({
                timestamp: priceHistory[i - 1]?.timestamp,
                value: rsi.value,
                price: priceHistory[i - 1]?.value
            });
        }
    }

    if (rsiHistory.length < 20) {
        return { score: 0, type: 'none', detected: false };
    }

    // Look at last 20 points
    const recentData = rsiHistory.slice(-20);

    // Find local minima and maxima
    const findLocalExtrema = (data, isMin) => {
        const extrema = [];
        for (let i = 2; i < data.length - 2; i++) {
            const val = data[i].value;
            const prev1 = data[i - 1].value;
            const prev2 = data[i - 2].value;
            const next1 = data[i + 1].value;
            const next2 = data[i + 2].value;

            if (isMin) {
                if (val < prev1 && val < prev2 && val < next1 && val < next2) {
                    extrema.push({ idx: i, ...data[i] });
                }
            } else {
                if (val > prev1 && val > prev2 && val > next1 && val > next2) {
                    extrema.push({ idx: i, ...data[i] });
                }
            }
        }
        return extrema;
    };

    const priceLows = findLocalExtrema(recentData.map(d => ({ ...d, value: d.price })), true);
    const priceHighs = findLocalExtrema(recentData.map(d => ({ ...d, value: d.price })), false);
    const rsiLows = findLocalExtrema(recentData, true);
    const rsiHighs = findLocalExtrema(recentData, false);

    // Check for bullish divergence (price lower low, RSI higher low)
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
        const lastPriceLows = priceLows.slice(-2);
        const lastRsiLows = rsiLows.slice(-2);

        if (lastPriceLows[1].value < lastPriceLows[0].value &&
            lastRsiLows[1].value > lastRsiLows[0].value) {
            return {
                score: BONUSES.bullishDivergence,
                type: 'bullish_divergence',
                detected: true,
                description: 'Price made lower low but RSI made higher low - bullish reversal signal'
            };
        }
    }

    // Check for bearish divergence (price higher high, RSI lower high)
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
        const lastPriceHighs = priceHighs.slice(-2);
        const lastRsiHighs = rsiHighs.slice(-2);

        if (lastPriceHighs[1].value > lastPriceHighs[0].value &&
            lastRsiHighs[1].value < lastRsiHighs[0].value) {
            return {
                score: BONUSES.bearishDivergence,
                type: 'bearish_divergence',
                detected: true,
                description: 'Price made higher high but RSI made lower high - bearish reversal signal'
            };
        }
    }

    return { score: 0, type: 'none', detected: false };
}

/**
 * Calculate Funding Rate Z-Score
 * Identifies extreme funding relative to historical norm
 * Z > 2 = extremely long-biased → contrarian bearish
 * Z < -2 = extremely short-biased → contrarian bullish
 */
function calculateFundingZScore(fundingHistory) {
    if (!fundingHistory || fundingHistory.length < 10) {
        return { score: 0, zScore: 0, mean: 0, stddev: 0, current: 0 };
    }

    const rates = fundingHistory.map(f => f.rate).filter(r => r !== undefined && !isNaN(r));
    if (rates.length < 5) {
        return { score: 0, zScore: 0, mean: 0, stddev: 0, current: 0 };
    }

    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) {
        return { score: 0, zScore: 0, mean, stddev: 0, current: rates[rates.length - 1] };
    }

    const currentRate = rates[rates.length - 1];
    const zScore = (currentRate - mean) / stddev;

    // Contrarian scoring based on Z-score
    let score = 0;
    let zone = 'normal';

    if (zScore >= 3) { score = -0.9; zone = 'extreme_long_bias'; }
    else if (zScore >= 2) { score = -0.6; zone = 'high_long_bias'; }
    else if (zScore >= 1.5) { score = -0.3; zone = 'moderate_long_bias'; }
    else if (zScore <= -3) { score = 0.9; zone = 'extreme_short_bias'; }
    else if (zScore <= -2) { score = 0.6; zone = 'high_short_bias'; }
    else if (zScore <= -1.5) { score = 0.3; zone = 'moderate_short_bias'; }

    return {
        score,
        zScore,
        mean,
        stddev,
        current: currentRate,
        annualized: currentRate * 3 * 365 * 100,
        zone
    };
}

/**
 * Calculate OI Rate of Change
 * Measures leverage buildup or unwind dynamics
 */
function calculateOIRoC(oiHistory, priceHistory) {
    if (!oiHistory || oiHistory.length < 10) {
        return { score: 0, hourlyRoC: 0, fourHourRoC: 0, trend: 'insufficient_data' };
    }

    const now = Date.now();
    const oneHourAgo = now - TIMEFRAMES.ONE_HOUR;
    const fourHoursAgo = now - TIMEFRAMES.FOUR_HOURS;

    // 1-hour RoC
    const recentOI = oiHistory.filter(o => o && o.timestamp >= oneHourAgo);
    let hourlyRoC = 0;
    if (recentOI.length >= 2 && recentOI[0].value > 0) {
        hourlyRoC = ((recentOI[recentOI.length - 1].value - recentOI[0].value) / recentOI[0].value) * 100;
    }

    // 4-hour RoC
    const longerOI = oiHistory.filter(o => o && o.timestamp >= fourHoursAgo);
    let fourHourRoC = 0;
    if (longerOI.length >= 2 && longerOI[0].value > 0) {
        fourHourRoC = ((longerOI[longerOI.length - 1].value - longerOI[0].value) / longerOI[0].value) * 100;
    }

    // Get price direction to contextualize OI change
    let priceChange = 0;
    if (priceHistory && priceHistory.length >= 2) {
        const recentPrices = priceHistory.filter(p => p && p.timestamp >= fourHoursAgo);
        if (recentPrices.length >= 2 && recentPrices[0].value > 0) {
            priceChange = ((recentPrices[recentPrices.length - 1].value - recentPrices[0].value) / recentPrices[0].value) * 100;
        }
    }

    // Scoring logic
    let score = 0;
    let trend = 'neutral';

    // Rising OI + Rising Price = Strong bullish trend (follow)
    // Rising OI + Falling Price = Strong bearish trend (follow)
    // Falling OI = Deleveraging (potential reversal)

    if (fourHourRoC > 5 && priceChange > 1) {
        score = 0.4; // Strong bullish leverage
        trend = 'bullish_leverage';
    } else if (fourHourRoC > 5 && priceChange < -1) {
        score = -0.4; // Strong bearish leverage
        trend = 'bearish_leverage';
    } else if (fourHourRoC > 5) {
        score = -0.2; // Overheating risk
        trend = 'overheating';
    } else if (fourHourRoC < -5 && priceChange < -2) {
        score = 0.5; // Long capitulation - bounce potential
        trend = 'long_capitulation';
    } else if (fourHourRoC < -5 && priceChange > 2) {
        score = -0.5; // Short squeeze exhaustion
        trend = 'short_squeeze_exhaustion';
    } else if (fourHourRoC < -3) {
        score = 0.2; // General deleveraging
        trend = 'deleveraging';
    } else if (fourHourRoC > 2) {
        score = priceChange > 0 ? 0.15 : -0.15; // Moderate buildup
        trend = 'building';
    }

    return {
        score,
        hourlyRoC,
        fourHourRoC,
        trend,
        priceChange,
        oiDelta: longerOI.length >= 2 ? longerOI[longerOI.length - 1].value - longerOI[0].value : 0
    };
}

/**
 * Detect market regime based on OI and funding
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
    if (recentOI.length >= 2 && recentOI[0].value > 0) {
        oiChange = ((recentOI[recentOI.length - 1].value - recentOI[0].value) / recentOI[0].value) * 100;
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
        score = 0.3;
        description = 'Healthy long trend building';
    } else if (oiRising && moderateNegativeFunding) {
        regime = 'HEALTHY_SHORT';
        score = -0.3;
        description = 'Healthy short trend building';
    } else if (oiFalling && Math.abs(oiChange) > 3) {
        regime = 'CAPITULATION';
        const recentPrice = priceHistory?.filter(e => e && e.timestamp >= oneHourAgo) || [];
        if (recentPrice.length >= 2 && recentPrice[0].value > 0) {
            const priceChange = ((recentPrice[recentPrice.length - 1].value - recentPrice[0].value) / recentPrice[0].value) * 100;
            if (priceChange < -1) {
                score = 0.4; // Longs capitulating = potential bottom
                description = 'Long capitulation - potential bottom';
            } else if (priceChange > 1) {
                score = -0.4; // Shorts capitulating = potential top
                description = 'Short squeeze exhaustion';
            }
        }
    } else {
        regime = 'NEUTRAL';
        score = 0;
        description = 'No clear regime';
    }

    return { score, regime, description, oiChange, annualizedFunding };
}

/**
 * Calculate CVD persistence (sustained buying/selling)
 */
function calculateCVDPersistence(cvdHistory) {
    if (!cvdHistory || cvdHistory.length < 2) {
        return { score: 0, thirtyMinDelta: 0, twoHourDelta: 0 };
    }

    const now = Date.now();
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

    return { score: normalizedScore, thirtyMinDelta, twoHourDelta };
}

/**
 * Calculate whale alignment score (Hyperliquid only)
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

        if (recentPrices.length >= 2 && recentPrices[0].value > 0) {
            const change = ((recentPrices[recentPrices.length - 1].value - recentPrices[0].value) / recentPrices[0].value) * 100;
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

    const bullishCount = biases.filter(b => b.bias === 'bullish').length;
    const bearishCount = biases.filter(b => b.bias === 'bearish').length;
    const dominantBias = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral';
    const maxCount = Math.max(bullishCount, bearishCount);
    const agreement = maxCount / biases.length;

    let score = 0;
    if (agreement >= 0.8) {
        score = dominantBias === 'bullish' ? 0.8 : dominantBias === 'bearish' ? -0.8 : 0;
    } else if (agreement >= 0.6) {
        score = dominantBias === 'bullish' ? 0.4 : dominantBias === 'bearish' ? -0.4 : 0;
    }

    return { score, agreement, exchangeCount: biases.length, dominantBias, details: biases };
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

    const prices = recentPrices.map(e => e.value).filter(v => v > 0);
    if (prices.length < 5) {
        return { atr: 0, isHigh: false };
    }

    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const range = ((maxPrice - minPrice) / avgPrice) * 100;

    return { atr: range, isHigh: range > 3 };
}

/**
 * Calculate proper ATR (Average True Range) in dollar terms
 * Used for invalidation level buffer
 */
function calculateATR(priceHistory, periodHours = 4) {
    if (!priceHistory || priceHistory.length < 10) {
        return 0;
    }

    const now = Date.now();
    const lookbackMs = periodHours * 60 * 60 * 1000;
    const relevantPrices = priceHistory.filter(p => p && p.timestamp >= now - lookbackMs);

    if (relevantPrices.length < 5) {
        return 0;
    }

    // Calculate true ranges (price changes between consecutive points)
    const trueRanges = [];
    for (let i = 1; i < relevantPrices.length; i++) {
        const curr = relevantPrices[i].value;
        const prev = relevantPrices[i - 1].value;
        if (curr > 0 && prev > 0) {
            trueRanges.push(Math.abs(curr - prev));
        }
    }

    if (trueRanges.length === 0) {
        return 0;
    }

    // Average true range
    const atr = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;

    // Scale ATR by time interval (normalize to hourly equivalent)
    const avgIntervalMs = (relevantPrices[relevantPrices.length - 1].timestamp - relevantPrices[0].timestamp) / relevantPrices.length;
    const hourlyScaleFactor = 60 * 60 * 1000 / avgIntervalMs;

    return atr * Math.sqrt(hourlyScaleFactor); // Volatility scales with sqrt of time
}

/**
 * Find swing high and low over a timeframe
 */
function findSwingLevels(priceHistory, lookbackMs) {
    if (!priceHistory || priceHistory.length < 5) {
        return { swingLow: 0, swingHigh: 0, currentPrice: 0 };
    }

    const now = Date.now();
    const relevantPrices = priceHistory.filter(p => p && p.timestamp >= now - lookbackMs);

    if (relevantPrices.length < 3) {
        return { swingLow: 0, swingHigh: 0, currentPrice: 0 };
    }

    const prices = relevantPrices.map(p => p.value).filter(v => v > 0);
    if (prices.length < 3) {
        return { swingLow: 0, swingHigh: 0, currentPrice: 0 };
    }

    const swingLow = Math.min(...prices);
    const swingHigh = Math.max(...prices);
    const currentPrice = priceHistory[priceHistory.length - 1]?.value || 0;

    return { swingLow, swingHigh, currentPrice };
}

/**
 * Calculate invalidation level where bias flips
 * For BULLISH: break below swing low - ATR buffer = invalid
 * For BEARISH: break above swing high + ATR buffer = invalid
 */
function calculateInvalidation(priceHistory, bias) {
    const ATR_MULTIPLIER = 0.5; // Half-ATR buffer
    const LOOKBACK_MS = 4 * 60 * 60 * 1000; // 4 hours

    const { swingLow, swingHigh, currentPrice } = findSwingLevels(priceHistory, LOOKBACK_MS);
    const atr = calculateATR(priceHistory, 4);

    if (currentPrice === 0 || swingLow === 0 || swingHigh === 0) {
        return null;
    }

    const biasUpper = bias?.toUpperCase() || '';

    if (biasUpper.includes('BULL')) {
        // Bullish bias invalidated if price breaks below swing low - buffer
        const invalidationPrice = swingLow - (atr * ATR_MULTIPLIER);
        const distance = ((currentPrice - invalidationPrice) / currentPrice) * 100;

        return {
            price: Math.round(invalidationPrice),
            type: 'below',
            direction: 'bearish',
            distance: distance,
            swingLevel: Math.round(swingLow),
            atrBuffer: Math.round(atr * ATR_MULTIPLIER),
            description: `Bias flips if BTC breaks below $${invalidationPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        };
    } else if (biasUpper.includes('BEAR')) {
        // Bearish bias invalidated if price breaks above swing high + buffer
        const invalidationPrice = swingHigh + (atr * ATR_MULTIPLIER);
        const distance = ((invalidationPrice - currentPrice) / currentPrice) * 100;

        return {
            price: Math.round(invalidationPrice),
            type: 'above',
            direction: 'bullish',
            distance: distance,
            swingLevel: Math.round(swingHigh),
            atrBuffer: Math.round(atr * ATR_MULTIPLIER),
            description: `Bias flips if BTC breaks above $${invalidationPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        };
    } else {
        // Neutral - show range
        const rangeLow = swingLow - (atr * 0.3);
        const rangeHigh = swingHigh + (atr * 0.3);

        return {
            type: 'range',
            rangeLow: Math.round(rangeLow),
            rangeHigh: Math.round(rangeHigh),
            distance: 0,
            description: `Watch for breakout from $${rangeLow.toLocaleString('en-US', { maximumFractionDigits: 0 })} - $${rangeHigh.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        };
    }
}


/**
 * Determine trading session
 */
function detectSession() {
    const now = new Date();
    const utcHour = now.getUTCHours();

    if (utcHour >= 0 && utcHour < 8) {
        return { name: '🌙 Asia', volatilityMultiplier: 0.9 };
    } else if (utcHour >= 8 && utcHour < 13) {
        return { name: '🇬🇧 London', volatilityMultiplier: 1.0 };
    } else if (utcHour >= 13 && utcHour < 16) {
        return { name: '🔥 Peak Hours', volatilityMultiplier: 1.1 };
    } else if (utcHour >= 16 && utcHour < 21) {
        return { name: '🇺🇸 New York', volatilityMultiplier: 1.0 };
    } else {
        return { name: '🌙 Off-Hours', volatilityMultiplier: 0.85 };
    }
}

/**
 * Main projection generator (v2 - Refined Algorithm)
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
    const hlData = dataStore.getExchangeData('hyperliquid');

    if (!hlData || !hlData.price?.BTC || hlData.price.BTC.length < 20) {
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
    const rsi = calculateRSI(hlData.price.BTC);
    const divergence = detectRSIDivergence(hlData.price.BTC);
    const fundingZScore = calculateFundingZScore(hlData.funding.BTC);
    const oiRoC = calculateOIRoC(hlData.oi.BTC, hlData.price.BTC);
    const cvdPersistence = calculateCVDPersistence(hlData.cvd.BTC);
    const regime = detectRegime(hlData.oi.BTC, hlData.funding.BTC, hlData.price.BTC);
    const whales = calculateWhaleAlignment(consensus);
    const confluence = calculateCrossExchangeConfluence(dataStore);
    const volatility = calculateVolatility(hlData.price.BTC);
    const session = detectSession();

    // Calculate weighted score (RSI divergence is bonus only, not in main weights)
    let totalWeight = WEIGHTS.fundingZScore + WEIGHTS.oiRoC +
        WEIGHTS.cvdPersistence + WEIGHTS.regime + WEIGHTS.confluence;
    let weightedScore = (
        (fundingZScore.score * WEIGHTS.fundingZScore) +
        (oiRoC.score * WEIGHTS.oiRoC) +
        (cvdPersistence.score * WEIGHTS.cvdPersistence) +
        (regime.score * WEIGHTS.regime) +
        (confluence.score * WEIGHTS.confluence)
    );

    // Add whale factor if available
    if (whales.hasData) {
        totalWeight += WEIGHTS.whales;
        weightedScore += whales.score * WEIGHTS.whales;
    }

    // Normalize
    let normalizedScore = weightedScore / totalWeight;

    // Add divergence bonus
    if (divergence.detected) {
        normalizedScore += divergence.score;
        normalizedScore = Math.max(-1, Math.min(1, normalizedScore));
    }

    // Check for all factors aligned bonus
    const allBullish = rsi.score > 0 && fundingZScore.score > 0 && oiRoC.score > 0 && regime.score > 0;
    const allBearish = rsi.score < 0 && fundingZScore.score < 0 && oiRoC.score < 0 && regime.score < 0;
    if (allBullish || allBearish) {
        normalizedScore += allBullish ? BONUSES.allFactorsAligned : -BONUSES.allFactorsAligned;
        normalizedScore = Math.max(-1, Math.min(1, normalizedScore));
    }

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
    if (absScore >= 0.7) grade = 'A+';
    else if (absScore >= 0.5) grade = 'A';
    else if (absScore >= 0.3) grade = 'B+';
    else if (absScore >= 0.15) grade = 'B';
    else grade = 'C';

    // Calculate confidence
    const confidenceFactors = [];
    let confidenceScore = 0.5;

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
    if (Math.abs(fundingZScore.zScore) >= 2) {
        confidenceFactors.push('Extreme funding detected');
        confidenceScore += 0.1;
    }
    if (divergence.detected) {
        confidenceFactors.push(`${divergence.type.replace('_', ' ')} detected`);
        confidenceScore += 0.15;
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
    if (Math.abs(fundingZScore.zScore) >= 3) {
        warnings.push(`Extreme funding (Z=${fundingZScore.zScore.toFixed(1)}) - mean reversion likely`);
    }
    if (rsi.zone === 'extreme_overbought') {
        warnings.push('RSI extremely overbought (>80) - reversal risk');
    }
    if (rsi.zone === 'extreme_oversold') {
        warnings.push('RSI extremely oversold (<20) - bounce potential');
    }

    // Build key factors for display
    const keyFactors = [
        {
            name: 'Funding Z-Score',
            direction: fundingZScore.score > 0.1 ? 'bullish' : fundingZScore.score < -0.1 ? 'bearish' : 'neutral',
            score: Math.abs(fundingZScore.score),
            impact: Math.abs(fundingZScore.zScore) > 2 ? 'high' : Math.abs(fundingZScore.zScore) > 1 ? 'medium' : 'low',
            detail: `Z=${fundingZScore.zScore.toFixed(2)} (${fundingZScore.zone.replace(/_/g, ' ')})`
        },
        {
            name: 'OI Rate of Change',
            direction: oiRoC.score > 0.1 ? 'bullish' : oiRoC.score < -0.1 ? 'bearish' : 'neutral',
            score: Math.abs(oiRoC.score),
            impact: Math.abs(oiRoC.fourHourRoC) > 5 ? 'high' : Math.abs(oiRoC.fourHourRoC) > 2 ? 'medium' : 'low',
            detail: `${oiRoC.fourHourRoC > 0 ? '+' : ''}${oiRoC.fourHourRoC.toFixed(2)}% (4hr)`
        },
        {
            name: 'CVD Flow',
            direction: cvdPersistence.score > 0.1 ? 'bullish' : cvdPersistence.score < -0.1 ? 'bearish' : 'neutral',
            score: Math.abs(cvdPersistence.score),
            impact: Math.abs(cvdPersistence.score) > 0.5 ? 'high' : Math.abs(cvdPersistence.score) > 0.2 ? 'medium' : 'low',
            detail: `$${(cvdPersistence.twoHourDelta / 1000000).toFixed(1)}M (2hr)`
        },
        {
            name: 'Market Regime',
            direction: regime.score > 0 ? 'bullish' : regime.score < 0 ? 'bearish' : 'neutral',
            score: Math.abs(regime.score),
            impact: Math.abs(regime.score) > 0.4 ? 'high' : Math.abs(regime.score) > 0.2 ? 'medium' : 'low',
            detail: regime.description
        }
    ];

    // Add RSI Divergence if detected (bonus signal)
    if (divergence.detected) {
        keyFactors.unshift({
            name: '⚡ RSI Div',
            direction: divergence.type === 'bullish_divergence' ? 'bullish' : 'bearish',
            score: 1.0,
            impact: 'high',
            detail: divergence.description
        });
    }

    // Add confluence
    keyFactors.push({
        name: 'Exchange Confluence',
        direction: confluence.dominantBias || 'neutral',
        score: confluence.agreement,
        impact: confluence.agreement > 0.8 ? 'high' : confluence.agreement > 0.6 ? 'medium' : 'low',
        detail: `${confluence.exchangeCount} exchanges, ${(confluence.agreement * 100).toFixed(0)}% aligned`
    });

    if (whales.hasData) {
        keyFactors.push({
            name: 'Whale Consensus',
            direction: whales.score > 0.2 ? 'bullish' : whales.score < -0.2 ? 'bearish' : 'neutral',
            score: Math.abs(whales.score),
            impact: Math.abs(whales.score) > 0.5 ? 'high' : Math.abs(whales.score) > 0.2 ? 'medium' : 'low',
            detail: `${(whales.longPct * 100).toFixed(0)}% long`
        });
    }

    // Calculate invalidation level
    const invalidation = calculateInvalidation(hlData.price.BTC, bias);

    // Get current price
    const currentPrice = hlData.price.BTC[hlData.price.BTC.length - 1]?.value || 0;

    return {
        coin: 'BTC',
        horizon: '8-12H',
        status: 'ACTIVE',
        algorithmVersion: 'v2',
        currentPrice,
        prediction: {
            bias,
            strength,
            score: normalizedScore,
            grade,
            direction: normalizedScore > 0 ? 'BULLISH' : normalizedScore < 0 ? 'BEARISH' : 'NEUTRAL'
        },
        invalidation,
        confidence: {
            level: confidenceLevel,
            score: confidenceScore,
            factors: confidenceFactors
        },
        keyFactors,
        warnings,
        session: session.name,
        divergence: divergence.detected ? divergence : null,
        components: {
            rsi,
            fundingZScore,
            oiRoC,
            cvdPersistence,
            regime,
            whales,
            confluence,
            volatility
        },
        generatedAt: now,
        validUntil: now + (4 * 60 * 60 * 1000),
        dataPointCount: hlData.price.BTC.length
    };
}

module.exports = {
    generateProjection,
    calculateRSI,
    detectRSIDivergence,
    calculateFundingZScore,
    calculateOIRoC,
    detectRegime,
    calculateCVDPersistence,
    calculateWhaleAlignment,
    calculateCrossExchangeConfluence,
    calculateVolatility,
    calculateATR,
    findSwingLevels,
    calculateInvalidation,
    detectSession
};
