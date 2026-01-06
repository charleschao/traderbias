import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
import { calculateWhaleBias, getBiasIndicator } from '../utils/biasCalculations';
import { formatUSD, getProfileUrl } from '../utils/formatters';

const ConsensusSection = ({ consensus }) => {
    // Get coins that have actual data, prioritize BTC/ETH/SOL
    const preferredCoins = ['BTC', 'ETH', 'SOL'];
    const availableCoins = Object.keys(consensus || {});
    const coins = preferredCoins.filter(c => availableCoins.includes(c));

    // If no preferred coins, show whatever we have
    if (coins.length === 0 && availableCoins.length > 0) {
        coins.push(...availableCoins.slice(0, 3));
    }

    return (
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
            <SectionBiasHeader
                title="TOP 10 WHALE CONSENSUS"
                icon="🎯"
                updateInterval="30s"
            />
            {coins.length === 0 ? (
                <div className="text-center py-8 text-white">Loading whale consensus data...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {coins.map(coin => {
                        const data = consensus?.[coin];
                        if (!data) return null;

                        const bias = calculateWhaleBias(coin, consensus);
                        const indicator = getBiasIndicator(bias.score, 10);
                        const total = data.longs.length + data.shorts.length;
                        const longPct = total > 0 ? (data.longs.length / total) * 100 : 50;

                        return (
                            <div key={coin} className={`${indicator.bg} rounded-lg p-3 border border-slate-700/50`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-white text-lg">{coin}</span>
                                    <span className={`text-xs font-bold ${indicator.color}`}>{indicator.icon} {indicator.label}</span>
                                </div>

                                <div className="mb-2">
                                    <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
                                        <div className="bg-green-500 transition-all duration-500 flex items-center justify-center" style={{ width: `${longPct}%` }}>
                                            {data.longs.length > 0 && <span className="text-[10px] text-white font-bold">{data.longs.length}L</span>}
                                        </div>
                                        <div className="bg-red-500 transition-all duration-500 flex items-center justify-center" style={{ width: `${100 - longPct}%` }}>
                                            {data.shorts.length > 0 && <span className="text-[10px] text-white font-bold">{data.shorts.length}S</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs space-y-1">
                                    {data.longs.slice(0, 2).map((p, i) => (
                                        <div key={`long-${i}`} className="flex justify-between">
                                            <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                                                #{p.rank} {p.isConsistent && '⭐'}
                                            </a>
                                            <span className="text-white">{formatUSD(p.notional)}</span>
                                        </div>
                                    ))}
                                    {data.shorts.slice(0, 2).map((p, i) => (
                                        <div key={`short-${i}`} className="flex justify-between">
                                            <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">
                                                #{p.rank} {p.isConsistent && '⭐'}
                                            </a>
                                            <span className="text-white">{formatUSD(p.notional)}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="text-[10px] text-white pt-2 mt-2 border-t border-slate-700/50">
                                    {formatUSD(data.totalNotional)} total • ⭐ = consistent winner
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ConsensusSection;
