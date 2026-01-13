/**
 * Backtest API Helpers
 *
 * Filtering, aggregation, and analysis functions for backtest data
 */

const winRateTracker = require('./winRateTracker');

/**
 * Filter predictions by criteria
 */
function filterPredictions({ coin, type, from, to, outcome, limit = 1000 }) {
  let predictions = winRateTracker.predictions || [];

  if (coin) {
    predictions = predictions.filter(p => p.coin === coin.toUpperCase());
  }

  if (type) {
    predictions = predictions.filter(p => p.projectionType === type);
  }

  if (from) {
    const fromTs = new Date(from).getTime();
    predictions = predictions.filter(p => p.timestamp >= fromTs);
  }

  if (to) {
    const toTs = new Date(to).getTime() + 24 * 60 * 60 * 1000; // End of day
    predictions = predictions.filter(p => p.timestamp <= toTs);
  }

  if (outcome) {
    predictions = predictions.filter(p => p.outcome === outcome);
  }

  // Sort by timestamp descending
  predictions = predictions.sort((a, b) => b.timestamp - a.timestamp);

  return predictions.slice(0, limit);
}

/**
 * Calculate aggregated statistics
 */
function calculateStats({ coin, type, from, to }) {
  const predictions = filterPredictions({ coin, type, from, to, limit: 100000 });
  const evaluated = predictions.filter(p => p.evaluated && p.outcome !== 'inconclusive');

  const calcWinRate = (preds) => {
    const total = preds.length;
    const correct = preds.filter(p => p.outcome === 'correct').length;
    return {
      total,
      correct,
      winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 0
    };
  };

  // Overall stats
  const overall = calcWinRate(evaluated);

  // By strength
  const byStrength = {};
  for (const strength of ['STRONG', 'MODERATE', 'WEAK']) {
    byStrength[strength] = calcWinRate(evaluated.filter(p => p.strength === strength));
  }

  // By confidence
  const byConfidence = {};
  for (const conf of ['HIGH', 'MEDIUM', 'LOW']) {
    byConfidence[conf] = calcWinRate(evaluated.filter(p => p.confidence === conf));
  }

  // By coin
  const byCoin = {};
  for (const c of ['BTC', 'ETH', 'SOL']) {
    byCoin[c] = calcWinRate(evaluated.filter(p => p.coin === c));
  }

  // By type
  const byType = {};
  for (const t of ['12hr', 'daily']) {
    byType[t] = calcWinRate(evaluated.filter(p => p.projectionType === t));
  }

  return { overall, byStrength, byConfidence, byCoin, byType };
}

/**
 * Generate equity curve from predictions
 */
function generateEquityCurve({ coin, type, from, to, initialCapital = 10000 }) {
  const predictions = filterPredictions({ coin, type, from, to, limit: 100000 });
  const evaluated = predictions
    .filter(p => p.evaluated && p.outcome !== 'inconclusive')
    .sort((a, b) => a.timestamp - b.timestamp);

  if (evaluated.length === 0) {
    return [];
  }

  let equity = initialCapital;
  const curve = [{ timestamp: evaluated[0].timestamp, equity, prediction: null }];

  for (const pred of evaluated) {
    // Simple model: win = +2%, lose = -1.5%
    if (pred.outcome === 'correct') {
      equity *= 1.02;
    } else {
      equity *= 0.985;
    }
    curve.push({
      timestamp: pred.evaluatedAt || pred.timestamp,
      equity: Math.round(equity * 100) / 100,
      prediction: {
        id: pred.id,
        coin: pred.coin,
        direction: pred.predictedDirection,
        outcome: pred.outcome
      }
    });
  }

  return curve;
}

/**
 * Calculate win/loss streaks
 */
function calculateStreaks({ coin, type, from, to }) {
  const predictions = filterPredictions({ coin, type, from, to, limit: 100000 });
  const evaluated = predictions
    .filter(p => p.evaluated && p.outcome !== 'inconclusive')
    .sort((a, b) => a.timestamp - b.timestamp);

  if (evaluated.length === 0) {
    return {
      currentStreak: { type: 'none', count: 0 },
      longestWin: 0,
      longestLoss: 0,
      streakDistribution: { wins: {}, losses: {} }
    };
  }

  let currentStreak = { type: null, count: 0 };
  let longestWin = 0;
  let longestLoss = 0;
  let tempStreak = 0;
  let tempType = null;
  const winStreaks = [];
  const lossStreaks = [];

  for (const pred of evaluated) {
    const isWin = pred.outcome === 'correct';

    if (tempType === null) {
      tempType = isWin ? 'win' : 'loss';
      tempStreak = 1;
    } else if ((isWin && tempType === 'win') || (!isWin && tempType === 'loss')) {
      tempStreak++;
    } else {
      // Streak ended
      if (tempType === 'win') {
        winStreaks.push(tempStreak);
        longestWin = Math.max(longestWin, tempStreak);
      } else {
        lossStreaks.push(tempStreak);
        longestLoss = Math.max(longestLoss, tempStreak);
      }
      tempType = isWin ? 'win' : 'loss';
      tempStreak = 1;
    }
  }

  // Final streak
  if (tempType === 'win') {
    winStreaks.push(tempStreak);
    longestWin = Math.max(longestWin, tempStreak);
  } else if (tempType === 'loss') {
    lossStreaks.push(tempStreak);
    longestLoss = Math.max(longestLoss, tempStreak);
  }

  currentStreak = { type: tempType, count: tempStreak };

  return {
    currentStreak,
    longestWin,
    longestLoss,
    totalPredictions: evaluated.length
  };
}

module.exports = {
  filterPredictions,
  calculateStats,
  generateEquityCurve,
  calculateStreaks
};
