// ============== PORTFOLIO SIMULATION & RISK MANAGEMENT ==============
// Advanced portfolio simulation and risk management for backtesting

// ============== PORTFOLIO SIMULATION ==============

export class PortfolioSimulator {
    constructor(config) {
        this.config = config;
        this.portfolio = {
            cash: config.initialCapital,
            positions: {},
            totalValue: config.initialCapital,
            maxLeverage: 1,
            currentLeverage: 0,
            unrealizedPnL: 0,
            realizedPnL: 0
        };
        this.riskMetrics = {
            var95: 0, // Value at Risk 95%
            var99: 0, // Value at Risk 99%
            maxDrawdown: 0,
            sharpeRatio: 0,
            sortinoRatio: 0,
            calmarRatio: 0,
            beta: 0,
            correlation: {}
        };
        this.history = [];
        this.riskEvents = [];
    }

    // Execute trade with portfolio impact
    executeTrade(signal, entryPrice, timestamp) {
        const positionSize = this.calculatePositionSize(signal, entryPrice);
        const tradeValue = positionSize * entryPrice;
        const fees = tradeValue * this.config.fees;
        const totalCost = tradeValue + fees;

        // Check if we have enough capital
        if (this.portfolio.cash < totalCost) {
            return { success: false, reason: 'Insufficient capital' };
        }

        // Create position
        const position = {
            id: signal.id,
            coin: signal.coin,
            type: signal.signal,
            size: positionSize,
            entryPrice,
            entryTime: timestamp,
            currentPrice: entryPrice,
            unrealizedPnL: 0,
            realizedPnL: 0,
            fees,
            margin: tradeValue * this.config.marginRequirement || 0,
            leverage: this.config.leverage || 1
        };

        // Update portfolio
        this.portfolio.cash -= totalCost;
        this.portfolio.positions[signal.coin] = position;
        this.portfolio.currentLeverage = this.calculateCurrentLeverage();

        // Record trade
        this.history.push({
            timestamp,
            type: 'ENTRY',
            coin: signal.coin,
            signal: signal.signal,
            price: entryPrice,
            size: positionSize,
            fees,
            portfolioValue: this.portfolio.totalValue,
            cash: this.portfolio.cash,
            leverage: this.portfolio.currentLeverage
        });

        return { success: true, position };
    }

    // Close position and calculate P&L
    closePosition(coin, exitPrice, timestamp, reason = 'signal') {
        const position = this.portfolio.positions[coin];
        if (!position) return { success: false, reason: 'No position found' };

        // Calculate P&L
        const priceChange = exitPrice - position.entryPrice;
        const direction = position.type === 'bullish' ? 1 : -1;
        const grossPnL = (priceChange * position.size * direction) / position.entryPrice;
        const fees = (position.size * exitPrice * this.config.fees);
        const netPnL = grossPnL - fees;

        // Update position
        position.exitPrice = exitPrice;
        position.exitTime = timestamp;
        position.realizedPnL = netPnL;
        position.exitReason = reason;

        // Update portfolio
        this.portfolio.cash += (position.size * exitPrice) - fees;
        this.portfolio.realizedPnL += netPnL;
        delete this.portfolio.positions[coin];
        this.portfolio.currentLeverage = this.calculateCurrentLeverage();

        // Update total value
        this.updatePortfolioValue(exitPrice);

        // Check for risk events
        this.checkRiskEvents(netPnL, timestamp);

        // Record trade
        this.history.push({
            timestamp,
            type: 'EXIT',
            coin,
            entryPrice: position.entryPrice,
            exitPrice,
            size: position.size,
            grossPnL,
            fees,
            netPnL,
            reason,
            portfolioValue: this.portfolio.totalValue,
            cash: this.portfolio.cash,
            leverage: this.portfolio.currentLeverage
        });

        return { success: true, netPnL, position };
    }

    // Calculate optimal position size
    calculatePositionSize(signal, entryPrice) {
        const baseSize = this.portfolio.totalValue * this.config.positionSize;
        
        // Adjust based on signal confidence
        const confidenceMultiplier = signal.confidence || 0.5;
        
        // Adjust based on volatility (if available)
        const volatilityMultiplier = this.getVolatilityMultiplier(signal.coin);
        
        // Kelly Criterion adjustment (simplified)
        const kellyMultiplier = this.getKellyMultiplier(signal);
        
        // Risk-based sizing
        const riskMultiplier = this.getRiskMultiplier(signal, entryPrice);
        
        const adjustedSize = baseSize * confidenceMultiplier * volatilityMultiplier * kellyMultiplier * riskMultiplier;
        
        // Ensure we don't exceed maximum position size
        const maxSize = this.portfolio.totalValue * (this.config.maxPositionSize || 0.2);
        return Math.min(adjustedSize, maxSize);
    }

    // Get volatility multiplier for position sizing
    getVolatilityMultiplier(coin) {
        // Simplified volatility adjustment
        // In a real implementation, use historical volatility data
        const volatilityMap = {
            'BTC': 0.8,  // Lower volatility, larger position
            'ETH': 0.7,  // Medium volatility
            'SOL': 0.6   // Higher volatility, smaller position
        };
        return volatilityMap[coin] || 0.7;
    }

    // Get Kelly Criterion multiplier
    getKellyMultiplier(signal) {
        // Simplified Kelly: f* = (bp - q) / b
        // where b = odds, p = win probability, q = loss probability
        const winRate = this.getHistoricalWinRate(signal.coin, signal.signal);
        const avgWin = this.getHistoricalAvgWin(signal.coin, signal.signal);
        const avgLoss = this.getHistoricalAvgLoss(signal.coin, signal.signal);
        
        if (avgLoss === 0) return 0.1; // Conservative default
        
        const odds = avgWin / avgLoss;
        const kelly = (odds * winRate - (1 - winRate)) / odds;
        
        // Use fractional Kelly (25% of full Kelly) for safety
        return Math.max(0.1, Math.min(0.5, kelly * 0.25));
    }

    // Get risk-based multiplier
    getRiskMultiplier(signal, entryPrice) {
        // Adjust position size based on risk/reward ratio
        const stopLossDistance = this.config.stopLoss || 0.03; // 3% default
        const takeProfitDistance = this.config.takeProfit || 0.05; // 5% default
        
        const riskRewardRatio = takeProfitDistance / stopLossDistance;
        
        // Higher risk/reward ratio allows larger position
        return Math.min(1.5, Math.max(0.5, riskRewardRatio / 2));
    }

    // Update portfolio value with current prices
    updatePortfolioValue(currentPrices = {}) {
        let totalValue = this.portfolio.cash;
        let unrealizedPnL = 0;

        Object.values(this.portfolio.positions).forEach(position => {
            const currentPrice = currentPrices[position.coin] || position.currentPrice;
            const priceChange = currentPrice - position.entryPrice;
            const direction = position.type === 'bullish' ? 1 : -1;
            const positionValue = (position.size * currentPrice * direction) / position.entryPrice;
            const positionPnL = (priceChange * position.size * direction) / position.entryPrice;
            
            totalValue += positionValue;
            unrealizedPnL += positionPnL;
            
            position.currentPrice = currentPrice;
            position.unrealizedPnL = positionPnL;
        });

        this.portfolio.totalValue = totalValue;
        this.portfolio.unrealizedPnL = unrealizedPnL;
    }

    // Calculate current leverage
    calculateCurrentLeverage() {
        const totalPositionValue = Object.values(this.portfolio.positions)
            .reduce((sum, pos) => sum + (pos.size * pos.currentPrice), 0);
        
        return this.portfolio.totalValue > 0 ? totalPositionValue / this.portfolio.totalValue : 0;
    }

    // Check for risk events
    checkRiskEvents(pnl, timestamp) {
        // Large loss event
        if (pnl < -this.portfolio.totalValue * 0.05) { // 5% loss
            this.riskEvents.push({
                timestamp,
                type: 'LARGE_LOSS',
                severity: pnl < -this.portfolio.totalValue * 0.1 ? 'HIGH' : 'MEDIUM',
                pnl,
                description: `Large loss: ${pnl.toFixed(2)} (${(pnl/this.portfolio.totalValue * 100).toFixed(2)}%)`
            });
        }

        // Leverage breach
        if (this.portfolio.currentLeverage > (this.config.maxLeverage || 2)) {
            this.riskEvents.push({
                timestamp,
                type: 'LEVERAGE_BREACH',
                severity: 'HIGH',
                leverage: this.portfolio.currentLeverage,
                description: `Leverage exceeded: ${this.portfolio.currentLeverage.toFixed(2)}x`
            });
        }
    }

    // Calculate risk metrics
    calculateRiskMetrics() {
        if (this.history.length < 10) return this.riskMetrics;

        const returns = this.calculateReturns();
        const portfolioValues = this.history.map(h => h.portfolioValue);

        // Value at Risk calculations
        this.riskMetrics.var95 = this.calculateVaR(returns, 0.05);
        this.riskMetrics.var99 = this.calculateVaR(returns, 0.01);

        // Maximum drawdown
        this.riskMetrics.maxDrawdown = this.calculateMaxDrawdown(portfolioValues);

        // Risk-adjusted returns
        this.riskMetrics.sharpeRatio = this.calculateSharpeRatio(returns);
        this.riskMetrics.sortinoRatio = this.calculateSortinoRatio(returns);
        this.riskMetrics.calmarRatio = this.calculateCalmarRatio(portfolioValues);

        // Beta (simplified)
        this.riskMetrics.beta = this.calculateBeta(returns);

        return this.riskMetrics;
    }

    // Calculate returns from history
    calculateReturns() {
        const returns = [];
        for (let i = 1; i < this.history.length; i++) {
            const prev = this.history[i - 1].portfolioValue;
            const curr = this.history[i].portfolioValue;
            if (prev > 0) {
                returns.push((curr - prev) / prev);
            }
        }
        return returns;
    }

    // Calculate Value at Risk
    calculateVaR(returns, percentile) {
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor(returns.length * percentile);
        return sortedReturns[index] * this.portfolio.totalValue;
    }

    // Calculate Maximum Drawdown
    calculateMaxDrawdown(values) {
        let peak = values[0];
        let maxDrawdown = 0;

        values.forEach(value => {
            if (value > peak) peak = value;
            const drawdown = (peak - value) / peak;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        });

        return maxDrawdown * 100; // Return as percentage
    }

    // Calculate Sharpe Ratio
    calculateSharpeRatio(returns) {
        if (returns.length === 0) return 0;

        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        // Annualized Sharpe (assuming daily returns)
        const annualizedReturn = avgReturn * 365;
        const annualizedStdDev = stdDev * Math.sqrt(365);

        return annualizedStdDev > 0 ? annualizedReturn / annualizedStdDev : 0;
    }

    // Calculate Sortino Ratio
    calculateSortinoRatio(returns) {
        if (returns.length === 0) return 0;

        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const negativeReturns = returns.filter(r => r < 0);
        
        if (negativeReturns.length === 0) return 999;

        const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / negativeReturns.length;
        const downsideStdDev = Math.sqrt(downsideVariance);

        // Annualized Sortino
        const annualizedReturn = avgReturn * 365;
        const annualizedDownsideStdDev = downsideStdDev * Math.sqrt(365);

        return annualizedDownsideStdDev > 0 ? annualizedReturn / annualizedDownsideStdDev : 0;
    }

    // Calculate Calmar Ratio
    calculateCalmarRatio(values) {
        if (values.length < 2) return 0;

        const totalReturn = (values[values.length - 1] - values[0]) / values[0];
        const maxDrawdown = this.calculateMaxDrawdown(values);

        // Annualized return (simplified)
        const days = values.length;
        const annualizedReturn = totalReturn * (365 / days);

        return maxDrawdown > 0 ? annualizedReturn / (maxDrawdown / 100) : 0;
    }

    // Calculate Beta (simplified)
    calculateBeta(returns) {
        // In a real implementation, compare against market benchmark
        // For now, return 1 (market correlation)
        return 1;
    }

    // Get portfolio summary
    getPortfolioSummary() {
        return {
            totalValue: this.portfolio.totalValue,
            cash: this.portfolio.cash,
            positions: Object.keys(this.portfolio.positions).length,
            unrealizedPnL: this.portfolio.unrealizedPnL,
            realizedPnL: this.portfolio.realizedPnL,
            totalPnL: this.portfolio.unrealizedPnL + this.portfolio.realizedPnL,
            leverage: this.portfolio.currentLeverage,
            return: ((this.portfolio.totalValue - this.config.initialCapital) / this.config.initialCapital) * 100,
            riskMetrics: this.calculateRiskMetrics(),
            riskEvents: this.riskEvents.length,
            trades: this.history.length
        };
    }

    // Helper methods (simplified implementations)
    getHistoricalWinRate(coin, signal) { return 0.5; }
    getHistoricalAvgWin(coin, signal) { return 0.05; }
    getHistoricalAvgLoss(coin, signal) { return 0.03; }
}

// ============== RISK MANAGEMENT SYSTEM ==============

export class RiskManager {
    constructor(config) {
        this.config = config;
        this.riskLimits = {
            maxLeverage: config.maxLeverage || 2,
            maxPositionSize: config.maxPositionSize || 0.2,
            maxDrawdown: config.maxDrawdown || 0.15,
            maxDailyLoss: config.maxDailyLoss || 0.05,
            maxCorrelation: config.maxCorrelation || 0.7,
            minConfidence: config.minConfidence || 0.3
        };
        this.alerts = [];
        this.stopLosses = {};
        this.takeProfits = {};
    }

    // Check if trade is allowed based on risk rules
    isTradeAllowed(portfolio, signal, entryPrice) {
        const checks = [
            this.checkLeverageLimit(portfolio),
            this.checkPositionSizeLimit(portfolio, signal),
            this.checkDrawdownLimit(portfolio),
            this.checkDailyLossLimit(portfolio),
            this.checkCorrelationLimit(portfolio, signal),
            this.checkConfidenceLimit(signal),
            this.checkLiquidityLimit(signal, entryPrice)
        ];

        const failedChecks = checks.filter(check => !check.allowed);
        
        if (failedChecks.length > 0) {
            this.alerts.push({
                timestamp: Date.now(),
                type: 'TRADE_REJECTED',
                signal: signal.id,
                reasons: failedChecks.map(check => check.reason),
                severity: 'HIGH'
            });
            return false;
        }

        return true;
    }

    // Check leverage limit
    checkLeverageLimit(portfolio) {
        const currentLeverage = portfolio.currentLeverage || 0;
        const allowed = currentLeverage <= this.riskLimits.maxLeverage;
        
        return {
            allowed,
            reason: allowed ? null : `Leverage ${currentLeverage.toFixed(2)}x exceeds limit ${this.riskLimits.maxLeverage}x`
        };
    }

    // Check position size limit
    checkPositionSizeLimit(portfolio, signal) {
        const existingPosition = portfolio.positions[signal.coin];
        const currentValue = portfolio.totalValue;
        const maxSize = currentValue * this.riskLimits.maxPositionSize;
        
        // Calculate new position size
        const newSize = currentValue * (signal.confidence * this.config.positionSize || 0.1);
        const totalSize = (existingPosition?.size || 0) + newSize;
        
        const allowed = totalSize <= maxSize;
        
        return {
            allowed,
            reason: allowed ? null : `Position size ${totalSize.toFixed(2)} exceeds limit ${maxSize.toFixed(2)}`
        };
    }

    // Check drawdown limit
    checkDrawdownLimit(portfolio) {
        const currentDrawdown = this.calculateCurrentDrawdown(portfolio);
        const allowed = currentDrawdown <= this.riskLimits.maxDrawdown;
        
        return {
            allowed,
            reason: allowed ? null : `Drawdown ${(currentDrawdown * 100).toFixed(2)}% exceeds limit ${(this.riskLimits.maxDrawdown * 100).toFixed(2)}%`
        };
    }

    // Check daily loss limit
    checkDailyLossLimit(portfolio) {
        const dailyPnL = this.calculateDailyPnL(portfolio);
        const dailyLoss = Math.abs(Math.min(0, dailyPnL));
        const dailyLossPercent = dailyLoss / this.config.initialCapital;
        const allowed = dailyLossPercent <= this.riskLimits.maxDailyLoss;
        
        return {
            allowed,
            reason: allowed ? null : `Daily loss ${(dailyLossPercent * 100).toFixed(2)}% exceeds limit ${(this.riskLimits.maxDailyLoss * 100).toFixed(2)}%`
        };
    }

    // Check correlation limit
    checkCorrelationLimit(portfolio, signal) {
        // Simplified correlation check
        const existingCoins = Object.keys(portfolio.positions);
        
        if (existingCoins.length === 0) {
            return { allowed: true, reason: null };
        }

        // Check if new signal is too correlated with existing positions
        const maxCorrelation = this.getMaxCorrelation(signal.coin, existingCoins);
        const allowed = maxCorrelation <= this.riskLimits.maxCorrelation;
        
        return {
            allowed,
            reason: allowed ? null : `Correlation ${maxCorrelation.toFixed(2)} exceeds limit ${this.riskLimits.maxCorrelation}`
        };
    }

    // Check confidence limit
    checkConfidenceLimit(signal) {
        const allowed = signal.confidence >= this.riskLimits.minConfidence;
        
        return {
            allowed,
            reason: allowed ? null : `Confidence ${signal.confidence.toFixed(2)} below minimum ${this.riskLimits.minConfidence}`
        };
    }

    // Check liquidity limit
    checkLiquidityLimit(signal, entryPrice) {
        // Simplified liquidity check
        // In a real implementation, check orderbook depth
        const positionValue = (this.config.initialCapital * this.config.positionSize * signal.confidence);
        const minLiquidity = positionValue * 10; // Require 10x liquidity
        
        return {
            allowed: true,
            reason: null // Always allow for now
        };
    }

    // Set dynamic stop loss
    setStopLoss(coin, entryPrice, signal) {
        const stopLossPercent = this.calculateDynamicStopLoss(signal);
        const stopLossPrice = signal.signal === 'bullish' 
            ? entryPrice * (1 - stopLossPercent)
            : entryPrice * (1 + stopLossPercent);
        
        this.stopLosses[coin] = {
            price: stopLossPrice,
            percent: stopLossPercent,
            entryPrice,
            signal: signal.signal,
            timestamp: Date.now()
        };
    }

    // Set dynamic take profit
    setTakeProfit(coin, entryPrice, signal) {
        const takeProfitPercent = this.calculateDynamicTakeProfit(signal);
        const takeProfitPrice = signal.signal === 'bullish'
            ? entryPrice * (1 + takeProfitPercent)
            : entryPrice * (1 - takeProfitPercent);
        
        this.takeProfits[coin] = {
            price: takeProfitPrice,
            percent: takeProfitPercent,
            entryPrice,
            signal: signal.signal,
            timestamp: Date.now()
        };
    }

    // Calculate dynamic stop loss based on volatility and signal strength
    calculateDynamicStopLoss(signal) {
        const baseStopLoss = this.config.stopLoss || 0.03; // 3% default
        
        // Adjust based on signal confidence
        const confidenceAdjustment = (1 - signal.confidence) * 0.02; // Wider stops for lower confidence
        
        // Adjust based on volatility
        const volatilityAdjustment = this.getVolatilityAdjustment(signal.coin);
        
        return Math.max(0.01, Math.min(0.1, baseStopLoss + confidenceAdjustment + volatilityAdjustment));
    }

    // Calculate dynamic take profit
    calculateDynamicTakeProfit(signal) {
        const baseTakeProfit = this.config.takeProfit || 0.05; // 5% default
        
        // Adjust based on signal confidence
        const confidenceAdjustment = signal.confidence * 0.03; // Higher targets for higher confidence
        
        // Risk/reward ratio adjustment
        const riskRewardAdjustment = this.getRiskRewardAdjustment(signal);
        
        return Math.max(0.02, Math.min(0.2, baseTakeProfit + confidenceAdjustment + riskRewardAdjustment));
    }

    // Get volatility adjustment
    getVolatilityAdjustment(coin) {
        const volatilityMap = {
            'BTC': 0.005,  // Low volatility
            'ETH': 0.01,   // Medium volatility
            'SOL': 0.02    // High volatility
        };
        return volatilityMap[coin] || 0.01;
    }

    // Get risk/reward adjustment
    getRiskRewardAdjustment(signal) {
        // Higher risk/reward for stronger signals
        return signal.confidence * 0.02;
    }

    // Check if stop loss is triggered
    checkStopLoss(coin, currentPrice) {
        const stopLoss = this.stopLosses[coin];
        if (!stopLoss) return false;

        if (stopLoss.signal === 'bullish') {
            return currentPrice <= stopLoss.price;
        } else {
            return currentPrice >= stopLoss.price;
        }
    }

    // Check if take profit is triggered
    checkTakeProfit(coin, currentPrice) {
        const takeProfit = this.takeProfits[coin];
        if (!takeProfit) return false;

        if (takeProfit.signal === 'bullish') {
            return currentPrice >= takeProfit.price;
        } else {
            return currentPrice <= takeProfit.price;
        }
    }

    // Helper methods
    calculateCurrentDrawdown(portfolio) {
        const peak = this.config.initialCapital;
        const current = portfolio.totalValue;
        return Math.max(0, (peak - current) / peak);
    }

    calculateDailyPnL(portfolio) {
        // Simplified daily P&L calculation
        return portfolio.unrealizedPnL + portfolio.realizedPnL;
    }

    getMaxCorrelation(newCoin, existingCoins) {
        // Simplified correlation matrix
        const correlationMatrix = {
            'BTC-ETH': 0.8,
            'BTC-SOL': 0.7,
            'ETH-SOL': 0.75
        };

        let maxCorrelation = 0;
        existingCoins.forEach(coin => {
            const key = [newCoin, coin].sort().join('-');
            maxCorrelation = Math.max(maxCorrelation, correlationMatrix[key] || 0.5);
        });

        return maxCorrelation;
    }

    // Get risk alerts
    getRiskAlerts() {
        return this.alerts;
    }

    // Clear old alerts
    clearAlerts(maxAge = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        this.alerts = this.alerts.filter(alert => now - alert.timestamp < maxAge);
    }
}

export default {
    PortfolioSimulator,
    RiskManager
};