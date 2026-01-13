import React from 'react';
import { formatPrice } from '../utils/formatters';

/**
 * LiquidationZones Component
 *
 * Displays estimated liquidation cascade zones based on:
 * - Dynamic leverage estimation from funding rates
 * - ATR-based volatility buffers
 * - OI clustering probability assessment
 *
 * Shows 2 key price levels:
 * - Long liquidation zone (below current price)
 * - Short squeeze zone (above current price)
 */
const LiquidationZones = ({ zonesData, coin = 'BTC' }) => {
  if (!zonesData || zonesData.status !== 'ACTIVE') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-neutral-900 dark:text-white">LIQ ZONES</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            BETA
          </span>
        </div>
        <div className="text-center py-4 text-neutral-500 dark:text-slate-400 text-xs">
          {zonesData?.status === 'NO_DATA' ? 'Waiting for price data...' : 'Calculating zones...'}
        </div>
      </div>
    );
  }

  const { zones, currentPrice, probability, inputs } = zonesData;
  const { long, short } = zones;

  // Probability colors
  const probColors = {
    HIGH: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700',
    MEDIUM: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700',
    LOW: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700'
  };

  // Format OI at risk
  const formatOI = (oi) => {
    if (oi >= 1e9) return `$${(oi / 1e9).toFixed(1)}B`;
    if (oi >= 1e6) return `$${(oi / 1e6).toFixed(0)}M`;
    return `$${(oi / 1e3).toFixed(0)}K`;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-900 dark:text-white">LIQ ZONES</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            BETA
          </span>
        </div>
        <div className={`text-[10px] px-1.5 py-0.5 rounded border ${probColors[probability]}`}>
          {probability} RISK
        </div>
      </div>

      {/* Current Price */}
      <div className="text-center mb-3">
        <span className="text-neutral-500 dark:text-slate-400 text-[10px]">Current</span>
        <div className="text-lg font-bold text-neutral-900 dark:text-white font-mono">
          ${formatPrice(currentPrice)}
        </div>
      </div>

      {/* Visual Range Bar */}
      <div className="relative h-8 bg-neutral-100 dark:bg-slate-700 rounded-lg mb-3 overflow-hidden">
        {/* Center line (current price) */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-neutral-900 dark:bg-white z-10" style={{ left: '50%' }} />

        {/* Long liq zone (left side - below price) */}
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-r from-red-200 to-red-100 dark:from-red-900/40 dark:to-red-800/20"
          style={{
            left: 0,
            width: `${Math.max(10, Math.min(45, 50 - long.distance * 5))}%`
          }}
        >
          <div className="absolute inset-y-0 right-0 w-0.5 bg-red-500" />
        </div>

        {/* Short liq zone (right side - above price) */}
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-l from-green-200 to-green-100 dark:from-green-900/40 dark:to-green-800/20"
          style={{
            right: 0,
            width: `${Math.max(10, Math.min(45, 50 - short.distance * 5))}%`
          }}
        >
          <div className="absolute inset-y-0 left-0 w-0.5 bg-green-500" />
        </div>

        {/* Labels */}
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-red-600 dark:text-red-400">
          LONG LIQ
        </span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-green-600 dark:text-green-400">
          SHORT LIQ
        </span>
      </div>

      {/* Zone Details */}
      <div className="grid grid-cols-2 gap-2">
        {/* Long Liq Zone */}
        <div className="border border-red-200 dark:border-red-800/50 rounded-lg p-2 bg-red-50/50 dark:bg-red-900/10">
          <div className="text-red-600 dark:text-red-400 text-[10px] font-semibold mb-1">
            Long Cascade Zone
          </div>
          <div className="text-neutral-900 dark:text-white font-mono font-bold">
            ${formatPrice(long.price)}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-neutral-500 dark:text-slate-400 text-[10px]">
              {long.distance.toFixed(1)}% below
            </span>
            <span className={`text-[9px] px-1 py-0.5 rounded ${probColors[long.probability]}`}>
              {long.probability}
            </span>
          </div>
          <div className="text-neutral-400 dark:text-slate-500 text-[9px] mt-1">
            ~{formatOI(long.oiAtRisk)} OI at risk
          </div>
        </div>

        {/* Short Liq Zone */}
        <div className="border border-green-200 dark:border-green-800/50 rounded-lg p-2 bg-green-50/50 dark:bg-green-900/10">
          <div className="text-green-600 dark:text-green-400 text-[10px] font-semibold mb-1">
            Short Squeeze Zone
          </div>
          <div className="text-neutral-900 dark:text-white font-mono font-bold">
            ${formatPrice(short.price)}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-neutral-500 dark:text-slate-400 text-[10px]">
              {short.distance.toFixed(1)}% above
            </span>
            <span className={`text-[9px] px-1 py-0.5 rounded ${probColors[short.probability]}`}>
              {short.probability}
            </span>
          </div>
          <div className="text-neutral-400 dark:text-slate-500 text-[9px] mt-1">
            ~{formatOI(short.oiAtRisk)} OI at risk
          </div>
        </div>
      </div>

      {/* Inputs Summary (collapsible detail) */}
      <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-slate-700">
        <div className="flex items-center justify-between text-[9px] text-neutral-400 dark:text-slate-500">
          <span>Est. Leverage: {inputs?.estimatedLeverage?.toFixed(1)}x</span>
          <span>ATR: {inputs?.atrPercent?.toFixed(2)}%</span>
          <span>OI Vel: {inputs?.oiVelocity > 0 ? '+' : ''}{inputs?.oiVelocity?.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default LiquidationZones;
