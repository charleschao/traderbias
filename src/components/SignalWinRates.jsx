import React from 'react';

/**
 * SignalWinRates - Displays win rate statistics for bias signals
 * Shows in DetailModal to help traders understand signal reliability
 */
const SignalWinRates = ({ coin, winRates }) => {
    if (!winRates || winRates.totalLogged === 0) {
        return (
            <div className="mt-6 pt-6 border-t border-slate-700">
                <h4 className="text-sm font-bold text-white mb-3">📈 SIGNAL WIN RATES</h4>
                <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                    <p className="text-slate-400 text-sm">
                        No signal history yet. Win rates will appear after signals are evaluated (15 min).
                    </p>
                </div>
            </div>
        );
    }

    const { byType, overall, pending } = winRates;

    // Signal display config
    const signalConfig = {
        'STRONG_BULL': { icon: '🟢', label: 'STRONG BULL', colorClass: 'text-green-400' },
        'BULLISH': { icon: '🟢', label: 'BULLISH', colorClass: 'text-green-300' },
        'WEAK_BULL': { icon: '🟡', label: 'WEAK BULL', colorClass: 'text-lime-400' },
        'STRONG_BEAR': { icon: '🔴', label: 'STRONG BEAR', colorClass: 'text-red-400' },
        'BEARISH': { icon: '🔴', label: 'BEARISH', colorClass: 'text-red-300' },
        'WEAK_BEAR': { icon: '🟡', label: 'WEAK BEAR', colorClass: 'text-orange-400' }
    };

    // Get bar color based on win rate
    const getBarColor = (winRate) => {
        if (winRate === null) return 'bg-slate-600';
        if (winRate >= 65) return 'bg-green-500';
        if (winRate >= 55) return 'bg-lime-500';
        if (winRate >= 45) return 'bg-yellow-500';
        if (winRate >= 35) return 'bg-orange-500';
        return 'bg-red-500';
    };

    // Get text color based on win rate
    const getTextColor = (winRate) => {
        if (winRate === null) return 'text-slate-500';
        if (winRate >= 55) return 'text-green-400';
        if (winRate >= 45) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="mt-6 pt-6 border-t border-slate-700">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                📈 SIGNAL WIN RATES
                {pending > 0 && (
                    <span className="text-xs font-normal text-slate-400">
                        ({pending} pending evaluation)
                    </span>
                )}
            </h4>

            {/* Overall Stats */}
            {overall.total > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">Overall Win Rate ({coin})</span>
                        <span className={`font-bold ${getTextColor(overall.winRate)}`}>
                            {overall.winRate?.toFixed(1)}% ({overall.wins}/{overall.total})
                        </span>
                    </div>
                    <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${getBarColor(overall.winRate)} transition-all duration-500`}
                            style={{ width: `${overall.winRate || 0}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Per-Signal Type Stats */}
            <div className="space-y-2">
                {Object.entries(signalConfig).map(([type, config]) => {
                    const stats = byType[type];
                    if (!stats || stats.total === 0) return null;

                    return (
                        <div key={type} className="bg-slate-800/30 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span>{config.icon}</span>
                                    <span className={`text-xs font-medium ${config.colorClass}`}>
                                        {config.label}
                                    </span>
                                </div>
                                <span className={`text-xs font-mono ${getTextColor(stats.winRate)}`}>
                                    {stats.winRate?.toFixed(0)}% ({stats.wins}/{stats.total})
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${getBarColor(stats.winRate)} transition-all duration-500`}
                                    style={{ width: `${stats.winRate || 0}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer note */}
            <div className="mt-3 text-[10px] text-slate-500 flex items-center gap-1">
                <span>ⓘ</span>
                <span>Evaluated 15min after signal. Win = +0.3% for bull, -0.3% for bear.</span>
            </div>
        </div>
    );
};

export default SignalWinRates;
