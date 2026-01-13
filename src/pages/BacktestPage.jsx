import React, { useState, useEffect, useCallback } from 'react';
import {
  getBacktestStats,
  getBacktestPredictions,
  getBacktestEquityCurve,
  getBacktestStreaks
} from '../services/backendApi.js';

// ============== MAIN PAGE ==============

const getDefaultFilters = () => {
  const now = Date.now();
  return {
    coin: '',
    type: '',
    from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date(now).toISOString().split('T')[0]
  };
};

const BacktestPage = () => {
  const [filters, setFilters] = useState(getDefaultFilters);
  const [stats, setStats] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [equityCurve, setEquityCurve] = useState([]);
  const [streaks, setStreaks] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [statsData, predsData, curveData, streaksData] = await Promise.all([
      getBacktestStats(filters),
      getBacktestPredictions({ ...filters, limit: 100 }),
      getBacktestEquityCurve(filters),
      getBacktestStreaks(filters)
    ]);
    setStats(statsData);
    setPredictions(predsData?.predictions || []);
    setEquityCurve(curveData?.curve || []);
    setStreaks(streaksData);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Backtest Analytics</h1>
          <p className="text-slate-400">Prediction accuracy analysis</p>
        </header>

        <FilterBar filters={filters} setFilters={setFilters} />

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <div className="space-y-6">
            <WinRateDashboard stats={stats} streaks={streaks} />
            <EquityCurveChart curve={equityCurve} />
            <PredictionTable predictions={predictions} />
          </div>
        )}
      </div>
    </div>
  );
};

// ============== FILTER BAR ==============

const FilterBar = ({ filters, setFilters }) => {
  const handleChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-slate-900 rounded-lg p-4 mb-6 border border-slate-700">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Coin</label>
          <select
            value={filters.coin}
            onChange={(e) => handleChange('coin', e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
          >
            <option value="">All</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="SOL">SOL</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Type</label>
          <select
            value={filters.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
          >
            <option value="">All</option>
            <option value="12hr">12hr</option>
            <option value="daily">Daily</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">From</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => handleChange('from', e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">To</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => handleChange('to', e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
          />
        </div>
      </div>
    </div>
  );
};

// ============== WIN RATE DASHBOARD ==============

const WinRateDashboard = ({ stats, streaks }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Overall Win Rate"
        value={`${stats.overall?.winRate || 0}%`}
        subtitle={`${stats.overall?.correct || 0} / ${stats.overall?.total || 0} predictions`}
        color={parseFloat(stats.overall?.winRate || 0) >= 50 ? 'green' : 'red'}
      />
      <StatCard
        title="Current Streak"
        value={`${streaks?.currentStreak?.count || 0} ${streaks?.currentStreak?.type || ''}`}
        subtitle={`Longest: ${streaks?.longestWin || 0}W / ${streaks?.longestLoss || 0}L`}
        color={streaks?.currentStreak?.type === 'win' ? 'green' : 'red'}
      />
      <StatCard
        title="12hr Predictions"
        value={`${stats.byType?.['12hr']?.winRate || 0}%`}
        subtitle={`${stats.byType?.['12hr']?.total || 0} total`}
        color="blue"
      />
      <StatCard
        title="Daily Predictions"
        value={`${stats.byType?.daily?.winRate || 0}%`}
        subtitle={`${stats.byType?.daily?.total || 0} total`}
        color="purple"
      />

      {/* Breakdown by strength */}
      <div className="col-span-full">
        <h3 className="text-lg font-semibold mb-3">By Signal Strength</h3>
        <div className="grid grid-cols-3 gap-4">
          {['STRONG', 'MODERATE', 'WEAK'].map(strength => (
            <div key={strength} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-400">{strength}</div>
              <div className="text-2xl font-bold">{stats.byStrength?.[strength]?.winRate || 0}%</div>
              <div className="text-xs text-slate-500">{stats.byStrength?.[strength]?.total || 0} predictions</div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown by coin */}
      <div className="col-span-full">
        <h3 className="text-lg font-semibold mb-3">By Coin</h3>
        <div className="grid grid-cols-3 gap-4">
          {['BTC', 'ETH', 'SOL'].map(coin => (
            <div key={coin} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-400">{coin}</div>
              <div className="text-2xl font-bold">{stats.byCoin?.[coin]?.winRate || 0}%</div>
              <div className="text-xs text-slate-500">{stats.byCoin?.[coin]?.total || 0} predictions</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, color = 'blue' }) => {
  const colors = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400'
  };

  return (
    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
      <div className="text-sm text-slate-400">{title}</div>
      <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </div>
  );
};

// ============== EQUITY CURVE CHART ==============

const EquityCurveChart = ({ curve }) => {
  if (!curve || curve.length < 2) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Equity Curve</h3>
        <p className="text-slate-400">Not enough data for equity curve</p>
      </div>
    );
  }

  const width = 800;
  const height = 200;
  const padding = 40;

  const equityValues = curve.map(p => p.equity);
  const maxEquity = Math.max(...equityValues);
  const minEquity = Math.min(...equityValues);
  const range = maxEquity - minEquity || 1;

  const points = curve.map((point, index) => {
    const x = padding + (index / (curve.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((point.equity - minEquity) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const initialEquity = curve[0].equity;
  const finalEquity = curve[curve.length - 1].equity;
  const totalReturn = ((finalEquity - initialEquity) / initialEquity) * 100;

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Equity Curve</h3>
        <div className={`text-lg font-bold ${totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
        </div>
      </div>
      <svg width={width} height={height} className="w-full h-auto" viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(i => (
          <line
            key={i}
            x1={padding}
            y1={padding + i * (height - 2 * padding)}
            x2={width - padding}
            y2={padding + i * (height - 2 * padding)}
            stroke="#334155"
            strokeWidth="1"
          />
        ))}
        {/* Equity line */}
        <polyline
          points={points}
          fill="none"
          stroke={totalReturn >= 0 ? '#10b981' : '#ef4444'}
          strokeWidth="2"
        />
        {/* Start/end points */}
        <circle cx={padding} cy={height - padding - ((initialEquity - minEquity) / range) * (height - 2 * padding)} r="4" fill="#3b82f6" />
        <circle cx={width - padding} cy={height - padding - ((finalEquity - minEquity) / range) * (height - 2 * padding)} r="4" fill="#3b82f6" />
        {/* Labels */}
        <text x={padding} y={height - 10} fill="#94a3b8" fontSize="12">${initialEquity.toFixed(0)}</text>
        <text x={width - padding} y={height - 10} fill="#94a3b8" fontSize="12" textAnchor="end">${finalEquity.toFixed(0)}</text>
      </svg>
    </div>
  );
};

// ============== PREDICTION TABLE ==============

const PredictionTable = ({ predictions }) => {
  if (!predictions || predictions.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Recent Predictions</h3>
        <p className="text-slate-400">No predictions found</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
      <h3 className="text-lg font-semibold mb-4">Recent Predictions ({predictions.length})</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left">
              <th className="py-2 px-3 text-slate-400">Date</th>
              <th className="py-2 px-3 text-slate-400">Coin</th>
              <th className="py-2 px-3 text-slate-400">Type</th>
              <th className="py-2 px-3 text-slate-400">Predicted</th>
              <th className="py-2 px-3 text-slate-400">Strength</th>
              <th className="py-2 px-3 text-slate-400">Price Change</th>
              <th className="py-2 px-3 text-slate-400">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((pred, i) => (
              <tr key={pred.id || i} className="border-b border-slate-800">
                <td className="py-2 px-3 text-slate-300">
                  {new Date(pred.timestamp).toLocaleDateString()}
                </td>
                <td className="py-2 px-3 text-white font-medium">{pred.coin}</td>
                <td className="py-2 px-3 text-slate-300">{pred.projectionType || '12hr'}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    pred.predictedDirection === 'BULLISH' ? 'bg-green-900/50 text-green-400' :
                    pred.predictedDirection === 'BEARISH' ? 'bg-red-900/50 text-red-400' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {pred.predictedDirection}
                  </span>
                </td>
                <td className="py-2 px-3 text-slate-300">{pred.strength}</td>
                <td className="py-2 px-3">
                  {pred.actualPriceChange !== undefined ? (
                    <span className={pred.actualPriceChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {pred.actualPriceChange >= 0 ? '+' : ''}{pred.actualPriceChange.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </td>
                <td className="py-2 px-3">
                  {pred.evaluated ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      pred.outcome === 'correct' ? 'bg-green-900/50 text-green-400' :
                      pred.outcome === 'incorrect' ? 'bg-red-900/50 text-red-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {pred.outcome}
                    </span>
                  ) : (
                    <span className="text-slate-500">pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BacktestPage;
