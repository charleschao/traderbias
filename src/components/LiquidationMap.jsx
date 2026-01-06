import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
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

    // Only show BTC, ETH, SOL - focused coins only
    const allowedCoins = ['BTC', 'ETH', 'SOL'];
    const mainCoins = allowedCoins.filter(c => liqLevels[c]);

    if (mainCoins.length === 0) {
        return (
            <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
                <SectionBiasHeader
                    title="LIQUIDATION MAP"
                    icon="💀"
                    updateInterval="5min"
                />
                <div className="text-center py-8 text-white">
                    {positions.length === 0 ? 'Loading whale positions...' : 'No positions found'}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
            <SectionBiasHeader
                title="LIQUIDATION MAP"
                icon="💀"
                updateInterval="5min"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {mainCoins.map(coin => {
                    const data = liqLevels[coin];
                    const closestLong = data.longs[0];
                    const closestShort = data.shorts[0];

                    return (
                        <div key={coin} className="bg-slate-800/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-white text-lg">{coin}</span>
                                <span className="text-slate-400 font-mono text-sm">${formatPrice(data.currentPrice)}</span>
                            </div>

                            <div className="relative h-8 bg-slate-700/50 rounded-lg mb-3 overflow-hidden">
                                <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: '50%' }} />
                                <div className="absolute top-1 text-[10px] text-white font-bold z-10" style={{ left: '50%', transform: 'translateX(-50%)' }}>NOW</div>

                                {closestLong && (
                                    <div className="absolute top-0 bottom-0 bg-green-500/30 border-r-2 border-green-400"
                                        style={{ left: 0, width: `${Math.max(5, 50 - closestLong.distance)}%` }}>
                                        <span className="absolute bottom-1 left-1 text-[9px] text-green-400 font-bold">LONG</span>
                                    </div>
                                )}

                                {closestShort && (
                                    <div className="absolute top-0 bottom-0 bg-red-500/30 border-l-2 border-red-400"
                                        style={{ right: 0, width: `${Math.max(5, 50 - closestShort.distance)}%` }}>
                                        <span className="absolute bottom-1 right-1 text-[9px] text-red-400 font-bold">SHORT</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-green-500/10 rounded p-2">
                                    <div className="text-green-400 font-bold">Long Liqs ↓</div>
                                    {closestLong ? (
                                        <>
                                            <div className="text-white font-mono">${formatPrice(closestLong.price)}</div>
                                            <div className="text-white">{closestLong.distance.toFixed(1)}% away</div>
                                        </>
                                    ) : <div className="text-white">None</div>}
                                </div>
                                <div className="bg-red-500/10 rounded p-2">
                                    <div className="text-red-400 font-bold">Short Liqs ↑</div>
                                    {closestShort ? (
                                        <>
                                            <div className="text-white font-mono">${formatPrice(closestShort.price)}</div>
                                            <div className="text-white">{closestShort.distance.toFixed(1)}% away</div>
                                        </>
                                    ) : <div className="text-white">None</div>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-3 text-[10px] text-white">
                Price hunts liquidations. Closer cluster = higher probability of sweep.
            </div>
        </div>
    );
};

export default LiquidationMap;
