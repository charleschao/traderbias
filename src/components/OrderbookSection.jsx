import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
import { calculateOrderbookBias, getBiasIndicator } from '../utils/biasCalculations';
import { formatUSD } from '../utils/formatters';

const OrderbookSection = ({ orderbookData }) => {
    const coins = ['BTC', 'ETH', 'SOL'];

    return (
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
            <SectionBiasHeader
                title="ORDERBOOK IMBALANCE"
                icon="📈"
                updateInterval="Updates: 10s"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coins.map(coin => {
                    const ob = orderbookData?.[coin];
                    const bias = calculateOrderbookBias(coin, ob);
                    const indicator = getBiasIndicator(bias.score, 6);
                    // Calculate bidPct from volumes if available, otherwise derive from imbalance
                    const bidPct = ob && ob.bidVolume > 0 && ob.askVolume > 0
                        ? (ob.bidVolume / (ob.bidVolume + ob.askVolume)) * 100
                        : ob?.imbalance !== undefined
                            ? 50 + (ob.imbalance / 2)
                            : 50;

                    return (
                        <div key={coin} className="bg-slate-800/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-white text-lg">{coin}</span>
                                <span className={`text-xs font-bold ${indicator.color}`}>{indicator.icon} {indicator.label}</span>
                            </div>

                            <div className="mb-2">
                                <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
                                    <div className="bg-green-500 transition-all duration-500 flex items-center justify-end pr-1" style={{ width: `${bidPct}%` }}>
                                        <span className="text-[10px] text-white font-bold">{bidPct.toFixed(0)}%</span>
                                    </div>
                                    <div className="bg-red-500 transition-all duration-500 flex items-center pl-1" style={{ width: `${100 - bidPct}%` }}>
                                        <span className="text-[10px] text-white font-bold">{(100 - bidPct).toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <div className="text-slate-300">Bid Depth</div>
                                    <div className="text-green-400 font-mono">{formatUSD(ob?.bidVolume || 0)}</div>
                                </div>
                                <div>
                                    <div className="text-slate-300">Ask Depth</div>
                                    <div className="text-red-400 font-mono">{formatUSD(ob?.askVolume || 0)}</div>
                                </div>
                            </div>

                            <div className="flex justify-center items-center mt-2 pt-2 border-t border-slate-700/50">
                                <span className="text-xs text-slate-300 mr-2">Imbalance:</span>
                                <span className={`text-sm font-bold font-mono ${(ob?.imbalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(ob?.imbalance || 0) >= 0 ? '+' : ''}{(ob?.imbalance || 0).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-3 text-[10px] text-slate-400">
                L2 depth imbalance. Positive = more bid pressure (bullish). Negative = more ask pressure (bearish).
            </div>
        </div>
    );
};

export default OrderbookSection;
