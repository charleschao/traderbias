import React from 'react';
import SectionBiasHeader from './SectionBiasHeader';
import { calculateFundingBias, getBiasIndicator } from '../utils/biasCalculations';

const FundingRatesSection = ({ fundingData }) => {
    const coins = ['BTC', 'ETH', 'SOL'];

    return (
        <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <SectionBiasHeader
                title="FUNDING RATES"
                icon="💰"
                updateInterval="5min (8h rate, settles hourly)"
            />
            <div className="grid grid-cols-3 gap-3">
                {coins.map(coin => {
                    const fr = fundingData?.[coin];
                    const bias = calculateFundingBias(coin, fr);
                    const indicator = getBiasIndicator(bias.score, 6);
                    const rate = fr?.rate || 0;
                    const annualized = rate * 3 * 365 * 100;

                    return (
                        <div key={coin} className="bg-slate-800/50 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-white text-sm">{coin}</span>
                                <span className={`text-[10px] font-bold ${indicator.color}`}>{indicator.label}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={`font-mono text-xs font-bold ${rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {rate >= 0 ? '+' : ''}{(rate * 100).toFixed(4)}%
                                </span>
                                <span className={`font-mono text-[10px] ${annualized >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                    {annualized >= 0 ? '+' : ''}{annualized.toFixed(0)}% APR
                                </span>
                            </div>
                            {fr?.trend !== undefined && (
                                <div className="text-[10px] text-slate-300 mt-1">
                                    Trend: {fr.trend > 0 ? '↑ Rising' : fr.trend < 0 ? '↓ Falling' : '→ Stable'}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
                Extreme funding = crowded trade = contrarian signal. 8h rate paid hourly (1/8 each hour).
            </div>
        </div>
    );
};

export default FundingRatesSection;
