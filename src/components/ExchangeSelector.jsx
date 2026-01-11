import React from 'react';
import { EXCHANGE_LIST } from '../config/exchanges';

const ExchangeSelector = ({ activeExchange, onExchangeChange, onTop10Click, showTop10 = false }) => (
  <div className="flex items-center gap-1 bg-neutral-100 dark:bg-slate-800 rounded-lg p-1">
    {EXCHANGE_LIST.map(exchange => {
      const isActive = activeExchange === exchange.id;
      const isHyperliquid = exchange.id === 'hyperliquid';

      if (isHyperliquid) {
        return (
          <div key={exchange.id} className="flex flex-col">
            <button
              onClick={() => { onExchangeChange(exchange.id); if (showTop10 && onTop10Click) onTop10Click(); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg font-semibold text-sm transition-all ${isActive && !showTop10 ? 'bg-neutral-900 dark:bg-slate-600 text-white' : isActive ? 'bg-neutral-700 dark:bg-slate-700 text-white' : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'}`}
              title={exchange.description}
            >
              <span className="hidden sm:inline">{exchange.name}</span>
              <span className="sm:hidden">{exchange.shortName}</span>
            </button>
            {isActive && (
              <button
                onClick={onTop10Click}
                className={`text-[10px] font-semibold px-3 py-1 rounded-b-lg transition-all ${showTop10 ? 'bg-neutral-900 dark:bg-slate-600 text-white' : 'bg-neutral-200 dark:bg-slate-700 text-neutral-600 dark:text-slate-300 hover:bg-neutral-300 dark:hover:bg-slate-600'}`}
              >
                Top 10 Traders
              </button>
            )}
          </div>
        );
      }

      return (
        <button
          key={exchange.id}
          onClick={() => onExchangeChange(exchange.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${isActive ? 'bg-neutral-900 dark:bg-slate-600 text-white' : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'}`}
          title={exchange.description}
        >
          <span className="hidden sm:inline">{exchange.name}</span>
          <span className="sm:hidden">{exchange.shortName}</span>
          {exchange.status !== 'active' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-slate-700 text-neutral-500 dark:text-slate-400">
              {exchange.status === 'api_required' ? 'API' : 'Soon'}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default ExchangeSelector;
