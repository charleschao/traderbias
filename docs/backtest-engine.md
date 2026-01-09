# Trader Bias Backtesting Engine Documentation

This document describes the architecture, data model, data sources, and usage of the built-in backtesting engine added to Trader Bias. It covers core components, how they interact, and how to extend or customize the backtest workflow.

## Overview
- Purpose: Validate trading strategies using historical data and bias signals before deploying to live trading.
- Scope: Data collection from multiple exchanges, signal generation from bias calculations, risk-managed execution, and advanced performance analytics.
- Current capabilities: End-to-end backtest pipeline with multi-coin support, basic to advanced risk metrics, Monte Carlo simulations, and a UI integration for configuration and results.

## Architecture & Data Flow
- Core modules
  - Historical data collection: `src/services/historicalDataService.js` collects candles/price/volume, funding, open interest from multiple sources and caches data.
  - Backtest engine: `src/utils/backtestEngine.js` orchestrates the backtest flow, generates signals, executes trades, tracks P&L, and outputs metrics.
  - Performance analytics: `src/utils/performanceAnalytics.js` computes advanced metrics (Calmar, Sortino, Sharpe, Monte Carlo, etc.).
  - Portfolio simulation: `src/utils/portfolioSimulation.js` provides position sizing, risk management, leverage logic, and P&L accounting.
  - UI layer: `src/components/BacktestPanel.jsx` exposes controls and displays results.
- Data flow (high level)
  1. User configures backtest window, coins, and risk settings.
  2. Engine collects/loads historical data from `HistoricalDataService`.
  3. For each timestamp, bias calculations produce signals which drive simulated trades.
  4. Trades are tracked with entry/exit prices, P&L, and duration.
  5. Results are aggregated into metrics and visualized by the UI.

## Data Model
- Signal
  - timestamp, coin, signal ('bullish'|'bearish'|'neutral'), confidence, components, entryPrice, exitPrice, pnl, pnlPercent, duration, status
- Trade (embedded in Signal)
  - entryPrice, exitPrice, pnl, pnlPercent, duration, status, exitReason
- Backtest Config
  - startDate, endDate, initialCapital, positionSize, maxPositions, takeProfit, stopLoss, maxDuration, minConfidence, cooldown, fees, slippage
- Metrics & Summary
  - totalTrades, winRate, totalPnL, totalPnLPercent, shmape-like metrics, maxDrawdown, etc.

## Data Sources
- Hyperliquid: price, candles, funding, open interest
- Binance Futures: price, candles, funding, open interest
- Nado: historical trades for whale context (optional in backtest plumbing)
- Data collection service handles merging and caching to improve resilience.

## API Surface (Internal)
- runBacktest(config, coins)
  - Returns: { config, trades, signals, equity, timestamps, metrics, summary }
- createBacktestConfig(startDate, endDate, initialCapital)
- loadHistoricalData(startDate, endDate, coins)
- collectHistoricalData(startDate, endDate, coins, resolution)
- getCollectionProgress()
- clearHistoricalDataCache()
- PortfolioSimulator (class) with methods:
  - executeTrade(signal, entryPrice, timestamp)
  - closePosition(coin, exitPrice, timestamp, reason)
  - getPortfolioSummary()
- Performance analytics surface:
  - calculateAdvancedMetrics(trades, config, equity, timestamps)
  - generatePerformanceReport(results, config)

Notes:
- The backtest API surface is designed for composable usage within the app and is not a public REST API.
- The code is organized to enable extension with additional data sources or coins.

## Getting Started (Quick Start)
1) Ensure backtest UI is visible: a “Backtesting” button is exposed in the main UI.
2) Open Backtest panel and configure:
   - Date range (startDate, endDate)
   - Coins (BTC, ETH, SOL, etc.)
   - Capital and risk settings (initial capital, position size, take profit, stop loss, max duration, confidence)
3) Click Start Backtest. The engine will:
   - Collect historical data
   - Generate bias signals per timestamp per coin
   - Execute trades with risk controls
   - Produce a results payload with metrics and a historical equity curve
4) Review results in the Backtest Results view.

## Example Configuration
```
{
  "startDate": "2025-12-01T00:00:00.000Z",
  "endDate": "2025-12-31T23:59:59.999Z",
  "initialCapital": 10000,
  "positionSize": 0.1, // 10%
  "maxPositions": 3,
  "takeProfit": 0.05, // 5%
  "stopLoss": 0.03, // 3%
  "maxDuration": 1440, // 24h in minutes
  "minConfidence": 0.3,
  "coins": ["BTC","ETH","SOL"],
  "fees": 0.0005,
  "slippage": 0.0002
}
```

## File Map (Backtest-Related)
- Core engine: `src/utils/backtestEngine.js`
- Historical data: `src/services/historicalDataService.js`
- Performance analytics: `src/utils/performanceAnalytics.js`
- Portfolio simulator: `src/utils/portfolioSimulation.js`
- UI components: `src/components/BacktestPanel.jsx`
- App integration: see `App.jsx` changes for the Backtest button and panel wiring

## Extensibility & Customization
- Add more data sources by extending `HISTORICAL_DATA_SOURCES` in `historicalDataService.js`.
- Extend signals by adjusting bias logic in `biasCalculations.js` and wiring to the backtest through `generateSignalAtTime`.
- Swap or enhance risk rules by modifying `PortfolioSimulator` and `RiskManager` in `portfolioSimulation.js`.

## Testing & Validation
- Add unit tests for:
  - Signal generation stability under edge cases.
  - P&L calculations with different entry/exit scenarios.
  - Risk rule enforcement (leverage, max drawdown, position sizes).
- Consider Vitest + React Testing Library for UI components and Jest for non-UI logic.

## Known Limitations
- Data quality: backtests rely on mocked/merged data and external API behavior; real API failures are simulated in code paths.
- Slippage and fees are simplified models; tune to reflect your environment.
- Backtest results depend on historical data completeness; ensure date ranges align with available sources.

## Roadmap & Future Enhancements
- Add multi-strategy backtesting (parallel runs, stratified sampling).
- Introduce parameter optimization (grid search, Bayesian optimization).
- Integrate with a dedicated backtesting database for large-scale scenarios.

## Change History (Summary)
- Added backtest engine modules, data services, analytics, and UI integration.
- Introduced a BacktestPanel in the UI and wired controls to run experiments.
- Enhanced App with backtest toggle and results rendering.

## Contributing
- Follow the repository’s AGENTS.md guidelines.
- Document any new data sources, signals, or risk rules added.

## Author Notes
- This document summarizes the implemented backtesting system and should be kept up-to-date as the code evolves.
