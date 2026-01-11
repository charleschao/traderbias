import React from 'react';
import { formatUSD, formatPrice } from '../utils/formatters';
import { estimateLiquidationPrice, liquidationDistance } from '../utils/helpers';

const PositionCard = ({ position, marketData }) => {
    const isLong = position.size > 0;
    const pnlPositive = position.unrealizedPnl >= 0;
    const currentPrice = marketData?.[position.coin]?.markPx || position.entryPx;
    const liqPrice = estimateLiquidationPrice(position.entryPx, position.leverage, isLong);
    const liqDist = liquidationDistance(currentPrice, liqPrice, isLong);

    return (
        <div className="bg-neutral-50 dark:bg-slate-800/50 rounded-lg p-3 border border-neutral-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {isLong ? 'LONG' : 'SHORT'}
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-white">{position.coin}</span>
                    <span className="text-cyan-400 text-sm">{position.leverage}x</span>
                </div>
                <span className="text-neutral-500 dark:text-slate-300 text-xs">#{position.rank}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                    <div className="text-neutral-500 dark:text-slate-300">Notional</div>
                    <div className="text-neutral-900 dark:text-white font-mono">{formatUSD(position.notional)}</div>
                </div>
                <div>
                    <div className="text-neutral-500 dark:text-slate-300">Entry</div>
                    <div className="text-neutral-900 dark:text-white font-mono">${formatPrice(position.entryPx)}</div>
                </div>
                <div>
                    <div className="text-neutral-500 dark:text-slate-300">uPNL</div>
                    <div className={`font-mono font-bold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {formatUSD(position.unrealizedPnl)}
                    </div>
                </div>
                <div>
                    <div className="text-neutral-500 dark:text-slate-300">Liq Dist</div>
                    <div className={`font-mono ${liqDist > 20 ? 'text-green-400' : liqDist > 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {liqDist.toFixed(1)}%
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PositionCard;
