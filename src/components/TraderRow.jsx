import React from 'react';
import { formatUSD, formatPercent, formatAddress, getProfileUrl } from '../utils/formatters';

const TraderRow = ({ trader, rank, isSelected, onClick }) => {
    const isConsistent = trader.weekRoi > 0 && trader.monthRoi > 0 && trader.allTimeRoi > 0;

    return (
        <tr className={`border-b border-slate-700/50 cursor-pointer transition-colors ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'}`} onClick={onClick}>
            <td className="py-3 px-3 text-center">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                    rank === 2 ? 'bg-slate-400/20 text-slate-300' :
                        rank === 3 ? 'bg-amber-600/20 text-amber-500' :
                            'bg-slate-700/50 text-slate-400'
                    }`}>{rank}</span>
            </td>
            <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                    <a href={getProfileUrl(trader.address)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="text-cyan-400 hover:text-cyan-300 font-mono text-sm hover:underline">
                        {formatAddress(trader.address)}
                    </a>
                    {isConsistent && <span className="text-purple-400" title="Consistent Winner">⭐</span>}
                </div>
            </td>
            <td className="py-3 px-3 text-right font-mono text-white text-sm">{formatUSD(trader.accountValue)}</td>
            <td className={`py-3 px-3 text-right font-mono font-bold text-sm ${trader.weekPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatUSD(trader.weekPnl)}</td>
            <td className={`py-3 px-3 text-right font-mono text-sm ${trader.weekRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(trader.weekRoi)}</td>
            <td className={`py-3 px-3 text-right font-mono text-sm ${trader.monthRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(trader.monthRoi)}</td>
            <td className={`py-3 px-3 text-right font-mono text-sm ${trader.allTimeRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(trader.allTimeRoi)}</td>
            <td className="py-3 px-3 text-center text-slate-300 text-sm">{trader.positionCount || '-'}</td>
        </tr>
    );
};

export default TraderRow;
