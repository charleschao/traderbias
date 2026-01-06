import React from 'react';
import { EXCHANGE_LIST } from '../config/exchanges';

const ExchangeSelector = ({ activeExchange, onExchangeChange }) => (
    <div className="flex items-center gap-1 bg-slate-800/50 rounded-xl p-1">
        {EXCHANGE_LIST.map(exchange => {
            const isActive = activeExchange === exchange.id;
            const colorClasses = {
                cyan: isActive ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-cyan-400',
                purple: isActive ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-slate-400 hover:text-purple-400',
                violet: isActive ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'text-slate-400 hover:text-violet-400',
                yellow: isActive ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20' : 'text-slate-400 hover:text-yellow-400',
                orange: isActive ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:text-orange-400',
                amber: isActive ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-amber-400',
            };

            return (
                <button
                    key={exchange.id}
                    onClick={() => onExchangeChange(exchange.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm transition-all ${colorClasses[exchange.color] || colorClasses.cyan}`}
                    title={exchange.description}
                >
                    <span className="text-lg">{exchange.icon}</span>
                    <span className="hidden sm:inline">{exchange.name}</span>
                    <span className="sm:hidden">{exchange.shortName}</span>
                    {exchange.status !== 'active' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                            {exchange.status === 'api_required' ? 'API' : 'Soon'}
                        </span>
                    )}
                </button>
            );
        })}
    </div>
);

export default ExchangeSelector;
