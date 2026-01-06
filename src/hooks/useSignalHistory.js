import { useState, useEffect, useRef, useCallback } from 'react';

// Configuration
const EVALUATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const EVALUATION_GRACE_MS = 2 * 60 * 1000; // 2 minutes grace period after evaluation window
const MIN_SIGNAL_GAP_MS = 60 * 1000; // Minimum 60 seconds between same signal type logs
const WIN_THRESHOLD_PCT = 0.3; // 0.3% minimum move to count as win
const MAX_HISTORY_PER_COIN = 500;
const HISTORY_MAX_AGE_DAYS = 7;
const STORAGE_KEY = 'traderBias_signalHistory';

// Signal types that are bullish (price should go up to win)
const BULLISH_SIGNALS = ['STRONG_BULL', 'BULLISH', 'WEAK_BULL'];
// Signal types that are bearish (price should go down to win)
const BEARISH_SIGNALS = ['STRONG_BEAR', 'BEARISH', 'WEAK_BEAR'];
// Signals we don't track win/loss for
const NEUTRAL_SIGNALS = ['NEUTRAL', 'DIVERGENCE'];

/**
 * Load signal history from localStorage
 */
const loadSignalHistory = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            const now = Date.now();
            const maxAge = HISTORY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

            // Clean old entries
            ['BTC', 'ETH', 'SOL'].forEach(coin => {
                if (parsed[coin]) {
                    parsed[coin] = parsed[coin].filter(s => now - s.timestamp < maxAge);
                }
            });

            return parsed;
        }
    } catch (e) {
        console.warn('Failed to load signal history:', e);
    }
    return { BTC: [], ETH: [], SOL: [] };
};

/**
 * Save signal history to localStorage
 */
const saveSignalHistory = (history) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save signal history:', e);
    }
};

/**
 * Hook to manage signal history and calculate win rates
 */
export const useSignalHistory = () => {
    const [signalHistory, setSignalHistory] = useState(() => loadSignalHistory());
    // Track last logged signal type AND timestamp per coin
    const lastLoggedSignalRef = useRef({
        BTC: { type: null, timestamp: 0 },
        ETH: { type: null, timestamp: 0 },
        SOL: { type: null, timestamp: 0 }
    });

    /**
     * Log a new signal
     */
    const logSignal = useCallback((coin, signalType, entryPrice) => {
        // Don't track neutral signals
        if (NEUTRAL_SIGNALS.includes(signalType)) return;

        const now = Date.now();
        const lastLogged = lastLoggedSignalRef.current[coin];

        // Don't log the same signal type twice within MIN_SIGNAL_GAP_MS
        if (lastLogged.type === signalType && (now - lastLogged.timestamp) < MIN_SIGNAL_GAP_MS) {
            return;
        }

        // Update the ref with new signal type and timestamp
        lastLoggedSignalRef.current[coin] = { type: signalType, timestamp: now };

        const signal = {
            type: signalType,
            entryPrice,
            timestamp: Date.now(),
            exitPrice: null,
            evaluatedAt: null,
            won: null
        };

        setSignalHistory(prev => {
            const newHistory = { ...prev };
            newHistory[coin] = [signal, ...(prev[coin] || [])].slice(0, MAX_HISTORY_PER_COIN);
            saveSignalHistory(newHistory);
            return newHistory;
        });

        console.log(`[SignalHistory] Logged ${signalType} for ${coin} @ $${entryPrice.toFixed(2)}`);
    }, []);

    /**
     * Evaluate pending signals
     */
    const evaluateSignals = useCallback((currentPrices) => {
        const now = Date.now();
        let hasChanges = false;

        setSignalHistory(prev => {
            const newHistory = { ...prev };

            ['BTC', 'ETH', 'SOL'].forEach(coin => {
                const currentPrice = currentPrices[coin];
                if (!currentPrice || !newHistory[coin]) return;

                newHistory[coin] = newHistory[coin].map(signal => {
                    // Skip if already evaluated
                    if (signal.won !== null) return signal;

                    const signalAge = now - signal.timestamp;

                    // Not ready yet - wait for 15 minute window
                    if (signalAge < EVALUATION_WINDOW_MS) return signal;

                    // CRITICAL FIX: Only evaluate within the valid window (15-17 mins)
                    // If we missed the window (signal is too old), mark as expired/indeterminate
                    if (signalAge > EVALUATION_WINDOW_MS + EVALUATION_GRACE_MS) {
                        console.log(`[SignalHistory] Signal ${signal.type} for ${coin} expired - missed evaluation window`);
                        return {
                            ...signal,
                            evaluatedAt: now,
                            won: null, // Indeterminate - we can't fairly evaluate old signals
                            expired: true
                        };
                    }

                    // Evaluate outcome - we're within the valid 15-17 minute window
                    const pctChange = ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100;
                    let won = null;

                    if (BULLISH_SIGNALS.includes(signal.type)) {
                        won = pctChange >= WIN_THRESHOLD_PCT;
                    } else if (BEARISH_SIGNALS.includes(signal.type)) {
                        won = pctChange <= -WIN_THRESHOLD_PCT;
                    }

                    if (won !== null) {
                        hasChanges = true;
                        console.log(`[SignalHistory] Evaluated ${signal.type} for ${coin}: ${won ? 'WIN' : 'LOSS'} (${pctChange.toFixed(2)}% after ${Math.round(signalAge / 60000)}min)`);
                    }

                    return {
                        ...signal,
                        exitPrice: currentPrice,
                        evaluatedAt: now,
                        won
                    };
                });
            });

            if (hasChanges) {
                saveSignalHistory(newHistory);
            }

            return newHistory;
        });
    }, []);

    /**
     * Get win rates for a specific coin
     */
    const getWinRates = useCallback((coin) => {
        const signals = signalHistory[coin] || [];
        // Only count signals that were actually evaluated (not expired)
        const evaluated = signals.filter(s => s.won !== null && !s.expired);

        // Group by signal type
        const byType = {};
        [...BULLISH_SIGNALS, ...BEARISH_SIGNALS].forEach(type => {
            const typeSignals = evaluated.filter(s => s.type === type);
            const wins = typeSignals.filter(s => s.won === true).length;
            const total = typeSignals.length;

            byType[type] = {
                wins,
                losses: total - wins,
                total,
                winRate: total > 0 ? (wins / total) * 100 : null
            };
        });

        // Overall stats
        const totalWins = evaluated.filter(s => s.won === true).length;
        const totalSignals = evaluated.length;
        // Pending = signals that haven't been evaluated yet AND aren't expired
        const pendingCount = signals.filter(s => s.won === null && !s.expired).length;
        const expiredCount = signals.filter(s => s.expired === true).length;

        return {
            byType,
            overall: {
                wins: totalWins,
                losses: totalSignals - totalWins,
                total: totalSignals,
                winRate: totalSignals > 0 ? (totalWins / totalSignals) * 100 : null
            },
            pending: pendingCount,
            expired: expiredCount,
            totalLogged: signals.length
        };
    }, [signalHistory]);

    /**
     * Get detailed stats for a specific signal type
     */
    const getSignalStats = useCallback((coin, signalType) => {
        const signals = signalHistory[coin] || [];
        const typeSignals = signals.filter(s => s.type === signalType);

        const recentWins = typeSignals.filter(s => s.won === true).slice(0, 3);
        const recentLosses = typeSignals.filter(s => s.won === false).slice(0, 3);
        const pending = typeSignals.filter(s => s.won === null);

        return {
            recentWins,
            recentLosses,
            pending: pending.length,
            avgWinPct: calculateAvgPct(recentWins),
            avgLossPct: calculateAvgPct(recentLosses)
        };
    }, [signalHistory]);

    return {
        signalHistory,
        logSignal,
        evaluateSignals,
        getWinRates,
        getSignalStats
    };
};

/**
 * Calculate average percentage change
 */
const calculateAvgPct = (signals) => {
    if (signals.length === 0) return 0;
    const sum = signals.reduce((acc, s) => {
        if (!s.entryPrice || !s.exitPrice) return acc;
        return acc + ((s.exitPrice - s.entryPrice) / s.entryPrice) * 100;
    }, 0);
    return sum / signals.length;
};

export default useSignalHistory;
