import React from 'react';
import { calculateOrderbookBias } from '../utils/biasCalculations';
import { formatUSD } from '../utils/formatters';

const OrderbookSection = ({ orderbookData, coins = ['BTC'] }) => {
  const isSingleCoin = coins.length === 1;

  const getBiasLabel = (score) => {
    if (score > 30) return 'BULLISH';
    if (score > 10) return 'LEAN BULL';
    if (score < -30) return 'BEARISH';
    if (score < -10) return 'LEAN BEAR';
    return 'NEUTRAL';
  };

  const getBiasColor = (score) => {
    if (score > 10) return 'text-green-600 dark:text-green-400';
    if (score < -10) return 'text-red-600 dark:text-red-400';
    return 'text-neutral-500 dark:text-slate-400';
  };

  const getInterpretation = (imbalance) => {
    if (imbalance >= 40) return 'Heavy bid support. Book skewed bullish.';
    if (imbalance >= 20) return 'Moderate bid dominance.';
    if (imbalance <= -40) return 'Heavy ask pressure. Book skewed bearish.';
    if (imbalance <= -20) return 'Moderate ask dominance.';
    return 'Balanced order book.';
  };

  if (isSingleCoin) {
    const coin = coins[0];
    const ob = orderbookData?.[coin];
    const bias = calculateOrderbookBias(coin, ob);
    const bidPct = ob && ob.bidVolume > 0 && ob.askVolume > 0
      ? (ob.bidVolume / (ob.bidVolume + ob.askVolume)) * 100
      : ob?.imbalance !== undefined
        ? 50 + (ob.imbalance / 2)
        : 50;

    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-slate-700 h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">ORDERBOOK</span>
          <span className={`text-sm font-semibold ${getBiasColor(bias.score)}`}>
            {getBiasLabel(bias.score)}
          </span>
        </div>

        {/* Imbalance Bar */}
        <div className="mb-3">
          <div className="flex h-6 rounded overflow-hidden bg-neutral-100 dark:bg-slate-700">
            <div
              className="bg-green-500 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${bidPct}%` }}
            >
              <span className="text-xs text-white font-bold">{bidPct.toFixed(0)}%</span>
            </div>
            <div
              className="bg-red-500 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${100 - bidPct}%` }}
            >
              <span className="text-xs text-white font-bold">{(100 - bidPct).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Bid/Ask Values */}
        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
          <div className="bg-neutral-50 dark:bg-slate-700/50 rounded p-2 text-center">
            <div className="text-neutral-50 dark:text-slate-400 text-[10px]">BID DEPTH</div>
            <div className="text-green-600 font-mono font-semibold">
              {formatUSD(ob?.bidVolume || 0)}
            </div>
          </div>
          <div className="bg-neutral-50 dark:bg-slate-700/50 rounded p-2 text-center">
            <div className="text-neutral-50 dark:text-slate-400 text-[10px]">ASK DEPTH</div>
            <div className="text-red-600 font-mono font-semibold">
              {formatUSD(ob?.askVolume || 0)}
            </div>
          </div>
        </div>

        <div className="flex justify-center items-center pt-2">
          <span className="text-xs text-neutral-500 dark:text-slate-400 mr-2">Net:</span>
          <span className={`text-lg font-bold font-mono ${(ob?.imbalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(ob?.imbalance || 0) >= 0 ? '+' : ''}{(ob?.imbalance || 0).toFixed(1)}%
          </span>
        </div>

        <div className="mt-3 pt-2">
          <p className="text-xs text-neutral-500 dark:text-slate-400">{getInterpretation(ob?.imbalance || 0)}</p>
        </div>
      </div>
    );
  }

  // Multi-coin grid
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">ORDERBOOK IMBALANCE</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coins.map(coin => {
          const ob = orderbookData?.[coin];
          const bias = calculateOrderbookBias(coin, ob);
          const bidPct = ob && ob.bidVolume > 0 && ob.askVolume > 0
            ? (ob.bidVolume / (ob.bidVolume + ob.askVolume)) * 100
            : ob?.imbalance !== undefined
              ? 50 + (ob.imbalance / 2)
              : 50;

          return (
            <div key={coin} className="bg-neutral-50 dark:bg-slate-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-neutral-900 dark:text-white">{coin}</span>
                <span className={`text-xs font-semibold ${getBiasColor(bias.score)}`}>
                  {getBiasLabel(bias.score)}
                </span>
              </div>
              <div className="flex h-4 rounded overflow-hidden bg-neutral-100 dark:bg-slate-700 mb-2">
                <div className="bg-green-500" style={{ width: `${bidPct}%` }}></div>
                <div className="bg-red-500" style={{ width: `${100 - bidPct}%` }}></div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-green-600 font-mono">{formatUSD(ob?.bidVolume || 0)}</span>
                <span className="text-red-600 font-mono">{formatUSD(ob?.askVolume || 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderbookSection;
