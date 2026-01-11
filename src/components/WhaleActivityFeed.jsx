import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
import { formatUSD, formatAddress, getProfileUrl } from '../utils/formatters';

// eslint-disable-next-line no-unused-vars
const WhaleActivityFeed = ({ consensus, positionChanges, whaleTrades }) => {
    // Only show BTC, ETH, SOL
    const targetCoins = ['BTC', 'ETH', 'SOL'];

    // Calculate whale signals from consensus data - only for target coins
    const whaleSignals = targetCoins.map(coin => {
        const data = consensus?.[coin];
        if (!data) return null;

        const longs = data.longs || [];
        const shorts = data.shorts || [];
        const longNotional = longs.reduce((s, p) => s + p.notional, 0);
        const shortNotional = shorts.reduce((s, p) => s + p.notional, 0);
        const totalNotional = data.totalNotional || 0;
        const bias = longNotional > shortNotional ? 'LONG' : shortNotional > longNotional ? 'SHORT' : 'NEUTRAL';

        return {
            coin,
            bias,
            longCount: longs.length,
            shortCount: shorts.length,
            longNotional,
            shortNotional,
            totalNotional,
            topLong: longs[0] || null,
            topShort: shorts[0] || null,
            topTraders: [...longs.slice(0, 4), ...shorts.slice(0, 4)].sort((a, b) => b.notional - a.notional)
        };
    }).filter(Boolean);

    return (
        <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-neutral-200 dark:border-slate-800 p-4">
            <SectionBiasHeader
                title="WHALE POSITIONS (BTC/ETH/SOL)"
                icon="🐋"
                updateInterval="30s"
            />

            {whaleSignals.length === 0 ? (
                <div className="text-center py-4 text-neutral-700 dark:text-white">Loading whale data...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {whaleSignals.map((signal, i) => (
                        <div key={i} className={`rounded-lg p-3 border ${signal.bias === 'LONG' ? 'bg-green-500/10 border-green-500/30' : signal.bias === 'SHORT' ? 'bg-red-500/10 border-red-500/30' : 'bg-neutral-100 dark:bg-slate-800/50 border-neutral-200 dark:border-slate-700'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-2xl font-black text-neutral-900 dark:text-white">{signal.coin}</span>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${signal.bias === 'LONG' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : signal.bias === 'SHORT' ? 'bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-neutral-200 dark:bg-slate-700 text-neutral-600 dark:text-slate-400'}`}>
                                    {signal.bias === 'LONG' ? '🟢 LONG' : signal.bias === 'SHORT' ? '🔴 SHORT' : '⚪ MIXED'}
                                </span>
                            </div>

                            <div className="text-neutral-900 dark:text-white font-bold text-lg mb-2">{formatUSD(signal.totalNotional)}</div>

                            <div className="flex gap-2 text-xs">
                                {signal.topLong ? (
                                    <a href={getProfileUrl(signal.topLong.trader)} target="_blank" rel="noopener noreferrer"
                                        className="text-green-400 hover:underline cursor-pointer">
                                        {signal.longCount}L ({formatUSD(signal.longNotional)})
                                    </a>
                                ) : (
                                    <span className="text-green-400">{signal.longCount}L ({formatUSD(signal.longNotional)})</span>
                                )}
                                {signal.topShort ? (
                                    <a href={getProfileUrl(signal.topShort.trader)} target="_blank" rel="noopener noreferrer"
                                        className="text-red-400 hover:underline cursor-pointer">
                                        {signal.shortCount}S ({formatUSD(signal.shortNotional)})
                                    </a>
                                ) : (
                                    <span className="text-red-400">{signal.shortCount}S ({formatUSD(signal.shortNotional)})</span>
                                )}
                            </div>

                            {signal.topTraders.length > 0 && (
                                <div className="text-xs text-neutral-500 dark:text-slate-400 mt-2 flex flex-wrap gap-1">
                                    {signal.topTraders.slice(0, 6).map((t, j) => (
                                        <a key={j} href={getProfileUrl(t.trader)} target="_blank" rel="noopener noreferrer"
                                            className={`hover:underline ${t.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                                            #{t.rank} {t.direction === 'long' ? 'L' : 'S'}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 🔔 LIVE WHALE ACTIVITY - Position Changes Feed */}
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-slate-700">
                <h3 className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-2">
                    🔔 LIVE WHALE ACTIVITY
                    <span className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></span>
                </h3>

                {(!positionChanges || positionChanges.length === 0) ? (
                    <div className="text-center py-3 text-neutral-700 dark:text-white text-xs">
                        Monitoring top 10 trader positions for changes...
                    </div>
                ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {positionChanges.filter(c => targetCoins.includes(c.coin)).slice(0, 12).map((change, i) => {
                            const configs = {
                                entry: { icon: '📥', color: 'text-green-400', bg: 'bg-green-500/10', label: 'ENTRY' },
                                exit: { icon: '📤', color: 'text-red-400', bg: 'bg-red-500/10', label: 'EXIT' },
                                flip: { icon: '🔄', color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'FLIP' },
                                increase: { icon: '📈', color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: '+SIZE' },
                                decrease: { icon: '📉', color: 'text-orange-400', bg: 'bg-orange-500/10', label: '-SIZE' },
                            };
                            const cfg = configs[change.type] || configs.entry;

                            return (
                                <div key={i} className={`${cfg.bg} rounded-lg px-3 py-2 flex items-center gap-2`}>
                                    <span className="text-lg">{cfg.icon}</span>
                                    <span className={`text-xs font-bold ${cfg.color} min-w-[50px]`}>{cfg.label}</span>
                                    <span className="text-neutral-900 dark:text-white font-bold">{change.coin}</span>
                                    {change.direction && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${change.direction === 'LONG' ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}`}>
                                            {change.direction}
                                        </span>
                                    )}
                                    <a href={getProfileUrl(change.trader)} target="_blank" rel="noopener noreferrer"
                                        className="text-cyan-400 hover:underline text-xs font-mono">
                                        #{change.rank} {formatAddress(change.trader)}
                                    </a>
                                    <span className="text-neutral-900 dark:text-white text-xs ml-auto">{formatUSD(change.notional)}</span>
                                    <span className="text-neutral-700 dark:text-white text-xs">{change.time?.toLocaleTimeString()}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhaleActivityFeed;
