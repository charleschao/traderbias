import React from 'react';
import { formatUSD, formatPrice, formatAddress, getProfileUrl } from '../utils/formatters';
import { calculateFlowConfluence } from '../utils/biasCalculations';
import SignalWinRates from './SignalWinRates';

const DetailModal = ({ coin, biasData, priceData, oiData, orderbookData, cvdData, fundingData, consensus, winRates, onClose }) => {
  if (!coin || !biasData) return null;

  const cons = consensus?.[coin];
  const oiChange = oiData?.sessionChange || 0;
  const imbalance = orderbookData?.imbalance || 0;
  const rate = fundingData?.rate || 0;

  const getBiasColor = (signal) => {
    if (signal === 'bullish') return 'text-green-600 dark:text-green-400';
    if (signal === 'bearish') return 'text-red-600 dark:text-red-400';
    return 'text-neutral-500 dark:text-slate-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-3xl font-bold text-neutral-900 dark:text-white">{coin}</span>
            <button onClick={onClose} className="text-neutral-400 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white text-xl">×</button>
          </div>

          {/* Bias Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded font-semibold mb-6 ${biasData.signal === 'bullish' ? 'text-green-600 dark:text-green-400' : biasData.signal === 'bearish' ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-slate-400'}`}>
            {biasData.label}
          </div>

          {/* Market Data */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">MARKET DATA</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-neutral-200 dark:border-slate-600 rounded-lg p-3">
                <div className="text-xs text-neutral-500 dark:text-slate-400">Open Interest</div>
                <div className="text-lg font-mono text-neutral-900 dark:text-white">{formatUSD(oiData?.current || 0)}</div>
              </div>
              <div className="border border-neutral-200 dark:border-slate-600 rounded-lg p-3">
                <div className="text-xs text-neutral-500 dark:text-slate-400">OI Change</div>
                <div className={`text-lg font-mono font-semibold ${oiChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {oiChange >= 0 ? '+' : ''}{oiChange.toFixed(2)}%
                </div>
              </div>
              <div className="border border-neutral-200 dark:border-slate-600 rounded-lg p-3">
                <div className="text-xs text-neutral-500 dark:text-slate-400">Book Imbalance</div>
                <div className={`text-lg font-mono font-semibold ${imbalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {imbalance >= 0 ? '+' : ''}{imbalance.toFixed(1)}%
                </div>
              </div>
              <div className="border border-neutral-200 dark:border-slate-600 rounded-lg p-3">
                <div className="text-xs text-neutral-500 dark:text-slate-400">Funding Rate</div>
                <div className={`text-lg font-mono font-semibold ${rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(rate * 100).toFixed(4)}%
                </div>
              </div>
            </div>
          </div>

          {/* Signal Analysis */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">SIGNAL ANALYSIS</h4>
            <div className="space-y-3">
              {/* Flow Confluence */}
              {(() => {
                const conf = calculateFlowConfluence(coin, oiData, cvdData, priceData);
                return (
                  <div className="rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-neutral-900 dark:text-white">Flow Confluence</span>
                      <span className={`font-semibold ${getBiasColor(conf.signal)}`}>
                        {conf.confluenceType.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-2 bg-neutral-50 dark:bg-slate-700 rounded-lg p-2">
                      <div>
                        <div className="text-neutral-500 dark:text-slate-400 text-[10px]">PRICE</div>
                        <div className={`text-lg font-bold ${conf.priceDir === '↑' ? 'text-green-600' : conf.priceDir === '↓' ? 'text-red-600' : 'text-neutral-400'}`}>
                          {conf.priceDir === '↑' ? '↗' : conf.priceDir === '↓' ? '↘' : '↔'}
                        </div>
                      </div>
                      <div>
                        <div className="text-neutral-500 dark:text-slate-400 text-[10px]">OI</div>
                        <div className={`text-lg font-bold ${conf.oiDir === '↑' ? 'text-green-600' : conf.oiDir === '↓' ? 'text-red-600' : 'text-neutral-400'}`}>
                          {conf.oiDir === '↑' ? '↗' : conf.oiDir === '↓' ? '↘' : '↔'}
                        </div>
                      </div>
                      <div>
                        <div className="text-neutral-500 dark:text-slate-400 text-[10px]">CVD</div>
                        <div className={`text-lg font-bold ${conf.cvdDir === '↑' ? 'text-green-600' : conf.cvdDir === '↓' ? 'text-red-600' : 'text-neutral-400'}`}>
                          {conf.cvdDir === '↑' ? '↗' : conf.cvdDir === '↓' ? '↘' : '↔'}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-slate-300">{conf.reason}</div>
                    {conf.divergence && (
                      <div className="mt-2 text-xs text-red-600 border border-red-200 rounded px-2 py-1">
                        {conf.divergence.message}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Orderbook */}
              <div className="rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-neutral-900 dark:text-white">Orderbook</span>
                  <span className={`font-semibold ${imbalance > 10 ? 'text-green-600' : imbalance < -10 ? 'text-red-600' : 'text-neutral-500'}`}>
                    {imbalance > 20 ? 'Heavy Bids' : imbalance > 10 ? 'Bids Lean' : imbalance < -20 ? 'Heavy Asks' : imbalance < -10 ? 'Asks Lean' : 'Balanced'}
                  </span>
                </div>
                <div className="text-sm text-neutral-600 dark:text-slate-300">
                  Imbalance: {imbalance >= 0 ? '+' : ''}{imbalance.toFixed(1)}% | Bid: {formatUSD(orderbookData?.bidVolume || 0)} | Ask: {formatUSD(orderbookData?.askVolume || 0)}
                </div>
              </div>

              {/* Funding */}
              <div className="rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-neutral-900 dark:text-white">Funding</span>
                  <span className={`font-semibold ${rate > 0.0005 ? 'text-red-600' : rate < -0.0005 ? 'text-green-600' : 'text-neutral-500'}`}>
                    {rate > 0.0005 ? 'Crowded Longs' : rate < -0.0005 ? 'Crowded Shorts' : rate > 0.0002 ? 'Bullish' : rate < -0.0002 ? 'Bearish' : 'Neutral'}
                  </span>
                </div>
                <div className="text-sm text-neutral-600 dark:text-slate-300">
                  Rate: {(rate * 100).toFixed(4)}% | APR: {(rate * 3 * 365 * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Whale Positions */}
          {cons && (cons.longs.length > 0 || cons.shorts.length > 0) && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">TOP 10 POSITIONS</h4>
              <div className="border border-neutral-200 dark:border-slate-600 rounded-lg p-3 mb-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{cons.longs.length}</div>
                    <div className="text-xs text-neutral-500 dark:text-slate-400">Longs</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white">{formatUSD(cons.totalNotional || 0)}</div>
                    <div className="text-xs text-neutral-500 dark:text-slate-400">Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{cons.shorts.length}</div>
                    <div className="text-xs text-neutral-500 dark:text-slate-400">Shorts</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-green-600 text-sm font-semibold mb-2">Longs ({cons.longs.length})</div>
                  {cons.longs.slice(0, 5).map((p, i) => (
                    <div key={i} className="text-xs flex justify-between py-1">
                      <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white hover:underline">
                        #{p.rank} {formatAddress(p.trader)} {p.isConsistent && '*'}
                      </a>
                      <span className="text-neutral-900 dark:text-white font-mono">{formatUSD(p.notional)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-red-600 text-sm font-semibold mb-2">Shorts ({cons.shorts.length})</div>
                  {cons.shorts.slice(0, 5).map((p, i) => (
                    <div key={i} className="text-xs flex justify-between py-1">
                      <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white hover:underline">
                        #{p.rank} {formatAddress(p.trader)} {p.isConsistent && '*'}
                      </a>
                      <span className="text-neutral-900 dark:text-white font-mono">{formatUSD(p.notional)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <SignalWinRates coin={coin} winRates={winRates} />
        </div>
      </div>
    </div>
  );
};

export default DetailModal;
