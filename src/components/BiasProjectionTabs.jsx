import React, { useState } from 'react';
import BiasProjection from './BiasProjection';
import DailyBiasTab from './DailyBiasTab';

export default function BiasProjectionTabs({
  projection,
  dailyBias,
  projectionLoading = false,
  dailyBiasLoading = false
}) {
  const [activeTab, setActiveTab] = useState('8-12h');

  return (
    <div className="space-y-2">
      {/* Tab Switcher */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('8-12h')}
          className={`px-4 py-1.5 rounded text-xs font-semibold transition-all ${activeTab === '8-12h'
            ? 'bg-white dark:bg-slate-700 text-neutral-900 dark:text-white shadow-sm'
            : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          12Hr Bias
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-1.5 rounded text-xs font-semibold transition-all ${activeTab === 'daily'
            ? 'bg-white dark:bg-slate-700 text-neutral-900 dark:text-white shadow-sm'
            : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          Daily Bias
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'daily' ? (
        <DailyBiasTab
          dailyBias={dailyBias}
          loading={dailyBiasLoading}
        />
      ) : (
        <BiasProjection
          projection={projection}
          loading={projectionLoading}
        />
      )}
    </div>
  );
}
