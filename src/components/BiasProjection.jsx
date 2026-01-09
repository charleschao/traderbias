import React, { useState } from 'react';

/**
 * BiasProjection Component
 * 
 * Displays 8-12 hour forward-looking bias prediction for BTC
 * Premium UI with factor breakdown and confidence indicators
 */
export default function BiasProjection({ projection, loading = false }) {
    const [expanded, setExpanded] = useState(false);

    // Loading state
    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-slate-700 rounded"></div>
                    <div className="h-5 bg-slate-700 rounded w-32"></div>
                </div>
                <div className="h-20 bg-slate-700/50 rounded-lg"></div>
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

    const getImpactBar = (score, direction) => {
        const width = Math.min(100, Math.max(0, score * 100));
        const bgColor = direction === 'bullish' ? 'bg-green-500' :
            direction === 'bearish' ? 'bg-red-500' : 'bg-slate-500';
        return (
            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${bgColor} rounded-full transition-all duration-500`}
                    style={{ width: `${width}%` }}
                />
            </div>
        );
    };

    const formatBias = (bias) => {
        return bias?.replace('_', ' ').replace('BULL', 'BULLISH').replace('BEAR', 'BEARISH') || 'NEUTRAL';
    };

    return (
        <div
            className={`bg-gradient-to-br ${styles.gradient} rounded-xl border ${styles.border} overflow-hidden shadow-lg ${styles.glow}`}
        >
            {/* Header */}
            <div
                className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📊</span>
                        <span className="text-sm font-bold text-white">8-12H OUTLOOK</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">
                            {session}
                        </span>
                    </div>
                    <span className="text-xs text-slate-500">
                        {formatTimeAgo(generatedAt)}
                    </span>
                </div>

                {/* Main Prediction Display */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Bias Icon & Label */}
                        <div className={`text-3xl font-bold ${styles.text} flex items-center gap-2`}>
                            <span className="text-2xl">{styles.icon}</span>
                            <span>{formatBias(prediction?.bias)}</span>
                        </div>

                        {/* Grade Badge */}
                        <div className={`px-3 py-1 rounded-lg ${styles.bg}/20 ${styles.text} font-bold text-lg`}>
                            {prediction?.grade}
                        </div>
                    </div>

                    {/* Confidence */}
                    <div className="text-right">
                        <div className={`text-sm font-semibold ${getConfidenceColor()}`}>
                            {Math.round((confidence?.score || 0) * 100)}% Confidence
                        </div>
                        <div className="text-xs text-slate-500">
                            {confidence?.level}
                        </div>
                    </div>
                </div>

                {/* Warnings (if any) */}
                {warnings && warnings.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {warnings.slice(0, 2).map((warning, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                ⚠️ {warning}
                            </span>
                        ))}
                    </div>
                )}

                {/* Expand indicator */}
                <div className="flex justify-center mt-2">
                    <span className={`text-xs text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                        ▼
                    </span>
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-700/50">
                    {/* Key Factors */}
                    <div className="mt-4">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Key Factors</h4>
                        <div className="space-y-2">
                            {keyFactors?.map((factor, i) => (
                                <div key={i} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm ${getFactorColor(factor.direction)}`}>
                                            {factor.direction === 'bullish' ? '✓' : factor.direction === 'bearish' ? '✗' : '○'}
                                        </span>
                                        <span className="text-sm text-slate-300">{factor.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {getImpactBar(factor.score, factor.direction)}
                                        <span className="text-xs text-slate-500 w-24 text-right">{factor.detail}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Confidence Factors */}
                    {confidence?.factors && confidence.factors.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Confidence Boosters</h4>
                            <div className="flex flex-wrap gap-2">
                                {confidence.factors.map((factor, i) => (
                                    <span key={i} className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                                        ✓ {factor}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Raw Score */}
                    <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
                        <span>Raw Score: {((prediction?.score || 0) * 100).toFixed(1)}</span>
                        <span>{projection.dataPointCount || 0} data points</span>
                    </div>
                </div>
            )}
        </div>
    );
}
