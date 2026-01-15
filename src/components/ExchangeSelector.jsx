import React from 'react';

const ExchangeSelector = ({ onTop10Click, showTop10 = false }) => (
  <button
    onClick={onTop10Click}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
      showTop10
        ? 'bg-neutral-900 dark:bg-slate-600 text-white'
        : 'bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
    }`}
    title="View Top 10 Hyperliquid Traders"
  >
    <span className="text-base">🏆</span>
    <span className="hidden sm:inline">Top 10 HL Traders</span>
    <span className="sm:hidden">Top 10</span>
  </button>
);

export default ExchangeSelector;
