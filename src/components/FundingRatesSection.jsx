import React from 'react';
import { calculateFundingBias } from '../utils/biasCalculations';

const FundingRatesSection = ({ fundingData }) => {
  const coins = ['BTC', 'ETH', 'SOL'];

  const getBiasLabel = (score) => {
    if (score > 30) return 'CROWDED LONGS';
    if (score > 10) return 'BULLISH';
    if (score < -30) return 'CROWDED SHORTS';
    if (score < -10) return 'BEARISH';
    return 'NEUTRAL';
  };

  const getBiasColor = (score) => {
    if (score > 30) return 'text-red-600 dark:text-red-400';
    if (score > 10) return 'text-green-600 dark:text-green-400';
    if (score < -30) return 'text-green-600 dark:text-green-400';
    if (score < -10) return 'text-red-600 dark:text-red-400';
    return 'text-neutral-500 dark:text-slate-400';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">FUNDING RATES</span>
        <span className="text-xs text-neutral-400 dark:text-slate-500">8h rate</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {coins.map(coin => {
          const fr = fundingData?.[coin];
          const bias = calculateFundingBias(coin, fr);
          const rate = fr?.rate || 0;
          const annualized = rate * 3 * 365 * 100;

          return (
            <div key={coin} className="border border-neutral-200 dark:border-slate-600 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-neutral-900 dark:text-white text-sm">{coin}</span>
                <span className={`text-[10px] font-semibold ${getBiasColor(bias.score)}`}>
                  {getBiasLabel(bias.score)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`font-mono text-xs font-semibold ${rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {rate >= 0 ? '+' : ''}{(rate * 100).toFixed(4)}%
                </span>
                <span className={`font-mono text-[10px] ${annualized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {annualized >= 0 ? '+' : ''}{annualized.toFixed(0)}% APR
                </span>
              </div>
              {fr?.trend !== undefined && (
                <div className="text-[10px] text-neutral-500 dark:text-slate-400 mt-1">
                  {fr.trend > 0 ? '↑ Rising' : fr.trend < 0 ? '↓ Falling' : '→ Stable'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FundingRatesSection;
