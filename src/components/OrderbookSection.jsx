import React from 'react';
import { calculateOrderbookBias, getBiasIndicator } from '../utils/biasCalculations';
import { formatUSD } from '../utils/formatters';

/**
 * Compact Orderbook Section - designed for single coin display
 * Shows bid/ask imbalance in a condensed format
 */
const OrderbookSection = ({ orderbookData, coins = ['BTC'] }) => {
    // For single coin, render compact. For multiple, render grid.
    const isSingleCoin = coins.length === 1;

    if (isSingleCoin) {
        const coin = coins[0];
        const ob = orderbookData?.[coin];
        const bias = calculateOrderbookBias(coin, ob);
        const indicator = getBiasIndicator(bias.score, 6);
        const bidPct = ob && ob.bidVolume > 0 && ob.askVolume > 0
            ? (ob.bidVolume / (ob.bidVolume + ob.askVolume)) * 100
            : ob?.imbalance !== undefined
                ? 50 + (ob.imbalance / 2)
                : 50;

        return (
            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 h-full">
                {/* Compact Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">📈</span>
                        <span className="text-sm font-bold text-white">ORDERBOOK</span>
                    </div>
                    <span className={`text-xs font-bold ${indicator.color}`}>
                        {indicator.icon} {indicator.label}
                    </span>
                </div>

                {/* Imbalance Bar */}
                <div className="mb-3">
                    <div className="flex h-6 rounded-lg overflow-hidden bg-slate-700">
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
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-green-500/10 rounded-lg p-2 text-center">
                        <div className="text-slate-400 text-[10px]">BID DEPTH</div>
                        <div className="text-green-400 font-mono font-bold text-sm">
                            {formatUSD(ob?.bidVolume || 0)}
                        </div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-2 text-center">
                        <div className="text-slate-400 text-[10px]">ASK DEPTH</div>
                        <div className="text-red-400 font-mono font-bold text-sm">
                            {formatUSD(ob?.askVolume || 0)}
                        </div>
                    </div>
                </div>

                {/* Imbalance Value */}
                <div className="flex justify-center items-center mt-3 pt-2 border-t border-slate-700/50">
                    <span className="text-xs text-slate-400 mr-2">Net Imbalance:</span>
                    <span className={`text-lg font-bold font-mono ${(ob?.imbalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(ob?.imbalance || 0) >= 0 ? '+' : ''}{(ob?.imbalance || 0).toFixed(1)}%
                    </span>
                </div>
            </div>
        );
    }

    // Multi-coin grid layout (original)
    return (
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm">📈</span>
                    <span className="text-sm font-bold text-white">ORDERBOOK IMBALANCE</span>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coins.map(coin => {
                    const ob = orderbookData?.[coin];
                    const bias = calculateOrderbookBias(coin, ob);
                    const indicator = getBiasIndicator(bias.score, 6);
                    const bidPct = ob && ob.bidVolume > 0 && ob.askVolume > 0
                        ? (ob.bidVolume / (ob.bidVolume + ob.askVolume)) * 100
                        : ob?.imbalance !== undefined
                            ? 50 + (ob.imbalance / 2)
                            : 50;

                    return (
                        <div key={coin} className="bg-slate-800/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-white">{coin}</span>
                                <span className={`text-xs font-bold ${indicator.color}`}>{indicator.icon} {indicator.label}</span>
                            </div>
                            <div className="flex h-4 rounded-full overflow-hidden bg-slate-700 mb-2">
                                <div className="bg-green-500" style={{ width: `${bidPct}%` }}></div>
                                <div className="bg-red-500" style={{ width: `${100 - bidPct}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-green-400 font-mono">{formatUSD(ob?.bidVolume || 0)}</span>
                                <span className="text-red-400 font-mono">{formatUSD(ob?.askVolume || 0)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OrderbookSection;
