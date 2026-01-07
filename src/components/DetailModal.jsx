import React from 'react';
import { formatUSD, formatPrice, formatAddress, getProfileUrl } from '../utils/formatters';
import { calculateFlowConfluence } from '../utils/biasCalculations';
import SignalWinRates from './SignalWinRates';

const DetailModal = ({ coin, biasData, priceData, oiData, orderbookData, cvdData, fundingData, consensus, winRates, onClose }) => {
    if (!coin || !biasData) return null;

    const cons = consensus?.[coin];

    // Calculate actual data labels
    const oiChange = oiData?.sessionChange || 0;
    const priceChange = priceData?.sessionChange || 0;
    const imbalance = orderbookData?.imbalance || 0;
    const rate = fundingData?.rate || 0;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-4xl font-black text-white">{coin}</span>
                        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">✕</button>
                    </div>

                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xl mb-6 ${biasData.bg}`}>
                        <span className="text-2xl">{biasData.icon}</span>
                        <span className={biasData.color}>{biasData.label}</span>
                    </div>

                    {/* MARKET DATA SECTION */}
                    <div className="mb-6">
                        <h4 className="text-sm font-bold text-white mb-3">📊 MARKET DATA</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="bg-slate-800/50 rounded-lg p-3">
                                <div className="text-xs text-white">Open Interest</div>
                                <div className="text-lg font-mono text-white">{formatUSD(oiData?.current || 0)}</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3">
                                <div className="text-xs text-white">OI Change</div>
                                <div className={`text-lg font-mono font-bold ${oiChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {oiChange >= 0 ? '+' : ''}{oiChange.toFixed(2)}%
                                </div>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3">
                                <div className="text-xs text-white">Book Imbalance</div>
                                <div className={`text-lg font-mono font-bold ${imbalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {imbalance >= 0 ? '+' : ''}{imbalance.toFixed(1)}%
                                </div>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3">
                                <div className="text-xs text-white">Funding Rate</div>
                                <div className={`text-lg font-mono font-bold ${rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(rate * 100).toFixed(4)}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SIGNAL ANALYSIS */}
                    <div className="mb-6">
                        <h4 className="text-sm font-bold text-white mb-3">🎯 SIGNAL ANALYSIS</h4>
                        <div className="space-y-2">
                            {/* Flow Confluence - Combined OI + CVD + Price */}
                            {(() => {
                                const conf = calculateFlowConfluence(coin, oiData, cvdData, priceData);
                                const bgColor = conf.signal === 'bullish' ? 'bg-green-500/10' :
                                    conf.signal === 'bearish' ? 'bg-red-500/10' : 'bg-slate-800/50';
                                return (
                                    <div className={`rounded-lg p-3 border border-slate-700/50 ${bgColor}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-white">Flow Confluence</span>
                                            <span className={`font-bold ${conf.signal === 'bullish' ? 'text-green-400' :
                                                conf.signal === 'bearish' ? 'text-red-400' : 'text-slate-400'
                                                }`}>
                                                {{
                                                    'STRONG_BULL': '🟢', 'BULLISH': '🟢', 'WEAK_BULL': '🟡',
                                                    'STRONG_BEAR': '🔴', 'BEARISH': '🔴', 'WEAK_BEAR': '🟡',
                                                    'DIVERGENCE': '⚠️', 'NEUTRAL': '⚪'
                                                }[conf.confluenceType] || '⚪'} {conf.confluenceType.replace('_', ' ')}
                                            </span>
                                        </div>
                                        {/* Direction Arrows */}
                                        <div className="grid grid-cols-3 gap-2 text-center mb-2 bg-slate-900/50 rounded-lg p-2">
                                            <div>
                                                <div className="text-white text-[10px]">PRICE</div>
                                                <div className={`text-lg font-bold ${conf.priceDir === '↑' ? 'text-green-400' : conf.priceDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {conf.priceDir}
                                                </div>
                                                <div className={`text-[10px] font-mono ${(conf.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {(conf.priceChange || 0) >= 0 ? '+' : ''}{(conf.priceChange || 0).toFixed(2)}%
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-white text-[10px]">OI</div>
                                                <div className={`text-lg font-bold ${conf.oiDir === '↑' ? 'text-green-400' : conf.oiDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {conf.oiDir}
                                                </div>
                                                <div className={`text-[10px] font-mono ${(conf.oiChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {(conf.oiChange || 0) >= 0 ? '+' : ''}{(conf.oiChange || 0).toFixed(1)}%
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-white text-[10px]">CVD</div>
                                                <div className={`text-lg font-bold ${conf.cvdDir === '↑' ? 'text-green-400' : conf.cvdDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {conf.cvdDir}
                                                </div>
                                                <div className={`text-[10px] font-mono ${(conf.cvdDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatUSD(conf.cvdDelta || 0)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-sm text-white">{conf.reason}</div>
                                        {conf.divergence && (
                                            <div className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
                                                ⚠️ {conf.divergence.message}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Orderbook Analysis */}
                            <div className={`rounded-lg p-3 border border-slate-700/50 ${imbalance > 15 ? 'bg-green-500/10' : imbalance < -15 ? 'bg-red-500/10' : 'bg-slate-800/50'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-white">Orderbook</span>
                                    <span className={`font-bold ${imbalance > 10 ? 'text-green-400' : imbalance < -10 ? 'text-red-400' : 'text-slate-400'}`}>
                                        {imbalance > 20 ? '📗 HEAVY BIDS' :
                                            imbalance > 10 ? '📗 Bids Lean' :
                                                imbalance < -20 ? '📕 HEAVY ASKS' :
                                                    imbalance < -10 ? '📕 Asks Lean' : '⚖️ Balanced'}
                                    </span>
                                </div>
                                <div className="text-sm text-white">
                                    Bid/Ask imbalance: {imbalance >= 0 ? '+' : ''}{imbalance.toFixed(1)}% | Bid Vol: {formatUSD(orderbookData?.bidVolume || 0)} | Ask Vol: {formatUSD(orderbookData?.askVolume || 0)}
                                </div>
                            </div>

                            {/* Funding Analysis */}
                            <div className={`rounded-lg p-3 border border-slate-700/50 ${Math.abs(rate) > 0.0005 ? (rate > 0 ? 'bg-red-500/10' : 'bg-green-500/10') : 'bg-slate-800/50'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-white">Funding</span>
                                    <span className={`font-bold ${rate > 0.0005 ? 'text-red-400' : rate < -0.0005 ? 'text-green-400' : rate > 0 ? 'text-green-400' : rate < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                        {rate > 0.0005 ? '⚠️ CROWDED LONGS' :
                                            rate < -0.0005 ? '⚠️ CROWDED SHORTS' :
                                                rate > 0.0002 ? 'Bullish Bias' :
                                                    rate < -0.0002 ? 'Bearish Bias' : 'Neutral'}
                                    </span>
                                </div>
                                <div className="text-sm text-white">
                                    Rate: {(rate * 100).toFixed(4)}% per 8h | APR: {(rate * 3 * 365 * 100).toFixed(1)}% | {rate > 0 ? 'Longs pay shorts' : rate < 0 ? 'Shorts pay longs' : 'Neutral'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* WHALE POSITIONS */}
                    {cons && (cons.longs.length > 0 || cons.shorts.length > 0) && (
                        <div>
                            <h4 className="text-sm font-bold text-white mb-3">🐋 TOP 10 TRADER POSITIONS</h4>
                            <div className="bg-slate-800/30 rounded-lg p-3 mb-3">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-green-400">{cons.longs.length}</div>
                                        <div className="text-xs text-white">Longs</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">{formatUSD(cons.totalNotional || 0)}</div>
                                        <div className="text-xs text-white">Total Notional</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-red-400">{cons.shorts.length}</div>
                                        <div className="text-xs text-white">Shorts</div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-green-400 text-sm font-bold mb-2">LONGS ({cons.longs.length})</div>
                                    {cons.longs.slice(0, 5).map((p, i) => (
                                        <div key={i} className="text-xs flex justify-between py-1 border-b border-slate-800">
                                            <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                                                #{p.rank} {formatAddress(p.trader)} {p.isConsistent && '⭐'}
                                            </a>
                                            <span className="text-white">{formatUSD(p.notional)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div className="text-red-400 text-sm font-bold mb-2">SHORTS ({cons.shorts.length})</div>
                                    {cons.shorts.slice(0, 5).map((p, i) => (
                                        <div key={i} className="text-xs flex justify-between py-1 border-b border-slate-800">
                                            <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                                                #{p.rank} {formatAddress(p.trader)} {p.isConsistent && '⭐'}
                                            </a>
                                            <span className="text-white">{formatUSD(p.notional)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SIGNAL WIN RATES */}
                    <SignalWinRates coin={coin} winRates={winRates} />
                </div>
            </div>
        </div>
    );
};

export default DetailModal;
