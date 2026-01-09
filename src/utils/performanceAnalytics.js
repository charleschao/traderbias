// ============== PERFORMANCE ANALYTICS ==============
// Advanced analytics and reporting for backtesting results

// ============== ADVANCED METRICS ==============

export const calculateAdvancedMetrics = (trades, config, equity, timestamps) => {
    if (!trades || trades.length === 0) {
        return getEmptyAdvancedMetrics();
    }

    const closedTrades = trades.filter(t => t.status === 'closed');
    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const losingTrades = closedTrades.filter(t => t.pnl < 0);

    // 1. Calmar Ratio (Annual Return / Max Drawdown)
    const calmarRatio = calculateCalmarRatio(closedTrades, config);

    // 2. Sortino Ratio (Downside deviation version of Sharpe)
    const sortinoRatio = calculateSortinoRatio(closedTrades);

    // 3. Win/Loss Streak Analysis
    const streakAnalysis = analyzeStreaks(closedTrades);

    // 4. Monthly Returns Analysis
    const monthlyReturns = analyzeMonthlyReturns(closedTrades, timestamps);

    // 5. Risk-Adjusted Returns
    const riskAdjustedReturns = calculateRiskAdjustedReturns(closedTrades, config);

    // 6. Trade Distribution Analysis
    const tradeDistribution = analyzeTradeDistribution(closedTrades);

    // 7. Correlation Analysis (if multiple coins/strategies)
    const correlationAnalysis = analyzeCorrelations(closedTrades);

    // 8. Expectancy and EV
    const expectancy = calculateExpectancy(closedTrades);

    // 9. Risk of Ruin
    const riskOfRuin = calculateRiskOfRuin(closedTrades, config);

    // 10. Monte Carlo Simulation
    const monteCarlo = runMonteCarloSimulation(closedTrades, config);

    return {
        ...getEmptyAdvancedMetrics(),
        calmarRatio,
        sortinoRatio,
        streakAnalysis,
        monthlyReturns,
        riskAdjustedReturns,
        tradeDistribution,
        correlationAnalysis,
        expectancy,
        riskOfRuin,
        monteCarlo
    };
};

// ============== SPECIFIC METRIC CALCULATIONS ==============

const calculateCalmarRatio = (trades, config) => {
    if (trades.length === 0) return 0;

    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const annualReturn = (totalPnL / config.initialCapital) * (365 / getBacktestDuration(trades, config));
    
    const maxDrawdown = calculateMaxDrawdown(trades, config);
    
    return maxDrawdown > 0 ? annualReturn / maxDrawdown : annualReturn > 0 ? 999 : 0;
};

const calculateSortinoRatio = (trades) => {
    if (trades.length === 0) return 0;

    const returns = trades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // Calculate downside deviation (only negative returns)
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return 999;
    
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / negativeReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);
    
    return downsideDeviation > 0 ? avgReturn / downsideDeviation : avgReturn > 0 ? 999 : 0;
};

const analyzeStreaks = (trades) => {
    if (trades.length === 0) return { currentStreak: 0, maxWinStreak: 0, maxLossStreak: 0, avgWinStreak: 0, avgLossStreak: 0 };

    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let winStreaks = [];
    let lossStreaks = [];
    let currentStreakType = null;

    trades.forEach(trade => {
        if (trade.pnl > 0) {
            if (currentStreakType === 'win') {
                currentStreak++;
            } else {
                if (currentStreakType === 'loss' && currentStreak > 0) {
                    lossStreaks.push(currentStreak);
                    maxLossStreak = Math.max(maxLossStreak, currentStreak);
                }
                currentStreak = 1;
                currentStreakType = 'win';
            }
            maxWinStreak = Math.max(maxWinStreak, currentStreak);
        } else if (trade.pnl < 0) {
            if (currentStreakType === 'loss') {
                currentStreak++;
            } else {
                if (currentStreakType === 'win' && currentStreak > 0) {
                    winStreaks.push(currentStreak);
                    maxWinStreak = Math.max(maxWinStreak, currentStreak);
                }
                currentStreak = 1;
                currentStreakType = 'loss';
            }
            maxLossStreak = Math.max(maxLossStreak, currentStreak);
        }
    });

    // Add final streak
    if (currentStreak > 0) {
        if (currentStreakType === 'win') {
            winStreaks.push(currentStreak);
        } else {
            lossStreaks.push(currentStreak);
        }
    }

    const avgWinStreak = winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0;
    const avgLossStreak = lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length : 0;

    return {
        currentStreak,
        maxWinStreak,
        maxLossStreak,
        avgWinStreak: Math.round(avgWinStreak * 10) / 10,
        avgLossStreak: Math.round(avgLossStreak * 10) / 10
    };
};

const analyzeMonthlyReturns = (trades, timestamps) => {
    if (trades.length === 0 || !timestamps || timestamps.length === 0) {
        return { monthlyReturns: [], avgMonthlyReturn: 0, bestMonth: 0, worstMonth: 0, volatility: 0 };
    }

    // Group trades by month
    const monthlyData = {};
    
    trades.forEach(trade => {
        if (trade.status !== 'closed') return;
        
        const date = new Date(trade.timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { pnl: 0, count: 0 };
        }
        
        monthlyData[monthKey].pnl += trade.pnl;
        monthlyData[monthKey].count++;
    });

    const monthlyReturns = Object.keys(monthlyData).map(month => ({
        month,
        return: monthlyData[month].pnl,
        tradeCount: monthlyData[month].count
    }));

    const returns = monthlyReturns.map(m => m.return);
    const avgMonthlyReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const bestMonth = Math.max(...returns);
    const worstMonth = Math.min(...returns);
    
    // Calculate volatility (standard deviation)
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgMonthlyReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    return {
        monthlyReturns,
        avgMonthlyReturn: Math.round(avgMonthlyReturn * 100) / 100,
        bestMonth: Math.round(bestMonth * 100) / 100,
        worstMonth: Math.round(worstMonth * 100) / 100,
        volatility: Math.round(volatility * 100) / 100
    };
};

const calculateRiskAdjustedReturns = (trades, config) => {
    if (trades.length === 0) return { alpha: 0, beta: 0, informationRatio: 0, treynorRatio: 0 };

    const returns = trades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // Beta (sensitivity to market) - simplified as correlation with itself
    const beta = 1; // In a real implementation, compare against market benchmark
    
    // Alpha (excess return over expected return)
    const marketReturn = avgReturn; // Simplified - use actual market data
    const alpha = avgReturn - (beta * marketReturn);
    
    // Information Ratio (alpha divided by tracking error)
    const trackingError = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const informationRatio = trackingError > 0 ? alpha / trackingError : 0;
    
    // Treynor Ratio (excess return per unit of systematic risk)
    const treynorRatio = beta > 0 ? avgReturn / beta : 0;

    return {
        alpha: Math.round(alpha * 1000) / 1000,
        beta: Math.round(beta * 1000) / 1000,
        informationRatio: Math.round(informationRatio * 1000) / 1000,
        treynorRatio: Math.round(treynorRatio * 1000) / 1000
    };
};

const analyzeTradeDistribution = (trades) => {
    if (trades.length === 0) return { percentiles: {}, skewness: 0, kurtosis: 0 };

    const returns = trades.map(t => t.pnlPercent).sort((a, b) => a - b);
    
    // Calculate percentiles
    const percentiles = {};
    [10, 25, 50, 75, 90, 95, 99].forEach(p => {
        const index = Math.floor((p / 100) * returns.length);
        percentiles[p] = returns[index];
    });

    // Calculate skewness (measure of asymmetry)
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) / returns.length;
    
    // Calculate kurtosis (measure of tail heaviness)
    const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) / returns.length - 3;

    return {
        percentiles,
        skewness: Math.round(skewness * 1000) / 1000,
        kurtosis: Math.round(kurtosis * 1000) / 1000
    };
};

const analyzeCorrelations = (trades) => {
    // Group trades by coin
    const coinTrades = {};
    trades.forEach(trade => {
        if (!coinTrades[trade.coin]) {
            coinTrades[trade.coin] = [];
        }
        coinTrades[trade.coin].push(trade.pnlPercent);
    });

    const coins = Object.keys(coinTrades);
    const correlations = {};

    // Calculate correlation matrix between different coins
    for (let i = 0; i < coins.length; i++) {
        for (let j = i + 1; j < coins.length; j++) {
            const coin1 = coins[i];
            const coin2 = coins[j];
            const correlation = calculateCorrelation(coinTrades[coin1], coinTrades[coin2]);
            correlations[`${coin1}-${coin2}`] = Math.round(correlation * 1000) / 1000;
        }
    }

    return { correlations, diversificationRatio: calculateDiversificationRatio(correlations) };
};

const calculateCorrelation = (x, y) => {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
};

const calculateDiversificationRatio = (correlations) => {
    const values = Object.values(correlations);
    if (values.length === 0) return 1;
    
    const avgCorrelation = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.max(0, 1 - avgCorrelation);
};

const calculateExpectancy = (trades) => {
    if (trades.length === 0) return { expectancy: 0, avgWin: 0, avgLoss: 0, winRate: 0 };

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    
    const avgWin = winningTrades.length > 0 
        ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length 
        : 0;
    const avgLoss = losingTrades.length > 0 
        ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length 
        : 0;
    
    const winRate = winningTrades.length / trades.length;
    const lossRate = 1 - winRate;
    
    // Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
    const expectancy = (winRate * avgWin) - (lossRate * avgLoss);

    return {
        expectancy: Math.round(expectancy * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        winRate: Math.round(winRate * 10000) / 100
    };
};

const calculateRiskOfRuin = (trades, config) => {
    if (trades.length === 0) return { riskOfRuin: 0, probability: 0 };

    const expectancy = calculateExpectancy(trades);
    const returns = trades.map(t => t.pnlPercent);
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - expectancy.expectancy, 2), 0) / returns.length);
    
    // Simplified Risk of Ruin calculation
    const capitalUnits = config.initialCapital / Math.abs(expectancy.avgLoss || 1);
    const z = expectancy.expectancy / (stdDev || 1);
    
    // Using the formula: Risk of Ruin = ((1 - z) / (1 + z))^capitalUnits
    const riskOfRuin = z > 0 ? Math.pow((1 - z) / (1 + z), capitalUnits) : 1;
    
    return {
        riskOfRuin: Math.round(riskOfRuin * 10000) / 100,
        probability: Math.round(riskOfRuin * 100) / 100
    };
};

const runMonteCarloSimulation = (trades, config, simulations = 1000) => {
    if (trades.length === 0) return { medianReturn: 0, percentile5: 0, percentile95: 0, probabilityOfProfit: 0 };

    const returns = trades.map(t => t.pnlPercent);
    const results = [];

    // Run Monte Carlo simulations
    for (let i = 0; i < simulations; i++) {
        let totalReturn = 0;
        
        // Randomly sample returns with replacement
        for (let j = 0; j < trades.length; j++) {
            const randomIndex = Math.floor(Math.random() * returns.length);
            totalReturn += returns[randomIndex];
        }
        
        results.push(totalReturn);
    }

    // Sort results for percentile analysis
    results.sort((a, b) => a - b);
    
    const medianReturn = results[Math.floor(simulations / 2)];
    const percentile5 = results[Math.floor(simulations * 0.05)];
    const percentile95 = results[Math.floor(simulations * 0.95)];
    const probabilityOfProfit = results.filter(r => r > 0).length / simulations;

    return {
        medianReturn: Math.round(medianReturn * 100) / 100,
        percentile5: Math.round(percentile5 * 100) / 100,
        percentile95: Math.round(percentile95 * 100) / 100,
        probabilityOfProfit: Math.round(probabilityOfProfit * 10000) / 100
    };
};

// ============== UTILITY FUNCTIONS ==============

const getEmptyAdvancedMetrics = () => ({
    calmarRatio: 0,
    sortinoRatio: 0,
    streakAnalysis: {
        currentStreak: 0,
        maxWinStreak: 0,
        maxLossStreak: 0,
        avgWinStreak: 0,
        avgLossStreak: 0
    },
    monthlyReturns: {
        monthlyReturns: [],
        avgMonthlyReturn: 0,
        bestMonth: 0,
        worstMonth: 0,
        volatility: 0
    },
    riskAdjustedReturns: {
        alpha: 0,
        beta: 0,
        informationRatio: 0,
        treynorRatio: 0
    },
    tradeDistribution: {
        percentiles: {},
        skewness: 0,
        kurtosis: 0
    },
    correlationAnalysis: {
        correlations: {},
        diversificationRatio: 1
    },
    expectancy: {
        expectancy: 0,
        avgWin: 0,
        avgLoss: 0,
        winRate: 0
    },
    riskOfRuin: {
        riskOfRuin: 0,
        probability: 0
    },
    monteCarlo: {
        medianReturn: 0,
        percentile5: 0,
        percentile95: 0,
        probabilityOfProfit: 0
    }
});

const getBacktestDuration = (trades, config) => {
    if (trades.length === 0) return 1;
    
    const firstTrade = trades[0];
    const lastTrade = trades[trades.length - 1];
    const duration = (lastTrade.timestamp - firstTrade.timestamp) / (1000 * 60 * 60 * 24); // days
    
    return Math.max(1, duration);
};

const calculateMaxDrawdown = (trades, config) => {
    if (trades.length === 0) return 0;

    let peak = config.initialCapital;
    let maxDrawdown = 0;
    let runningCapital = config.initialCapital;

    trades.forEach(trade => {
        if (trade.status === 'closed') {
            runningCapital += trade.pnl;
            if (runningCapital > peak) {
                peak = runningCapital;
            }
            const drawdown = ((peak - runningCapital) / peak) * 100;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
    });

    return maxDrawdown;
};

// ============== REPORT GENERATION ==============

export const generatePerformanceReport = (results, config) => {
    const advancedMetrics = calculateAdvancedMetrics(results.trades, config, results.equity, results.timestamps);
    
    return {
        executiveSummary: generateExecutiveSummary(results, advancedMetrics),
        performanceAnalysis: generatePerformanceAnalysis(results, advancedMetrics),
        riskAnalysis: generateRiskAnalysis(results, advancedMetrics),
        recommendations: generateRecommendations(results, advancedMetrics),
        detailedMetrics: advancedMetrics
    };
};

const generateExecutiveSummary = (results, advancedMetrics) => {
    const { metrics, summary } = results;
    
    return {
        overallGrade: summary.grade,
        totalReturn: metrics.totalPnLPercent,
        winRate: metrics.winRate,
        riskLevel: summary.riskLevel,
        keyHighlights: [
            `${metrics.totalTrades} trades executed`,
            `${metrics.sharpeRatio.toFixed(2)} Sharpe ratio`,
            `${advancedMetrics.calmarRatio.toFixed(2)} Calmar ratio`,
            `${(advancedMetrics.expectancy.probabilityOfProfit * 100).toFixed(1)}% probability of profit`
        ],
        assessment: summary.assessment
    };
};

const generatePerformanceAnalysis = (results, advancedMetrics) => {
    return {
        returns: {
            total: results.metrics.totalPnLPercent,
            annualized: (results.metrics.totalPnLPercent * (365 / getBacktestDuration(results.trades, results.config))).toFixed(2),
            monthly: advancedMetrics.monthlyReturns.avgMonthlyReturn,
            bestMonth: advancedMetrics.monthlyReturns.bestMonth,
            worstMonth: advancedMetrics.monthlyReturns.worstMonth
        },
        riskAdjusted: {
            sharpe: results.metrics.sharpeRatio,
            sortino: advancedMetrics.sortinoRatio,
            calmar: advancedMetrics.calmarRatio,
            treynor: advancedMetrics.riskAdjustedReturns.treynorRatio
        },
        consistency: {
            streaks: advancedMetrics.streakAnalysis,
            monthlyVolatility: advancedMetrics.monthlyReturns.volatility,
            tradeDistribution: advancedMetrics.tradeDistribution
        }
    };
};

const generateRiskAnalysis = (results, advancedMetrics) => {
    return {
        drawdown: {
            max: results.metrics.maxDrawdown,
            avgDuration: 0, // Would need more detailed analysis
            recovery: 0 // Would need more detailed analysis
        },
        riskOfRuin: advancedMetrics.riskOfRuin,
        monteCarlo: advancedMetrics.monteCarlo,
        correlations: advancedMetrics.correlationAnalysis,
        positionSizing: {
            avgSize: results.config.positionSize * 100,
            maxPositions: results.config.maxPositions,
            diversification: advancedMetrics.correlationAnalysis.diversificationRatio
        }
    };
};

const generateRecommendations = (results, advancedMetrics) => {
    const recommendations = [];
    
    // Performance-based recommendations
    if (results.metrics.winRate < 40) {
        recommendations.push({
            type: 'performance',
            priority: 'high',
            title: 'Low Win Rate Detected',
            description: 'Consider increasing signal confidence threshold or refining entry criteria',
            action: 'Review signal generation logic and consider higher minimum confidence'
        });
    }
    
    // Risk-based recommendations
    if (results.metrics.maxDrawdown > 20) {
        recommendations.push({
            type: 'risk',
            priority: 'high',
            title: 'High Maximum Drawdown',
            description: 'Risk management should be improved',
            action: 'Reduce position size or tighten stop losses'
        });
    }
    
    // Consistency recommendations
    if (advancedMetrics.streakAnalysis.maxLossStreak > 5) {
        recommendations.push({
            type: 'consistency',
            priority: 'medium',
            title: 'Long Losing Streaks',
            description: 'Strategy may be prone to extended losing periods',
            action: 'Consider adding cooldown periods or dynamic position sizing'
        });
    }
    
    // Correlation recommendations
    if (advancedMetrics.correlationAnalysis.diversificationRatio < 0.3) {
        recommendations.push({
            type: 'diversification',
            priority: 'medium',
            title: 'Low Diversification',
            description: 'Trades may be too correlated',
            action: 'Consider adding more coins or uncorrelated strategies'
        });
    }
    
    return recommendations;
};

export default {
    calculateAdvancedMetrics,
    generatePerformanceReport
};