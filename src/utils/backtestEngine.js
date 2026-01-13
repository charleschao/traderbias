// ============== BACKTESTING ENGINE ==============
// Historical signal performance analysis for Trader Bias

import { getRegimeAtIndex } from './regimeDetector.js';

// ============== DATA STRUCTURES ==============

// Trade signal structure
export const createSignal = (timestamp, coin, signal, confidence, components) => ({
    id: `${coin}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    coin,
    signal, // 'bullish', 'bearish', 'neutral'
    confidence, // 0-1 score
    components: {
        flowConfluence: components.flowConfluence,
        fundingBias: components.fundingBias,
        orderbookBias: components.orderbookBias,
        whaleBias: components.whaleBias
    },
    entryPrice: null, // Set when signal is "executed"
    exitPrice: null, // Set when trade is closed
    pnl: 0, // Profit/Loss in USD
    pnlPercent: 0, // Profit/Loss in percentage
    duration: null, // Trade duration in minutes
    status: 'pending', // 'pending', 'active', 'closed'
    exitReason: null, // 'take_profit', 'stop_loss', 'timeout', 'signal_reverse'
    regime: null // 'trending' | 'ranging' - set by backtest engine
});

// Backtest configuration
export const createBacktestConfig = (startDate, endDate, initialCapital = 10000) => ({
    startDate,
    endDate,
    initialCapital,
    currentCapital: initialCapital,
    positionSize: 0.1, // 10% of capital per trade
    maxPositions: 3, // Max concurrent trades
    takeProfit: 0.05, // 5% take profit
    stopLoss: 0.03, // 3% stop loss
    maxDuration: 1440, // 24 hours max trade duration
    minConfidence: 0.3, // Minimum signal confidence to trade
    cooldownPeriod: 60, // 60 minutes between same coin trades
    fees: 0.0005, // 0.05% trading fees
    slippage: 0.0002 // 0.02% slippage
});

// Performance metrics
export const calculatePerformanceMetrics = (trades, config) => {
    if (!trades || trades.length === 0) {
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalPnL: 0,
            totalPnLPercent: 0,
            avgWin: 0,
            avgLoss: 0,
            profitFactor: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            avgDuration: 0,
            bestTrade: 0,
            worstTrade: 0,
            finalCapital: config.initialCapital
        };
    }

    const closedTrades = trades.filter(t => t.status === 'closed');
    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const losingTrades = closedTrades.filter(t => t.pnl < 0);

    const totalPnL = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalPnLPercent = (totalPnL / config.initialCapital) * 100;
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    const avgWin = winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
        : 0;
    const avgLoss = losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length
        : 0;

    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0);
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Calculate max drawdown
    let peak = config.initialCapital;
    let maxDrawdown = 0;
    let runningCapital = config.initialCapital;

    closedTrades.forEach(trade => {
        runningCapital += trade.pnl;
        if (runningCapital > peak) {
            peak = runningCapital;
        }
        const drawdown = ((peak - runningCapital) / peak) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
    });

    // Calculate Sharpe ratio (simplified, assuming 0% risk-free rate)
    const returns = closedTrades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    const avgDuration = closedTrades.length > 0
        ? closedTrades.reduce((sum, t) => sum + (t.duration || 0), 0) / closedTrades.length
        : 0;

    const bestTrade = closedTrades.length > 0
        ? Math.max(...closedTrades.map(t => t.pnl))
        : 0;
    const worstTrade = closedTrades.length > 0
        ? Math.min(...closedTrades.map(t => t.pnl))
        : 0;

    return {
        totalTrades: closedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: Math.round(winRate * 100) / 100,
        totalPnL: Math.round(totalPnL * 100) / 100,
        totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 1000) / 1000,
        avgDuration: Math.round(avgDuration),
        bestTrade: Math.round(bestTrade * 100) / 100,
        worstTrade: Math.round(worstTrade * 100) / 100,
        finalCapital: config.initialCapital + totalPnL
    };
};

// ============== HISTORICAL DATA MANAGEMENT ==============

// Load historical data from localStorage or API
export const loadHistoricalData = async (startDate, endDate, coins = ['BTC', 'ETH', 'SOL']) => {
    // Try to load from localStorage first
    const storedData = localStorage.getItem('traderBias_backtestData');
    if (storedData) {
        try {
            const parsed = JSON.parse(storedData);
            // Check if data covers the requested period
            if (parsed.data && parsed.data.length > 0) {
                const oldestTimestamp = Math.min(...parsed.data.map(d => d.timestamp));
                const newestTimestamp = Math.max(...parsed.data.map(d => d.timestamp));

                if (oldestTimestamp <= startDate && newestTimestamp >= endDate) {
                    console.log('📊 Loaded historical data from localStorage');
                    return filterDataByPeriod(parsed.data, startDate, endDate, coins);
                }
            }
        } catch (error) {
            console.warn('Failed to parse stored historical data:', error);
        }
    }

    // If no suitable stored data, fetch from API
    console.log('📊 Fetching historical data from API');
    return await fetchHistoricalData(startDate, endDate, coins);
};

// Filter data by time period and coins
const filterDataByPeriod = (data, startDate, endDate, coins) => {
    return data.filter(entry =>
        entry.timestamp >= startDate &&
        entry.timestamp <= endDate &&
        coins.some(coin => entry.data[coin])
    );
};

// Fetch historical data from external API
const fetchHistoricalData = async (startDate, endDate, coins) => {
    // This would integrate with historical data providers
    // For now, return mock data structure
    const mockData = [];
    const interval = 5 * 60 * 1000; // 5 minutes
    let currentTimestamp = startDate;

    while (currentTimestamp <= endDate) {
        const dataEntry = {
            timestamp: currentTimestamp,
            data: {}
        };

        coins.forEach(coin => {
            dataEntry.data[coin] = {
                price: generateMockPrice(coin, currentTimestamp),
                priceChange: (Math.random() - 0.5) * 2,
                oi: generateMockOI(coin, currentTimestamp),
                oiChange: (Math.random() - 0.5) * 5,
                funding: (Math.random() - 0.5) * 0.001,
                cvd: (Math.random() - 0.5) * 100000,
                orderbook: {
                    imbalance: (Math.random() - 0.5) * 40,
                    avgImbalance: (Math.random() - 0.5) * 30
                }
            };
        });

        mockData.push(dataEntry);
        currentTimestamp += interval;
    }

    // Store for future use
    localStorage.setItem('traderBias_backtestData', JSON.stringify({
        data: mockData,
        lastUpdated: Date.now()
    }));

    return mockData;
};

// Mock data generators (replace with real historical data)
const generateMockPrice = (coin, timestamp) => {
    const basePrices = { BTC: 45000, ETH: 3000, SOL: 100 };
    const base = basePrices[coin] || 100;
    const trend = Math.sin(timestamp / (24 * 60 * 60 * 1000)) * 0.1; // Daily trend
    const noise = (Math.random() - 0.5) * 0.05;
    return base * (1 + trend + noise);
};

const generateMockOI = (coin, timestamp) => {
    const baseOI = { BTC: 1000000, ETH: 500000, SOL: 200000 };
    const base = baseOI[coin] || 100000;
    const trend = Math.cos(timestamp / (12 * 60 * 60 * 1000)) * 0.2; // 12h trend
    const noise = (Math.random() - 0.5) * 0.1;
    return base * (1 + trend + noise);
};

// ============== BACKTEST ENGINE ==============

// Main backtesting engine
export const runBacktest = async (config, coins = ['BTC', 'ETH', 'SOL']) => {
    console.log('🚀 Starting backtest...', {
        period: `${new Date(config.startDate).toLocaleDateString()} - ${new Date(config.endDate).toLocaleDateString()}`,
        coins,
        initialCapital: config.initialCapital
    });

    // Load historical data
    const historicalData = await loadHistoricalData(config.startDate, config.endDate, coins);

    if (historicalData.length === 0) {
        throw new Error('No historical data available for the specified period');
    }

    // Initialize backtest state
    const backtestState = {
        trades: [],
        activePositions: {},
        lastTradeTime: {},
        equity: [config.initialCapital],
        timestamps: [config.startDate],
        signals: []
    };

    // Process each time point
    for (let i = 0; i < historicalData.length; i++) {
        const timePoint = historicalData[i];
        const timestamp = timePoint.timestamp;

        // Generate signals for each coin
        for (const coin of coins) {
            if (!timePoint.data[coin]) continue;

            const signal = await generateSignalAtTime(coin, timePoint, historicalData, i, config);
            if (signal && signal.confidence >= config.minConfidence) {
                backtestState.signals.push(signal);

                // Check if we can enter a trade
                if (canEnterTrade(coin, signal, backtestState, config)) {
                    const trade = executeTrade(signal, timePoint.data[coin].price, config);
                    backtestState.trades.push(trade);
                    backtestState.activePositions[coin] = trade;
                    backtestState.lastTradeTime[coin] = timestamp;
                }
            }
        }

        // Check existing positions for exit conditions
        Object.keys(backtestState.activePositions).forEach(coin => {
            const trade = backtestState.activePositions[coin];
            const currentPrice = timePoint.data[coin]?.price;

            if (currentPrice && shouldExitTrade(trade, currentPrice, timestamp, config)) {
                const exitResult = closeTrade(trade, currentPrice, timestamp, config);
                backtestState.activePositions[coin] = null;

                // Update equity curve
                const lastEquity = backtestState.equity[backtestState.equity.length - 1];
                backtestState.equity.push(lastEquity + exitResult.pnl);
                backtestState.timestamps.push(timestamp);
            }
        });
    }

    // Close any remaining positions at the end
    const lastTimePoint = historicalData[historicalData.length - 1];
    Object.keys(backtestState.activePositions).forEach(coin => {
        const trade = backtestState.activePositions[coin];
        if (trade && trade.status === 'active') {
            const finalPrice = lastTimePoint.data[coin]?.price;
            if (finalPrice) {
                closeTrade(trade, finalPrice, lastTimePoint.timestamp, config, 'timeout');
            }
        }
    });

    // Calculate performance metrics
    const metrics = calculatePerformanceMetrics(backtestState.trades, config);

    console.log('✅ Backtest completed!', {
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate + '%',
        totalPnL: metrics.totalPnLPercent + '%',
        profitFactor: metrics.profitFactor,
        sharpeRatio: metrics.sharpeRatio
    });

    return {
        config,
        trades: backtestState.trades,
        signals: backtestState.signals,
        equity: backtestState.equity,
        timestamps: backtestState.timestamps,
        metrics,
        summary: generateBacktestSummary(metrics, config)
    };
};

// Generate signal at specific time point
const generateSignalAtTime = async (coin, timePoint, historicalData, currentIndex, config) => {
    const currentData = timePoint.data[coin];
    if (!currentData) return null;

    // Get historical context for calculations
    const contextData = getHistoricalContext(historicalData, currentIndex, coin);

    // Calculate bias components using existing logic
    const allData = {
        priceData: { [coin]: currentData },
        oiData: { [coin]: currentData },
        cvdData: { [coin]: currentData },
        fundingData: { [coin]: currentData },
        orderbookData: { [coin]: currentData.orderbook },
        consensus: {} // No whale data in backtest yet
    };

    // Import bias calculations (circular dependency handled by dynamic import)
    const { calculateCompositeBias } = await import('./biasCalculations.js');
    const biasResult = calculateCompositeBias(coin, allData);

    // Convert bias to signal
    let signal = 'neutral';
    if (biasResult.normalizedScore > 0.3) signal = 'bullish';
    else if (biasResult.normalizedScore < -0.3) signal = 'bearish';

    const confidence = Math.abs(biasResult.normalizedScore);

    // Detect market regime at this point
    const prices = getHistoricalContext(historicalData, currentIndex, coin, 20)
        .map(d => d.price)
        .filter(p => p !== undefined);
    prices.push(currentData.price);

    const { detectRegime } = await import('./regimeDetector.js');
    const regimeResult = detectRegime(prices, 20);

    const signalObj = createSignal(
        timePoint.timestamp,
        coin,
        signal,
        confidence,
        biasResult.components
    );
    signalObj.regime = regimeResult.regime;

    return signalObj;
};

// Get historical context for bias calculations
const getHistoricalContext = (historicalData, currentIndex, coin, lookback = 20) => {
    const start = Math.max(0, currentIndex - lookback);
    const contextData = [];

    for (let i = start; i < currentIndex; i++) {
        if (historicalData[i].data[coin]) {
            contextData.push(historicalData[i].data[coin]);
        }
    }

    return contextData;
};

// Check if we can enter a new trade
const canEnterTrade = (coin, signal, state, config) => {
    // Check if we already have an active position
    if (state.activePositions[coin]) return false;

    // Check max positions
    const activeCount = Object.values(state.activePositions).filter(p => p !== null).length;
    if (activeCount >= config.maxPositions) return false;

    // Check cooldown period
    const lastTrade = state.lastTradeTime[coin];
    if (lastTrade && (signal.timestamp - lastTrade) < (config.cooldownPeriod * 60 * 1000)) {
        return false;
    }

    // Check if signal is strong enough
    if (signal.confidence < config.minConfidence) return false;

    return true;
};

// Execute a trade
const executeTrade = (signal, entryPrice, config) => {
    const positionSize = config.currentCapital * config.positionSize;
    const fees = positionSize * config.fees;
    const slippage = entryPrice * config.slippage;

    const adjustedEntryPrice = signal.signal === 'bullish'
        ? entryPrice + slippage
        : entryPrice - slippage;

    signal.entryPrice = adjustedEntryPrice;
    signal.status = 'active';
    signal.timestamp = Date.now();

    return signal;
};

// Check if trade should be closed
const shouldExitTrade = (trade, currentPrice, timestamp, config) => {
    if (trade.status !== 'active') return false;

    const pnlPercent = calculatePnLPercent(trade, currentPrice);
    const duration = (timestamp - trade.timestamp) / (60 * 1000); // minutes

    // Take profit
    if (pnlPercent >= config.takeProfit * 100) {
        return { shouldExit: true, reason: 'take_profit' };
    }

    // Stop loss
    if (pnlPercent <= -config.stopLoss * 100) {
        return { shouldExit: true, reason: 'stop_loss' };
    }

    // Max duration
    if (duration >= config.maxDuration) {
        return { shouldExit: true, reason: 'timeout' };
    }

    return { shouldExit: false };
};

// Close a trade and calculate P&L
const closeTrade = (trade, exitPrice, timestamp, config, reason = null) => {
    if (trade.status !== 'active') return trade;

    const fees = trade.entryPrice * config.positionSize * config.fees;
    const slippage = exitPrice * config.slippage;

    const adjustedExitPrice = trade.signal === 'bullish'
        ? exitPrice - slippage
        : exitPrice + slippage;

    trade.exitPrice = adjustedExitPrice;
    trade.status = 'closed';
    trade.exitReason = reason || (trade.pnl > 0 ? 'take_profit' : 'stop_loss');
    trade.duration = (timestamp - trade.timestamp) / (60 * 1000);
    trade.pnl = calculatePnL(trade, adjustedExitPrice, config);
    trade.pnlPercent = calculatePnLPercent(trade, adjustedExitPrice);

    return trade;
};

// Calculate trade P&L in USD
const calculatePnL = (trade, exitPrice, config) => {
    const positionSize = config.currentCapital * config.positionSize;
    const priceChange = exitPrice - trade.entryPrice;
    const direction = trade.signal === 'bullish' ? 1 : -1;

    return (priceChange * positionSize / trade.entryPrice) * direction;
};

// Calculate trade P&L in percentage
const calculatePnLPercent = (trade, exitPrice) => {
    const priceChange = exitPrice - trade.entryPrice;
    const direction = trade.signal === 'bullish' ? 1 : -1;

    return (priceChange / trade.entryPrice) * 100 * direction;
};

// Generate backtest summary
const generateBacktestSummary = (metrics, config) => {
    let grade = 'C';
    let assessment = 'Average performance';

    if (metrics.winRate >= 60 && metrics.profitFactor >= 2 && metrics.totalPnLPercent > 20) {
        grade = 'A+';
        assessment = 'Excellent strategy with strong risk-adjusted returns';
    } else if (metrics.winRate >= 55 && metrics.profitFactor >= 1.5 && metrics.totalPnLPercent > 10) {
        grade = 'A';
        assessment = 'Strong strategy with good profitability';
    } else if (metrics.winRate >= 50 && metrics.profitFactor >= 1.2 && metrics.totalPnLPercent > 5) {
        grade = 'B';
        assessment = 'Solid strategy with moderate returns';
    } else if (metrics.winRate < 40 || metrics.profitFactor < 0.8) {
        grade = 'D';
        assessment = 'Poor strategy - needs significant improvement';
    } else if (metrics.totalPnLPercent < 0) {
        grade = 'F';
        assessment = 'Unprofitable strategy - major revisions needed';
    }

    return {
        grade,
        assessment,
        recommendation: getRecommendation(metrics, grade),
        riskLevel: getRiskLevel(metrics),
        consistency: getConsistency(metrics)
    };
};

// Get strategy recommendation
const getRecommendation = (metrics, grade) => {
    if (grade === 'A+' || grade === 'A') {
        return 'Consider increasing position size or adding more coins';
    } else if (grade === 'B') {
        return 'Good foundation - consider optimizing entry/exit criteria';
    } else if (grade === 'C') {
        return 'Review signal confidence thresholds and risk management';
    } else if (grade === 'D' || grade === 'F') {
        return 'Major strategy revision needed - consider different approach';
    }
    return 'Continue testing and optimization';
};

// Get risk level assessment
const getRiskLevel = (metrics) => {
    if (metrics.maxDrawdown > 25) return 'High';
    if (metrics.maxDrawdown > 15) return 'Medium';
    return 'Low';
};

// Get consistency assessment
const getConsistency = (metrics) => {
    if (metrics.sharpeRatio > 1.5) return 'Very Consistent';
    if (metrics.sharpeRatio > 1.0) return 'Consistent';
    if (metrics.sharpeRatio > 0.5) return 'Moderate';
    return 'Inconsistent';
};

export default {
    runBacktest,
    createBacktestConfig,
    calculatePerformanceMetrics,
    loadHistoricalData
};