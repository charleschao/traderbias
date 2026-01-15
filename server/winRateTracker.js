/**
 * Win Rate Tracker for Bias Projections
 *
 * Tracks prediction accuracy over time to validate algorithm performance
 * Stores predictions and evaluates outcome after 10-20 hours (type-dependent)
 */

const fs = require('fs');
const path = require('path');
const dataStore = require('./dataStore');

const WIN_RATE_FILE = path.join(__dirname, 'data', 'winrates.json');
const MAX_HISTORY_DAYS = 365;
const EVALUATION_DELAYS = {
  '12hr': 8 * 60 * 60 * 1000,   // 8 hours
  'daily': 16 * 60 * 60 * 1000, // 16 hours
  '4hr': 3 * 60 * 60 * 1000,    // 3 hours
  'oi-4hr': 3 * 60 * 60 * 1000, // 3 hours
  'cvd-2hr': 1.5 * 60 * 60 * 1000 // 1.5 hours
};
// Minimum time between recording same coin+type predictions
const RECORD_COOLDOWNS = {
  '12hr': 4 * 60 * 60 * 1000,   // 4 hour cooldown for 12hr projections
  'daily': 4 * 60 * 60 * 1000,  // 4 hour cooldown for daily projections
  '4hr': 2 * 60 * 60 * 1000,    // 2 hour cooldown for 4hr projections
  'oi-4hr': 2 * 60 * 60 * 1000, // 2 hour cooldown for OI signals
  'cvd-2hr': 1 * 60 * 60 * 1000 // 1 hour cooldown for CVD signals
};

class WinRateTracker {
    constructor() {
        this.predictions = [];
        this.stats = {
            BTC: { total: 0, correct: 0, winRate: 0, strongCorrect: 0, strongTotal: 0 },
            ETH: { total: 0, correct: 0, winRate: 0, strongCorrect: 0, strongTotal: 0 },
            SOL: { total: 0, correct: 0, winRate: 0, strongCorrect: 0, strongTotal: 0 }
        };
        this.loadFromFile();

        // Evaluate predictions every hour
        setInterval(() => this.evaluatePredictions(), 60 * 60 * 1000);

        // Save stats every 5 minutes
        setInterval(() => this.saveToFile(), 5 * 60 * 1000);
    }

    /**
     * Load win rate data from file
     */
    loadFromFile() {
        try {
            if (!fs.existsSync(WIN_RATE_FILE)) {
                console.log('[WinRateTracker] No saved data, starting fresh');
                return;
            }

            const raw = fs.readFileSync(WIN_RATE_FILE, 'utf8');
            const saved = JSON.parse(raw);

            if (saved.predictions) this.predictions = saved.predictions;
            if (saved.stats) this.stats = saved.stats;

            console.log(`[WinRateTracker] Loaded ${this.predictions.length} predictions`);
        } catch (error) {
            console.error('[WinRateTracker] Error loading data:', error.message);
        }
    }

    /**
     * Save win rate data to file
     */
    saveToFile() {
        try {
            const dataDir = path.dirname(WIN_RATE_FILE);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Clean old predictions (> 365 days)
            const cutoff = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
            this.predictions = this.predictions.filter(p => p.timestamp >= cutoff);

            const data = {
                predictions: this.predictions,
                stats: this.stats,
                savedAt: Date.now()
            };

            fs.writeFileSync(WIN_RATE_FILE, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            console.error('[WinRateTracker] Error saving data:', error.message);
        }
    }

    /**
     * Record a new prediction (with cooldown to prevent duplicates)
     */
    recordPrediction(coin, projection, projectionType = '12hr') {
        // Check cooldown - don't record if we have a recent prediction for same coin+type
        const cooldown = RECORD_COOLDOWNS[projectionType] || RECORD_COOLDOWNS['12hr'];
        const cutoff = Date.now() - cooldown;
        const recentPrediction = this.predictions.find(p =>
            p.coin === coin &&
            p.projectionType === projectionType &&
            p.timestamp > cutoff
        );
        if (recentPrediction) {
            return; // Skip - already have a recent prediction
        }

        // Extract signal scores from components (if available)
        const c = projection.components || {};
        const signals = {
            flowConfluence: c.flowConfluence?.score ?? null,
            flowSignal: c.flowConfluence?.signal ?? null,
            fundingZScore: c.fundingZScore?.score ?? null,
            fundingZ: c.fundingZScore?.zScore ?? null,
            oiRoC: c.oiRoC?.score ?? null,
            oiFourHr: c.oiRoC?.fourHourRoC ?? null,
            cvdFlow: c.cvdPersistence?.score ?? null,
            regime: c.regime?.regime ?? null,
            regimeScore: c.regime?.score ?? null,
            confluence: c.confluence?.agreement ?? null,
            whales: c.whales?.score ?? null
        };

        const prediction = {
            id: `${coin}_${projectionType}_${Date.now()}`,
            coin,
            projectionType,
            timestamp: Date.now(),
            initialPrice: projection.currentPrice,
            predictedBias: projection.prediction.bias,
            predictedDirection: projection.prediction.direction,
            score: projection.prediction.score,
            strength: projection.prediction.strength,
            grade: projection.prediction.grade,
            confidence: projection.confidence.level,
            signals,
            evaluated: false,
            outcome: null
        };

        this.predictions.push(prediction);
        console.log(`[WinRateTracker] Recorded ${coin} ${projectionType} prediction: ${prediction.predictedBias} @ $${projection.currentPrice}`);
    }

    /**
     * Get current price for a coin from dataStore (prefer Binance, fallback to others)
     */
    getCurrentPrice(coin) {
        const exchanges = ['binance', 'hyperliquid', 'bybit'];
        for (const exchange of exchanges) {
            const price = dataStore.data[exchange]?.current?.price?.[coin];
            if (price && price > 0) {
                return price;
            }
        }
        return null;
    }

    /**
     * Evaluate predictions that are due based on their type
     */
    evaluatePredictions() {
        const now = Date.now();

        // Find unevaluated predictions that are due based on their type
        const duePredictions = this.predictions.filter(p => {
            if (p.evaluated) return false;
            const delay = EVALUATION_DELAYS[p.projectionType] || EVALUATION_DELAYS['12hr'];
            return p.timestamp <= (now - delay);
        });

        if (duePredictions.length === 0) {
            return;
        }

        console.log(`[WinRateTracker] Evaluating ${duePredictions.length} predictions...`);

        for (const pred of duePredictions) {
            const currentPrice = this.getCurrentPrice(pred.coin);
            this.evaluateSinglePrediction(pred, currentPrice);
        }

        this.recalculateStats();
        this.saveToFile();
    }

    /**
     * Evaluate a single prediction (requires current price to be passed manually)
     * Call this from server when evaluating
     */
    evaluateSinglePrediction(prediction, currentPrice = null) {
        if (prediction.evaluated) return;

        // If no current price provided, mark as evaluated but inconclusive
        if (!currentPrice) {
            prediction.evaluated = true;
            prediction.outcome = 'inconclusive';
            return;
        }

        const priceChange = ((currentPrice - prediction.initialPrice) / prediction.initialPrice) * 100;
        const actualDirection = priceChange > 0.5 ? 'BULLISH' : priceChange < -0.5 ? 'BEARISH' : 'NEUTRAL';

        // Determine if prediction was correct
        let correct = false;
        if (prediction.predictedDirection === 'BULLISH' && actualDirection === 'BULLISH') {
            correct = true;
        } else if (prediction.predictedDirection === 'BEARISH' && actualDirection === 'BEARISH') {
            correct = true;
        } else if (prediction.predictedDirection === 'NEUTRAL' && actualDirection === 'NEUTRAL') {
            correct = true;
        }

        prediction.evaluated = true;
        prediction.outcome = correct ? 'correct' : 'incorrect';
        prediction.finalPrice = currentPrice;
        prediction.actualPriceChange = priceChange;
        prediction.actualDirection = actualDirection;
        prediction.evaluatedAt = Date.now();

        console.log(`[WinRateTracker] ${prediction.coin} ${prediction.outcome.toUpperCase()} - Predicted: ${prediction.predictedDirection}, Actual: ${actualDirection} (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%)`);
    }

    /**
     * Recalculate win rate statistics
     */
    recalculateStats() {
        // Reset stats
        for (const coin of ['BTC', 'ETH', 'SOL']) {
            this.stats[coin] = { total: 0, correct: 0, winRate: 0, strongCorrect: 0, strongTotal: 0 };
        }

        // Calculate from evaluated predictions
        const evaluatedPredictions = this.predictions.filter(p => p.evaluated && p.outcome !== 'inconclusive');

        for (const pred of evaluatedPredictions) {
            const coinStats = this.stats[pred.coin];
            coinStats.total++;
            if (pred.outcome === 'correct') {
                coinStats.correct++;
            }

            // Track STRONG signals separately (higher accuracy expected)
            if (pred.strength === 'STRONG') {
                coinStats.strongTotal++;
                if (pred.outcome === 'correct') {
                    coinStats.strongCorrect++;
                }
            }
        }

        // Calculate win rates
        for (const coin of ['BTC', 'ETH', 'SOL']) {
            const stats = this.stats[coin];
            stats.winRate = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
            stats.strongWinRate = stats.strongTotal > 0 ? (stats.strongCorrect / stats.strongTotal) * 100 : 0;
        }

        console.log(`[WinRateTracker] Stats updated - BTC: ${this.stats.BTC.winRate.toFixed(1)}%, ETH: ${this.stats.ETH.winRate.toFixed(1)}%, SOL: ${this.stats.SOL.winRate.toFixed(1)}%`);
    }

    /**
     * Get win rate stats for a specific coin
     */
    getStats(coin) {
        if (!coin) {
            return this.stats;
        }
        return this.stats[coin] || { total: 0, correct: 0, winRate: 0 };
    }

    /**
     * Get recent predictions with outcomes
     */
    getRecentPredictions(coin = null, limit = 20) {
        let predictions = this.predictions
            .filter(p => p.evaluated)
            .sort((a, b) => b.timestamp - a.timestamp);

        if (coin) {
            predictions = predictions.filter(p => p.coin === coin);
        }

        return predictions.slice(0, limit);
    }
}

// Singleton instance
const winRateTracker = new WinRateTracker();

module.exports = winRateTracker;
