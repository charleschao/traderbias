import React from 'react';
import { calculateFlowConfluence } from '../utils/biasCalculations';
import { formatUSD } from '../utils/formatters';
import Sparkline from './Sparkline';

const FlowConfluenceSection = ({ oiData, cvdData, priceData, timeframe = '5m', hasEnoughData = true, coins = ['BTC', 'ETH', 'SOL'], getSparklineData = null }) => {

  const getCoinDataStatus = (coin) => {
    const hasOiData = oiData?.[coin]?.hasTimeframeData !== false;
    const hasPriceData = priceData?.[coin]?.hasTimeframeData !== false;
    const hasCvdData = cvdData?.[coin]?.hasTimeframeData !== false;
    return { hasOiData, hasPriceData, hasCvdData, hasAllData: hasOiData && hasPriceData && hasCvdData };
  };

  const getConfluenceColor = (confluenceType) => {
    if (confluenceType.includes('BULL')) return 'text-green-600 dark:text-green-400';
    if (confluenceType.includes('BEAR')) return 'text-red-600 dark:text-red-400';
    return 'text-neutral-500 dark:text-slate-400';
  };

  const getMetricDescription = (metric, value, dir) => {
    if (metric === 'price') {
      if (dir === '↑') return value > 0.5 ? 'Strong upward movement' : 'Price increasing';
      if (dir === '↓') return value < -0.5 ? 'Significant decline' : 'Price decreasing';
      return 'Minimal movement';
    }
    if (metric === 'oi') {
      if (dir === '↑') return 'Positions building';
      if (dir === '↓') return 'Positions closing';
      return 'No significant change';
    }
    if (metric === 'cvd') {
      if (dir === '↑') return 'Net buying pressure';
      if (dir === '↓') return 'Selling pressure';
      return 'Balanced flow';
    }
    return '';
  };

  const getMetricAnalysis = (confluence) => {
    const priceBullish = confluence.priceDir === '↑';
    const priceBearish = confluence.priceDir === '↓';
    const oiBullish = confluence.oiDir === '↑';
    const oiBearish = confluence.oiDir === '↓';
    const cvdBullish = confluence.cvdDir === '↑';
    const cvdBearish = confluence.cvdDir === '↓';

    const bullishCount = [priceBullish, oiBullish, cvdBullish].filter(Boolean).length;
    const bearishCount = [priceBearish, oiBearish, cvdBearish].filter(Boolean).length;

    const missing = [];
    if (!priceBullish && !priceBearish) missing.push('Price');
    if (!oiBullish && !oiBearish) missing.push('OI');
    if (!cvdBullish && !cvdBearish) missing.push('CVD');

    let leaningLabel = '';
    if (bullishCount === 2 && bearishCount === 0) leaningLabel = 'Leaning Bullish';
    else if (bearishCount === 2 && bullishCount === 0) leaningLabel = 'Leaning Bearish';

    let awaitingMsg = '';
    if (missing.length > 0 && (bullishCount > 0 || bearishCount > 0)) {
      awaitingMsg = `Awaiting ${missing.join('/')} confirmation`;
    }

    return { bullishCount, bearishCount, leaningLabel, awaitingMsg };
  };

  const divergences = coins.map(coin => {
    const confluence = calculateFlowConfluence(coin, oiData?.[coin], cvdData?.[coin], priceData?.[coin]);
    return confluence.divergence ? { coin, ...confluence.divergence } : null;
  }).filter(Boolean);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">FLOW CONFLUENCE</span>
        <span className="text-xs text-neutral-400 dark:text-slate-500">
          {hasEnoughData ? `${timeframe.toUpperCase()} rolling` : 'Collecting...'}
        </span>
      </div>

      {/* Data Warning */}
      {!hasEnoughData && (
        <div className="mb-3 p-2 bg-neutral-50 dark:bg-slate-700/50 rounded text-xs text-neutral-500 dark:text-slate-400">
          Collecting {timeframe.toUpperCase()} historical data. Using session data as fallback.
        </div>
      )}

      {/* Coins Grid */}
      <div className={`grid gap-4 ${coins.length === 1 ? 'grid-cols-1' : coins.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
        {coins.map(coin => {
          const oi = oiData?.[coin];
          const cvd = cvdData?.[coin];
          const price = priceData?.[coin];
          const confluence = calculateFlowConfluence(coin, oi, cvd, price);
          const metrics = getMetricAnalysis(confluence);
          const dataStatus = getCoinDataStatus(coin);

          const getDirColor = (dir) => {
            if (dir === '↑') return 'text-green-600 dark:text-green-400';
            if (dir === '↓') return 'text-red-600 dark:text-red-400';
            return 'text-neutral-400 dark:text-slate-500';
          };

          return (
            <div key={coin} className={`bg-neutral-50 dark:bg-slate-700/50 rounded-lg p-3 ${!dataStatus.hasAllData ? 'opacity-60' : ''}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-neutral-900 dark:text-white">{coin}</span>
                <span className={`text-sm font-semibold ${getConfluenceColor(confluence.confluenceType)}`}>
                  {confluence.confluenceType.replace('_', ' ')}
                </span>
              </div>

              {/* Metrics Table */}
              <div className="space-y-2 mb-3">
                {/* Price */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={getDirColor(confluence.priceDir)}>
                      {confluence.priceDir === '↑' ? '↗' : confluence.priceDir === '↓' ? '↘' : '↔'}
                    </span>
                    <span className="text-neutral-500 dark:text-slate-400">Price</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSparklineData && <Sparkline data={getSparklineData(coin, 'price')} width={40} height={14} strokeWidth={1} />}
                    <span className={`font-mono ${(confluence.priceChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(confluence.priceChange || 0) >= 0 ? '+' : ''}{(confluence.priceChange || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
                {/* OI */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={getDirColor(confluence.oiDir)}>
                      {confluence.oiDir === '↑' ? '↗' : confluence.oiDir === '↓' ? '↘' : '↔'}
                    </span>
                    <span className="text-neutral-500 dark:text-slate-400">OI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSparklineData && <Sparkline data={getSparklineData(coin, 'oi')} width={40} height={14} strokeWidth={1} />}
                    <span className={`font-mono ${(oi?.oiDelta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatUSD(oi?.oiDelta || 0)}
                    </span>
                  </div>
                </div>
                {/* CVD */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={getDirColor(confluence.cvdDir)}>
                      {confluence.cvdDir === '↑' ? '↗' : confluence.cvdDir === '↓' ? '↘' : '↔'}
                    </span>
                    <span className="text-neutral-500 dark:text-slate-400">CVD</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSparklineData && <Sparkline data={getSparklineData(coin, 'cvd')} width={40} height={14} strokeWidth={1} />}
                    <span className={`font-mono ${(confluence.cvdDelta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatUSD(confluence.cvdDelta || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="pt-2 text-xs">
                <div className="flex gap-2 mb-1">
                  {metrics.bullishCount > 0 && <span className="text-green-600">{metrics.bullishCount}/3 bullish</span>}
                  {metrics.bearishCount > 0 && <span className="text-red-600">{metrics.bearishCount}/3 bearish</span>}
                </div>
                {metrics.awaitingMsg && (
                  <div className="text-neutral-400 dark:text-slate-500 italic">{metrics.awaitingMsg}</div>
                )}
                <div className="text-neutral-500 dark:text-slate-400 mt-1">{confluence.reason}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Divergence Alerts */}
      {divergences.length > 0 && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
          {divergences.map((d, i) => (
            <div key={i}><strong>{d.coin}:</strong> {d.message}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlowConfluenceSection;
