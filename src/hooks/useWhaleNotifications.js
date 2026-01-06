import { useState, useCallback, useRef } from 'react';
import { formatUSD } from '../utils/formatters';
import { WHALE_WS_CONFIG } from '../config/whaleWsConfig';

/**
 * Hook to manage browser notifications for whale trades
 * @param {number} threshold - Minimum trade size to trigger notification
 */
export const useWhaleNotifications = (threshold = 10_000_000) => {
    // Initialize permission from browser on first render (lazy initialization)
    const [permission, setPermission] = useState(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            return Notification.permission;
        }
        return 'denied';
    });
    const [enabled, setEnabled] = useState(() => {
        // Load saved preference from localStorage
        const saved = localStorage.getItem('whale_notifications_enabled');
        return saved === 'true';
    });
    const notifiedTradesRef = useRef(new Set());

    // Request notification permission
    const requestPermission = useCallback(async () => {
        if (!('Notification' in window)) {
            console.warn('Browser does not support notifications');
            return 'denied';
        }

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result;
        } catch (err) {
            console.error('Failed to request notification permission:', err);
            return 'denied';
        }
    }, []);

    // Toggle notifications on/off
    const toggleNotifications = useCallback(async () => {
        if (!enabled) {
            // Enabling - request permission first if needed
            if (permission === 'default') {
                const result = await requestPermission();
                if (result === 'granted') {
                    setEnabled(true);
                    localStorage.setItem('whale_notifications_enabled', 'true');
                }
            } else if (permission === 'granted') {
                setEnabled(true);
                localStorage.setItem('whale_notifications_enabled', 'true');
            }
        } else {
            // Disabling
            setEnabled(false);
            localStorage.setItem('whale_notifications_enabled', 'false');
        }
    }, [enabled, permission, requestPermission]);

    // Send a notification for a whale trade
    const notifyWhaleTrade = useCallback((trade) => {
        // Skip if notifications not enabled or not permitted
        if (!enabled || permission !== 'granted') {
            return;
        }

        // Skip if trade is below threshold
        if (trade.notional < threshold) {
            return;
        }

        // Skip if we already notified about this trade
        const tradeId = `${trade.exchange}-${trade.tradeId}`;
        if (notifiedTradesRef.current.has(tradeId)) return;
        notifiedTradesRef.current.add(tradeId);

        // Clean up old trade IDs (keep last 1000)
        if (notifiedTradesRef.current.size > 1000) {
            const arr = Array.from(notifiedTradesRef.current);
            notifiedTradesRef.current = new Set(arr.slice(-500));
        }

        const isBuy = trade.side === 'BUY';
        const emoji = isBuy ? '🟢' : '🔴';
        const direction = isBuy ? 'BUY' : 'SELL';
        const config = WHALE_WS_CONFIG[trade.exchange];
        const exchangeName = config?.name || trade.exchange;

        try {
            const notification = new Notification(`${emoji} WHALE ${direction} - ${trade.symbol}`, {
                body: `${formatUSD(trade.notional)} on ${exchangeName}\n$${trade.price.toLocaleString()}`,
                icon: '/whale.png',
                tag: tradeId, // Prevents duplicate notifications
                requireInteraction: false,
                silent: false
            });

            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);

            console.log(`🔔 Notification sent: ${trade.symbol} ${direction} ${formatUSD(trade.notional)}`);

        } catch (err) {
            console.error('Failed to send notification:', err);
        }
    }, [enabled, permission, threshold]);

    // Process multiple trades (for batch updates from WebSocket)
    const notifyWhaleTrades = useCallback((trades) => {
        if (!enabled || permission !== 'granted') return;

        // Only notify for trades above threshold
        const eligibleTrades = trades.filter(t => t.notional >= threshold);

        // Only notify for the most recent 3 trades to avoid spam
        eligibleTrades.slice(0, 3).forEach(trade => {
            notifyWhaleTrade(trade);
        });
    }, [enabled, permission, threshold, notifyWhaleTrade]);

    return {
        notificationPermission: permission,
        notificationEnabled: enabled,
        notificationSupported: typeof window !== 'undefined' && 'Notification' in window,
        requestPermission,
        toggleNotifications,
        notifyWhaleTrade,
        notifyWhaleTrades
    };
};
