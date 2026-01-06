/**
 * Data Quality Validator
 *
 * Validates data accuracy, consistency, and freshness
 * Identifies issues that could lead to bad trading decisions
 */

export class DataQualityValidator {
    constructor() {
        this.validationRules = this.defineValidationRules();
        this.lastValidation = {};
    }

    /**
     * Define validation rules for each data type
     */
    defineValidationRules() {
        return {
            price: {
                maxStalenessMs: 10000, // 10 seconds
                reasonableChangePercent: 5, // 5% move in one update is suspicious
                requiredFields: ['current', 'sessionChange']
            },
            openInterest: {
                maxStalenessMs: 30000, // 30 seconds
                reasonableChangePercent: 20, // 20% OI change is suspicious
                requiredFields: ['value', 'sessionChange']
            },
            funding: {
                maxStalenessMs: 60000, // 1 minute
                reasonableRange: [-0.01, 0.01], // Funding outside this range is extreme
                requiredFields: ['rate']
            },
            cvd: {
                maxStalenessMs: 15000, // 15 seconds
                requiredFields: ['sessionDelta', 'rolling5mDelta']
            },
            orderbook: {
                maxStalenessMs: 10000, // 10 seconds
                reasonableImbalance: 50, // >50% imbalance is suspicious (might be API issue)
                requiredFields: ['imbalance', 'avgImbalance']
            },
            whaleTrades: {
                maxStalenessMs: 60000, // 1 minute since last trade
                minThreshold: 1000000, // $1M minimum
                requiredFields: ['size', 'price', 'exchange', 'timestamp']
            },
            whalePositions: {
                maxStalenessMs: 60000, // 1 minute
                reasonableLeverage: 50, // >50x leverage is extreme
                requiredFields: ['size', 'entryPrice', 'leverage']
            }
        };
    }

    /**
     * Validate all data sources
     */
    async validate() {
        const issues = [];

        // Get current data from window (injected by app)
        const appData = window.__TRADERBIAS_DATA__ || {};

        // Validate each data type
        issues.push(...this.validatePriceData(appData.priceData));
        issues.push(...this.validateOIData(appData.oiData));
        issues.push(...this.validateFundingData(appData.fundingData));
        issues.push(...this.validateCVDData(appData.cvdData));
        issues.push(...this.validateOrderbookData(appData.orderbookData));
        issues.push(...this.validateWhaleTrades(appData.whaleTrades));
        issues.push(...this.validateWhalePositions(appData.whalePositions));
        issues.push(...this.validateExchangeConnections(appData.connectionStatus));

        return issues;
    }

    /**
     * Validate price data
     */
    validatePriceData(priceData) {
        const issues = [];
        if (!priceData) {
            issues.push({
                priority: 'critical',
                title: 'Price Data Missing',
                description: 'No price data available. Application cannot function without price feeds.',
                affectedFeatures: ['BiasCard', 'FlowConfluence', 'All Calculations'],
                fixSuggestion: 'Check API connectivity to Hyperliquid price endpoint'
            });
            return issues;
        }

        const coins = ['BTC', 'ETH', 'SOL'];
        const now = Date.now();

        coins.forEach(coin => {
            const data = priceData[coin];

            if (!data) {
                issues.push({
                    priority: 'high',
                    title: `${coin} Price Data Missing`,
                    description: `No price data for ${coin}`,
                    affectedFeatures: [`${coin} BiasCard`],
                    fixSuggestion: `Check ${coin} price API subscription`
                });
                return;
            }

            // Check staleness
            if (data.timestamp && (now - data.timestamp) > this.validationRules.price.maxStalenessMs) {
                issues.push({
                    priority: 'high',
                    title: `${coin} Price Data Stale`,
                    description: `Last update was ${Math.round((now - data.timestamp) / 1000)}s ago (threshold: 10s)`,
                    affectedFeatures: [`${coin} BiasCard`, 'Flow Confluence'],
                    fixSuggestion: 'Check WebSocket connection or API polling interval'
                });
            }

            // Check for unreasonable changes
            if (data.sessionChange && Math.abs(data.sessionChange) > this.validationRules.price.reasonableChangePercent) {
                issues.push({
                    priority: 'medium',
                    title: `${coin} Extreme Price Move`,
                    description: `${coin} showing ${data.sessionChange.toFixed(2)}% session change. Verify this is real.`,
                    affectedFeatures: [`${coin} BiasCard`],
                    fixSuggestion: 'Cross-check with other data sources. Might be API glitch or flash crash.'
                });
            }

            // Check required fields
            this.validationRules.price.requiredFields.forEach(field => {
                if (data[field] === undefined || data[field] === null) {
                    issues.push({
                        priority: 'medium',
                        title: `${coin} Price Missing Field: ${field}`,
                        description: `Required field "${field}" is missing from ${coin} price data`,
                        affectedFeatures: [`${coin} BiasCard`],
                        fixSuggestion: `Ensure API response includes ${field}`
                    });
                }
            });
        });

        return issues;
    }

    /**
     * Validate Open Interest data
     */
    validateOIData(oiData) {
        const issues = [];
        if (!oiData) {
            issues.push({
                priority: 'high',
                title: 'Open Interest Data Missing',
                description: 'No OI data available. Critical for flow confluence analysis.',
                affectedFeatures: ['OI Velocity', 'Flow Confluence', 'OI Bias'],
                fixSuggestion: 'Check Hyperliquid OI API endpoint'
            });
            return issues;
        }

        const coins = ['BTC', 'ETH', 'SOL'];
        coins.forEach(coin => {
            const data = oiData[coin];

            if (!data) {
                issues.push({
                    priority: 'high',
                    title: `${coin} OI Data Missing`,
                    description: `No OI data for ${coin}. Cannot calculate OI bias or velocity.`,
                    affectedFeatures: [`${coin} OI Velocity`, 'Flow Confluence'],
                    fixSuggestion: `Check ${coin} OI API subscription`
                });
                return;
            }

            // Check for extreme OI changes (might indicate data error)
            if (data.sessionChange && Math.abs(data.sessionChange) > this.validationRules.openInterest.reasonableChangePercent) {
                issues.push({
                    priority: 'medium',
                    title: `${coin} Extreme OI Change`,
                    description: `${coin} OI changed ${data.sessionChange.toFixed(2)}% in one session. Verify accuracy.`,
                    affectedFeatures: [`${coin} Flow Confluence`],
                    fixSuggestion: 'Might be real deleveraging event or API error. Cross-check with exchange directly.'
                });
            }
        });

        return issues;
    }

    /**
     * Validate Funding Rate data
     */
    validateFundingData(fundingData) {
        const issues = [];
        if (!fundingData) {
            issues.push({
                priority: 'medium',
                title: 'Funding Rate Data Missing',
                description: 'No funding rate data. Affects sentiment analysis.',
                affectedFeatures: ['Funding Bias', 'Composite Bias'],
                fixSuggestion: 'Check funding rate API endpoint'
            });
            return issues;
        }

        const coins = ['BTC', 'ETH', 'SOL'];
        coins.forEach(coin => {
            const data = fundingData[coin];

            if (!data || data.rate === undefined) {
                issues.push({
                    priority: 'medium',
                    title: `${coin} Funding Rate Missing`,
                    description: `No funding rate for ${coin}`,
                    affectedFeatures: [`${coin} Composite Bias`],
                    fixSuggestion: `Check ${coin} funding rate API`
                });
                return;
            }

            // Check for extreme funding (might be API error)
            const [min, max] = this.validationRules.funding.reasonableRange;
            if (data.rate < min || data.rate > max) {
                issues.push({
                    priority: 'low',
                    title: `${coin} Extreme Funding Rate`,
                    description: `${coin} funding at ${(data.rate * 100).toFixed(4)}%. This is extreme but might be real.`,
                    affectedFeatures: [`${coin} Funding Bias`],
                    fixSuggestion: 'Verify with exchange. Extreme funding is rare but possible during volatility.'
                });
            }
        });

        return issues;
    }

    /**
     * Validate CVD data
     */
    validateCVDData(cvdData) {
        const issues = [];
        if (!cvdData) {
            issues.push({
                priority: 'high',
                title: 'CVD Data Missing',
                description: 'No CVD (Cumulative Volume Delta) data. Critical for flow analysis.',
                affectedFeatures: ['CVD Bias', 'Flow Confluence', 'Divergence Detection'],
                fixSuggestion: 'Check trades API endpoint for CVD calculation'
            });
            return issues;
        }

        const coins = ['BTC', 'ETH', 'SOL'];
        coins.forEach(coin => {
            const data = cvdData[coin];

            if (!data) {
                issues.push({
                    priority: 'high',
                    title: `${coin} CVD Data Missing`,
                    description: `No CVD data for ${coin}. Cannot analyze buy/sell pressure.`,
                    affectedFeatures: [`${coin} Flow Confluence`],
                    fixSuggestion: `Ensure trade data is being collected for ${coin}`
                });
            }
        });

        return issues;
    }

    /**
     * Validate Orderbook data
     */
    validateOrderbookData(orderbookData) {
        const issues = [];
        if (!orderbookData) {
            issues.push({
                priority: 'medium',
                title: 'Orderbook Data Missing',
                description: 'No orderbook data. Cannot analyze bid/ask pressure.',
                affectedFeatures: ['Orderbook Bias', 'Liquidity Analysis'],
                fixSuggestion: 'Check orderbook API endpoint'
            });
            return issues;
        }

        const coins = ['BTC', 'ETH', 'SOL'];
        coins.forEach(coin => {
            const data = orderbookData[coin];

            if (!data) {
                issues.push({
                    priority: 'medium',
                    title: `${coin} Orderbook Missing`,
                    description: `No orderbook data for ${coin}`,
                    affectedFeatures: [`${coin} Orderbook Section`],
                    fixSuggestion: `Check ${coin} orderbook API`
                });
                return;
            }

            // Check for extreme imbalances (might be API error or spoofing)
            if (data.imbalance && Math.abs(data.imbalance) > this.validationRules.orderbook.reasonableImbalance) {
                issues.push({
                    priority: 'low',
                    title: `${coin} Extreme Orderbook Imbalance`,
                    description: `${coin} showing ${data.imbalance.toFixed(1)}% imbalance. Might be spoofed wall.`,
                    affectedFeatures: [`${coin} Orderbook Section`],
                    fixSuggestion: 'Watch for wall cancellations. Extreme imbalance often indicates spoofing.'
                });
            }
        });

        return issues;
    }

    /**
     * Validate Whale Trades
     */
    validateWhaleTrades(whaleTrades) {
        const issues = [];
        if (!whaleTrades || whaleTrades.length === 0) {
            issues.push({
                priority: 'low',
                title: 'No Recent Whale Trades',
                description: 'No whale trades in last minute. Might be normal during low activity.',
                affectedFeatures: ['Whale Trade Feed'],
                fixSuggestion: 'Check WebSocket connections to exchanges. Or activity is just low.'
            });
            return issues;
        }

        // Check for trades with missing data
        whaleTrades.forEach((trade, idx) => {
            this.validationRules.whaleTrades.requiredFields.forEach(field => {
                if (!trade[field]) {
                    issues.push({
                        priority: 'low',
                        title: `Whale Trade Missing Field: ${field}`,
                        description: `Trade #${idx} from ${trade.exchange} missing ${field}`,
                        affectedFeatures: ['Whale Trade Feed'],
                        fixSuggestion: `Fix parser for ${trade.exchange} WebSocket`
                    });
                }
            });
        });

        return issues;
    }

    /**
     * Validate Whale Positions
     */
    validateWhalePositions(whalePositions) {
        const issues = [];
        if (!whalePositions || whalePositions.length === 0) {
            issues.push({
                priority: 'medium',
                title: 'No Whale Positions Loaded',
                description: 'Cannot calculate whale consensus or liquidation proximity.',
                affectedFeatures: ['Whale Consensus', 'Liquidation Map'],
                fixSuggestion: 'Check Hyperliquid leaderboard API'
            });
            return issues;
        }

        // Check for extreme leverage (might be data error)
        whalePositions.forEach(pos => {
            if (pos.leverage && pos.leverage > this.validationRules.whalePositions.reasonableLeverage) {
                issues.push({
                    priority: 'low',
                    title: `Extreme Leverage Detected: ${pos.leverage}x`,
                    description: `Trader ${pos.address?.slice(0, 8)} using ${pos.leverage}x leverage on ${pos.coin}. Risky.`,
                    affectedFeatures: ['Liquidation Map'],
                    fixSuggestion: 'Verify leverage calculation. >50x is rare but possible on some exchanges.'
                });
            }
        });

        return issues;
    }

    /**
     * Validate Exchange Connections
     */
    validateExchangeConnections(connectionStatus) {
        const issues = [];
        if (!connectionStatus) {
            issues.push({
                priority: 'medium',
                title: 'No Connection Status Available',
                description: 'Cannot verify exchange WebSocket connections.',
                affectedFeatures: ['Whale Trade Feed'],
                fixSuggestion: 'Ensure useWhaleWebSockets hook exposes connection status'
            });
            return issues;
        }

        // Check each exchange connection
        Object.entries(connectionStatus).forEach(([exchange, status]) => {
            if (status === 'disconnected' || status === 'error') {
                issues.push({
                    priority: 'medium',
                    title: `${exchange} Connection Failed`,
                    description: `WebSocket to ${exchange} is ${status}. No whale trades from this source.`,
                    affectedFeatures: ['Whale Trade Feed'],
                    fixSuggestion: `Check ${exchange} WebSocket config. Might be blocked by region or down.`
                });
            }
        });

        return issues;
    }
}
