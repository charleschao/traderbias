import React from 'react';
import { formatUSD } from '../utils/formatters';

const VwapLevels = ({ data, currentPrice }) => {
  if (!data || !currentPrice) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-neutral-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">VWAP LEVELS</span>
          <span className="text-xs text-neutral-400 dark:text-slate-500">Loading...</span>
        </div>
      </div>
    );
  }

  const levels = [
    { key: 'yearly', label: 'Y', full: 'Yearly' },
    { key: 'quarterly', label: 'Q', full: 'Quarterly' },
    { key: 'monthly', label: 'M', full: 'Monthly' },
    { key: 'weekly', label: 'W', full: 'Weekly' },
    { key: 'daily', label: 'D', full: 'Daily' }
  ];

  const getDistancePercent = (vwapPrice) => {
    if (!vwapPrice || !currentPrice) return null;
    return ((currentPrice - vwapPrice) / vwapPrice) * 100;
  };

  const formatDistance = (pct) => {
    if (pct === null) return '--';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  const getDistanceColor = (pct) => {
    if (pct === null) return 'text-neutral-400 dark:text-slate-500';
    if (pct > 0) return 'text-green-600 dark:text-green-400';
    if (pct < 0) return 'text-red-600 dark:text-red-400';
    return 'text-neutral-500 dark:text-slate-400';
  };

  // Check if data is stale (> 20 minutes old)
  const isStale = data.updatedAt && (Date.now() - data.updatedAt > 20 * 60 * 1000);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-neutral-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">VWAP LEVELS</span>
        <div className="flex items-center gap-2">
          {isStale && (
            <span className="text-[10px] text-amber-500" title="Data may be stale">STALE</span>
          )}
          <span className="text-xs font-mono text-neutral-600 dark:text-slate-300">
            BTC {formatUSD(currentPrice)}
          </span>
        </div>
      </div>

      <div className="flex justify-between gap-2">
        {levels.map(({ key, label, full }) => {
          const vwapPrice = data[key]?.price;
          const distance = getDistancePercent(vwapPrice);

          return (
            <div
              key={key}
              className="flex-1 text-center bg-neutral-50 dark:bg-slate-700/50 rounded px-2 py-1.5"
              title={`${full} VWAP`}
            >
              <div className="text-[10px] text-neutral-500 dark:text-slate-400 font-medium mb-0.5">
                {label}
              </div>
              <div className="text-xs font-mono text-neutral-700 dark:text-slate-200">
                {vwapPrice ? `$${Math.round(vwapPrice).toLocaleString()}` : '--'}
              </div>
              <div className={`text-[11px] font-semibold font-mono ${getDistanceColor(distance)}`}>
                {formatDistance(distance)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VwapLevels;
