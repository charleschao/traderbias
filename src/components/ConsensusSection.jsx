import React from 'react';
import { calculateWhaleBias } from '../utils/biasCalculations';
import { formatUSD, getProfileUrl } from '../utils/formatters';

const ConsensusSection = ({ consensus }) => {
  const preferredCoins = ['BTC', 'ETH', 'SOL'];
  const availableCoins = Object.keys(consensus || {});
  const coins = preferredCoins.filter(c => availableCoins.includes(c));

  if (coins.length === 0 && availableCoins.length > 0) {
    coins.push(...availableCoins.slice(0, 3));
  }

  const getBiasColor = (score) => {
    if (score > 0) return 'text-green-600 dark:text-green-400';
    if (score < 0) return 'text-red-600 dark:text-red-400';
    return 'text-neutral-500 dark:text-slate-400';
  };

  const getBiasLabel = (score) => {
    if (score > 20) return 'BULLISH';
    if (score > 0) return 'LEAN BULL';
    if (score < -20) return 'BEARISH';
    if (score < 0) return 'LEAN BEAR';
    return 'NEUTRAL';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">TOP 10 WHALE CONSENSUS</span>
        <span className="text-xs text-neutral-400 dark:text-slate-500">30s</span>
      </div>

      {coins.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 dark:text-slate-400">Loading whale consensus data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {coins.map(coin => {
            const data = consensus?.[coin];
            if (!data) return null;

            const bias = calculateWhaleBias(coin, consensus);
            const total = data.longs.length + data.shorts.length;
            const longPct = total > 0 ? (data.longs.length / total) * 100 : 50;

            return (
              <div key={coin} className="border border-neutral-200 dark:border-slate-600 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-neutral-900 dark:text-white">{coin}</span>
                  <span className={`text-sm font-semibold ${getBiasColor(bias.score)}`}>
                    {getBiasLabel(bias.score)}
                  </span>
                </div>

                {/* Longs/Shorts Bar */}
                <div className="mb-3">
                  <div className="flex h-5 rounded overflow-hidden bg-neutral-100 dark:bg-slate-700">
                    <div
                      className="bg-green-500 transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${longPct}%` }}
                    >
                      {data.longs.length > 0 && (
                        <span className="text-[10px] text-white font-bold">{data.longs.length}L</span>
                      )}
                    </div>
                    <div
                      className="bg-red-500 transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${100 - longPct}%` }}
                    >
                      {data.shorts.length > 0 && (
                        <span className="text-[10px] text-white font-bold">{data.shorts.length}S</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Positions */}
                <div className="text-xs space-y-1">
                  {data.longs.slice(0, 2).map((p, i) => (
                    <div key={`long-${i}`} className="flex justify-between">
                      <a
                        href={getProfileUrl(p.trader)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline"
                      >
                        #{p.rank} {p.isConsistent && '*'}
                      </a>
                      <span className="text-neutral-700 dark:text-slate-300 font-mono">{formatUSD(p.notional)}</span>
                    </div>
                  ))}
                  {data.shorts.slice(0, 2).map((p, i) => (
                    <div key={`short-${i}`} className="flex justify-between">
                      <a
                        href={getProfileUrl(p.trader)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 hover:underline"
                      >
                        #{p.rank} {p.isConsistent && '*'}
                      </a>
                      <span className="text-neutral-700 dark:text-slate-300 font-mono">{formatUSD(p.notional)}</span>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-neutral-500 dark:text-slate-400 pt-2 mt-2 border-t border-neutral-100 dark:border-slate-700">
                  {formatUSD(data.totalNotional)} total
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConsensusSection;
