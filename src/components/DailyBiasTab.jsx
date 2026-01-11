import React from 'react';
import InfoTooltip from './InfoTooltip';

/**
 * DailyBiasTab Component
 *
 * Displays 24-hour daily directional bias prediction for BTC
 * Optimized for day traders wanting "direction for today"
 */
export default function DailyBiasTab({ dailyBias, loading = false }) {
    // Loading state
    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-slate-700 rounded"></div>
                    <div className="h-5 bg-slate-700 rounded w-32"></div>
                </div>
                <div className="h-16 bg-slate-700/50 rounded-lg"></div>
            </div>
        );
    }

    // No data
    if (!dailyBias) {
        return null;
    }

    // Still collecting data
    if (dailyBias.status === 'COLLECTING') {
        return (
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🔮</span>
                    <span className="text-sm font-semibold text-slate-300">DAILY BIAS</span>
                    <span className="text-xs text-slate-500 ml-auto">Collecting...</span>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">⏳</div>
                    <p className="text-sm text-slate-400">{dailyBias.message}</p>
                    <p className="text-xs text-slate-500 mt-2">
                        {dailyBias.dataAge || 0} data points collected
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (dailyBias.error) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400">
                    <span>⚠️</span>
                    <span className="text-sm">{dailyBias.error}</span>
                </div>
            </div>
        );
    }

    const { prediction, confidence, keyFactors, warnings, generatedAt, invalidation, currentPrice, components, dataQuality, nextUpdate, freshness, rangeAnalysis, vetoDetails } = dailyBias;
    const spotPerpDivergence = components?.spotPerpDivergence;

    // Determine colors and styling based on bias
    const getBiasStyles = () => {
        const bias = prediction?.bias || 'NEUTRAL';

        // NO_SIGNAL (VETO) - orange warning
        if (bias === 'NO_SIGNAL') {
            return {
                gradient: 'from-orange-500/20 to-amber-600/10',
                border: 'border-orange-500/40',
                text: 'text-orange-400',
                bg: 'bg-orange-500',
                icon: '⛔',
                glow: 'shadow-orange-500/20'
            };
        }

        // CONSOLIDATION - cyan range-trading
        if (bias === 'CONSOLIDATION') {
            return {
                gradient: 'from-cyan-500/20 to-teal-600/10',
                border: 'border-cyan-500/40',
                text: 'text-cyan-400',
                bg: 'bg-cyan-500',
                icon: '⬌',
                glow: 'shadow-cyan-500/20'
            };
        }

        // MICRO or stronger BULL
        if (bias.includes('BULL')) {
            return {
                gradient: 'from-green-500/20 to-emerald-600/10',
                border: 'border-green-500/40',
                text: 'text-green-400',
                bg: 'bg-green-500',
                icon: bias.includes('MICRO') ? '↗' : '▲',
                glow: 'shadow-green-500/20'
            };
        }

        // MICRO or stronger BEAR
        if (bias.includes('BEAR')) {
            return {
                gradient: 'from-red-500/20 to-rose-600/10',
                border: 'border-red-500/40',
                text: 'text-red-400',
                bg: 'bg-red-500',
                icon: bias.includes('MICRO') ? '↘' : '▼',
                glow: 'shadow-red-500/20'
            };
        }

        // NEUTRAL (default)
        return {
            gradient: 'from-slate-600/20 to-slate-700/10',
            border: 'border-slate-500/40',
            text: 'text-slate-400',
            bg: 'bg-slate-500',
            icon: '◆',
            glow: 'shadow-slate-500/20'
        };
    };

    const styles = getBiasStyles();

    const getConfidenceColor = () => {
        switch (confidence?.level) {
            case 'HIGH': return 'text-green-400';
            case 'MEDIUM': return 'text-yellow-400';
            default: return 'text-orange-400';
        }
    };

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        const mins = Math.floor((Date.now() - timestamp) / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
    };

    const getFactorColor = (direction) => {
        if (direction === 'bullish') return 'text-green-400';
        if (direction === 'bearish') return 'text-red-400';
        return 'text-slate-400';
    };

    const formatBias = (bias) => {
        if (!bias) return 'NEUTRAL';

        // Handle special cases first
        if (bias === 'NO_SIGNAL') return 'NO SIGNAL';
        if (bias === 'CONSOLIDATION') return 'CONSOLIDATION';
        if (bias === 'MICRO_BULL') return 'MICRO BULLISH';
        if (bias === 'MICRO_BEAR') return 'MICRO BEARISH';

        const formatted = bias.replace('_', ' ')
            .replace('STRONG_BULL', 'STRONG BULLISH')
            .replace('STRONG_BEAR', 'STRONG BEARISH')
            .replace('LEAN_BULL', 'LEAN BULLISH')
            .replace('LEAN_BEAR', 'LEAN BEARISH');
        if (formatted === 'BULL' || formatted === 'BULLISH') return 'BULLISH';
        if (formatted === 'BEAR' || formatted === 'BEARISH') return 'BEARISH';
        return formatted;
    };

    // Get trading guidance for low-conviction states
    const getTradingGuidance = () => {
        const bias = prediction?.bias;
        if (bias === 'NO_SIGNAL') return vetoDetails?.recommendation || 'Conflicting data - stand aside';
        if (bias === 'CONSOLIDATION') return rangeAnalysis?.tradingGuidance || 'Trade the range';
        if (bias === 'MICRO_BULL' || bias === 'MICRO_BEAR') return 'Scalp only - tight stops';
        if (bias === 'NEUTRAL') return prediction?.marketState === 'CHOPPY' ? 'Choppy - reduce exposure' : 'No clear direction';
        return null;
    };

    return (
        <div
            className={`bg-gradient-to-br ${styles.gradient} rounded-xl border ${styles.border} shadow-lg ${styles.glow} p-4`}
        >
            {/* Header Row */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🔮</span>
                    <span className="text-sm font-bold text-white">DAILY BIAS</span>
                    <InfoTooltip position="bottom-right">
                        <div className="space-y-3">
                            <div className="font-bold text-white text-sm">24-Hour Daily Bias (v1)</div>
                            <div className="text-slate-300 text-xs">
                                Day trader's directional guide using extended lookback windows and institutional flow signals:
                            </div>

                            {/* Weighted Factors */}
                            <div className="space-y-2 text-xs">
                                <div className="bg-slate-800/50 rounded p-2">
                                    <span className="text-cyan-400 font-bold">🔀 Spot/Perp Divergence (35%)</span>
                                    <div className="text-slate-400 mt-1">PRIMARY signal. 6H spot vs perp CVD comparison. Spot leading = smart money accumulation/distribution.</div>
                                </div>
                                <div className="bg-slate-800/50 rounded p-2">
                                    <span className="text-cyan-400 font-bold">💰 Funding Mean Reversion (25%)</span>
                                    <div className="text-slate-400 mt-1">90-day baseline funding. Extreme deviation = crowd positioning, mean reversion expected.</div>
                                </div>
                                <div className="bg-slate-800/50 rounded p-2">
                                    <span className="text-cyan-400 font-bold">📈 OI + Price Momentum (20%)</span>
                                    <div className="text-slate-400 mt-1">8H window for OI velocity and price trend alignment. Healthy trend = aligned, divergence = caution.</div>
                                </div>
                                <div className="bg-slate-800/50 rounded p-2">
                                    <span className="text-cyan-400 font-bold">⚖️ Cross-Exchange Confluence (10%)</span>
                                    <div className="text-slate-400 mt-1">Veto mechanism. Agreement across Hyperliquid, Binance, Bybit strengthens signal.</div>
                                </div>
                                <div className="bg-slate-800/50 rounded p-2">
                                    <span className="text-cyan-400 font-bold">🐋 Whale Activity (5%)</span>
                                    <div className="text-slate-400 mt-1">$4M+ trade flow tracking. Net whale bias with size-weighted importance.</div>
                                </div>
                            </div>

                            {/* Signal Freshness */}
                            <div className="pt-2 border-t border-slate-700">
                                <div className="text-yellow-400 font-bold text-xs mb-1">⏱️ Signal Freshness Decay</div>
                                <div className="text-slate-400 text-[10px]">
                                    Signals age over 24H: 0-6H = 100%, 6-12H = 90%, 12-18H = 75%, 18-24H = 60%
                                </div>
                            </div>

                            {/* Scoring */}
                            <div className="pt-2 border-t border-slate-700">
                                <div className="text-cyan-400 font-bold text-xs mb-1">How Scoring Works</div>
                                <div className="text-slate-400 text-[10px]">
                                    Extended lookbacks for 24H stability. Score ≥0.5 = STRONG direction.
                                </div>
                                <div className="text-slate-400 text-[10px] mt-1">
                                    • Score ≥0.5 → <span className="text-green-400">STRONG BULLISH</span><br />
                                    • Score 0.25-0.5 → <span className="text-green-400">BULLISH</span><br />
                                    • Score 0.1-0.25 → <span className="text-green-300">LEAN BULLISH</span><br />
                                    • Score -0.1 to 0.1 → <span className="text-slate-400">NEUTRAL</span><br />
                                    • Negative scores = bearish equivalents
                                </div>
                            </div>

                            {/* Update frequency */}
                            <div className="pt-2 border-t border-slate-700 text-[10px] text-slate-500">
                                Updates every 2 hours. Optimized for full trading day visibility.
                            </div>
                        </div>
                    </InfoTooltip>
                    {/* Freshness indicator */}
                    {freshness && (
                        <span className={`text-xs px-2 py-0.5 rounded ${freshness >= 0.9 ? 'bg-green-500/20 text-green-400' :
                                freshness >= 0.75 ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-orange-500/20 text-orange-400'
                            }`}>
                            {Math.round(freshness * 100)}% fresh
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {/* Current Price Display */}
                    {currentPrice > 0 && (
                        <div className="text-right">
                            <div className="text-lg font-bold text-white font-mono">
                                ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] text-slate-500">BTC Price</div>
                        </div>
                    )}
                    <span className="text-xs text-slate-500">
                        {nextUpdate ? `Next: ${new Date(nextUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : formatTimeAgo(generatedAt)}
                    </span>
                </div>
            </div>

            {/* Main Content - Horizontal Layout */}
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                {/* Left: Bias + Confidence */}
                <div className="flex items-center gap-4 lg:min-w-[280px]">
                    {/* Bias Icon & Label */}
                    <div className={`text-2xl font-bold ${styles.text} flex items-center gap-2`}>
                        <span className="text-xl">{styles.icon}</span>
                        <span>{formatBias(prediction?.bias)}</span>
                    </div>

                    {/* Grade Badge */}
                    <div className={`px-3 py-1 rounded-lg ${styles.bg}/20 ${styles.text} font-bold text-lg`}>
                        {prediction?.grade}
                    </div>

                    {/* Confidence */}
                    <div className="text-center">
                        <div className={`text-sm font-semibold ${getConfidenceColor()}`}>
                            {Math.round((confidence?.score || 0) * 100)}%
                        </div>
                        <div className="text-[10px] text-slate-500">
                            {confidence?.level}
                        </div>
                    </div>
                </div>

                {/* Right: Key Factors (compact) */}
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {keyFactors?.slice(0, 4).map((factor, i) => (
                        <div key={i} className="bg-slate-800/40 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-1 mb-1">
                                <span className={`text-xs ${getFactorColor(factor.direction)}`}>
                                    {factor.direction === 'bullish' ? '▲' : factor.direction === 'bearish' ? '▼' : '─'}
                                </span>
                                <span className="text-xs text-slate-400 truncate">{factor.name}</span>
                            </div>
                            <div className={`text-sm font-mono font-bold ${getFactorColor(factor.direction)}`}>
                                {factor.detail}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Trading Guidance for low-conviction states */}
            {getTradingGuidance() && (
                <div className="mt-3">
                    <span className={`text-xs px-3 py-1.5 rounded ${prediction?.bias === 'NO_SIGNAL' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' :
                            prediction?.bias === 'CONSOLIDATION' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' :
                                prediction?.bias?.includes('MICRO') ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' :
                                    'bg-slate-700/50 text-slate-400 border border-slate-600'
                        }`}>
                        💡 {getTradingGuidance()}
                    </span>
                </div>
            )}

            {/* Range Analysis for CONSOLIDATION */}
            {rangeAnalysis && (prediction?.bias === 'CONSOLIDATION' || prediction?.bias === 'NEUTRAL' || prediction?.bias?.includes('MICRO')) && (
                <div className="mt-3 p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400">📊 8H Range:</span>
                            <span className="text-sm font-mono text-white">
                                ${rangeAnalysis.swingLow?.toLocaleString()} - ${rangeAnalysis.swingHigh?.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500">
                                ({rangeAnalysis.rangeWidth}%)
                            </span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Mid: ${rangeAnalysis.midpoint?.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}

            {/* Invalidation Level */}
            {invalidation && invalidation.price && (
                <div className="mt-3 flex items-center gap-2">
                    <span className={`text-xs px-3 py-1.5 rounded font-bold ${invalidation.type === 'below' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-green-500/10 text-green-400 border border-green-500/30'}`}>
                        ⚠️ Invalidation: {invalidation.type === 'below' ? 'Below' : 'Above'} ${invalidation.price.toLocaleString()} ({invalidation.distance > 0 ? '-' : '+'}{Math.abs(invalidation.distance).toFixed(1)}%)
                    </span>
                    <span className="text-[10px] text-slate-500">
                        Bias flips {invalidation.type === 'below' ? 'bearish' : 'bullish'} if breached
                    </span>
                </div>
            )}
            {invalidation && invalidation.type === 'range' && (
                <div className="mt-3">
                    <span className="text-xs px-3 py-1.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600">
                        📊 Range: ${invalidation.rangeLow?.toLocaleString()} - ${invalidation.rangeHigh?.toLocaleString()}
                    </span>
                </div>
            )}

            {/* Spot vs Perp CVD Divergence - Primary Signal for Daily */}
            {spotPerpDivergence && (
                <div className={`mt-3 p-2 rounded-lg border ${spotPerpDivergence.bias === 'bullish'
                    ? 'bg-green-500/10 border-green-500/30'
                    : spotPerpDivergence.bias === 'bearish'
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-slate-700/30 border-slate-600'
                    }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-cyan-400 font-bold">PRIMARY</span>
                            <span className={`text-sm font-bold ${spotPerpDivergence.bias === 'bullish' ? 'text-green-400' :
                                spotPerpDivergence.bias === 'bearish' ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                {spotPerpDivergence.signal === 'SPOT_ACCUMULATION' && '🟢 SPOT ACCUMULATION'}
                                {spotPerpDivergence.signal === 'CAPITULATION_BOTTOM' && '🟢 CAPITULATION BOTTOM'}
                                {spotPerpDivergence.signal === 'FAKE_PUMP' && '🔴 FAKE PUMP'}
                                {spotPerpDivergence.signal === 'DISTRIBUTION' && '🔴 DISTRIBUTION'}
                                {!['SPOT_ACCUMULATION', 'CAPITULATION_BOTTOM', 'FAKE_PUMP', 'DISTRIBUTION'].includes(spotPerpDivergence.signal) && '⚪ ALIGNED'}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${spotPerpDivergence.strength === 'strong' ? 'bg-white/10 text-white' : 'bg-slate-600/50 text-slate-400'
                                }`}>
                                {spotPerpDivergence.strength}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                            <span className={spotPerpDivergence.spotTrend === 'up' ? 'text-green-400' : spotPerpDivergence.spotTrend === 'down' ? 'text-red-400' : 'text-slate-400'}>
                                SPOT: {spotPerpDivergence.spotTrend === 'up' ? '↗' : spotPerpDivergence.spotTrend === 'down' ? '↘' : '↔'}
                            </span>
                            <span className={spotPerpDivergence.perpTrend === 'up' ? 'text-green-400' : spotPerpDivergence.perpTrend === 'down' ? 'text-red-400' : 'text-slate-400'}>
                                PERP: {spotPerpDivergence.perpTrend === 'up' ? '↗' : spotPerpDivergence.perpTrend === 'down' ? '↘' : '↔'}
                            </span>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                        {spotPerpDivergence.description}
                    </div>
                </div>
            )}

            {/* Data Quality indicator for Daily */}
            {dataQuality && dataQuality.completeness < 1 && (
                <div className="mt-3 flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${dataQuality.completeness >= 0.8 ? 'bg-green-500/10 text-green-400' :
                            dataQuality.completeness >= 0.5 ? 'bg-yellow-500/10 text-yellow-400' :
                                'bg-orange-500/10 text-orange-400'
                        }`}>
                        📊 Data: {Math.round(dataQuality.completeness * 100)}% complete
                    </span>
                    {dataQuality.issues?.slice(0, 2).map((issue, i) => (
                        <span key={i} className="text-[10px] text-slate-500">{issue}</span>
                    ))}
                </div>
            )}

            {/* Warnings (if any) - compact */}
            {warnings && warnings.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {warnings.slice(0, 2).map((warning, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            ⚠️ {warning}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
