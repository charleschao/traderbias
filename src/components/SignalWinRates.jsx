import React from 'react';

const SignalWinRates = ({ coin, winRates }) => {
  if (!winRates || winRates.totalLogged === 0) {
    return (
      <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">SIGNAL WIN RATES</h4>
        <div className="border border-neutral-200 dark:border-slate-700 rounded-lg p-4 text-center">
          <p className="text-neutral-500 dark:text-slate-400 text-sm">
            No signal history yet. Win rates will appear after signals are evaluated (15 min).
          </p>
        </div>
      </div>
    );
  }

  const { byType, overall, pending } = winRates;

  const signalConfig = {
    'STRONG_BULL': { label: 'Strong Bull', colorClass: 'text-green-600' },
    'BULLISH': { label: 'Bullish', colorClass: 'text-green-600' },
    'WEAK_BULL': { label: 'Weak Bull', colorClass: 'text-green-500' },
    'STRONG_BEAR': { label: 'Strong Bear', colorClass: 'text-red-600' },
    'BEARISH': { label: 'Bearish', colorClass: 'text-red-600' },
    'WEAK_BEAR': { label: 'Weak Bear', colorClass: 'text-red-500' }
  };

  const getBarColor = (winRate) => {
    if (winRate === null) return 'bg-neutral-200';
    if (winRate >= 55) return 'bg-green-500';
    if (winRate >= 45) return 'bg-neutral-400';
    return 'bg-red-500';
  };

  const getTextColor = (winRate) => {
    if (winRate === null) return 'text-neutral-500';
    if (winRate >= 55) return 'text-green-600';
    if (winRate >= 45) return 'text-neutral-600';
    return 'text-red-600';
  };

  return (
    <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-slate-700">
      <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
        SIGNAL WIN RATES
        {pending > 0 && (
          <span className="text-xs font-normal text-neutral-400 dark:text-slate-500">
            ({pending} pending)
          </span>
        )}
      </h4>

      {overall.total > 0 && (
        <div className="border border-neutral-200 dark:border-slate-700 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600 dark:text-slate-300 text-sm">Overall ({coin})</span>
            <span className={`font-semibold ${getTextColor(overall.winRate)}`}>
              {overall.winRate?.toFixed(1)}% ({overall.wins}/{overall.total})
            </span>
          </div>
          <div className="mt-2 h-2 bg-neutral-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getBarColor(overall.winRate)} transition-all duration-500`}
              style={{ width: `${overall.winRate || 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {Object.entries(signalConfig).map(([type, config]) => {
          const stats = byType[type];
          if (!stats || stats.total === 0) return null;

          return (
            <div key={type} className="border border-neutral-100 dark:border-slate-700 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${config.colorClass}`}>
                  {config.label}
                </span>
                <span className={`text-xs font-mono ${getTextColor(stats.winRate)}`}>
                  {stats.winRate?.toFixed(0)}% ({stats.wins}/{stats.total})
                </span>
              </div>
              <div className="h-1.5 bg-neutral-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getBarColor(stats.winRate)} transition-all duration-500`}
                  style={{ width: `${stats.winRate || 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] text-neutral-400 dark:text-slate-500">
        Evaluated 15min after signal. Win = +0.3% for bull, -0.3% for bear.
      </div>
    </div>
  );
};

export default SignalWinRates;
