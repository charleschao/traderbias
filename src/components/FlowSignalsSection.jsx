import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
import { detectEdgeSignals, getPrioritySignal } from '../utils/flowSignals';

const FlowSignalsSection = ({ oiData, cvdData, priceData }) => {
    const coins = ['BTC', 'ETH', 'SOL'];

    // Collect signals for all coins (show all 3 even if no signal)
    const coinSignals = coins.map(coin => {
        const signals = detectEdgeSignals(
            coin,
            oiData?.[coin],
            cvdData?.[coin],
            priceData?.[coin]
        );
        const priority = getPrioritySignal(signals);
        return { coin, signals, priority };
    });

    return (
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
            <SectionBiasHeader
                title="FLOW SIGNALS"
                icon="🎯"
                updateInterval="Live"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coinSignals.map(({ coin, priority, signals }) => {
                    const hasSignal = signals.length > 0 && priority;

                    if (!hasSignal) {
                        // No signal detected for this coin
                        return (
                            <div
                                key={coin}
                                className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-white text-lg">{coin}</span>
                                    <span className="text-xs font-bold px-2 py-1 rounded bg-slate-500/10 text-slate-400">
                                        ⚪ NO SIGNAL
                                    </span>
                                </div>
                                <div className="text-sm text-slate-400">
                                    Markets in equilibrium
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    → No edge detected currently
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={coin}
                            className={`${priority.bg} ${priority.border} border rounded-lg p-3`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-lg">{coin}</span>
                                    <span className="text-lg">{priority.icon}</span>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded ${priority.bg} ${priority.color}`}>
                                    {priority.signal}
                                </span>
                            </div>

                            <div className="text-sm text-white mb-1">
                                {priority.description}
                            </div>

                            <div className={`text-xs ${priority.color} font-medium`}>
                                → {priority.implication}
                            </div>

                            {/* Show strength bar for divergence/absorption */}
                            {priority.strength && (
                                <div className="mt-2">
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                                        <span>Strength</span>
                                        <span className={priority.color}>{priority.strength}%</span>
                                    </div>
                                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${priority.type === 'bullish' ? 'bg-green-500' :
                                                priority.type === 'bearish' ? 'bg-red-500' : 'bg-yellow-500'
                                                }`}
                                            style={{ width: `${priority.strength}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Additional signals indicator */}
                            {signals.length > 1 && (
                                <div className="mt-2 pt-2 border-t border-slate-700/50">
                                    <div className="text-[10px] text-slate-400">
                                        +{signals.length - 1} more: {signals.slice(1).map(s => s.signal).join(', ')}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-3 text-[10px] text-white">
                Detects divergences, absorption, and OI patterns. Strong signals = higher reversal probability.
            </div>
        </div>
    );
};

export default FlowSignalsSection;
