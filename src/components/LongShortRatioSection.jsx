import React, { useState, useEffect } from 'react';
import { fetchLongShortRatio } from '../services/backendApi';

const formatPct = (value) => {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(1)}%`;
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '-';
  const now = new Date();
  const updated = new Date(timestamp);
  const diffMs = now - updated;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
};

const LongShortRatioSection = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchLongShortRatio();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Poll every 60s
    return () => clearInterval(interval);
  }, []);

  const renderRatioBar = (source, label) => {
    const sourceData = data?.[source];

    if (!sourceData) {
      return (
        <div className="mb-3">
          <div className="text-[10px] text-neutral-400 dark:text-slate-500 mb-1">{label}</div>
          <div className="flex h-6 rounded overflow-hidden bg-neutral-100 dark:bg-slate-700 items-center justify-center">
            <span className="text-[10px] text-neutral-400 dark:text-slate-500">
              {loading ? 'Loading...' : 'Unavailable'}
            </span>
          </div>
        </div>
      );
    }

    const longPct = sourceData.longPct;
    const shortPct = sourceData.shortPct;
    const dailyData = data?.daily?.[source];

    return (
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-neutral-700 dark:text-slate-300">{label}</span>
          <span className="text-[10px] text-neutral-400 dark:text-slate-500">
            {formatTimeAgo(sourceData.updatedAt)}
          </span>
        </div>
        <div className="flex h-6 rounded overflow-hidden bg-neutral-100 dark:bg-slate-700">
          <div
            className="bg-green-500 transition-all duration-500 flex items-center justify-start pl-2"
            style={{ width: `${longPct}%` }}
          >
            {longPct >= 20 && (
              <span className="text-xs text-white font-bold">{formatPct(longPct)} LONG</span>
            )}
          </div>
          <div
            className="bg-red-500 transition-all duration-500 flex items-center justify-end pr-2"
            style={{ width: `${shortPct}%` }}
          >
            {shortPct >= 20 && (
              <span className="text-xs text-white font-bold">SHORT {formatPct(shortPct)}</span>
            )}
          </div>
        </div>
        {dailyData && (
          <div className="text-[10px] text-neutral-400 dark:text-slate-500 mt-1">
            Day range: {formatPct(dailyData.lowLongPct)} - {formatPct(dailyData.highLongPct)} long
          </div>
        )}
      </div>
    );
  };

  const renderDivergence = () => {
    const divergence = data?.divergence;
    if (!divergence) return null;

    const isAligned = divergence.signal === 'ALIGNED';
    const diff = divergence.pctDiff;

    // Determine which side is more bullish
    let description;
    if (Math.abs(diff) < 1) {
      description = 'Both sources show similar positioning';
    } else if (diff > 0) {
      description = `Retail more bullish than top traders (+${diff.toFixed(1)}%)`;
    } else {
      description = `Top traders more bullish than retail (${diff.toFixed(1)}%)`;
    }

    return (
      <div className={`mt-3 p-2 rounded text-center text-xs ${
        isAligned
          ? 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-300'
          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
      }`}>
        <span className="font-semibold">{divergence.signal}</span>
        <span className="mx-2">-</span>
        <span>{description}</span>
      </div>
    );
  };

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">LONG/SHORT POSITIONING (BTC)</span>
        </div>
        <div className="text-center text-red-500 text-sm py-4">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-neutral-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">LONG/SHORT POSITIONING (BTC)</span>
        <span className="text-xs text-neutral-400 dark:text-slate-500">
          Resets midnight UTC
        </span>
      </div>

      {renderRatioBar('allAccounts', 'All Accounts (Retail)')}
      {renderRatioBar('topTraders', 'Top Traders (Smart Money)')}
      {renderDivergence()}
    </div>
  );
};

export default LongShortRatioSection;
