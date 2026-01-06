import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
import { calculateFlowConfluence } from '../utils/biasCalculations';
import { formatUSD } from '../utils/formatters';

const FlowConfluenceSection = ({ oiData, cvdData, priceData, timeframe = '5m', hasEnoughData = true }) => {
    const coins = ['BTC', 'ETH', 'SOL'];

    // Get confluence indicator styling
    const getConfluenceStyle = (confluenceType) => {
        const styles = {
            'STRONG_BULL': { bg: 'bg-green-500/20', border: 'border-green-500/50', icon: '🟢', label: 'STRONG BULL', color: 'text-green-400' },
            'BULLISH': { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: '🟢', label: 'BULLISH', color: 'text-green-300' },
            'WEAK_BULL': { bg: 'bg-lime-500/10', border: 'border-lime-500/30', icon: '🟡', label: 'WEAK BULL', color: 'text-lime-400' },
            'NEUTRAL': { bg: 'bg-slate-500/10', border: 'border-slate-500/30', icon: '⚪', label: 'NEUTRAL', color: 'text-slate-400' },
            'DIVERGENCE': { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: '⚠️', label: 'DIVERGENCE', color: 'text-yellow-400' },
            'WEAK_BEAR': { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: '🟡', label: 'WEAK BEAR', color: 'text-orange-400' },
            'BEARISH': { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: '🔴', label: 'BEARISH', color: 'text-red-300' },
            'STRONG_BEAR': { bg: 'bg-red-500/20', border: 'border-red-500/50', icon: '🔴', label: 'STRONG BEAR', color: 'text-red-400' },
        };
        return styles[confluenceType] || styles.NEUTRAL;
    };

    // Collect any divergences for footer alert
    const divergences = coins.map(coin => {
        const confluence = calculateFlowConfluence(coin, oiData?.[coin], cvdData?.[coin], priceData?.[coin]);
        return confluence.divergence ? { coin, ...confluence.divergence } : null;
    }).filter(Boolean);

    return (
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
            <SectionBiasHeader
                title={`FLOW CONFLUENCE (${timeframe.toUpperCase()})`}
                icon="📊"
                updateInterval={hasEnoughData ? `${timeframe.toUpperCase()} rolling` : `⚠️ Collecting data...`}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coins.map(coin => {
                    const oi = oiData?.[coin];
                    const cvd = cvdData?.[coin];
                    const price = priceData?.[coin];
                    const confluence = calculateFlowConfluence(coin, oi, cvd, price);
                    const style = getConfluenceStyle(confluence.confluenceType);

                    return (
                        <div key={coin} className={`${style.bg} ${style.border} border rounded-lg p-3`}>
                            {/* Header: Coin + Confluence Type */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-white text-lg">{coin}</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded ${style.bg} ${style.color}`}>
                                    {style.icon} {style.label}
                                </span>
                            </div>

                            {/* Confluence Table: Price, OI, CVD directions */}
                            <div className="grid grid-cols-3 gap-2 text-center mb-3 bg-slate-800/50 rounded-lg p-2">
                                <div>
                                    <div className="text-white text-[10px] uppercase">Price</div>
                                    <div className={`text-xl font-bold ${confluence.priceDir === '↑' ? 'text-green-400' : confluence.priceDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                        {confluence.priceDir}
                                    </div>
                                    <div className={`text-[10px] font-mono ${(confluence.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {(confluence.priceChange || 0) >= 0 ? '+' : ''}{(confluence.priceChange || 0).toFixed(2)}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-white text-[10px] uppercase">OI</div>
                                    <div className={`text-xl font-bold ${confluence.oiDir === '↑' ? 'text-green-400' : confluence.oiDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                        {confluence.oiDir}
                                    </div>
                                    <div className={`text-[10px] font-mono ${(confluence.oiChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {(confluence.oiChange || 0) >= 0 ? '+' : ''}{(confluence.oiChange || 0).toFixed(1)}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-white text-[10px] uppercase">CVD {timeframe}</div>
                                    <div className={`text-xl font-bold ${confluence.cvdDir === '↑' ? 'text-green-400' : confluence.cvdDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                        {confluence.cvdDir}
                                    </div>
                                    <div className={`text-[10px] font-mono ${(confluence.cvdDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatUSD(confluence.cvdDelta || 0)}
                                    </div>
                                </div>
                            </div>

                            {/* Interpretation */}
                            <div className="text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                                {confluence.reason}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Divergence Alerts */}
            {divergences.length > 0 && (
                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    {divergences.map((d, i) => (
                        <div key={i} className="text-xs text-yellow-400">
                            ⚠️ <span className="font-bold">{d.coin}:</span> {d.message}
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 text-[10px] text-white">
                Pro confluence: Price + OI + CVD = unified bias. Divergence = price/flow mismatch (reversal signal).
            </div>
        </div>
    );
};

export default FlowConfluenceSection;
