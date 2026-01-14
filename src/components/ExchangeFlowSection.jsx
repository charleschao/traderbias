import React from 'react';
import { formatUSD } from '../utils/formatters';

const EXCHANGE_CONFIG = {
  coinbase: { name: 'Coinbase', hasSpot: true, hasPerp: false },
  binance: { name: 'Binance', hasSpot: true, hasPerp: true },
  bybit: { name: 'Bybit', hasSpot: true, hasPerp: true },
  hyperliquid: { name: 'Hyperliquid', hasSpot: false, hasPerp: true }
};

const ExchangeFlowSection = ({ exchangeFlowData }) => {
  const exchanges = exchangeFlowData?.exchanges || {};

  const renderFlowBar = (data, label) => {
    if (!data || (data.buyVol === 0 && data.sellVol === 0)) {
      return (
        <div className="mb-2">
          <div className="text-[10px] text-neutral-400 dark:text-slate-500 mb-1">{label}</div>
          <div className="flex h-5 rounded overflow-hidden bg-neutral-100 dark:bg-slate-700 items-center justify-center">
            <span className="text-[10px] text-neutral-400 dark:text-slate-500">Collecting...</span>
          </div>
        </div>
      );
    }

    const total = data.buyVol + data.sellVol;
    const buyPct = total > 0 ? (data.buyVol / total) * 100 : 50;
    const sellPct = 100 - buyPct;
    const netFlow = data.buyVol - data.sellVol;

    return (
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-neutral-400 dark:text-slate-500">{label}</span>
          <span className={`text-[10px] font-mono ${netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {netFlow >= 0 ? '+' : ''}{formatUSD(netFlow)}
          </span>
        </div>
        <div className="flex h-5 rounded overflow-hidden bg-neutral-100 dark:bg-slate-700">
          <div
            className="bg-green-500 transition-all duration-500 flex items-center justify-center"
            style={{ width: `${buyPct}%` }}
          >
            {buyPct >= 20 && (
              <span className="text-[10px] text-white font-bold">{buyPct.toFixed(0)}%</span>
            )}
          </div>
          <div
            className="bg-red-500 transition-all duration-500 flex items-center justify-center"
            style={{ width: `${sellPct}%` }}
          >
            {sellPct >= 20 && (
              <span className="text-[10px] text-white font-bold">{sellPct.toFixed(0)}%</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderNaBar = (label) => (
    <div className="mb-2">
      <div className="text-[10px] text-neutral-400 dark:text-slate-500 mb-1">{label}</div>
      <div className="flex h-5 rounded overflow-hidden bg-neutral-100 dark:bg-slate-700 items-center justify-center">
        <span className="text-[10px] text-neutral-400 dark:text-slate-500">N/A</span>
      </div>
    </div>
  );

  const getNetBias = (exchange) => {
    const data = exchanges[exchange];
    if (!data) return null;

    let totalBuy = 0;
    let totalSell = 0;

    if (data.spot?.buyVol) totalBuy += data.spot.buyVol;
    if (data.spot?.sellVol) totalSell += data.spot.sellVol;
    if (data.perp?.buyVol) totalBuy += data.perp.buyVol;
    if (data.perp?.sellVol) totalSell += data.perp.sellVol;

    if (totalBuy === 0 && totalSell === 0) return null;

    const net = totalBuy - totalSell;
    const total = totalBuy + totalSell;
    const buyPct = (totalBuy / total) * 100;

    return { net, buyPct };
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">EXCHANGE FLOW</span>
        <span className="text-xs text-neutral-400 dark:text-slate-500">5m rolling</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(EXCHANGE_CONFIG).map(([key, config]) => {
          const bias = getNetBias(key);

          return (
            <div
              key={key}
              className="bg-neutral-50 dark:bg-slate-700/50 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                  {config.name}
                </span>
                {bias && (
                  <span className={`text-[10px] font-mono ${bias.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {bias.buyPct.toFixed(0)}% buy
                  </span>
                )}
              </div>

              {config.hasSpot
                ? renderFlowBar(exchanges[key]?.spot, 'SPOT')
                : renderNaBar('SPOT')}

              {config.hasPerp
                ? renderFlowBar(exchanges[key]?.perp, 'PERP')
                : renderNaBar('PERP')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExchangeFlowSection;
