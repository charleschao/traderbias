import React, { useState, useMemo } from 'react';
import { WHALE_WS_CONFIG } from '../config/whaleWsConfig';
import { formatUSD, formatPrice } from '../utils/formatters';
import NotificationToggle from './NotificationToggle';
import ThresholdSelector from './ThresholdSelector';

// Individual whale trade row - mockup timeline style
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

    // Exchange badge colors - Binance gets amber, others get slate
    const getExchangeBadgeStyle = (exchangeName) => {
        const name = exchangeName?.toLowerCase() || '';
        if (name.includes('binance')) return 'bg-amber-900/30 text-amber-300';
        return 'bg-slate-700 text-slate-300';
    };

    return (
        <div className={`flex items-center gap-4 p-4 bg-slate-800 rounded-lg ${isNew ? 'ring-1 ring-amber-500/50' : ''}`}>
            {/* Time */}
            <span className="text-slate-500 text-sm w-20">{time}</span>

            {/* Side Badge */}
            <span className={`px-3 py-1 text-white text-sm font-bold rounded w-16 text-center ${isBuy ? 'bg-emerald-500' : 'bg-rose-500'
                }`}>
                {isBuy ? 'BUY' : 'SELL'}
            </span>

            {/* Notional */}
            <span className={`font-semibold text-lg ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatUSD(trade.notional)}
            </span>

            {/* Size @ Price */}
            <span className="text-slate-400 text-sm hidden sm:block">
                {trade.size.toLocaleString(undefined, { maximumFractionDigits: 2 })} @ ${formatPrice(trade.price)}
            </span>

            {/* Coin */}
            <span className="text-white font-bold text-sm">{trade.symbol}</span>

            {/* Exchange Badge */}
            <span className={`ml-auto px-3 py-1 text-xs rounded ${getExchangeBadgeStyle(config?.name)}`}>
                {config?.icon} {config?.name}
            </span>
        </div>
    );
};

const MegaWhaleFeed = ({
    trades,
    isConnected,
    connectionStatus,
    // Threshold props
    threshold = 10_000_000,
    onThresholdChange = () => { },
    // Notification props
    notificationEnabled = false,
    notificationPermission = 'default',
    notificationSupported = true,
    onNotificationToggle = () => { }
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    // Filter trades based on current threshold
    const filteredTrades = useMemo(() =>
        trades.filter(t => t.notional >= threshold),
        [trades, threshold]
    );

    // Calculate stats from filtered trades
    const last5min = filteredTrades.filter(t => Date.now() - t.timestamp < 300000);
    const buyVolume = last5min.filter(t => t.side === 'BUY').reduce((sum, t) => sum + t.notional, 0);
    const sellVolume = last5min.filter(t => t.side === 'SELL').reduce((sum, t) => sum + t.notional, 0);
    const netFlow = buyVolume - sellVolume;

    const connectedCount = Object.values(connectionStatus).filter(s => s === 'connected').length;
    const totalConnections = Object.keys(connectionStatus).length;

    // Format threshold for display
    const formatThreshold = (val) => {
        if (val >= 1_000_000) return `$${val / 1_000_000}M`;
        return `$${val / 1_000}K`;
    };

    return (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 rounded-xl border border-amber-500/30 mb-6 overflow-hidden">
            {/* Header - Always visible */}
            <div
                className="px-3 py-2 cursor-pointer bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🐋</span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-amber-400">LARGE ORDERS</h2>
                                <div onClick={e => e.stopPropagation()}>
                                    <ThresholdSelector value={threshold} onChange={onThresholdChange} />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400">
                                {isConnected ? <span className="text-green-400">● LIVE</span> : <span className="text-yellow-400">● ...</span>}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Notification Toggle */}
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
                            <div className="text-center px-2 py-0.5 rounded bg-slate-800/50">
                                <span className="text-green-400 font-bold font-mono">{formatUSD(buyVolume)}</span>
                                <span className="text-slate-300 ml-1">buy</span>
                            </div>
                            <div className="text-center px-2 py-0.5 rounded bg-slate-800/50">
                                <span className="text-red-400 font-bold font-mono">{formatUSD(sellVolume)}</span>
                                <span className="text-slate-300 ml-1">sell</span>
                            </div>
                            <div className="text-center px-2 py-0.5 rounded bg-slate-800/50">
                                <span className={`font-bold font-mono ${netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {netFlow >= 0 ? '+' : ''}{formatUSD(netFlow)}
                                </span>
                                <span className="text-slate-300 ml-1">net</span>
                            </div>
                        </div>

                        <span className="text-slate-300 text-sm">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-slate-800">
                    {/* Trade List - compact height for ~5 trades */}
                    <div className="max-h-[180px] overflow-y-auto">
                        {filteredTrades.length === 0 ? (
                            <div className="p-4 text-center">
                                <div className="text-slate-300 text-sm">
                                    Watching for {formatThreshold(threshold)}+ trades...
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 p-3">
                                {filteredTrades.slice(0, 50).map((trade, i) => (
                                    <MegaWhaleTradeRow key={`${trade.exchange}-${trade.tradeId}-${i}`} trade={trade} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MegaWhaleFeed;
