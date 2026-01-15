import React, { useState, useEffect } from 'react';
import BiasProjection from './BiasProjection';
import DailyBiasTab from './DailyBiasTab';
import FourHrBiasTab from './FourHrBiasTab';

export default function BiasProjectionTabs({
  projection,
  dailyBias,
  fourHrBias,
  projectionLoading = false,
  dailyBiasLoading = false,
  fourHrBiasLoading = false,
  coin = 'BTC'
}) {
  const [activeTab, setActiveTab] = useState('8-12h');
  const show4Hr = coin === 'BTC';

  // Auto-switch to 12hr if on 4hr tab and coin changes from BTC
  useEffect(() => {
    if (!show4Hr && activeTab === '4hr') {
      setActiveTab('8-12h');
    }
  }, [show4Hr, activeTab]);

  return (
    <div className="space-y-2">
      {/* Tab Switcher */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {show4Hr && (
          <button
            onClick={() => setActiveTab('4hr')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition-all ${activeTab === '4hr'
              ? 'bg-white dark:bg-slate-700 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            4hr Bias
          </button>
        )}
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
      {activeTab === '4hr' && show4Hr ? (
        <FourHrBiasTab
          fourHrBias={fourHrBias}
          loading={fourHrBiasLoading}
        />
      ) : activeTab === 'daily' ? (
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
