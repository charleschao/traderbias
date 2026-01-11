import React from 'react';
import { estimateLiquidationPrice, liquidationDistance } from '../utils/helpers';
import { formatPrice } from '../utils/formatters';

const LiquidationMap = ({ positions, priceData }) => {
  const liqLevels = {};

  positions.forEach(pos => {
    const coin = pos.coin;
    const isLong = pos.size > 0;
    const liqPrice = estimateLiquidationPrice(pos.entryPx, pos.leverage, isLong);
    const currentPrice = priceData?.[coin]?.markPx || pos.entryPx;
    const distance = liquidationDistance(currentPrice, liqPrice, isLong);

    if (!liqLevels[coin]) {
      liqLevels[coin] = { longs: [], shorts: [], currentPrice, longLiqNotional: 0, shortLiqNotional: 0 };
    }

    if (isLong) {
      liqLevels[coin].longs.push({ price: liqPrice, notional: pos.notional, distance });
      liqLevels[coin].longLiqNotional += pos.notional;
    } else {
      liqLevels[coin].shorts.push({ price: liqPrice, notional: pos.notional, distance });
      liqLevels[coin].shortLiqNotional += pos.notional;
    }
  });

  Object.keys(liqLevels).forEach(coin => {
    liqLevels[coin].longs.sort((a, b) => b.price - a.price);
    liqLevels[coin].shorts.sort((a, b) => a.price - b.price);
  });

  const allowedCoins = ['BTC', 'ETH', 'SOL'];
  const mainCoins = allowedCoins.filter(c => liqLevels[c]);

  if (mainCoins.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">LIQUIDATION MAP</span>
          <span className="text-xs text-neutral-400 dark:text-slate-500">5min</span>
        </div>
        <div className="text-center py-8 text-neutral-500 dark:text-slate-400">
          {positions.length === 0 ? 'Loading whale positions...' : 'No positions found'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">LIQUIDATION MAP</span>
        <span className="text-xs text-neutral-400 dark:text-slate-500">5min</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mainCoins.map(coin => {
          const data = liqLevels[coin];
          const closestLong = data.longs[0];
          const closestShort = data.shorts[0];

          return (
            <div key={coin} className="border border-neutral-200 dark:border-slate-600 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-neutral-900 dark:text-white">{coin}</span>
                <span className="text-neutral-500 dark:text-slate-400 font-mono text-sm">${formatPrice(data.currentPrice)}</span>
              </div>

              {/* Range Bar */}
              <div className="relative h-6 bg-neutral-100 dark:bg-slate-700 rounded mb-3 overflow-hidden">
                <div className="absolute top-0 bottom-0 w-0.5 bg-neutral-900 dark:bg-white z-10" style={{ left: '50%' }} />
                <div className="absolute top-1 text-[9px] text-neutral-900 dark:text-white font-semibold z-10" style={{ left: '50%', transform: 'translateX(-50%)' }}>
                  NOW
                </div>

                {closestLong && (
                  <div
                    className="absolute top-0 bottom-0 bg-green-100 border-r border-green-500"
                    style={{ left: 0, width: `${Math.max(5, 50 - closestLong.distance)}%` }}
                  >
                    <span className="absolute bottom-0.5 left-1 text-[8px] text-green-600 font-semibold">L</span>
                  </div>
                )}

                {closestShort && (
                  <div
                    className="absolute top-0 bottom-0 bg-red-100 border-l border-red-500"
                    style={{ right: 0, width: `${Math.max(5, 50 - closestShort.distance)}%` }}
                  >
                    <span className="absolute bottom-0.5 right-1 text-[8px] text-red-600 font-semibold">S</span>
                  </div>
                )}
              </div>

              {/* Liq Levels */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="border border-green-200 rounded p-2">
                  <div className="text-green-600 font-semibold mb-1">Long Liqs</div>
                  {closestLong ? (
                    <>
                      <div className="text-neutral-900 dark:text-white font-mono">${formatPrice(closestLong.price)}</div>
                      <div className="text-neutral-500 dark:text-slate-400">{closestLong.distance.toFixed(1)}% away</div>
                    </>
                  ) : <div className="text-neutral-400 dark:text-slate-500">None</div>}
                </div>
                <div className="border border-red-200 rounded p-2">
                  <div className="text-red-600 font-semibold mb-1">Short Liqs</div>
                  {closestShort ? (
                    <>
                      <div className="text-neutral-900 dark:text-white font-mono">${formatPrice(closestShort.price)}</div>
                      <div className="text-neutral-500 dark:text-slate-400">{closestShort.distance.toFixed(1)}% away</div>
                    </>
                  ) : <div className="text-neutral-400 dark:text-slate-500">None</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiquidationMap;
