import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
import { calculateOrderbookBias, getBiasIndicator } from '../utils/biasCalculations';
import { formatUSD } from '../utils/formatters';

const OrderbookSection = ({ orderbookData, timeframe = '5m', hasEnoughData = true }) => {
    const coins = ['BTC', 'ETH', 'SOL'];

    return (
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
            <SectionBiasHeader
                title={`ORDERBOOK IMBALANCE (${timeframe.toUpperCase()})`}
                icon="📈"
                updateInterval={hasEnoughData ? `${timeframe.toUpperCase()} avg` : `⚠️ Collecting data...`}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coins.map(coin => {
                    const ob = orderbookData?.[coin];
                    const bias = calculateOrderbookBias(coin, ob);
                    const indicator = getBiasIndicator(bias.score, 6);
                    const bidPct = ob ? (ob.bidVolume / (ob.bidVolume + ob.askVolume)) * 100 : 50;

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

                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
                                <span className="text-xs text-slate-300">Current</span>
                                <span className={`text-xs font-mono ${(ob?.imbalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(ob?.imbalance || 0) >= 0 ? '+' : ''}{(ob?.imbalance || 0).toFixed(1)}%
                                </span>
                                <span className="text-xs text-slate-300">Avg</span>
                                <span className={`text-xs font-mono ${(ob?.avgImbalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(ob?.avgImbalance || 0) >= 0 ? '+' : ''}{(ob?.avgImbalance || 0).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-3 text-[10px] text-slate-400">
                Shows L2 depth imbalance. Avg = rolling 5-minute average for sustained pressure detection.
            </div>
        </div>
    );
};

export default OrderbookSection;
