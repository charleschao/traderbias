import React from 'react';
import { formatUSD, formatAddress, getProfileUrl } from '../utils/formatters';

/**
 * Live Whale Activity Feed - Position changes only
 * Shows real-time position changes from top 10 traders
 */
const LiveWhaleActivityFeed = ({ positionChanges }) => {
  const targetCoins = ['BTC', 'ETH', 'SOL'];

  return (
    <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-neutral-200 dark:border-slate-800 p-4">
      <h3 className="text-xs font-bold text-cyan-400 mb-3 flex items-center gap-2">
        LIVE WHALE ACTIVITY
        <span className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></span>
        <span className="text-neutral-400 dark:text-slate-500 font-normal ml-auto">Hyperliquid Top 10</span>
      </h3>

      {(!positionChanges || positionChanges.length === 0) ? (
        <div className="text-center py-3 text-neutral-700 dark:text-white text-xs">
          Monitoring top 10 trader positions for changes...
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {positionChanges.filter(c => targetCoins.includes(c.coin)).slice(0, 12).map((change, i) => {
            const configs = {
              entry: { icon: '📥', color: 'text-green-400', bg: 'bg-green-500/10', label: 'ENTRY' },
              exit: { icon: '📤', color: 'text-red-400', bg: 'bg-red-500/10', label: 'EXIT' },
              flip: { icon: '🔄', color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'FLIP' },
              increase: { icon: '📈', color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: '+SIZE' },
              decrease: { icon: '📉', color: 'text-orange-400', bg: 'bg-orange-500/10', label: '-SIZE' },
            };
            const cfg = configs[change.type] || configs.entry;

            return (
              <div key={i} className={`${cfg.bg} rounded-lg px-3 py-2 flex items-center gap-2`}>
                <span className="text-lg">{cfg.icon}</span>
                <span className={`text-xs font-bold ${cfg.color} min-w-[50px]`}>{cfg.label}</span>
                <span className="text-neutral-900 dark:text-white font-bold">{change.coin}</span>
                {change.direction && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${change.direction === 'LONG' ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}`}>
                    {change.direction}
                  </span>
                )}
                <a href={getProfileUrl(change.trader)} target="_blank" rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline text-xs font-mono">
                  #{change.rank} {formatAddress(change.trader)}
                </a>
                <span className="text-neutral-900 dark:text-white text-xs ml-auto">{formatUSD(change.notional)}</span>
                <span className="text-neutral-700 dark:text-white text-xs">{change.time?.toLocaleTimeString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveWhaleActivityFeed;
