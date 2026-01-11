import React, { useState, useMemo } from 'react';
import { WHALE_WS_CONFIG } from '../config/whaleWsConfig';
import { formatUSD, formatPrice } from '../utils/formatters';
import NotificationToggle from './NotificationToggle';
import ThresholdSelector from './ThresholdSelector';

const MegaWhaleTradeRow = ({ trade }) => {
  const isBuy = trade.side === 'BUY';
  const age = Date.now() - trade.timestamp;
  const isNew = age < 10000;

  const time = new Date(trade.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const config = WHALE_WS_CONFIG[trade.exchange];

  return (
    <div className={`flex items-center gap-4 p-3 border-b border-neutral-100 dark:border-slate-700 ${isNew ? 'bg-neutral-50 dark:bg-slate-800' : ''}`}>
      <span className="text-neutral-400 dark:text-slate-400 text-sm w-20 font-mono">{time}</span>
      <span className={`px-2 py-0.5 text-white text-xs font-bold rounded w-12 text-center ${isBuy ? 'bg-green-500' : 'bg-red-500'}`}>
        {isBuy ? 'BUY' : 'SELL'}
      </span>
      <span className={`font-semibold font-mono ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
        {formatUSD(trade.notional)}
      </span>
      <span className="text-neutral-400 dark:text-slate-400 text-sm hidden sm:block">
        {trade.size.toLocaleString(undefined, { maximumFractionDigits: 2 })} @ ${formatPrice(trade.price)}
      </span>
      <span className="text-neutral-900 dark:text-white font-semibold text-sm">{trade.symbol}</span>
      <span className="ml-auto text-xs text-neutral-400 dark:text-slate-400">
        {config?.name}
      </span>
    </div>
  );
};

const MegaWhaleFeed = ({
  trades,
  isConnected,
  connectionStatus,
  threshold = 10_000_000,
  onThresholdChange = () => { },
  notificationEnabled = false,
  notificationPermission = 'default',
  notificationSupported = true,
  onNotificationToggle = () => { }
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const filteredTrades = useMemo(() =>
    trades.filter(t => t.notional >= threshold),
    [trades, threshold]
  );

  const last5min = filteredTrades.filter(t => Date.now() - t.timestamp < 300000);
  const buyVolume = last5min.filter(t => t.side === 'BUY').reduce((sum, t) => sum + t.notional, 0);
  const sellVolume = last5min.filter(t => t.side === 'SELL').reduce((sum, t) => sum + t.notional, 0);
  const netFlow = buyVolume - sellVolume;

  const formatThreshold = (val) => {
    if (val >= 1_000_000) return `$${val / 1_000_000}M`;
    return `$${val / 1_000}K`;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700 mb-6 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 cursor-pointer border-b border-neutral-100 dark:border-slate-700"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">LARGE ORDERS</span>
                <div onClick={e => e.stopPropagation()}>
                  <ThresholdSelector value={threshold} onChange={onThresholdChange} />
                </div>
              </div>
              <span className={`text-xs ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-neutral-400 dark:text-slate-500'}`}>
                {isConnected ? 'LIVE' : '...'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div onClick={e => e.stopPropagation()}>
              <NotificationToggle
                enabled={notificationEnabled}
                permission={notificationPermission}
                isSupported={notificationSupported}
                onToggle={onNotificationToggle}
              />
            </div>

            {/* 5-min Flow Summary */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-green-600 font-mono">{formatUSD(buyVolume)}</span>
              <span className="text-neutral-300 dark:text-slate-600">/</span>
              <span className="text-red-600 font-mono">{formatUSD(sellVolume)}</span>
              <span className="text-neutral-300 dark:text-slate-600">=</span>
              <span className={`font-mono font-semibold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netFlow >= 0 ? '+' : ''}{formatUSD(netFlow)}
              </span>
            </div>

            <span className="text-neutral-400 dark:text-slate-400 text-sm">{isExpanded ? '−' : '+'}</span>
          </div>
        </div>
      </div>

      {/* Trade List */}
      {isExpanded && (
        <div className="max-h-[280px] overflow-y-auto">
          {filteredTrades.length === 0 ? (
            <div className="p-4 text-center text-neutral-500 dark:text-slate-400 text-sm">
              Watching for {formatThreshold(threshold)}+ trades...
            </div>
          ) : (
            <div>
              {filteredTrades.slice(0, 50).map((trade, i) => (
                <MegaWhaleTradeRow key={`${trade.exchange}-${trade.tradeId}-${i}`} trade={trade} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MegaWhaleFeed;
