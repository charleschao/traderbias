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
import InfoTooltip from './InfoTooltip';

// Load expanded state from localStorage
const loadExpandedState = () => {
  try {
    const saved = localStorage.getItem('biasCardExpanded');
    return saved ? JSON.parse(saved) : { BTC: false, ETH: false, SOL: false };
  } catch {
    return { BTC: false, ETH: false, SOL: false };
  }
};

// Minimal bias styling - just text color, no backgrounds
const getBiasStyle = (signal) => {
  if (signal === 'bullish') return 'text-green-600 dark:text-green-400';
  if (signal === 'bearish') return 'text-red-600 dark:text-red-400';
  return 'text-neutral-500 dark:text-slate-400';
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
  priceHistory = [],
  oiHistory = [],
  cvdHistory = [],
  biasHistory = [],
  timeframe = '5m',
  timeframeMinutes = 5,
  hasWhaleData: hasWhaleDataProp = true,
  projection = null
}) => {
  const hasWhaleData = biasData?.hasWhaleData ?? hasWhaleDataProp;
  const [isExpanded, setIsExpanded] = useState(() => loadExpandedState()[coin] || false);

  useEffect(() => {
    const current = loadExpandedState();
    current[coin] = isExpanded;
    localStorage.setItem('biasCardExpanded', JSON.stringify(current));
  }, [isExpanded, coin]);

  if (!biasData) return null;

  const getBookLabel = () => {
    const imb = orderbookData?.imbalance || 0;
    const avg = orderbookData?.avgImbalance || 0;
    if (imb > 20) return { text: 'Heavy Bids', color: 'text-green-600' };
    if (imb > 10) return { text: 'Bids Lean', color: 'text-green-600' };
    if (imb < -20) return { text: 'Heavy Asks', color: 'text-red-600' };
    if (imb < -10) return { text: 'Asks Lean', color: 'text-red-600' };
    if (imb > avg + 10) return { text: 'Bids Strengthening', color: 'text-green-600' };
    if (imb < avg - 10) return { text: 'Asks Strengthening', color: 'text-red-600' };
    return { text: 'Balanced', color: 'text-neutral-500' };
  };

  const getFundingLabel = () => {
    const rate = fundingData?.rate || 0;
    const apr = Math.abs(rate * 3 * 365 * 100);
    if (rate > 0.0005) return { text: `Crowded Longs (${apr.toFixed(0)}% APR)`, color: 'text-red-600' };
    if (rate > 0.0002) return { text: 'Bullish Bias', color: 'text-green-600' };
    if (rate < -0.0005) return { text: `Crowded Shorts (${apr.toFixed(0)}% APR)`, color: 'text-green-600' };
    if (rate < -0.0002) return { text: 'Bearish Bias', color: 'text-red-600' };
    return { text: 'Neutral', color: 'text-neutral-500' };
  };

  const book = getBookLabel();
  const funding = getFundingLabel();
  const confluence = calculateFlowConfluence(coin, oiData, cvdData, priceData);

  const signals = detectEdgeSignals(coin, oiData, cvdData, priceData);
  const prioritySignal = getPrioritySignal(signals);
  const hasEventAlert = signals.length > 0 && prioritySignal;

  const oiVelocity = calculateOIVelocity(oiData?.current, oiHistory, timeframeMinutes);
  const divergence = calculateDivergenceStrength(
    priceData?.timeframeChange || priceData?.sessionChange || 0,
    cvdData?.rolling5mDelta
  );

  const getDirectionColor = (value, threshold = 0) => {
    if (value > threshold) return 'text-green-600';
    if (value < -threshold) return 'text-red-600';
    return 'text-neutral-500';
  };

  const getWinRateBadge = () => {
    if (!projection?.historicalPerformance) return null;
    const { winRate, total, strongWinRate, strongTotal } = projection.historicalPerformance;
    if (total < 5) return null;
    const displayRate = strongTotal >= 3 ? strongWinRate : winRate;
    const displayTotal = strongTotal >= 3 ? strongTotal : total;
    let color = 'text-neutral-500';
    if (displayRate >= 60) color = 'text-green-600';
    else if (displayRate < 50) color = 'text-red-600';
    return { rate: displayRate, total: displayTotal, color };
  };

  const winRateBadge = getWinRateBadge();

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Get bias signal for styling
  const biasSignal = biasData.signal || 'neutral';

  return (
    <div className="bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl font-bold text-neutral-900 dark:text-white">{coin}</span>
        {priceData && (
          <span className="text-neutral-500 dark:text-slate-400 font-mono text-sm">
            ${formatPrice(priceData.markPx)}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm ${getBiasStyle(biasSignal)}`}>
            {biasData.label}
          </span>
          {winRateBadge && (
            <span className={`text-xs ${winRateBadge.color}`}>
              {winRateBadge.rate.toFixed(0)}%
            </span>
          )}
          <InfoTooltip position="bottom-left">
            <div className="space-y-2">
              <div className="font-bold text-neutral-900 dark:text-white text-sm">Composite Bias Score</div>
              <div className="text-neutral-600 dark:text-slate-300 text-xs">
                Combines Flow Confluence ({hasWhaleData ? '50%' : '71%'}),
                {hasWhaleData && ' Whale Consensus (30%),'} Orderbook ({hasWhaleData ? '10%' : '14%'}),
                Funding ({hasWhaleData ? '10%' : '14%'})
              </div>
              {biasData.components && (
                <div className="pt-2 mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-slate-400">Flow:</span>
                    <span className={getBiasStyle(biasData.components.flowConfluence?.signal)}>
                      {biasData.components.flowConfluence?.confluenceType?.replace('_', ' ') || '...'}
                    </span>
                  </div>
                  {hasWhaleData && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500 dark:text-slate-400">Whales:</span>
                      <span className={biasData.components.whaleBias?.score > 0 ? 'text-green-600 dark:text-green-400' : biasData.components.whaleBias?.score < 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-slate-400'}>
                        {biasData.components.whaleBias?.reason || '...'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-slate-400">Book:</span>
                    <span className={biasData.components.obBias?.score > 0 ? 'text-green-600 dark:text-green-400' : biasData.components.obBias?.score < 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-slate-400'}>
                      {biasData.components.obBias?.reason || '...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-slate-400">Funding:</span>
                    <span className={biasData.components.fundingBias?.score > 0 ? 'text-green-600 dark:text-green-400' : biasData.components.fundingBias?.score < 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-slate-400'}>
                      {biasData.components.fundingBias?.reason || '...'}
                    </span>
                  </div>
                </div>
              )}
              {winRateBadge && (
                <div className="pt-2 mt-2 text-xs text-neutral-600 dark:text-slate-300">
                  Win rate: <span className={winRateBadge.color}>{winRateBadge.rate.toFixed(0)}%</span> ({winRateBadge.total} predictions)
                </div>
              )}
            </div>
          </InfoTooltip>
        </div>
      </div>

      {/* Event Alert */}
      {hasEventAlert && (
        <div className={`mb-3 p-2 rounded border-l-4 ${prioritySignal.type === 'bullish' ? 'border-l-green-500' : prioritySignal.type === 'bearish' ? 'border-l-red-500' : 'border-l-neutral-400'} bg-white dark:bg-slate-800`}>
          <div className={`text-sm font-semibold ${prioritySignal.type === 'bullish' ? 'text-green-700 dark:text-green-400' : prioritySignal.type === 'bearish' ? 'text-red-700 dark:text-red-400' : 'text-neutral-700 dark:text-slate-300'}`}>
            {prioritySignal.signal}
          </div>
          <div className="text-xs text-neutral-600 dark:text-slate-300">{prioritySignal.description}</div>
          {prioritySignal.strength && (
            <div className="mt-1 h-1 bg-neutral-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${prioritySignal.type === 'bullish' ? 'bg-green-500' : prioritySignal.type === 'bearish' ? 'bg-red-500' : 'bg-neutral-400'}`}
                style={{ width: `${prioritySignal.strength}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-neutral-50 dark:bg-slate-700/50 rounded p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-neutral-500 dark:text-slate-400">OI</span>
            <Sparkline data={oiHistory} width={40} height={14} strokeWidth={1} />
          </div>
          <div className={`font-mono font-semibold ${(oiData?.oiDelta || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatUSD(oiData?.oiDelta || 0)}
          </div>
        </div>
        <div className="bg-neutral-50 dark:bg-slate-700/50 rounded p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-neutral-500 dark:text-slate-400">CVD</span>
            <Sparkline data={cvdHistory} width={40} height={14} strokeWidth={1} />
          </div>
          <div className={`font-mono font-semibold ${(cvdData?.rolling5mDelta || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatUSD(cvdData?.rolling5mDelta || 0)}
          </div>
        </div>
        <div className="bg-neutral-50 dark:bg-slate-700/50 rounded p-2">
          <span className="text-neutral-500 dark:text-slate-400 block mb-1">Flow</span>
          <span className={`font-semibold ${getBiasStyle(confluence.signal)}`}>
            {confluence.confluenceType.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {
        isExpanded && (
          <div className="mt-3 space-y-2 text-sm animate-fadeIn">
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500 dark:text-slate-400">Open Interest</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-neutral-900 dark:text-white">{formatUSD(oiData?.current || 0)}</span>
                <span className={`text-xs ${oiVelocity.color?.replace('400', '600').replace('lime', 'green').replace('orange', 'red').replace('slate', 'neutral') || 'text-neutral-500 dark:text-slate-400'}`}>
                  {oiVelocity.label}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500 dark:text-slate-400">Flow Confluence</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-neutral-400 dark:text-slate-500">
                  P{confluence.priceDir} OI{confluence.oiDir} CVD{confluence.cvdDir}
                </span>
                <span className={`font-semibold ${getBiasStyle(confluence.signal)}`}>
                  {confluence.confluenceType.replace('_', ' ')}
                </span>
              </div>
            </div>

            {divergence.label && divergence.strength > 20 && (
              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-500 dark:text-slate-400">Divergence</span>
                <span className="text-red-600 dark:text-red-400 font-semibold text-xs">{divergence.label}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500 dark:text-slate-400">Book</span>
              <span className={`font-semibold ${book.color}`}>{book.text}</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500 dark:text-slate-400">Funding</span>
              <span className={`font-semibold ${funding.color}`}>{funding.text}</span>
            </div>

            {hasWhaleData && biasData.components?.whaleBias?.reason && (
              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-500 dark:text-slate-400">Consensus</span>
                <span className="text-neutral-700 dark:text-slate-300 text-xs">{biasData.components.whaleBias.reason}</span>
              </div>
            )}
          </div>
        )
      }

      {/* Footer */}
      <div className="mt-3 pt-3 flex justify-between items-center">
        <button
          onClick={handleToggleExpand}
          className="text-xs text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          {isExpanded ? '− Less' : '+ More'}
        </button>
        <BiasHistoryBar history={biasHistory} label="15m" />
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(coin); }}
          className="text-xs text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          Details →
        </button>
      </div>
    </div >
  );
};

export default BiasCard;
