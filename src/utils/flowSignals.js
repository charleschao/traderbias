// ============== EDGE SIGNAL DETECTION ==============
// High-value orderflow patterns that provide actual trading edge

import { formatUSD } from './formatters';

/**
 * CVD DIVERGENCE DETECTION
 * Detects when price and CVD move in opposite directions
 * - Bearish divergence: Price rising but CVD falling (hidden selling)
 * - Bullish divergence: Price falling but CVD rising (hidden buying)
 */
export const detectCVDDivergence = (priceChange, cvdDelta, threshold = { price: 0.3, cvd: 5000 }) => {
    const priceUp = priceChange > threshold.price;
    const priceDown = priceChange < -threshold.price;
    const cvdUp = cvdDelta > threshold.cvd;
    const cvdDown = cvdDelta < -threshold.cvd;

    // Bearish Divergence: Price up, CVD down
    if (priceUp && cvdDown) {
        const strength = Math.min(100, Math.abs(priceChange * 20) + Math.abs(cvdDelta / 1000));
        return {
            type: 'bearish',
            signal: 'BEARISH DIVERGENCE',
            icon: '📉',
            description: 'Price rising but selling pressure underneath',
            implication: 'Hidden distribution - watch for reversal',
            strength,
            isStrong: strength > 50,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/30'
        };
    }

    // Bullish Divergence: Price down, CVD up
    if (priceDown && cvdUp) {
        const strength = Math.min(100, Math.abs(priceChange * 20) + Math.abs(cvdDelta / 1000));
        return {
            type: 'bullish',
            signal: 'BULLISH DIVERGENCE',
            icon: '📈',
            description: 'Price falling but buying pressure underneath',
            implication: 'Hidden accumulation - watch for bounce',
            strength,
            isStrong: strength > 50,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            border: 'border-green-500/30'
        };
    }

    return null;
};

/**
 * ABSORPTION DETECTION
 * Detects when large selling/buying is absorbed without price movement
 * - Bullish absorption: High negative CVD but price holds/rises
 * - Bearish absorption: High positive CVD but price holds/falls
 */
export const detectAbsorption = (priceChange, cvdDelta, threshold = { cvd: 50000, priceMax: 0.3 }) => {
    const priceSteady = Math.abs(priceChange) < threshold.priceMax;
    const priceRising = priceChange > 0;
    const priceFalling = priceChange < 0;
    const heavySelling = cvdDelta < -threshold.cvd;
    const heavyBuying = cvdDelta > threshold.cvd;

    // Bullish Absorption: Heavy selling absorbed (price holds or rises)
    if (heavySelling && (priceSteady || priceRising)) {
        const absorptionStrength = Math.abs(cvdDelta / 1000);
        return {
            type: 'bullish',
            signal: 'SELLING ABSORBED',
            icon: '🛡️',
            description: `${formatUSD(Math.abs(cvdDelta))} net selling absorbed`,
            implication: 'Strong buyers defending - potential bounce',
            strength: Math.min(100, absorptionStrength),
            isStrong: absorptionStrength > 100,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            border: 'border-green-500/30'
        };
    }

    // Bearish Absorption: Heavy buying absorbed (price holds or falls)
    if (heavyBuying && (priceSteady || priceFalling)) {
        const absorptionStrength = Math.abs(cvdDelta / 1000);
        return {
            type: 'bearish',
            signal: 'BUYING ABSORBED',
            icon: '🧱',
            description: `${formatUSD(cvdDelta)} net buying absorbed`,
            implication: 'Strong sellers capping - potential drop',
            strength: Math.min(100, absorptionStrength),
            isStrong: absorptionStrength > 100,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/30'
        };
    }

    return null;
};

/**
 * OI + PRICE PATTERN DETECTION
 * Identifies meaningful OI/Price relationships
 */
export const detectOIPricePattern = (oiChange, priceChange) => {
    const oiUp = oiChange > 1;
    const oiDown = oiChange < -1;
    const oiFlat = !oiUp && !oiDown;
    const priceUp = priceChange > 0.3;
    const priceDown = priceChange < -0.3;
    const priceFlat = !priceUp && !priceDown;

    // Coil Pattern: OI rising, price flat = breakout building
    if (oiUp && priceFlat) {
        return {
            type: 'neutral',
            signal: 'COIL FORMING',
            icon: '🌀',
            description: 'OI building while price consolidates',
            implication: 'Breakout incoming - direction unclear',
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/30'
        };
    }

    // Short Covering Rally: Price up, OI down, in an uptrend
    if (priceUp && oiDown) {
        return {
            type: 'bearish',
            signal: 'SHORT COVERING',
            icon: '🏃',
            description: 'Shorts closing, not new longs entering',
            implication: 'Weak rally - may fade after squeeze',
            color: 'text-orange-400',
            bg: 'bg-orange-500/10',
            border: 'border-orange-500/30'
        };
    }

    // Long Liquidations: Price down, OI down
    if (priceDown && oiDown) {
        return {
            type: 'neutral',
            signal: 'LONGS EXITING',
            icon: '🚪',
            description: 'Positions closing on the sell-off',
            implication: 'Capitulation may = bottom forming',
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/30'
        };
    }

    // Strong Trend: Price up, OI up (or price down, OI up with shorts)
    if (priceUp && oiUp) {
        return {
            type: 'bullish',
            signal: 'STRONG FLOW',
            icon: '💪',
            description: 'New longs entering on the rally',
            implication: 'Healthy trend - momentum supported',
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            border: 'border-green-500/30'
        };
    }

    if (priceDown && oiUp) {
        return {
            type: 'bearish',
            signal: 'STRONG FLOW',
            icon: '💪',
            description: 'New shorts entering on the drop',
            implication: 'Strong selling pressure - trend intact',
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/30'
        };
    }

    return null;
};

/**
 * AGGREGATE ALL EDGE SIGNALS FOR A COIN
 */
export const detectEdgeSignals = (coin, oiData, cvdData, priceData) => {
    const signals = [];

    const oiChange = oiData?.timeframeChange ?? oiData?.sessionChange ?? 0;
    const priceChange = priceData?.timeframeChange ?? priceData?.sessionChange ?? 0;
    const cvdDelta = cvdData?.rolling5mDelta ?? cvdData?.timeframeDelta ?? 0;

    // Check CVD Divergence
    const divergence = detectCVDDivergence(priceChange, cvdDelta);
    if (divergence) {
        signals.push({ ...divergence, category: 'divergence' });
    }

    // Check Absorption
    const absorption = detectAbsorption(priceChange, cvdDelta);
    if (absorption) {
        signals.push({ ...absorption, category: 'absorption' });
    }

    // Check OI/Price Pattern
    const oiPattern = detectOIPricePattern(oiChange, priceChange);
    if (oiPattern) {
        signals.push({ ...oiPattern, category: 'oi_pattern' });
    }

    return signals;
};

/**
 * GET HIGHEST PRIORITY SIGNAL
 */
export const getPrioritySignal = (signals) => {
    if (!signals || signals.length === 0) return null;

    // Priority: divergence > absorption > oi_pattern
    const priority = ['divergence', 'absorption', 'oi_pattern'];

    for (const cat of priority) {
        const signal = signals.find(s => s.category === cat && s.isStrong);
        if (signal) return signal;
    }

    for (const cat of priority) {
        const signal = signals.find(s => s.category === cat);
        if (signal) return signal;
    }

    return signals[0];
};
