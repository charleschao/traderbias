import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
import { calculateFlowConfluence } from '../utils/biasCalculations';
import { formatUSD } from '../utils/formatters';

const FlowConfluenceSection = ({ oiData, cvdData, priceData, timeframe = '5m', onTimeframeChange, hasEnoughData = true, coins = ['BTC', 'ETH', 'SOL'] }) => {


    // Check if individual coins have timeframe data
    const getCoinDataStatus = (coin) => {
        const hasOiData = oiData?.[coin]?.hasTimeframeData !== false;
        const hasPriceData = priceData?.[coin]?.hasTimeframeData !== false;
        const hasCvdData = cvdData?.[coin]?.hasTimeframeData !== false;
        return { hasOiData, hasPriceData, hasCvdData, hasAllData: hasOiData && hasPriceData && hasCvdData };
    };

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
            {/* Header with Timeframe Toggle */}
            <div className="flex items-center justify-between mb-4">
                <SectionBiasHeader
                    title={`FLOW CONFLUENCE`}
                    icon="📊"
                    updateInterval={hasEnoughData ? `${timeframe.toUpperCase()} rolling` : `⚠️ Collecting data...`}
                />
                {/* Timeframe Toggle */}
                {onTimeframeChange && (
                    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
                        {['5m', '15m', '1h'].map(tf => (
                            <button key={tf} onClick={() => onTimeframeChange(tf)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${timeframe === tf ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                                {tf.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Data Collection Warning */}
            {!hasEnoughData && (
                <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
                    <span className="text-yellow-400 text-sm">⏳</span>
                    <div className="text-xs text-yellow-400">
                        <div className="font-bold mb-1">Collecting {timeframe.toUpperCase()} historical data...</div>
                        <div className="text-yellow-400/80">
                            Timeframe calculations require {timeframe.toUpperCase()} of historical data.
                            Data shown below may use session data until enough history is collected.
                        </div>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coins.map(coin => {
                    const oi = oiData?.[coin];
                    const cvd = cvdData?.[coin];
                    const price = priceData?.[coin];
                    const confluence = calculateFlowConfluence(coin, oi, cvd, price);
                    const style = getConfluenceStyle(confluence.confluenceType);

                    const dataStatus = getCoinDataStatus(coin);

                    return (
                        <div key={coin} className={`${style.bg} ${style.border} border rounded-lg p-3 ${!dataStatus.hasAllData ? 'opacity-60' : ''}`}>
                            {/* Header: Coin + Confluence Type */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-lg">{coin}</span>
                                    {!dataStatus.hasAllData && (
                                        <span className="text-[10px] text-yellow-400 animate-pulse">⏳</span>
                                    )}
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded ${style.bg} ${style.color}`}>
                                    {style.icon} {style.label}
                                </span>
                            </div>

                            {/* Confluence Table: Price, OI, CVD directions */}
                            <div className="grid grid-cols-3 gap-2 text-center mb-3 bg-slate-800/50 rounded-lg p-2">
                                <div className={`${!dataStatus.hasPriceData ? 'opacity-40' : ''}`}>
                                    <div className="text-white text-[10px] uppercase flex items-center justify-center gap-1">
                                        Price {!dataStatus.hasPriceData && <span className="text-yellow-400">⏳</span>}
                                    </div>
                                    <div className={`text-xl font-bold ${confluence.priceDir === '↑' ? 'text-green-400' : confluence.priceDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                        {confluence.priceDir}
                                    </div>
                                    <div className={`text-[10px] font-mono ${(confluence.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {(confluence.priceChange || 0) >= 0 ? '+' : ''}{(confluence.priceChange || 0).toFixed(2)}%
                                    </div>
                                </div>
                                <div className={`${!dataStatus.hasOiData ? 'opacity-40' : ''}`}>
                                    <div className="text-white text-[10px] uppercase flex items-center justify-center gap-1">
                                        OI {!dataStatus.hasOiData && <span className="text-yellow-400">⏳</span>}
                                    </div>
                                    <div className={`text-xl font-bold ${confluence.oiDir === '↑' ? 'text-green-400' : confluence.oiDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                        {confluence.oiDir}
                                    </div>
                                    <div className={`text-[10px] font-mono ${(confluence.oiChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatUSD(oiData?.[coin]?.oiDelta || 0)}
                                    </div>
                                </div>
                                <div className={`${!dataStatus.hasCvdData ? 'opacity-40' : ''}`}>
                                    <div className="text-white text-[10px] uppercase flex items-center justify-center gap-1">
                                        CVD {timeframe} {!dataStatus.hasCvdData && <span className="text-yellow-400">⏳</span>}
                                    </div>
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
