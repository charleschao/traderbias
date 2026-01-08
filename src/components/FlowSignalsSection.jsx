import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
import { detectEdgeSignals, getPrioritySignal } from '../utils/flowSignals';

const FlowSignalsSection = ({ oiData, cvdData, priceData, biasData = {} }) => {
    const coins = ['BTC', 'ETH', 'SOL'];

    // Collect signals for all coins
    const coinSignals = coins.map(coin => {
        const signals = detectEdgeSignals(
            coin,
            oiData?.[coin],
            cvdData?.[coin],
            priceData?.[coin]
        );
        const priority = getPrioritySignal(signals);
        const bias = biasData[coin];
        return { coin, signals, priority, bias };
    });

    return (
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 mb-6">
            <SectionBiasHeader
                title="BIAS & SIGNALS"
                icon="🎯"
                updateInterval="Live"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coinSignals.map(({ coin, priority, signals, bias }) => {
                    const hasSignal = signals.length > 0 && priority;
                    const biasLabel = bias?.label || 'LOADING';
                    const biasColor = bias?.color || 'text-slate-400';
                    const biasIcon = bias?.icon || '⏳';
                    const biasBg = bias?.bg || 'bg-slate-800/50';

                    // Determine the main display based on signal presence
                    const showEventAlert = hasSignal;

                    return (
                        <div
                            key={coin}
                            className={`${showEventAlert ? priority.bg : biasBg} ${showEventAlert ? priority.border : 'border-slate-700/50'} border rounded-lg p-4`}
                        >
                            {/* Header: Coin + Bias Badge */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-xl">{coin}</span>
                                    {priceData?.[coin]?.markPx && (
                                        <span className="text-slate-400 font-mono text-sm">
                                            ${parseFloat(priceData[coin].markPx).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    )}
                                </div>
                                {/* Always show bias badge */}
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm ${biasBg}`}>
                                    <span>{biasIcon}</span>
                                    <span className={biasColor}>{biasLabel}</span>
                                </div>
                            </div>

                            {/* Event Alert (if any) */}
                            {showEventAlert ? (
                                <div className="space-y-2">
                                    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded ${priority.bg}`}>
                                        <span className="text-lg">{priority.icon}</span>
                                        <span className={`text-sm font-bold ${priority.color}`}>
                                            {priority.signal}
                                        </span>
                                    </div>
                                    <div className="text-sm text-white">
                                        {priority.description}
                                    </div>
                                    <div className={`text-xs ${priority.color} font-medium`}>
                                        → {priority.implication}
                                    </div>

                                    {/* Strength bar */}
                                    {priority.strength && (
                                        <div className="mt-2">
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                                                <span>Strength</span>
                                                <span className={priority.color}>{Math.round(priority.strength)}%</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${priority.type === 'bullish' ? 'bg-green-500' :
                                                        priority.type === 'bearish' ? 'bg-red-500' : 'bg-yellow-500'
                                                        }`}
                                                    style={{ width: `${priority.strength}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // No event - show calm state with bias context
                                <div className="space-y-1">
                                    <div className="text-sm text-slate-300">
                                        Markets in equilibrium
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        → No edge detected currently
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-3 text-[10px] text-slate-500">
                Shows your trading bias + alerts on sudden market events (absorption, divergence, breakouts).
            </div>
        </div>
    );
};

export default FlowSignalsSection;

