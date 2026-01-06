import { useState, useRef, useCallback } from 'react';

/**
 * Hook to track historical values for sparkline visualization
 * Maintains a rolling window of data points for each metric
 */
export const useSparklineHistory = (maxPoints = 30, intervalMs = 10000) => {
    const [priceHistory, setPriceHistory] = useState({ BTC: [], ETH: [], SOL: [] });
    const [oiHistory, setOiHistory] = useState({ BTC: [], ETH: [], SOL: [] });
    const [cvdHistory, setCvdHistory] = useState({ BTC: [], ETH: [], SOL: [] });
    const [fundingHistory, setFundingHistory] = useState({ BTC: [], ETH: [], SOL: [] });

    const lastUpdateRef = useRef(0);
    const isFirstUpdateRef = useRef(true);

    const addDataPoint = useCallback((coin, type, value) => {
        const now = Date.now();
        const point = { value, timestamp: now };

        const updateHistory = (setter) => {
            setter(prev => {
                const updated = [...(prev[coin] || []), point];
                // Keep only last maxPoints
                const trimmed = updated.slice(-maxPoints);
                return { ...prev, [coin]: trimmed };
            });
        };

        switch (type) {
            case 'price':
                updateHistory(setPriceHistory);
                break;
            case 'oi':
                updateHistory(setOiHistory);
                break;
            case 'cvd':
                updateHistory(setCvdHistory);
                break;
            case 'funding':
                updateHistory(setFundingHistory);
                break;
        }
    }, [maxPoints]);

    // Batch update from market data
    const updateFromMarketData = useCallback((priceData, oiData, cvdData, fundingData) => {
        const now = Date.now();

        // Allow first update immediately, then throttle
        if (!isFirstUpdateRef.current && now - lastUpdateRef.current < intervalMs) {
            return;
        }

        isFirstUpdateRef.current = false;
        lastUpdateRef.current = now;

        ['BTC', 'ETH', 'SOL'].forEach(coin => {
            if (priceData?.[coin]?.markPx) {
                addDataPoint(coin, 'price', parseFloat(priceData[coin].markPx));
            }
            if (oiData?.[coin]?.current) {
                addDataPoint(coin, 'oi', oiData[coin].current);
            }
            if (cvdData?.[coin]?.rolling5mDelta !== undefined) {
                addDataPoint(coin, 'cvd', cvdData[coin].rolling5mDelta);
            }
            if (fundingData?.[coin]?.rate !== undefined) {
                addDataPoint(coin, 'funding', fundingData[coin].rate);
            }
        });
    }, [addDataPoint, intervalMs]);

    // Get sparkline data for a specific coin and metric
    const getSparklineData = useCallback((coin, type) => {
        const historyMap = {
            price: priceHistory,
            oi: oiHistory,
            cvd: cvdHistory,
            funding: fundingHistory
        };
        return (historyMap[type]?.[coin] || []).filter(p => p != null).map(p => p.value);
    }, [priceHistory, oiHistory, cvdHistory, fundingHistory]);

    return {
        priceHistory,
        oiHistory,
        cvdHistory,
        fundingHistory,
        addDataPoint,
        updateFromMarketData,
        getSparklineData
    };
};
