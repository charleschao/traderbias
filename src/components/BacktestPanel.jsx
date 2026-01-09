// ============== BACKTESTING UI COMPONENTS ==============
// React components for backtesting interface

import React, { useState, useEffect } from 'react';
import { runBacktest, createBacktestConfig } from '../utils/backtestEngine.js';
import { collectHistoricalData, getCollectionProgress } from '../services/historicalDataService.js';

// ============== BACKTEST CONTROL PANEL ==============

export const BacktestControlPanel = ({ onBacktestStart, onBacktestComplete, isRunning = false }) => {
    const [config, setConfig] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
        endDate: new Date().toISOString().split('T')[0], // Today
        initialCapital: 10000,
        positionSize: 0.1,
        maxPositions: 3,
        takeProfit: 5,
        stopLoss: 3,
        maxDuration: 1440,
        minConfidence: 0.3,
        coins: ['BTC', 'ETH', 'SOL']
    });

    const [dataCollectionStatus, setDataCollectionStatus] = useState('idle');
    const [progress, setProgress] = useState(null);

    useEffect(() => {
        if (dataCollectionStatus === 'collecting') {
            const interval = setInterval(() => {
                const prog = getCollectionProgress();
                if (prog) {
                    setProgress(prog);
                } else {
                    setDataCollectionStatus('completed');
                    setProgress(null);
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [dataCollectionStatus]);

    const handleStartBacktest = async () => {
        if (isRunning) return;

        try {
            setDataCollectionStatus('collecting');
            
            // Convert dates to timestamps
            const startDate = new Date(config.startDate).getTime();
            const endDate = new Date(config.endDate).getTime();

            // Collect historical data first
            await collectHistoricalData(startDate, endDate, config.coins);
            
            setDataCollectionStatus('completed');
            
            // Create backtest configuration
            const backtestConfig = createBacktestConfig(
                startDate,
                endDate,
                config.initialCapital
            );

            // Override config with form values
            Object.assign(backtestConfig, {
                positionSize: config.positionSize,
                maxPositions: config.maxPositions,
                takeProfit: config.takeProfit / 100,
                stopLoss: config.stopLoss / 100,
                maxDuration: config.maxDuration,
                minConfidence: config.minConfidence
            });

            onBacktestStart && onBacktestStart();

            // Run the backtest
            const results = await runBacktest(backtestConfig, config.coins);
            
            onBacktestComplete && onBacktestComplete(results);

        } catch (error) {
            console.error('Backtest failed:', error);
            setDataCollectionStatus('error');
        }
    };

    const handleCoinToggle = (coin) => {
        setConfig(prev => ({
            ...prev,
            coins: prev.coins.includes(coin) 
                ? prev.coins.filter(c => c !== coin)
                : [...prev.coins, coin]
        }));
    };

    return (
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">🔬 Backtest Configuration</h3>
            
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                    <input
                        type="date"
                        value={config.startDate}
                        onChange={(e) => setConfig(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                        disabled={isRunning}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
                    <input
                        type="date"
                        value={config.endDate}
                        onChange={(e) => setConfig(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                        disabled={isRunning}
                    />
                </div>
            </div>

            {/* Coins Selection */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">Coins</label>
                <div className="flex gap-2">
                    {['BTC', 'ETH', 'SOL'].map(coin => (
                        <button
                            key={coin}
                            onClick={() => handleCoinToggle(coin)}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                config.coins.includes(coin)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                            disabled={isRunning}
                        >
                            {coin}
                        </button>
                    ))}
                </div>
            </div>

            {/* Trading Parameters */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Initial Capital</label>
                    <input
                        type="number"
                        value={config.initialCapital}
                        onChange={(e) => setConfig(prev => ({ ...prev, initialCapital: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                        disabled={isRunning}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Position Size (%)</label>
                    <input
                        type="number"
                        value={config.positionSize * 100}
                        onChange={(e) => setConfig(prev => ({ ...prev, positionSize: Number(e.target.value) / 100 }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                        min="1"
                        max="100"
                        disabled={isRunning}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Max Positions</label>
                    <input
                        type="number"
                        value={config.maxPositions}
                        onChange={(e) => setConfig(prev => ({ ...prev, maxPositions: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                        min="1"
                        max="10"
                        disabled={isRunning}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Min Confidence</label>
                    <input
                        type="number"
                        value={config.minConfidence}
                        onChange={(e) => setConfig(prev => ({ ...prev, minConfidence: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                        min="0"
                        max="1"
                        step="0.1"
                        disabled={isRunning}
                    />
                </div>
            </div>

            {/* Risk Management */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Take Profit (%)</label>
                    <input
                        type="number"
                        value={config.takeProfit}
                        onChange={(e) => setConfig(prev => ({ ...prev, takeProfit: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                        min="0.1"
                        max="50"
                        step="0.1"
                        disabled={isRunning}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Stop Loss (%)</label>
                    <input
                        type="number"
                        value={config.stopLoss}
                        onChange={(e) => setConfig(prev => ({ ...prev, stopLoss: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                        min="0.1"
                        max="20"
                        step="0.1"
                        disabled={isRunning}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Max Duration (min)</label>
                    <input
                        type="number"
                        value={config.maxDuration}
                        onChange={(e) => setConfig(prev => ({ ...prev, maxDuration: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                        min="5"
                        max="10080"
                        disabled={isRunning}
                    />
                </div>
            </div>

            {/* Progress Display */}
            {dataCollectionStatus === 'collecting' && progress && (
                <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-md">
                    <div className="text-sm text-blue-300 mb-2">
                        {progress.current}
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                        />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                        {progress.completed} / {progress.total} data points
                    </div>
                </div>
            )}

            {/* Start Button */}
            <button
                onClick={handleStartBacktest}
                disabled={isRunning || dataCollectionStatus === 'collecting' || config.coins.length === 0}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-400 text-white font-medium rounded-md transition-colors"
            >
                {isRunning ? '⏳ Running Backtest...' : 
                 dataCollectionStatus === 'collecting' ? '📊 Collecting Data...' :
                 dataCollectionStatus === 'error' ? '❌ Error - Try Again' :
                 '🚀 Start Backtest'}
            </button>
        </div>
    );
};

// ============== RESULTS DISPLAY ==============

export const BacktestResults = ({ results }) => {
    if (!results) return null;

    const { metrics, summary, trades, equity, timestamps } = results;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PerformanceCard 
                    title="Overall Performance"
                    grade={summary.grade}
                    assessment={summary.assessment}
                    color={getGradeColor(summary.grade)}
                />
                <MetricsCard metrics={metrics} />
                <RiskCard 
                    riskLevel={summary.riskLevel}
                    consistency={summary.consistency}
                    recommendation={summary.recommendation}
                />
            </div>

            {/* Equity Curve */}
            <EquityCurve equity={equity} timestamps={timestamps} />

            {/* Trade List */}
            <TradeList trades={trades} />

            {/* Detailed Metrics */}
            <DetailedMetrics metrics={metrics} />
        </div>
    );
};

// ============== PERFORMANCE CARD ==============

const PerformanceCard = ({ title, grade, assessment, color }) => (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
        <div className={`text-3xl font-bold ${color} mb-2`}>{grade}</div>
        <p className="text-sm text-slate-300">{assessment}</p>
    </div>
);

// ============== METRICS CARD ==============

const MetricsCard = ({ metrics }) => (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Key Metrics</h3>
        <div className="space-y-3">
            <MetricRow label="Total Trades" value={metrics.totalTrades} />
            <MetricRow label="Win Rate" value={`${metrics.winRate}%`} color={metrics.winRate >= 50 ? 'text-green-400' : 'text-red-400'} />
            <MetricRow label="Total P&L" value={`${metrics.totalPnLPercent}%`} color={metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'} />
            <MetricRow label="Profit Factor" value={metrics.profitFactor} />
            <MetricRow label="Sharpe Ratio" value={metrics.sharpeRatio} />
            <MetricRow label="Max Drawdown" value={`${metrics.maxDrawdown}%`} color="text-red-400" />
        </div>
    </div>
);

// ============== RISK CARD ==============

const RiskCard = ({ riskLevel, consistency, recommendation }) => (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Risk Analysis</h3>
        <div className="space-y-3">
            <div>
                <span className="text-sm text-slate-400">Risk Level:</span>
                <span className={`ml-2 text-sm font-medium ${getRiskColor(riskLevel)}`}>{riskLevel}</span>
            </div>
            <div>
                <span className="text-sm text-slate-400">Consistency:</span>
                <span className="ml-2 text-sm font-medium text-slate-300">{consistency}</span>
            </div>
            <div className="pt-2 border-t border-slate-700">
                <span className="text-sm text-slate-400">Recommendation:</span>
                <p className="text-sm text-slate-300 mt-1">{recommendation}</p>
            </div>
        </div>
    </div>
);

// ============== EQUITY CURVE ==============

const EquityCurve = ({ equity, timestamps }) => {
    if (!equity || equity.length < 2) return null;

    // Simple SVG chart (in production, would use a proper charting library)
    const width = 800;
    const height = 200;
    const padding = 20;

    const maxEquity = Math.max(...equity);
    const minEquity = Math.min(...equity);
    const equityRange = maxEquity - minEquity;

    const points = equity.map((value, index) => {
        const x = padding + (index / (equity.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((value - minEquity) / equityRange) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    const initialEquity = equity[0];
    const finalEquity = equity[equity.length - 1];
    const totalReturn = ((finalEquity - initialEquity) / initialEquity) * 100;

    return (
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Equity Curve</h3>
            <div className="mb-4">
                <span className={`text-sm font-medium ${totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Total Return: {totalReturn.toFixed(2)}%
                </span>
            </div>
            <svg width={width} height={height} className="w-full h-auto">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(i => (
                    <line
                        key={i}
                        x1={padding}
                        y1={padding + i * (height - 2 * padding)}
                        x2={width - padding}
                        y2={padding + i * (height - 2 * padding)}
                        stroke="#475569"
                        strokeWidth="1"
                    />
                ))}
                {/* Equity curve */}
                <polyline
                    points={points}
                    fill="none"
                    stroke={totalReturn >= 0 ? "#10b981" : "#ef4444"}
                    strokeWidth="2"
                />
                {/* Start and end points */}
                <circle cx={padding} cy={height - padding - ((equity[0] - minEquity) / equityRange) * (height - 2 * padding)} r="4" fill="#3b82f6" />
                <circle cx={width - padding} cy={height - padding - ((equity[equity.length - 1] - minEquity) / equityRange) * (height - 2 * padding)} r="4" fill="#3b82f6" />
            </svg>
        </div>
    );
};

// ============== TRADE LIST ==============

const TradeList = ({ trades }) => {
    const closedTrades = trades?.filter(t => t.status === 'closed') || [];
    
    if (closedTrades.length === 0) {
        return (
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Trade History</h3>
                <p className="text-slate-400">No completed trades</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Trade History ({closedTrades.length} trades)</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="text-left py-2 px-3 text-slate-300">Coin</th>
                            <th className="text-left py-2 px-3 text-slate-300">Signal</th>
                            <th className="text-left py-2 px-3 text-slate-300">Entry</th>
                            <th className="text-left py-2 px-3 text-slate-300">Exit</th>
                            <th className="text-left py-2 px-3 text-slate-300">P&L</th>
                            <th className="text-left py-2 px-3 text-slate-300">Duration</th>
                            <th className="text-left py-2 px-3 text-slate-300">Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {closedTrades.slice(0, 10).map((trade, index) => (
                            <tr key={trade.id || index} className="border-b border-slate-800">
                                <td className="py-2 px-3 text-white">{trade.coin}</td>
                                <td className="py-2 px-3">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        trade.signal === 'bullish' ? 'bg-green-900/50 text-green-400' :
                                        trade.signal === 'bearish' ? 'bg-red-900/50 text-red-400' :
                                        'bg-slate-700 text-slate-300'
                                    }`}>
                                        {trade.signal}
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-white">${trade.entryPrice?.toFixed(2)}</td>
                                <td className="py-2 px-3 text-white">${trade.exitPrice?.toFixed(2)}</td>
                                <td className="py-2 px-3">
                                    <span className={`font-medium ${
                                        trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} ({trade.pnlPercent.toFixed(2)}%)
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-slate-300">{trade.duration}m</td>
                                <td className="py-2 px-3 text-slate-300">{trade.exitReason}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {closedTrades.length > 10 && (
                    <div className="text-center py-2 text-slate-400 text-sm">
                        ... and {closedTrades.length - 10} more trades
                    </div>
                )}
            </div>
        </div>
    );
};

// ============== DETAILED METRICS ==============

const DetailedMetrics = ({ metrics }) => (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Detailed Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Winning Trades" value={metrics.winningTrades} />
            <MetricCard title="Losing Trades" value={metrics.losingTrades} />
            <MetricCard title="Average Win" value={`$${metrics.avgWin}`} />
            <MetricCard title="Average Loss" value={`$${metrics.avgLoss}`} />
            <MetricCard title="Best Trade" value={`$${metrics.bestTrade}`} color="text-green-400" />
            <MetricCard title="Worst Trade" value={`$${metrics.worstTrade}`} color="text-red-400" />
            <MetricCard title="Avg Duration" value={`${metrics.avgDuration}m`} />
            <MetricCard title="Final Capital" value={`$${metrics.finalCapital.toFixed(2)}`} />
        </div>
    </div>
);

// ============== UTILITY COMPONENTS ==============

const MetricRow = ({ label, value, color = 'text-slate-300' }) => (
    <div className="flex justify-between">
        <span className="text-sm text-slate-400">{label}:</span>
        <span className={`text-sm font-medium ${color}`}>{value}</span>
    </div>
);

const MetricCard = ({ title, value, color = 'text-slate-300' }) => (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="text-xs text-slate-400 mb-1">{title}</div>
        <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
);

// ============== HELPER FUNCTIONS ==============

const getGradeColor = (grade) => {
    const colors = {
        'A+': 'text-green-400',
        'A': 'text-green-400',
        'B': 'text-blue-400',
        'C': 'text-yellow-400',
        'D': 'text-orange-400',
        'F': 'text-red-400'
    };
    return colors[grade] || 'text-slate-400';
};

const getRiskColor = (riskLevel) => {
    const colors = {
        'Low': 'text-green-400',
        'Medium': 'text-yellow-400',
        'High': 'text-red-400'
    };
    return colors[riskLevel] || 'text-slate-400';
};

export default BacktestControlPanel;