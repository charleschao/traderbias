import { useState, useEffect, useRef, useCallback } from 'react';
import { WHALE_WS_CONFIG } from '../config/whaleWsConfig';
import { formatUSD } from '../utils/formatters';

// Collect trades above this minimum - UI filters further based on user preference
const MIN_COLLECTION_THRESHOLD = 1_000_000; // $1M

// Only track BTC whale trades
const TRACKED_SYMBOLS = ['BTC'];

// Custom hook for managing whale trade WebSocket connections
export const useWhaleWebSockets = () => {
    const [trades, setTrades] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState({});
    const wsRefs = useRef({});
    const reconnectTimeouts = useRef({});
    const pingIntervals = useRef({});

    const addTrade = useCallback((trade) => {
        setTrades(prev => {
            // Dedupe by exchange + tradeId
            const exists = prev.some(t => t.exchange === trade.exchange && t.tradeId === trade.tradeId);
            if (exists) return prev;

            // Keep only last 100 trades, sorted by time
            const updated = [trade, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
            return updated;
        });
    }, []);

    const connectExchange = useCallback((configId) => {
        const config = WHALE_WS_CONFIG[configId];
        if (!config) {
            console.error(`[WhaleWS] No config found for ${configId}`);
            return;
        }

        // Clean up existing connection
        if (wsRefs.current[configId]) {
            try {
                const ws = wsRefs.current[configId];
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            } catch (e) {
                console.warn(`[WhaleWS] Error closing existing ${configId}:`, e);
            }
        }

        // Clear existing ping interval
        if (pingIntervals.current[configId]) {
            clearInterval(pingIntervals.current[configId]);
        }

        setConnectionStatus(prev => ({ ...prev, [configId]: 'connecting' }));

        try {
            const ws = new WebSocket(config.url);
            wsRefs.current[configId] = ws;

            ws.onopen = () => {
                console.log(`[WhaleWS] ✓ Connected to ${config.name} ${config.type}`);
                setConnectionStatus(prev => ({ ...prev, [configId]: 'connected' }));

                // Send subscription message(s)
                try {
                    const subMsg = config.subscribe(config.streams);
                    if (!subMsg) {
                        // No subscription needed (e.g., Binance combined stream)
                        console.log(`[WhaleWS] ${config.name} uses URL-based subscription`);
                    } else if (Array.isArray(subMsg)) {
                        // Hyperliquid sends multiple subscription messages
                        console.log(`[WhaleWS] Subscribing to ${config.name} with ${subMsg.length} messages`);
                        subMsg.forEach(msg => ws.send(JSON.stringify(msg)));
                    } else {
                        console.log(`[WhaleWS] Subscribing to ${config.name} streams:`, config.streams);
                        ws.send(JSON.stringify(subMsg));
                    }
                } catch (subErr) {
                    console.error(`[WhaleWS] Subscribe error on ${config.name}:`, subErr);
                }

                // Setup heartbeat based on exchange type
                setupHeartbeat(configId, ws);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    // Handle pong/heartbeat responses (don't try to parse as trades)
                    if (msg.event === 'pong' || msg.op === 'pong' || msg.ret_msg === 'pong' ||
                        msg.type === 'pong' || msg.method === 'subscription') {
                        return;
                    }

                    // Handle Kraken heartbeat
                    if (msg.method === 'heartbeat' || msg.channel === 'heartbeat') {
                        return;
                    }

                    // Handle OKX ping/pong and subscription confirmations
                    if (msg.event === 'subscribe' || msg.event === 'channel') {
                        return;
                    }

                    // Handle Bybit subscription confirmations
                    if (msg.op === 'subscribe') {
                        if (msg.success) {
                            console.log(`[WhaleWS] ${config.name} subscription confirmed`);
                        } else {
                            console.error(`[WhaleWS] ${config.name} subscription failed:`, msg);
                        }
                        return;
                    }

                    // Handle Coinbase subscription confirmations/errors
                    if (msg.type === 'subscriptions' || msg.type === 'error') {
                        console.log(`[WhaleWS] ${config.name} response:`, msg);
                        return;
                    }

                    const parsed = config.parse(msg);
                    if (!parsed) return;

                    // Handle single trade or array of trades
                    const tradeList = Array.isArray(parsed) ? parsed : [parsed];

                    tradeList.forEach(trade => {
                        // Filter: Only BTC trades above threshold
                        if (trade && TRACKED_SYMBOLS.includes(trade.symbol) && trade.notional >= MIN_COLLECTION_THRESHOLD) {
                            addTrade({
                                ...trade,
                                exchange: configId,
                                receivedAt: Date.now()
                            });

                            // Console log for debugging whale trades
                            console.log(`🐋 WHALE: ${config.name} ${config.type} | ${trade.side} ${trade.symbol} | ${formatUSD(trade.notional)}`);
                        }
                    });
                } catch (err) {
                    // Only log non-ping/pong parse errors
                    const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
                    if (!dataStr.includes('pong') && !dataStr.includes('ping')) {
                        console.error(`[WhaleWS] Parse error on ${config.name} ${config.type}:`, err.message);
                        console.log(`[WhaleWS] Raw message:`, dataStr.substring(0, 300));
                    }
                }
            };

            ws.onerror = (err) => {
                console.error(`[WhaleWS] ✗ Error on ${config.name} ${config.type}:`, err.message || 'WebSocket error');
                setConnectionStatus(prev => ({ ...prev, [configId]: 'error' }));
            };

            ws.onclose = (event) => {
                console.log(`[WhaleWS] Disconnected from ${config.name} ${config.type} (code: ${event.code})`);
                setConnectionStatus(prev => ({ ...prev, [configId]: 'disconnected' }));

                // Clear ping interval
                if (pingIntervals.current[configId]) {
                    clearInterval(pingIntervals.current[configId]);
                }

                // Reconnect after delay (longer delay for failed connections)
                const delay = event.code === 1000 ? 5000 : 10000;
                reconnectTimeouts.current[configId] = setTimeout(() => {
                    connectExchange(configId);
                }, delay);
            };

        } catch (err) {
            console.error(`[WhaleWS] Failed to connect to ${config.name}:`, err);
            setConnectionStatus(prev => ({ ...prev, [configId]: 'error' }));

            // Retry after delay
            reconnectTimeouts.current[configId] = setTimeout(() => {
                connectExchange(configId);
            }, 15000);
        }
    }, [addTrade]);

    // Setup heartbeat/ping for each exchange type
    const setupHeartbeat = (configId, ws) => {
        // Bybit requires ping every 20 seconds
        if (configId.startsWith('bybit')) {
            pingIntervals.current[configId] = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ op: 'ping' }));
                }
            }, 20000);
        }

        // OKX requires ping every 15 seconds (send "ping" as plain text)
        if (configId.startsWith('okx')) {
            pingIntervals.current[configId] = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send('ping');
                }
            }, 15000);
        }

        // Kraken v2 requires ping every 30 seconds
        if (configId === 'kraken') {
            pingIntervals.current[configId] = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ method: 'ping' }));
                }
            }, 30000);
        }

        // Binance auto-pings via the server; no client ping needed but we can send to test
        if (configId.startsWith('binance')) {
            // Binance doesn't require pings but pongs are automatic
        }

        // Coinbase Advanced Trade needs ping
        if (configId === 'coinbase') {
            pingIntervals.current[configId] = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);
        }

        // Hyperliquid may need ping
        if (configId === 'hyperliquid') {
            pingIntervals.current[configId] = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ method: 'ping' }));
                }
            }, 30000);
        }
    };

    useEffect(() => {
        // Connect to all exchanges on mount
        const exchangeIds = Object.keys(WHALE_WS_CONFIG);
        console.log(`[WhaleWS] Initializing connections to ${exchangeIds.length} exchanges`);

        exchangeIds.forEach(configId => {
            connectExchange(configId);
        });

        // Cleanup on unmount
        return () => {
            Object.keys(wsRefs.current).forEach(id => {
                if (pingIntervals.current[id]) {
                    clearInterval(pingIntervals.current[id]);
                }
                if (wsRefs.current[id]) {
                    try {
                        const ws = wsRefs.current[id];
                        // Only close if connection is OPEN or CONNECTING
                        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                            ws.close();
                        }
                    } catch (e) {
                        console.warn(`[WhaleWS] Error closing ${id}:`, e);
                    }
                }
            });
            Object.values(reconnectTimeouts.current).forEach(timeout => {
                clearTimeout(timeout);
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount, not when connectExchange changes

    const isConnected = Object.values(connectionStatus).some(s => s === 'connected');

    return { trades, connectionStatus, isConnected };
};
