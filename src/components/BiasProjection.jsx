import React from 'react';
import InfoTooltip from './InfoTooltip';

export default function BiasProjection({ projection, loading = false }) {
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

  if (!projection) return null;

  if (projection.status === 'COLLECTING') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-none">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-neutral-500 text-sm font-semibold">12HR BIAS</span>
          <span className="text-xs text-neutral-400 ml-auto">Collecting...</span>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-neutral-500">{projection.message}</p>
          <p className="text-xs text-neutral-400 mt-1">{projection.dataAge || 0} data points</p>
        </div>
      </div>
    );
  }

  if (projection.error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-red-200 dark:border-red-800">
        <span className="text-sm text-red-600">{projection.error}</span>
      </div>
    );
  }

  const { prediction, confidence, keyFactors, warnings, session, generatedAt, invalidation, currentPrice, components } = projection;
  const spotPerpDivergence = components?.spotPerpDivergence;

  const getBiasColor = () => {
    const bias = prediction?.bias || 'NEUTRAL';
    if (bias.includes('BULL')) return 'text-green-600 dark:text-green-400';
    if (bias.includes('BEAR')) return 'text-red-600 dark:text-red-400';
    return 'text-neutral-500 dark:text-slate-400';
  };

  const getBiasIcon = () => {
    const bias = prediction?.bias || 'NEUTRAL';
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
    return bias.replace('_', ' ')
      .replace('STRONG_BULL', 'STRONG BULLISH')
      .replace('STRONG_BEAR', 'STRONG BEARISH')
      .replace('LEAN_BULL', 'LEAN BULLISH')
      .replace('LEAN_BEAR', 'LEAN BEARISH')
      .replace(/^BULL$/, 'BULLISH')
      .replace(/^BEAR$/, 'BEARISH');
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-none p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">12HR BIAS</span>
          <InfoTooltip position="bottom-right">
            <div className="space-y-2 text-xs">
              <div className="font-bold text-neutral-900 dark:text-white">12 Hour Bias Prediction</div>
              <div className="text-neutral-600 dark:text-slate-300">
                Flow Confluence (55%) - Price + OI + CVD alignment<br/>
                Funding Z-Score (17%) - Extreme positioning detection<br/>
                Cross-Exchange Confluence (13%) - HL/Binance/Bybit agreement<br/>
                Liquidation Momentum (10%) - Cascade detection<br/>
                Whale Positioning (5%) - Hyperliquid whales
              </div>
              <div className="text-neutral-500 dark:text-slate-400 pt-2 border-t border-neutral-200 dark:border-slate-600">
                Valid for 4 hours, refreshes continuously
              </div>
            </div>
          </InfoTooltip>
          <span className="text-xs text-neutral-400 dark:text-slate-500">{session}</span>
        </div>
        <div className="flex items-center gap-3">
          {currentPrice > 0 && (
            <span className="font-mono text-neutral-900 dark:text-white">
              ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          )}
          <span className="text-xs text-neutral-400 dark:text-slate-500">
            {projection.validUntil
              ? `Valid until ${new Date(projection.validUntil).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} EST`
              : formatTimeAgo(generatedAt)}
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

      {/* Invalidation */}
      {invalidation && invalidation.price && (
        <div className="mt-3">
          <span className={`text-xs px-2 py-1 rounded border ${invalidation.type === 'below' ? 'border-red-200 text-red-600' : 'border-green-200 text-green-600'}`}>
            Invalidation: {invalidation.type === 'below' ? 'Below' : 'Above'} ${invalidation.price.toLocaleString()} ({invalidation.distance > 0 ? '-' : '+'}{Math.abs(invalidation.distance).toFixed(1)}%)
          </span>
        </div>
      )}

      {/* Spot/Perp Divergence - only show when we have actual signal data */}
      {spotPerpDivergence && spotPerpDivergence.signal && spotPerpDivergence.signal !== 'INSUFFICIENT_DATA' && spotPerpDivergence.signal !== 'NEUTRAL' && (
        <div className={`mt-3 p-2 rounded ${spotPerpDivergence.bias === 'bullish' ? 'bg-green-50 dark:bg-green-900/20' : spotPerpDivergence.bias === 'bearish' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold ${spotPerpDivergence.bias === 'bullish' ? 'text-green-700' : spotPerpDivergence.bias === 'bearish' ? 'text-red-700' : 'text-neutral-600'}`}>
              {spotPerpDivergence.signal.replace('_', ' ')}
            </span>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span>SPOT: {spotPerpDivergence.spotTrend === 'up' ? '↗' : spotPerpDivergence.spotTrend === 'down' ? '↘' : '↔'}</span>
              <span>PERP: {spotPerpDivergence.perpTrend === 'up' ? '↗' : spotPerpDivergence.perpTrend === 'down' ? '↘' : '↔'}</span>
            </div>
          </div>
          <div className="text-xs text-neutral-500 dark:text-slate-400 mt-1">{spotPerpDivergence.description}</div>
        </div>
      )}

      {/* Liquidation Cascade Indicator */}
      {projection.components?.liquidation && projection.components.liquidation.signal !== 'INSUFFICIENT_DATA' && projection.components.liquidation.signal !== 'NEUTRAL' && (
        <div className={`mt-3 p-2 rounded ${projection.components.liquidation.score < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold ${projection.components.liquidation.score < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
              🌊 {projection.components.liquidation.signal.replace(/_/g, ' ')}
            </span>
            <span className="text-xs font-mono text-neutral-600 dark:text-slate-400">
              ${(projection.components.liquidation.velocity['1h'].total / 1000000).toFixed(1)}M / 1H
            </span>
          </div>
          <div className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
            {projection.components.liquidation.description}
          </div>
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
