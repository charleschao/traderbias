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
            'LEAN_BULL': { bg: 'bg-lime-500/10', border: 'border-lime-500/30', icon: '🟡', label: 'LEANING BULLISH', color: 'text-lime-400' },
            'WEAK_BULL': { bg: 'bg-lime-500/10', border: 'border-lime-500/30', icon: '🟡', label: 'WEAK BULL', color: 'text-lime-400' },
            'NEUTRAL': { bg: 'bg-slate-500/10', border: 'border-slate-500/30', icon: '⚪', label: 'NEUTRAL', color: 'text-slate-400' },
            'DIVERGENCE': { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: '⚠️', label: 'DIVERGENCE', color: 'text-yellow-400' },
            'LEAN_BEAR': { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: '🟡', label: 'LEANING BEARISH', color: 'text-orange-400' },
            'WEAK_BEAR': { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: '🟡', label: 'WEAK BEAR', color: 'text-orange-400' },
            'BEARISH': { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: '🔴', label: 'BEARISH', color: 'text-red-300' },
            'STRONG_BEAR': { bg: 'bg-red-500/20', border: 'border-red-500/50', icon: '🔴', label: 'STRONG BEAR', color: 'text-red-400' },
        };
        return styles[confluenceType] || styles.NEUTRAL;
    };

    // Calculate metric counts and leaning state
    const getMetricAnalysis = (confluence) => {
        const priceBullish = confluence.priceDir === '↑';
        const priceBearish = confluence.priceDir === '↓';
        const oiBullish = confluence.oiDir === '↑';
        const oiBearish = confluence.oiDir === '↓';
        const cvdBullish = confluence.cvdDir === '↑';
        const cvdBearish = confluence.cvdDir === '↓';

        const bullishCount = [priceBullish, oiBullish, cvdBullish].filter(Boolean).length;
        const bearishCount = [priceBearish, oiBearish, cvdBearish].filter(Boolean).length;

        // Determine what's missing
        const missing = [];
        if (!priceBullish && !priceBearish) missing.push('Price');
        else if (bullishCount > bearishCount && !priceBullish) missing.push('Price');
        else if (bearishCount > bullishCount && !priceBearish) missing.push('Price');

        if (!oiBullish && !oiBearish) missing.push('OI');
        else if (bullishCount > bearishCount && !oiBullish) missing.push('OI');
        else if (bearishCount > bullishCount && !oiBearish) missing.push('OI');

        if (!cvdBullish && !cvdBearish) missing.push('CVD');
        else if (bullishCount > bearishCount && !cvdBullish) missing.push('CVD');
        else if (bearishCount > bullishCount && !cvdBearish) missing.push('CVD');

        // Determine leaning
        let leaning = 'neutral';
        let leaningLabel = '';
        if (bullishCount === 2 && bearishCount === 0) {
            leaning = 'bullish';
            leaningLabel = `→ LEANING BULLISH`;
        } else if (bearishCount === 2 && bullishCount === 0) {
            leaning = 'bearish';
            leaningLabel = `→ LEANING BEARISH`;
        } else if (bullishCount > bearishCount) {
            leaning = 'lean-bullish';
            leaningLabel = `→ Lean Bull`;
        } else if (bearishCount > bullishCount) {
            leaning = 'lean-bearish';
            leaningLabel = `→ Lean Bear`;
        }

        // Awaiting message
        let awaitingMsg = '';
        if (missing.length > 0 && (bullishCount > 0 || bearishCount > 0)) {
            const direction = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'directional';
            awaitingMsg = `Awaiting ${missing.join('/')} confirmation`;
        }

        return { bullishCount, bearishCount, leaning, leaningLabel, awaitingMsg, missing };
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
                    const metrics = getMetricAnalysis(confluence);
                    const dataStatus = getCoinDataStatus(coin);

                    return (
                        <div key={coin} className={`${style.bg} ${style.border} border rounded-lg p-3 ${!dataStatus.hasAllData ? 'opacity-60' : ''}`}>
                            {/* Header: Coin + Confluence Type + Leaning */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-lg">{coin}</span>
                                    {!dataStatus.hasAllData && (
                                        <span className="text-[10px] text-yellow-400 animate-pulse">⏳</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${style.bg} ${style.color}`}>
                                        {style.icon} {style.label}
                                    </span>
                                </div>
                            </div>

                            {/* Leaning Indicator */}
                            {metrics.leaningLabel && (
                                <div className={`text-xs font-bold mb-2 ${metrics.leaning.includes('bullish') ? 'text-green-400' : metrics.leaning.includes('bearish') ? 'text-red-400' : 'text-slate-400'}`}>
                                    {metrics.leaningLabel}
                                </div>
                            )}

                            {/* Confluence Table: Price, OI, CVD directions */}
                            <div className="space-y-1 mb-3 bg-slate-800/50 rounded-lg p-2">
                                {/* Price Row */}
                                <div className={`flex items-center justify-between ${!dataStatus.hasPriceData ? 'opacity-40' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-lg ${confluence.priceDir === '↑' ? 'text-green-400' : confluence.priceDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                            {confluence.priceDir === '↑' ? '↗' : confluence.priceDir === '↓' ? '↘' : '↔'}
                                        </span>
                                        <span className="text-white text-xs uppercase">PRICE:</span>
                                        <span className={`text-xs font-mono font-bold ${(confluence.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(confluence.priceChange || 0) >= 0 ? '+' : ''}{(confluence.priceChange || 0).toFixed(2)}%
                                        </span>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${confluence.priceDir === '↑' ? 'bg-green-500/20 text-green-400' : confluence.priceDir === '↓' ? 'bg-red-500/20 text-red-400' : 'bg-slate-600/30 text-slate-400'}`}>
                                        {confluence.priceDir === '↑' ? 'bullish' : confluence.priceDir === '↓' ? 'bearish' : 'neutral'}
                                    </span>
                                </div>
                                {/* OI Row */}
                                <div className={`flex items-center justify-between ${!dataStatus.hasOiData ? 'opacity-40' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-lg ${confluence.oiDir === '↑' ? 'text-green-400' : confluence.oiDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                            {confluence.oiDir === '↑' ? '↗' : confluence.oiDir === '↓' ? '↘' : '↔'}
                                        </span>
                                        <span className="text-white text-xs uppercase">OI:</span>
                                        <span className={`text-xs font-mono font-bold ${(confluence.oiChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatUSD(oi?.oiDelta || 0)}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${confluence.oiDir === '↑' ? 'bg-green-500/20 text-green-400' : confluence.oiDir === '↓' ? 'bg-red-500/20 text-red-400' : 'bg-slate-600/30 text-slate-400'}`}>
                                        {confluence.oiDir === '↑' ? 'bullish' : confluence.oiDir === '↓' ? 'bearish' : 'neutral'}
                                    </span>
                                </div>
                                {/* CVD Row */}
                                <div className={`flex items-center justify-between ${!dataStatus.hasCvdData ? 'opacity-40' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-lg ${confluence.cvdDir === '↑' ? 'text-green-400' : confluence.cvdDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                            {confluence.cvdDir === '↑' ? '↗' : confluence.cvdDir === '↓' ? '↘' : '↔'}
                                        </span>
                                        <span className="text-white text-xs uppercase">CVD {timeframe}:</span>
                                        <span className={`text-xs font-mono font-bold ${(confluence.cvdDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatUSD(confluence.cvdDelta || 0)}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${confluence.cvdDir === '↑' ? 'bg-green-500/20 text-green-400' : confluence.cvdDir === '↓' ? 'bg-red-500/20 text-red-400' : 'bg-slate-600/30 text-slate-400'}`}>
                                        {confluence.cvdDir === '↑' ? 'bullish' : confluence.cvdDir === '↓' ? 'bearish' : 'neutral'}
                                    </span>
                                </div>
                            </div>

                            {/* Metric Count & Awaiting */}
                            <div className="flex items-center justify-between text-[10px] mb-2">
                                <div className="flex gap-2">
                                    {metrics.bullishCount > 0 && (
                                        <span className="text-green-400">🟢 {metrics.bullishCount}/3 bullish</span>
                                    )}
                                    {metrics.bearishCount > 0 && (
                                        <span className="text-red-400">🔴 {metrics.bearishCount}/3 bearish</span>
                                    )}
                                </div>
                            </div>

                            {/* Awaiting confirmation */}
                            {metrics.awaitingMsg && (
                                <div className="text-[10px] text-yellow-400/80 italic mb-2">
                                    ⏳ {metrics.awaitingMsg}
                                </div>
                            )}

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
                Pro confluence: Price + OI + CVD = unified bias. 3/3 aligned = strong signal. 2/3 = leaning. Divergence = reversal warning.
            </div>
        </div>
    );
};

export default FlowConfluenceSection;
