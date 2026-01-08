import React, { useState, useEffect } from 'react';
import { formatUSD, formatPrice } from '../utils/formatters';
import {
    calculateFlowConfluence,
    calculateDivergenceStrength,
    calculateOIVelocity
} from '../utils/biasCalculations';
import { detectEdgeSignals, getPrioritySignal } from '../utils/flowSignals';
import Sparkline from './Sparkline';
import BiasHistoryBar from './BiasHistoryBar';

// Load expanded state from localStorage
const loadExpandedState = () => {
    try {
        const saved = localStorage.getItem('biasCardExpanded');
        return saved ? JSON.parse(saved) : { BTC: false, ETH: false, SOL: false };
    } catch {
        return { BTC: false, ETH: false, SOL: false };
    }
};

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
    biasHistory = [],
    // Timeframe information
    timeframe = '5m',
    timeframeMinutes = 5
}) => {
    const [isExpanded, setIsExpanded] = useState(() => loadExpandedState()[coin] || false);

    // Save to localStorage when expanded state changes
    useEffect(() => {
        const current = loadExpandedState();
        current[coin] = isExpanded;
        localStorage.setItem('biasCardExpanded', JSON.stringify(current));
    }, [isExpanded, coin]);

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

    // Detect event signals (BUYING ABSORBED, etc.)
    const signals = detectEdgeSignals(coin, oiData, cvdData, priceData);
    const prioritySignal = getPrioritySignal(signals);
    const hasEventAlert = signals.length > 0 && prioritySignal;

    // New algorithm improvements
    const oiVelocity = calculateOIVelocity(oiData?.current, oiHistory, timeframeMinutes);
    const divergence = calculateDivergenceStrength(
        priceData?.timeframeChange || priceData?.sessionChange || 0,
        cvdData?.rolling5mDelta
    );

    // Color-coded confluence indicators
    const getDirectionColor = (value, threshold = 0) => {
        if (value > threshold) return 'text-green-400';
        if (value < -threshold) return 'text-red-400';
        return 'text-slate-400';
    };

    const handleToggleExpand = (e) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div
            className={`${biasData.bg} border border-slate-700/50 rounded-2xl p-5 transition-all`}
        >
            {/* Header with Price + Bias Badge - Always visible */}
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

            {/* Event Alert Banner (if any signal detected) */}
            {hasEventAlert && (
                <div className={`mb-3 p-3 rounded-lg ${prioritySignal.bg} ${prioritySignal.border} border`}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{prioritySignal.icon}</span>
                        <span className={`text-sm font-bold ${prioritySignal.color}`}>
                            {prioritySignal.signal}
                        </span>
                    </div>
                    <div className="text-xs text-white mb-1">{prioritySignal.description}</div>
                    <div className={`text-[10px] ${prioritySignal.color}`}>→ {prioritySignal.implication}</div>
                    {prioritySignal.strength && (
                        <div className="mt-2">
                            <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${prioritySignal.type === 'bullish' ? 'bg-green-500' :
                                        prioritySignal.type === 'bearish' ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}
                                    style={{ width: `${prioritySignal.strength}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Collapsed View - Key Metrics Only */}
            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                        <span className="text-white">OI</span>
                        <Sparkline data={oiHistory} width={40} height={14} strokeWidth={1} />
                    </div>
                    <div className={`font-mono font-bold ${(oiData?.timeframeChange || oiData?.sessionChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(oiData?.timeframeChange || oiData?.sessionChange || 0) >= 0 ? '+' : ''}{(oiData?.timeframeChange || oiData?.sessionChange || 0).toFixed(2)}%
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
                <div className="bg-slate-800/50 rounded-lg p-2">
                    <span className="text-white block">Flow</span>
                    <span className={`font-bold text-xs ${confluence.signal === 'bullish' ? 'text-green-400' :
                        confluence.signal === 'bearish' ? 'text-red-400' : 'text-slate-400'
                        }`}>
                        {confluence.confluenceType.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Expanded Details - Only shown when expanded */}
            {isExpanded && (
                <div className="mt-3 space-y-1.5 text-sm animate-fadeIn">
                    {/* Full OI Details */}
                    <div className="flex items-center justify-between bg-slate-800/30 rounded px-2 py-1">
                        <span className="text-white">Open Interest</span>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-white">{formatUSD(oiData?.current || 0)}</span>
                            <span className={`text-xs ${oiVelocity.color}`}>{oiVelocity.icon} {oiVelocity.label}</span>
                        </div>
                    </div>

                    {/* Flow Confluence with P/OI/CVD indicators */}
                    <div className="flex items-center justify-between">
                        <span className="text-white">Flow Confluence</span>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-[10px] font-mono">
                                <span className={getDirectionColor(priceData?.timeframeChange || priceData?.sessionChange, 0.3)}>
                                    P{confluence.priceDir}
                                </span>
                                <span className={getDirectionColor(oiData?.timeframeChange || oiData?.sessionChange, 1)}>
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

                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                        <span className="text-xs text-white">Consensus: {biasData.components?.whaleBias?.reason || 'Loading...'}</span>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                <button
                    onClick={handleToggleExpand}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                    {isExpanded ? '▲ Hide Details' : '▼ Show Details'}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onExpand(coin); }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                    Full View →
                </button>
            </div>
        </div>
    );
};

export default BiasCard;

