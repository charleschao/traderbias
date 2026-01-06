import React from 'react';
import { formatUSD, formatPrice } from '../utils/formatters';
import {
    calculateFlowConfluence,
    calculateDivergenceStrength,
    calculateOIVelocity
} from '../utils/biasCalculations';
import Sparkline from './Sparkline';
import BiasHistoryBar from './BiasHistoryBar';

const BiasCard = ({
    coin,
    biasData,
    priceData,
    oiData,
    orderbookData,
    cvdData,
    fundingData,
    onExpand,
    // Sparkline data (optional)
    priceHistory = [],
    oiHistory = [],
    cvdHistory = [],
    // New: Bias history for time-weighted display
    biasHistory = []
}) => {
    if (!biasData) return null;

    // Generate trader-focused insight labels
    const getBookLabel = () => {
        const imb = orderbookData?.imbalance || 0;
        const avg = orderbookData?.avgImbalance || 0;
        if (imb > 20) return { text: '📗 Heavy Bids', color: 'text-green-400' };
        if (imb > 10) return { text: '📗 Bids Lean', color: 'text-green-400' };
        if (imb < -20) return { text: '📕 Heavy Asks', color: 'text-red-400' };
        if (imb < -10) return { text: '📕 Asks Lean', color: 'text-red-400' };
        if (imb > avg + 10) return { text: '↗️ Bids Strengthening', color: 'text-lime-400' };
        if (imb < avg - 10) return { text: '↘️ Asks Strengthening', color: 'text-orange-400' };
        return { text: '⚖️ Balanced Book', color: 'text-slate-400' };
    };

    const getFundingLabel = () => {
        const rate = fundingData?.rate || 0;
        const apr = Math.abs(rate * 3 * 365 * 100);
        if (rate > 0.0005) return { text: `⚠️ CROWDED LONGS (${apr.toFixed(0)}% APR)`, color: 'text-red-400' };
        if (rate > 0.0002) return { text: `Bullish Bias`, color: 'text-green-400' };
        if (rate < -0.0005) return { text: `⚠️ CROWDED SHORTS (${apr.toFixed(0)}% APR)`, color: 'text-green-400' };
        if (rate < -0.0002) return { text: `Bearish Bias`, color: 'text-red-400' };
        return { text: 'Neutral Funding', color: 'text-slate-400' };
    };

    const book = getBookLabel();
    const funding = getFundingLabel();
    const confluence = calculateFlowConfluence(coin, oiData, cvdData, priceData);

    // New algorithm improvements
    const oiVelocity = calculateOIVelocity(oiData?.current, oiHistory);
    const divergence = calculateDivergenceStrength(
        priceData?.sessionChange,
        cvdData?.rolling5mDelta
    );

    // Color-coded confluence indicators
    const getDirectionColor = (value, threshold = 0) => {
        if (value > threshold) return 'text-green-400';
        if (value < -threshold) return 'text-red-400';
        return 'text-slate-400';
    };

    return (
        <div
            className={`${biasData.bg} border border-slate-700/50 rounded-2xl p-5 cursor-pointer hover:border-slate-600 transition-all`}
            onClick={() => onExpand(coin)}
        >
            {/* Header with Price + Bias History */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-white">{coin}</span>
                    {priceData && <span className="text-slate-400 font-mono text-sm">${formatPrice(priceData.markPx)}</span>}
                </div>
                <div className="flex items-center gap-2">
                    <BiasHistoryBar history={biasHistory} label="15m" />
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-xs whitespace-nowrap ${biasData.bg}`}>
                        <span>{biasData.icon}</span>
                        <span className={biasData.color}>{biasData.label}</span>
                    </div>
                </div>
            </div>

            {/* Market Data - OI, Volume, Changes with Sparklines */}
            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                        <span className="text-white">Open Interest</span>
                        <Sparkline data={oiHistory} width={40} height={14} strokeWidth={1} />
                    </div>
                    <div className="text-white font-mono font-bold">{formatUSD(oiData?.current || 0)}</div>
                    {/* OI Velocity indicator */}
                    <div className={`text-[10px] ${oiVelocity.color}`}>
                        {oiVelocity.icon} {oiVelocity.label}
                    </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                        <span className="text-white">OI Change</span>
                    </div>
                    <div className={`font-mono font-bold ${(oiData?.sessionChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(oiData?.sessionChange || 0) >= 0 ? '+' : ''}{(oiData?.sessionChange || 0).toFixed(2)}%
                    </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                        <span className="text-white">CVD</span>
                        <Sparkline data={cvdHistory} width={40} height={14} strokeWidth={1} />
                    </div>
                    <div className={`font-mono font-bold ${(cvdData?.rolling5mDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatUSD(cvdData?.rolling5mDelta || 0)}
                    </div>
                </div>
            </div>

            {/* Signal Insights */}
            <div className="mt-3 space-y-1.5 text-sm">
                {/* Flow Confluence - Color-coded indicators */}
                <div className="flex items-center justify-between">
                    <span className="text-white">Flow Confluence</span>
                    <div className="flex items-center gap-2">
                        {/* Color-coded direction indicators */}
                        <div className="flex items-center gap-1 text-[10px] font-mono">
                            <span className={getDirectionColor(priceData?.sessionChange, 0.3)}>
                                P{confluence.priceDir}
                            </span>
                            <span className={getDirectionColor(oiData?.sessionChange, 1)}>
                                OI{confluence.oiDir}
                            </span>
                            <span className={getDirectionColor(cvdData?.rolling5mDelta, 0)}>
                                CVD{confluence.cvdDir}
                            </span>
                        </div>
                        <span className={`font-bold ${confluence.signal === 'bullish' ? 'text-green-400' :
                            confluence.signal === 'bearish' ? 'text-red-400' : 'text-slate-400'
                            }`}>
                            {{
                                'STRONG_BULL': '🟢', 'BULLISH': '🟢', 'WEAK_BULL': '🟡',
                                'STRONG_BEAR': '🔴', 'BEARISH': '🔴', 'WEAK_BEAR': '🟡',
                                'DIVERGENCE': '⚠️', 'NEUTRAL': '⚪'
                            }[confluence.confluenceType] || '⚪'} {confluence.confluenceType.replace('_', ' ')}
                        </span>
                    </div>
                </div>

                {/* Divergence Warning (if detected) */}
                {divergence.label && divergence.strength > 20 && (
                    <div className="flex items-center justify-between bg-slate-800/30 rounded px-2 py-1">
                        <span className="text-white text-xs">Divergence Alert</span>
                        <span className={`font-bold text-xs ${divergence.color}`}>
                            {divergence.label}
                        </span>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <span className="text-white">Book</span>
                    <span className={`font-bold ${book.color}`}>{book.text}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-white">Funding</span>
                    <span className={`font-bold ${funding.color}`}>{funding.text}</span>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                <span className="text-xs text-white">Consensus: {biasData.components?.whaleBias?.reason || 'Loading...'}</span>
                <span className="text-xs text-cyan-400">Details →</span>
            </div>
        </div>
    );
};

export default BiasCard;
