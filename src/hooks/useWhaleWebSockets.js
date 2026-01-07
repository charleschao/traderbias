import { useState, useEffect, useCallback } from 'react';

const API_Base = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001';

// Custom hook for fetching whale trades from backend
export const useWhaleWebSockets = () => {
    const [trades, setTrades] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState({ backend: 'connecting' });
    const [isConnected, setIsConnected] = useState(false);

    const fetchTrades = useCallback(async () => {
        try {
            const response = await fetch(`${API_Base}/api/whale-trades?limit=100`);
            if (!response.ok) throw new Error('API error');

            const newTrades = await response.json();

            setTrades(prev => {
                // Merge and dedupe
                const existingIds = new Set(prev.map(t => `${t.exchange}-${t.tradeId}`));
                const uniqueNewTrades = newTrades.filter(t => !existingIds.has(`${t.exchange}-${t.tradeId}`));

                if (uniqueNewTrades.length === 0) return prev;

                return [...uniqueNewTrades, ...prev]
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 100);
            });

            setConnectionStatus({ backend: 'connected' });
            setIsConnected(true);
        } catch (err) {
            console.error('[WhaleFeed] Fetch error:', err);
            setConnectionStatus({ backend: 'error' });
            setIsConnected(false);
        }
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchTrades();

        // Poll every 2 seconds for fresh trades (whale trades are fast)
        const interval = setInterval(fetchTrades, 2000);

        return () => clearInterval(interval);
    }, [fetchTrades]);

    return { trades, connectionStatus, isConnected };
};
