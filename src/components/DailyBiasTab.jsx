import React from 'react';
import InfoTooltip from './InfoTooltip';

export default function DailyBiasTab({ dailyBias, loading = false }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-slate-700 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-neutral-100 rounded"></div>
          <div className="h-5 bg-neutral-100 rounded w-32"></div>
        </div>
        <div className="h-16 bg-neutral-100 rounded"></div>
      </div>
    );
  }

  if (!dailyBias) return null;

  if (dailyBias.status === 'COLLECTING') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-none">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-neutral-500 text-sm font-semibold">DAILY BIAS</span>
          <span className="text-xs text-neutral-400 ml-auto">Collecting...</span>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-neutral-500">{dailyBias.message}</p>
          <p className="text-xs text-neutral-400 mt-1">{dailyBias.dataAge || 0} data points</p>
        </div>
      </div>
    );
  }

  if (dailyBias.error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-red-200 dark:border-red-800">
        <span className="text-sm text-red-600">{dailyBias.error}</span>
      </div>
    );
  }

  let { prediction, confidence, keyFactors, warnings = [], generatedAt, invalidation, currentPrice, components, dataQuality, nextUpdate, freshness, rangeAnalysis, vetoDetails } = dailyBias;

  // Handle freshness if it's an object (backend returns { freshness: 0.xx, ... })
  const freshnessScore = typeof freshness === 'object' ? freshness.freshness : freshness;

  const spotPerpDivergence = components?.spotPerpDivergence;

  // Inject liquidation warning if present (visual only for daily bias)
  if (components?.liquidation && components.liquidation.signal?.includes('CASCADE')) {
    const type = components.liquidation.signal.includes('BEARISH') ? 'Longs' : 'Shorts';
    const amount = (components.liquidation.velocity['1h'].total / 1000000).toFixed(1);
    warnings = [`⚠️ Cascade: $${amount}M ${type} liquidated`, ...warnings];
  }

  const getBiasColor = () => {
    const bias = prediction?.bias || 'NEUTRAL';
    if (bias === 'NO_SIGNAL') return 'text-neutral-500 dark:text-slate-400';
    if (bias === 'CONSOLIDATION') return 'text-neutral-500 dark:text-slate-400';
    if (bias.includes('BULL')) return 'text-green-600 dark:text-green-400';
    if (bias.includes('BEAR')) return 'text-red-600 dark:text-red-400';
    return 'text-neutral-500 dark:text-slate-400';
  };

  const getBiasIcon = () => {
    const bias = prediction?.bias || 'NEUTRAL';
    if (bias === 'NO_SIGNAL') return '—';
    if (bias === 'CONSOLIDATION') return '⬌';
    if (bias.includes('MICRO') && bias.includes('BULL')) return '↗';
    if (bias.includes('MICRO') && bias.includes('BEAR')) return '↘';
    if (bias.includes('BULL')) return '▲';
    if (bias.includes('BEAR')) return '▼';
    return '◆';
  };

  const getConfidenceColor = () => {
    switch (confidence?.level) {
      case 'HIGH': return 'text-green-600 dark:text-green-400';
      case 'MEDIUM': return 'text-neutral-600 dark:text-slate-300';
      default: return 'text-neutral-400 dark:text-slate-500';
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
    if (direction === 'bullish') return 'text-green-600 dark:text-green-400';
    if (direction === 'bearish') return 'text-red-600 dark:text-red-400';
    return 'text-neutral-500 dark:text-slate-400';
  };

  const formatBias = (bias) => {
    if (!bias) return 'NEUTRAL';
    if (bias === 'NO_SIGNAL') return 'NO SIGNAL';
    if (bias === 'CONSOLIDATION') return 'CONSOLIDATION';
    if (bias === 'MICRO_BULL') return 'MICRO BULLISH';
    if (bias === 'MICRO_BEAR') return 'MICRO BEARISH';
    return bias.replace('_', ' ')
      .replace('STRONG_BULL', 'STRONG BULLISH')
      .replace('STRONG_BEAR', 'STRONG BEARISH')
      .replace('LEAN_BULL', 'LEAN BULLISH')
      .replace('LEAN_BEAR', 'LEAN BEARISH')
      .replace(/^BULL$/, 'BULLISH')
      .replace(/^BEAR$/, 'BEARISH');
  };

  const getTradingGuidance = () => {
    const bias = prediction?.bias;
    if (bias === 'NO_SIGNAL') return vetoDetails?.recommendation || 'Conflicting data - stand aside';
    if (bias === 'CONSOLIDATION') return rangeAnalysis?.tradingGuidance || 'Trade the range';
    if (bias === 'MICRO_BULL' || bias === 'MICRO_BEAR') return 'Scalp only - tight stops';
    if (bias === 'NEUTRAL') return prediction?.marketState === 'CHOPPY' ? 'Choppy - reduce exposure' : 'No clear direction';
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-none p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">DAILY BIAS</span>
          <InfoTooltip position="bottom-right">
            <div className="space-y-2 text-xs">
              <div className="font-bold text-neutral-900 dark:text-white">24-Hour Daily Bias</div>
              <div className="text-neutral-600 dark:text-slate-300">
                Spot/Perp Divergence (30%), Funding Mean Reversion (20%), OI + Price Momentum (20%), ETF Flows (10% - BTC only), Cross-Exchange Confluence (10%), Whale Activity (5%)
              </div>
              <div className="text-neutral-500 dark:text-slate-400 pt-1">
                ETF tracks IBIT, FBTC, ARKB net flows from farside.co.uk
              </div>
              <div className="text-neutral-500 dark:text-slate-400 pt-2 border-t border-neutral-200 dark:border-slate-600">
                Updates every 4 hours
              </div>
            </div>
          </InfoTooltip>
          {freshnessScore !== undefined && (
            <span className={`text-xs ${freshnessScore >= 0.9 ? 'text-green-600' : freshnessScore >= 0.75 ? 'text-neutral-600' : 'text-neutral-400'}`}>
              {Math.round(freshnessScore * 100)}% fresh
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {currentPrice > 0 && (
            <span className="font-mono text-neutral-900 dark:text-white">
              ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          )}
          <span className="text-xs text-neutral-400 dark:text-slate-500">
            {nextUpdate ? `Next: ${new Date(nextUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : formatTimeAgo(generatedAt)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Bias Display */}
        <div className="flex items-center gap-4 lg:min-w-[280px]">
          <div className={`text-xl font-bold ${getBiasColor()} flex items-center gap-2`}>
            <span>{getBiasIcon()}</span>
            <span>{formatBias(prediction?.bias)}</span>
          </div>
          <span className={`font-semibold ${getBiasColor()}`}>{prediction?.grade}</span>
          <div className="text-center">
            <div className={`text-sm font-semibold ${getConfidenceColor()}`}>
              {Math.round((confidence?.score || 0) * 100)}%
            </div>
            <div className="text-[10px] text-neutral-400 dark:text-slate-500">{confidence?.level}</div>
          </div>
        </div>

        {/* Key Factors */}
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {keyFactors?.slice(0, 4).map((factor, i) => (
            <div key={i} className="bg-neutral-50 dark:bg-slate-700/50 rounded p-2">
              <div className="flex items-center gap-1 mb-1">
                <span className={`text-xs ${getFactorColor(factor.direction)}`}>
                  {factor.direction === 'bullish' ? '▲' : factor.direction === 'bearish' ? '▼' : '─'}
                </span>
                <span className="text-xs text-neutral-500 dark:text-slate-400 truncate">{factor.name}</span>
              </div>
              <div className={`text-sm font-mono font-semibold ${getFactorColor(factor.direction)}`}>
                {factor.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trading Guidance */}
      {getTradingGuidance() && (
        <div className="mt-3">
          <span className="text-xs px-2 py-1 rounded bg-neutral-50 dark:bg-slate-700/50 text-neutral-600 dark:text-slate-300">
            {getTradingGuidance()}
          </span>
        </div>
      )}

      {/* Range Analysis */}
      {rangeAnalysis && (prediction?.bias === 'CONSOLIDATION' || prediction?.bias === 'NEUTRAL' || prediction?.bias?.includes('MICRO')) && (
        <div className="mt-3 p-2 rounded">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500 dark:text-slate-400">8H Range:</span>
            <span className="font-mono text-neutral-900 dark:text-white">
              ${rangeAnalysis.swingLow?.toLocaleString()} - ${rangeAnalysis.swingHigh?.toLocaleString()}
            </span>
            <span className="text-xs text-neutral-400 dark:text-slate-500">Mid: ${rangeAnalysis.midpoint?.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Invalidation */}
      {invalidation && invalidation.price && (
        <div className="mt-3">
          <span className={`text-xs px-2 py-1 rounded ${invalidation.type === 'below' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-green-50 text-green-600 dark:bg-green-900/20'}`}>
            Invalidation: {invalidation.type === 'below' ? 'Below' : 'Above'} ${invalidation.price.toLocaleString()} ({invalidation.distance > 0 ? '-' : '+'}{Math.abs(invalidation.distance).toFixed(1)}%)
          </span>
        </div>
      )}

      {/* Spot/Perp Divergence */}
      {spotPerpDivergence && spotPerpDivergence.signal && (
        <div className={`mt-3 p-2 rounded ${spotPerpDivergence.bias === 'bullish' ? 'bg-green-50 dark:bg-green-900/20' : spotPerpDivergence.bias === 'bearish' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500 font-semibold">PRIMARY</span>
              <span className={`text-sm font-semibold ${spotPerpDivergence.bias === 'bullish' ? 'text-green-700' : spotPerpDivergence.bias === 'bearish' ? 'text-red-700' : 'text-neutral-600'}`}>
                {spotPerpDivergence.signal.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span>SPOT: {spotPerpDivergence.spotTrend === 'up' ? '↗' : spotPerpDivergence.spotTrend === 'down' ? '↘' : '↔'}</span>
              <span>PERP: {spotPerpDivergence.perpTrend === 'up' ? '↗' : spotPerpDivergence.perpTrend === 'down' ? '↘' : '↔'}</span>
            </div>
          </div>
          <div className="text-xs text-neutral-500 dark:text-slate-400 mt-1">{spotPerpDivergence.description}</div>
        </div>
      )}

      {/* Data Quality */}
      {dataQuality && dataQuality.completeness < 1 && (
        <div className="mt-3">
          <span className={`text-xs ${dataQuality.completeness >= 0.8 ? 'text-green-600' : dataQuality.completeness >= 0.5 ? 'text-neutral-600' : 'text-neutral-400'}`}>
            Data: {Math.round(dataQuality.completeness * 100)}% complete
          </span>
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {warnings.slice(0, 2).map((warning, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-300">
              {warning}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
