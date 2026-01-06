// ============== BIAS CALCULATIONS ==============

// ============== ALGORITHM IMPROVEMENTS ==============

// OI Velocity (Rate of Change) - How fast is OI changing?
// timeframeMinutes: the user-selected timeframe (5, 15, or 30 minutes)
export const calculateOIVelocity = (currentOI, historicalOI, timeframeMinutes = 5) => {
    if (!historicalOI || historicalOI.length < 2) {
        return { velocity: 0, label: 'Stable', color: 'text-slate-400', icon: '→' };
    }

    const now = Date.now();
    const timeframeAgo = now - (timeframeMinutes * 60 * 1000);
    const recentEntries = historicalOI.filter(e => e && e.timestamp >= timeframeAgo);

    if (recentEntries.length < 2) {
        return { velocity: 0, label: 'Stable', color: 'text-slate-400', icon: '→' };
    }

    const oldestRecent = recentEntries[0];
    const velocity = oldestRecent.value > 0
        ? ((currentOI - oldestRecent.value) / oldestRecent.value) * 100
        : 0;

    if (velocity > 1) return { velocity, label: 'OI Accelerating ↑↑', color: 'text-green-400', icon: '↑↑' };
    if (velocity > 0.3) return { velocity, label: 'OI Rising', color: 'text-green-300', icon: '↑' };
    if (velocity < -1) return { velocity, label: 'OI Accelerating ↓↓', color: 'text-red-400', icon: '↓↓' };
    if (velocity < -0.3) return { velocity, label: 'OI Falling', color: 'text-red-300', icon: '↓' };
    return { velocity, label: 'OI Stable', color: 'text-slate-400', icon: '→' };
};

// Funding Rate Trend - Is funding spiking or grinding?
export const calculateFundingTrend = (currentRate, historicalFunding) => {
    if (!historicalFunding || historicalFunding.length < 2) {
        return { trend: 0, label: 'Stable', color: 'text-slate-400', direction: 'flat' };
    }

    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentEntries = historicalFunding.filter(e => e && e.timestamp >= oneHourAgo);

    if (recentEntries.length < 2) {
        return { trend: 0, label: 'Stable', color: 'text-slate-400', direction: 'flat' };
    }

    const oldestRecent = recentEntries[0];
    const trend = (currentRate - oldestRecent.value) * 10000;

    if (trend > 1) return { trend, label: '⚠️ Funding Spiking', color: 'text-yellow-400', direction: 'up' };
    if (trend > 0.3) return { trend, label: 'Funding Rising', color: 'text-orange-400', direction: 'up' };
    if (trend < -1) return { trend, label: '⚠️ Funding Dropping', color: 'text-cyan-400', direction: 'down' };
    if (trend < -0.3) return { trend, label: 'Funding Falling', color: 'text-blue-400', direction: 'down' };
    return { trend, label: 'Funding Stable', color: 'text-slate-400', direction: 'flat' };
};

// Divergence Strength Score (0-100) - Higher = stronger divergence signal
// Note: This should be called with timeframeChange values, not sessionChange
export const calculateDivergenceStrength = (priceChange, cvdDelta) => {
    const priceMagnitude = Math.abs(priceChange || 0);
    const cvdDirection = cvdDelta > 0 ? 1 : cvdDelta < 0 ? -1 : 0;
    const priceDirection = priceChange > 0 ? 1 : priceChange < 0 ? -1 : 0;

    if (cvdDirection === priceDirection || cvdDirection === 0 || priceDirection === 0) {
        return { strength: 0, type: null, label: null, color: 'text-slate-400' };
    }

    const divergenceType = priceDirection > 0 ? 'bearish' : 'bullish';
    const cvdMagnitude = Math.abs(cvdDelta || 0);
    const strength = Math.min(100, Math.round((priceMagnitude * 20) + (cvdMagnitude / 100000)));

    if (strength > 60) {
        return {
            strength,
            type: divergenceType,
            label: '⚠️ STRONG ' + divergenceType.toUpperCase() + ' DIVERGENCE',
            color: divergenceType === 'bearish' ? 'text-red-400' : 'text-green-400'
        };
    } else if (strength > 30) {
        return {
            strength,
            type: divergenceType,
            label: (divergenceType === 'bearish' ? '↘️' : '↗️') + ' ' + divergenceType + ' divergence',
            color: divergenceType === 'bearish' ? 'text-orange-400' : 'text-lime-400'
        };
    }

    return { strength, type: divergenceType, label: 'Weak divergence', color: 'text-slate-400' };
};

// Liquidation Proximity Warning - Is price near major liq zones?
export const calculateLiquidationProximity = (currentPrice, coin, positions = []) => {
    if (!currentPrice || !positions || positions.length === 0) {
        return { warning: null, nearLongs: false, nearShorts: false, distance: null };
    }

    const longPositions = positions.filter(p => p.isLong && p.coin === coin);
    const shortPositions = positions.filter(p => !p.isLong && p.coin === coin);

    let nearLongLiq = null;
    let nearShortLiq = null;

    if (longPositions.length > 0) {
        const avgLongEntry = longPositions.reduce((sum, p) => sum + p.entryPrice, 0) / longPositions.length;
        const estLongLiqZone = avgLongEntry * 0.85;
        const distanceToLongLiq = ((currentPrice - estLongLiqZone) / currentPrice) * 100;
        if (distanceToLongLiq < 5) nearLongLiq = { zone: estLongLiqZone, distance: distanceToLongLiq };
    }

    if (shortPositions.length > 0) {
        const avgShortEntry = shortPositions.reduce((sum, p) => sum + p.entryPrice, 0) / shortPositions.length;
        const estShortLiqZone = avgShortEntry * 1.15;
        const distanceToShortLiq = ((estShortLiqZone - currentPrice) / currentPrice) * 100;
        if (distanceToShortLiq < 5) nearShortLiq = { zone: estShortLiqZone, distance: distanceToShortLiq };
    }

    if (nearLongLiq && nearLongLiq.distance < 3) {
        return {
            warning: '⚡ Near long liq zone ($' + Math.round(nearLongLiq.zone).toLocaleString() + ')',
            nearLongs: true, nearShorts: false, distance: nearLongLiq.distance, color: 'text-red-400'
        };
    }

    if (nearShortLiq && nearShortLiq.distance < 3) {
        return {
            warning: '⚡ Near short liq zone ($' + Math.round(nearShortLiq.zone).toLocaleString() + ')',
            nearLongs: false, nearShorts: true, distance: nearShortLiq.distance, color: 'text-green-400'
        };
    }

    return { warning: null, nearLongs: false, nearShorts: false, distance: null };
};

// ============== EXISTING BIAS CALCULATIONS ==============

// Get bias label and color
export const getBiasIndicator = (score, maxScore = 10) => {
    const pct = score / maxScore;
    if (pct >= 0.6) return { label: 'STRONG BULL', color: 'text-green-400', bg: 'bg-green-500/20', icon: '🟢' };
    if (pct >= 0.3) return { label: 'BULLISH', color: 'text-green-300', bg: 'bg-green-500/10', icon: '🟢' };
    if (pct >= 0.1) return { label: 'LEAN BULL', color: 'text-lime-400', bg: 'bg-lime-500/10', icon: '🟡' };
    if (pct >= -0.1) return { label: 'NEUTRAL', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: '⚪' };
    if (pct > -0.3) return { label: 'LEAN BEAR', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: '🟡' };
    if (pct > -0.6) return { label: 'BEARISH', color: 'text-red-300', bg: 'bg-red-500/10', icon: '🔴' };
    return { label: 'STRONG BEAR', color: 'text-red-400', bg: 'bg-red-500/20', icon: '🔴' };
};

// Calculate OI Bias: Based on OI change + price direction + funding
export const calculateOIBias = (coin, oiData, fundingData, priceData) => {
    if (!oiData || !fundingData || !priceData) return { score: 0, reason: 'Loading...' };

    const oiChange = oiData.timeframeChange || oiData.sessionChange || 0;
    const fundingRate = fundingData.rate || 0;
    const priceChange = priceData.timeframeChange || priceData.sessionChange || 0;

    let score = 0;
    let reasons = [];

    // OI Rising scenarios
    if (oiChange > 2) {
        if (fundingRate > 0 && priceChange > 0) {
            score = 8;
            reasons.push('New longs entering aggressively');
        } else if (fundingRate > 0 && priceChange < 0) {
            score = -6;
            reasons.push('Aggressive Shorting / Bulls Trapped');
        } else if (fundingRate < 0 && priceChange < 0) {
            score = -8;
            reasons.push('New shorts entering aggressively');
        } else if (fundingRate < 0 && priceChange > 0) {
            score = -3;
            reasons.push('Shorts building on rally');
        }
    }
    // OI Falling scenarios
    else if (oiChange < -2) {
        if (fundingRate > 0 && priceChange < 0) {
            score = -6;
            reasons.push('Long liquidations / exits');
        } else if (fundingRate < 0 && priceChange > 0) {
            score = 6;
            reasons.push('Short squeeze in progress');
        } else if (fundingRate > 0 && priceChange > 0) {
            score = 2;
            reasons.push('Profit taking by longs');
        } else {
            score = -2;
            reasons.push('Shorts covering');
        }
    }
    // OI Stable
    else {
        reasons.push('OI stable - no strong flow');
    }

    return { score, reason: reasons.join(', '), oiChange, priceChange };
};

// Calculate Funding Bias: Based on rate magnitude and trend
export const calculateFundingBias = (coin, fundingData) => {
    if (!fundingData) return { score: 0, reason: 'Loading...' };

    const rate = fundingData.rate || 0;
    const trend = fundingData.trend || 0;
    const annualized = rate * 3 * 365 * 100;

    let score = 0;
    let reasons = [];

    // Extreme funding = crowded trade, contrarian signal
    if (rate > 0.0005) {
        score = -4;
        reasons.push(`Extremely crowded longs (${annualized.toFixed(0)}% APR)`);
    } else if (rate > 0.0002) {
        score = 2;
        reasons.push('Bullish sentiment');
    } else if (rate < -0.0005) {
        score = 4;
        reasons.push(`Extremely crowded shorts (${annualized.toFixed(0)}% APR)`);
    } else if (rate < -0.0002) {
        score = -2;
        reasons.push('Bearish sentiment');
    } else {
        reasons.push('Neutral funding');
    }

    // Trend adjustment
    if (trend > 0.0001) {
        score += 1;
        reasons.push('Funding rising');
    } else if (trend < -0.0001) {
        score -= 1;
        reasons.push('Funding falling');
    }

    return { score, reason: reasons.join(' • '), rate, annualized, trend };
};

// Calculate Orderbook Bias: Based on sustained imbalance
export const calculateOrderbookBias = (coin, obData) => {
    if (!obData) return { score: 0, reason: 'Loading...' };

    const currentImbalance = obData.imbalance || 0;
    const avgImbalance = obData.avgImbalance || 0;

    let score = 0;
    let reasons = [];

    // Sustained imbalance matters more than snapshot
    if (avgImbalance > 20) {
        score = 6;
        reasons.push('Strong sustained bid wall');
    } else if (avgImbalance > 10) {
        score = 3;
        reasons.push('Bid heavy orderbook');
    } else if (avgImbalance < -20) {
        score = -6;
        reasons.push('Strong sustained ask wall');
    } else if (avgImbalance < -10) {
        score = -3;
        reasons.push('Ask heavy orderbook');
    } else {
        reasons.push('Balanced orderbook');
    }

    // Current vs average divergence
    if (currentImbalance > avgImbalance + 10) {
        score += 1;
        reasons.push('Bids strengthening');
    } else if (currentImbalance < avgImbalance - 10) {
        score -= 1;
        reasons.push('Asks strengthening');
    }

    return { score, reason: reasons.join(' • '), currentImbalance, avgImbalance };
};

// Calculate CVD Bias: Based on 5-minute rolling delta trend
export const calculateCVDBias = (coin, cvdData, priceData) => {
    if (!cvdData) return { score: 0, reason: 'Loading...' };

    const cumulativeDelta = cvdData.sessionDelta || 0;
    const rollingDelta = cvdData.rolling5mDelta || 0;
    const deltaTrend = cvdData.trend || 0;
    const priceChange = priceData?.timeframeChange || priceData?.sessionChange || 0;

    let score = 0;
    let reasons = [];

    // Rolling delta direction (Short term flow)
    if (rollingDelta > 0) {
        if (deltaTrend > 0) {
            score = 6;
            reasons.push('Buyers dominating 5m flow');
        } else {
            score = 3;
            reasons.push('Buyers in control (5m)');
        }
    } else if (rollingDelta < 0) {
        if (deltaTrend < 0) {
            score = -6;
            reasons.push('Sellers dominating 5m flow');
        } else {
            score = -3;
            reasons.push('Sellers in control (5m)');
        }
    }

    // Divergence detection (price vs rolling flow)
    if (priceChange > 0.5 && rollingDelta < 0) {
        score -= 3;
        reasons.push('⚠️ DIVERGENCE: Price rising into selling');
    } else if (priceChange < -0.5 && rollingDelta > 0) {
        score += 3;
        reasons.push('⚠️ DIVERGENCE: Price dropping into buying');
    }

    return { score, reason: reasons.join(' • '), cumulativeDelta, rollingDelta, deltaTrend };
};

// Calculate Flow Confluence: Pro trading confluence table (Price + OI + CVD)
export const calculateFlowConfluence = (coin, oiData, cvdData, priceData) => {
    if (!oiData || !cvdData || !priceData) {
        return {
            confluenceType: 'NEUTRAL',
            signal: 'neutral',
            score: 0,
            strength: 'weak',
            divergence: null,
            reason: 'Loading...',
            priceDir: '↔',
            oiDir: '↔',
            cvdDir: '↔'
        };
    }

    const oiChange = oiData.timeframeChange || oiData.sessionChange || 0;
    const cvdDelta = cvdData.rolling5mDelta || 0;
    const cvdTrend = cvdData.trend || 0;
    const priceChange = priceData.timeframeChange || priceData.sessionChange || 0;

    // Determine directions with thresholds
    const priceUp = priceChange > 0.3;
    const priceDown = priceChange < -0.3;
    const oiUp = oiChange > 1;
    const oiDown = oiChange < -1;
    // CVD direction based on net delta over timeframe (not trend)
    // Use small threshold to avoid noise from tiny deltas
    const cvdUp = cvdDelta > 1000; // > $1k net buying
    const cvdDown = cvdDelta < -1000; // < -$1k net selling

    // Direction arrows for display
    const priceDir = priceUp ? '↑' : priceDown ? '↓' : '↔';
    const oiDir = oiUp ? '↑' : oiDown ? '↓' : '↔';
    const cvdDir = cvdUp ? '↑' : cvdDown ? '↓' : '↔';

    let confluenceType = 'NEUTRAL';
    let signal = 'neutral';
    let score = 0;
    let strength = 'weak';
    let reason = '';
    let divergence = null;

    // Pro Confluence Table Logic
    if (priceUp && oiUp && cvdUp) {
        confluenceType = 'STRONG_BULL';
        signal = 'bullish';
        score = 9;
        strength = 'strong';
        reason = 'New longs + aggressive buying backing the move';
    } else if (priceUp && oiDown && cvdDown) {
        confluenceType = 'WEAK_BULL';
        signal = 'bullish';
        score = 3;
        strength = 'weak';
        reason = 'Shorts covering, sellers absorbing - watch for reversal';
        divergence = { type: 'bearish', message: 'Price up but flow weakening' };
    } else if (priceDown && oiUp && cvdDown) {
        confluenceType = 'STRONG_BEAR';
        signal = 'bearish';
        score = -9;
        strength = 'strong';
        reason = 'New shorts + aggressive selling pressuring price';
    } else if (priceDown && oiDown && cvdUp) {
        confluenceType = 'WEAK_BEAR';
        signal = 'bearish';
        score = -3;
        strength = 'weak';
        reason = 'Longs exiting, buyers absorbing - watch for bounce';
        divergence = { type: 'bullish', message: 'Price down but buyers stepping in' };
    }
    // Additional confluence patterns
    else if (priceUp && oiUp && cvdDown) {
        confluenceType = 'DIVERGENCE';
        signal = 'neutral';
        score = 2;
        strength = 'weak';
        reason = 'Price up, OI up, but CVD negative - distribution possible';
        divergence = { type: 'bearish', message: 'Hidden selling into rally' };
    } else if (priceDown && oiUp && cvdUp) {
        confluenceType = 'DIVERGENCE';
        signal = 'neutral';
        score = -2;
        strength = 'weak';
        reason = 'Price down, OI up, but CVD positive - accumulation possible';
        divergence = { type: 'bullish', message: 'Hidden buying into dip' };
    } else if (priceUp && cvdUp) {
        confluenceType = 'BULLISH';
        signal = 'bullish';
        score = 5;
        strength = 'moderate';
        reason = 'Price rising with buy flow support';
    } else if (priceDown && cvdDown) {
        confluenceType = 'BEARISH';
        signal = 'bearish';
        score = -5;
        strength = 'moderate';
        reason = 'Price falling with sell flow pressure';
    } else {
        confluenceType = 'NEUTRAL';
        signal = 'neutral';
        score = 0;
        strength = 'weak';
        reason = 'No clear flow confluence';
    }

    return {
        confluenceType,
        signal,
        score,
        strength,
        divergence,
        reason,
        priceDir,
        oiDir,
        cvdDir,
        oiChange,
        cvdDelta,
        priceChange
    };
};

// Calculate Whale Consensus Bias
export const calculateWhaleBias = (coin, consensus) => {
    if (!consensus || !consensus[coin]) return { score: 0, reason: 'No whale data' };

    const data = consensus[coin];
    const total = data.longs.length + data.shorts.length;
    if (total < 2) return { score: 0, reason: 'Insufficient data' };

    const longPct = data.longs.length / total;
    const consistentLongs = data.longs.filter(p => p.isConsistent).length;
    const consistentShorts = data.shorts.filter(p => p.isConsistent).length;

    let score = 0;
    let reasons = [];

    if (longPct >= 0.8) {
        score = 8;
        reasons.push(`${Math.round(longPct * 100)}% long`);
    } else if (longPct >= 0.6) {
        score = 4;
        reasons.push(`${Math.round(longPct * 100)}% long`);
    } else if (longPct <= 0.2) {
        score = -8;
        reasons.push(`${Math.round((1 - longPct) * 100)}% short`);
    } else if (longPct <= 0.4) {
        score = -4;
        reasons.push(`${Math.round((1 - longPct) * 100)}% short`);
    } else {
        reasons.push('Mixed positioning');
    }

    // Weight consistent winners more
    if (consistentLongs > consistentShorts) {
        score += 2;
        reasons.push(`${consistentLongs} consistent winners long`);
    } else if (consistentShorts > consistentLongs) {
        score -= 2;
        reasons.push(`${consistentShorts} consistent winners short`);
    }

    return { score, reason: reasons.join(' • '), longPct, consistentLongs, consistentShorts, total };
};

// Master Composite Bias Score
export const calculateCompositeBias = (coin, allData) => {
    // Use unified flow confluence instead of separate OI and CVD
    const flowConfluence = calculateFlowConfluence(
        coin,
        allData.oiData?.[coin],
        allData.cvdData?.[coin],
        allData.priceData?.[coin]
    );
    const fundingBias = calculateFundingBias(coin, allData.fundingData?.[coin]);
    const obBias = calculateOrderbookBias(coin, allData.orderbookData?.[coin]);
    const whaleBias = calculateWhaleBias(coin, allData.consensus);

    // Weighted scoring - flow confluence replaces OI + CVD
    const weights = {
        flow: 5,     // Flow confluence (was OI:3 + CVD:2) - most important
        whale: 3,    // What winners are doing
        ob: 1,       // Orderbook (noisy)
        funding: 1   // Funding (can be contrarian)
    };

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const weightedScore = (
        (flowConfluence.score * weights.flow) +
        (whaleBias.score * weights.whale) +
        (obBias.score * weights.ob) +
        (fundingBias.score * weights.funding)
    ) / totalWeight;

    const maxPossibleScore = 9; // Max flow confluence score
    const normalizedScore = weightedScore / maxPossibleScore;

    const indicator = getBiasIndicator(normalizedScore, 1);

    // Grade conversion
    let grade;
    if (normalizedScore >= 0.6) grade = 'A+';
    else if (normalizedScore >= 0.4) grade = 'A';
    else if (normalizedScore >= 0.2) grade = 'B';
    else if (normalizedScore >= -0.2) grade = 'C';
    else if (normalizedScore >= -0.4) grade = 'D';
    else grade = 'F';

    return {
        score: weightedScore,
        normalizedScore,
        grade,
        ...indicator,
        components: { flowConfluence, fundingBias, obBias, whaleBias }
    };
};
