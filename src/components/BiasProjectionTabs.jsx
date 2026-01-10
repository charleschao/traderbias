import React, { useState } from 'react';
import BiasProjection from './BiasProjection';
import DailyBiasTab from './DailyBiasTab';

/**
 * BiasProjectionTabs Component
 *
 * Tab container for switching between 8-12H Outlook and Daily Bias views
 * Allows traders to choose their preferred timeframe
 */
export default function BiasProjectionTabs({
    projection,
    dailyBias,
    projectionLoading = false,
    dailyBiasLoading = false
}) {
    const [activeTab, setActiveTab] = useState('daily'); // Default to daily for day traders

    return (
        <div className="space-y-2">
            {/* Tab Switcher */}
            <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'daily'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                        }`}
                >
                    🌅 Daily Bias
                </button>
                <button
                    onClick={() => setActiveTab('8-12h')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === '8-12h'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                        }`}
                >
                    📊 12Hr Outlook
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
