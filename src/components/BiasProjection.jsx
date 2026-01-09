import React from 'react';
import InfoTooltip from './InfoTooltip';

/**
 * BiasProjection Component
 * 
 * Displays 8-12 hour forward-looking bias prediction for BTC
 * Horizontal layout with factors on the right side
 */
export default function BiasProjection({ projection, loading = false }) {
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

    // No projection data
    if (!projection) {
        return null;
    }

    // Still collecting data
    if (projection.status === 'COLLECTING') {
        return (
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📊</span>
                    <span className="text-sm font-semibold text-slate-300">8-12H OUTLOOK</span>
                    <span className="text-xs text-slate-500 ml-auto">Collecting...</span>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">⏳</div>
                    <p className="text-sm text-slate-400">{projection.message}</p>
                    <p className="text-xs text-slate-500 mt-2">
                        {projection.dataAge || 0} data points collected
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (projection.error) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400">
                    <span>⚠️</span>
                    <span className="text-sm">{projection.error}</span>
                </div>
            </div>
        );
    }

    const { prediction, confidence, keyFactors, warnings, session, generatedAt } = projection;

    // Determine colors and styling based on bias
    const getBiasStyles = () => {
        const bias = prediction?.bias || 'NEUTRAL';
        if (bias.includes('BULL')) {
            return {
                gradient: 'from-green-500/20 to-emerald-600/10',
                border: 'border-green-500/40',
                text: 'text-green-400',
                bg: 'bg-green-500',
                icon: '▲',
                glow: 'shadow-green-500/20'
            };
        } else if (bias.includes('BEAR')) {
            return {
                gradient: 'from-red-500/20 to-rose-600/10',
                border: 'border-red-500/40',
                text: 'text-red-400',
                bg: 'bg-red-500',
                icon: '▼',
                glow: 'shadow-red-500/20'
            };
        }
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
        return bias?.replace('_', ' ').replace('BULL', 'BULLISH').replace('BEAR', 'BEARISH') || 'NEUTRAL';
    };

    return (
        <div
            className={`bg-gradient-to-br ${styles.gradient} rounded-xl border ${styles.border} overflow-hidden shadow-lg ${styles.glow} p-4`}
        >
            {/* Header Row */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <span className="text-sm font-bold text-white">8-12H OUTLOOK</span>
                    <InfoTooltip position="bottom-right">
                        <div className="space-y-3">
                            <div className="font-bold text-white text-sm">8-12 Hour Bias Prediction</div>
                            <div className="text-slate-300 text-xs">
                                Forward-looking directional bias based on multi-factor analysis:
                            </div>
                            <div className="space-y-2 text-xs">
                                <div>
                                    <span className="text-cyan-400 font-bold">4H Momentum (30%)</span>
                                    <div className="text-slate-400">Price change over 4 hours. Longer timeframe = more reliable signal.</div>
                                </div>
                                <div>
                                    <span className="text-cyan-400 font-bold">Market Regime (25%)</span>
                                    <div className="text-slate-400">Detects crowding via OI + funding. Overcrowded = contrarian signal.</div>
                                </div>
                                <div>
                                    <span className="text-cyan-400 font-bold">CVD Flow (20%)</span>
                                    <div className="text-slate-400">Sustained buying/selling pressure over 2 hours.</div>
                                </div>
                                <div>
                                    <span className="text-cyan-400 font-bold">Whale Consensus (15%)</span>
                                    <div className="text-slate-400">Top trader positioning from Hyperliquid leaderboard.</div>
                                </div>
                                <div>
                                    <span className="text-cyan-400 font-bold">Exchange Confluence (10%)</span>
                                    <div className="text-slate-400">Agreement across Hyperliquid, Binance, Bybit.</div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-slate-700 text-[10px] text-slate-500">
                                Updates every 5 minutes. Best used with other confluence.
                            </div>
                        </div>
                    </InfoTooltip>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">
                        {session}
                    </span>
                </div>
                <span className="text-xs text-slate-500">
                    {formatTimeAgo(generatedAt)}
                </span>
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
