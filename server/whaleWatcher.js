const WebSocket = require('ws');
const dataStore = require('./dataStore');

const CONFIG = {
    // Threshold to keep in memory (lower than frontend to allow filtering)
    MIN_STORE_THRESHOLD: 500_000,

    EXCHANGES: {
        binanceSpot: {
            url: 'wss://stream.binance.com/stream?streams=btcusdt@aggTrade',
            type: 'SPOT',
            name: 'Binance',
            parse: (msg) => {
                const trade = msg.data || msg;
                if (trade.e !== 'aggTrade') return null;
                return {
                    symbol: trade.s.replace('USDT', ''),
                    price: parseFloat(trade.p),
                    size: parseFloat(trade.q),
                    side: trade.m ? 'SELL' : 'BUY',
                    timestamp: trade.T,
                    tradeId: trade.a,
                    exchange: 'binanceSpot',
                    type: 'SPOT'
                };
            }
        },
        binanceFutures: {
            url: 'wss://fstream.binance.com/stream?streams=btcusdt@aggTrade',
            type: 'PERP',
            name: 'Binance',
            parse: (msg) => {
                const trade = msg.data || msg;
                if (trade.e !== 'aggTrade') return null;
                return {
                    symbol: trade.s.replace('USDT', ''),
                    price: parseFloat(trade.p),
                    size: parseFloat(trade.q),
                    side: trade.m ? 'SELL' : 'BUY',
                    timestamp: trade.T,
                    tradeId: trade.a,
                    exchange: 'binanceFutures',
                    type: 'PERP'
                };
            }
        },
        bybitLinear: {
            url: 'wss://stream.bybit.com/v5/public/linear',
            type: 'PERP',
            name: 'Bybit',
            subscribe: { op: 'subscribe', args: ['publicTrade.BTCUSDT'] },
            ping: { op: 'ping' },
            pingInterval: 20000,
            parse: (msg) => {
                if (!msg.topic?.startsWith('publicTrade') || !msg.data) return null;
                return msg.data.map(t => ({
                    symbol: t.s.replace('USDT', ''),
                    price: parseFloat(t.p),
                    size: parseFloat(t.v),
                    side: t.S === 'Buy' ? 'BUY' : 'SELL',
                    timestamp: t.T,
                    tradeId: t.i,
                    exchange: 'bybitLinear',
                    type: 'PERP'
                }));
            }
        },
        okxSwap: {
            url: 'wss://ws.okx.com:8443/ws/v5/public',
            type: 'PERP',
            name: 'OKX',
            subscribe: {
                op: 'subscribe',
                args: [
                    { channel: 'trades', instId: 'BTC-USDT-SWAP' }
                ]
            },
            ping: 'ping',
            pingInterval: 15000,
            parse: (msg) => {
                if (msg.event || !msg.data) return null;
                return msg.data.map(t => {
                    const symbol = t.instId.split('-')[0];
                    const contractSize = parseFloat(t.sz);
                    let multiplier = 1;
                    if (symbol === 'BTC') multiplier = 0.01;
                    else if (symbol === 'ETH') multiplier = 0.1;

                    return {
                        symbol,
                        price: parseFloat(t.px),
                        size: contractSize * multiplier,
                        side: t.side === 'buy' ? 'BUY' : 'SELL',
                        timestamp: parseInt(t.ts),
                        tradeId: t.tradeId,
                        exchange: 'okxSwap',
                        type: 'PERP'
                    };
                });
            }
        },
        hyperliquid: {
            url: 'wss://api.hyperliquid.xyz/ws',
            type: 'PERP',
            name: 'Hyperliquid',
            subscribe: [
                { method: 'subscribe', subscription: { type: 'trades', coin: 'BTC' } }
            ],
            ping: { method: 'ping' },
            pingInterval: 30000,
            parse: (msg) => {
                if (msg.channel !== 'trades' || !msg.data) return null;
                return msg.data.map(t => ({
                    symbol: t.coin,
                    price: parseFloat(t.px),
                    size: parseFloat(t.sz),
                    side: t.side === 'B' ? 'BUY' : 'SELL',
                    timestamp: t.time,
                    tradeId: t.tid,
                    exchange: 'hyperliquid',
                    type: 'PERP'
                }));
            }
        },
        coinbase: {
            url: 'wss://advanced-trade-ws.coinbase.com',
            type: 'SPOT',
            name: 'Coinbase',
            subscribe: {
                type: 'subscribe',
                product_ids: ['BTC-USD'],
                channel: 'market_trades'
            },
            ping: { type: 'ping' }, // Coinbase specific ping not always needed but good practice? Actually they use keepalives.
            // Note: Coinbase documentation says they don't respond to pings, but it keeps connection alive.
            // Let's stick to standard practice.
            parse: (msg) => {
                if (msg.channel !== 'market_trades' || !msg.events) return null;
                const trades = [];
                msg.events.forEach(e => {
                    if (e.trades) {
                        e.trades.forEach(t => {
                            trades.push({
                                symbol: t.product_id.split('-')[0],
                                price: parseFloat(t.price),
                                size: parseFloat(t.size),
                                side: t.side === 'BUY' ? 'BUY' : 'SELL',
                                timestamp: new Date(t.time).getTime(),
                                tradeId: t.trade_id,
                                exchange: 'coinbase',
                                type: 'SPOT'
                            });
                        });
                    }
                });
                return trades.length > 0 ? trades : null;
            }
        },
        kraken: {
            url: 'wss://ws.kraken.com/v2',
            type: 'SPOT',
            name: 'Kraken',
            subscribe: {
                method: 'subscribe',
                params: { channel: 'trade', symbol: ['BTC/USD'] }
            },
            ping: { method: 'ping' },
            pingInterval: 30000,
            parse: (msg) => {
                if (msg.channel !== 'trade' || !msg.data) return null;
                return msg.data.map(t => ({
                    symbol: t.symbol.split('/')[0],
                    price: parseFloat(t.price),
                    size: parseFloat(t.qty),
                    side: t.side === 'buy' ? 'BUY' : 'SELL',
                    timestamp: new Date(t.timestamp).getTime(),
                    tradeId: t.trade_id,
                    exchange: 'kraken',
                    type: 'SPOT'
                }));
            }
        }
    }
};

const connections = {};
const reconnectTimeouts = {};

function start() {
    console.log('[WhaleWatcher] Starting exchange connections...');
    Object.keys(CONFIG.EXCHANGES).forEach(key => {
        connect(key);
    });
}

function connect(key) {
    const exConfig = CONFIG.EXCHANGES[key];
    if (!exConfig) return;

    try {
        const ws = new WebSocket(exConfig.url);
        connections[key] = ws;

        ws.on('open', () => {
            console.log(`[WhaleWatcher] Connected to ${key}`);

            // Subscribe
            if (exConfig.subscribe) {
                if (Array.isArray(exConfig.subscribe)) {
                    exConfig.subscribe.forEach(msg => ws.send(JSON.stringify(msg)));
                } else {
                    ws.send(JSON.stringify(exConfig.subscribe));
                }
            }

            // Ping interval
            if (exConfig.ping) {
                connections[`${key}_ping`] = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        const pingMsg = typeof exConfig.ping === 'string' ? exConfig.ping : JSON.stringify(exConfig.ping);
                        ws.send(pingMsg);
                    }
                }, exConfig.pingInterval || 30000);
            }
        });

        ws.on('message', (data) => {
            try {
                const strData = data.toString();
                // Skip pongs
                if (strData.includes('pong') || strData === 'pong') return;

                const msg = JSON.parse(strData);
                // Skip events
                if (msg.event === 'subscribe' || msg.event === 'info') return;

                const parsed = exConfig.parse(msg);
                if (!parsed) return;

                const trades = Array.isArray(parsed) ? parsed : [parsed];

                trades.forEach(trade => {
                    const notional = trade.price * trade.size;
                    if (notional >= CONFIG.MIN_STORE_THRESHOLD) {
                        dataStore.addWhaleTrade({
                            ...trade,
                            notional,
                            receivedAt: Date.now()
                        });
                    }
                });

            } catch (e) {
                // Silent catch for parse errors to avoid spam
            }
        });

        ws.on('error', (err) => {
            console.error(`[WhaleWatcher] Error on ${key}:`, err.message);
        });

        ws.on('close', () => {
            console.log(`[WhaleWatcher] Disconnected from ${key}, reconnecting...`);
            if (connections[`${key}_ping`]) clearInterval(connections[`${key}_ping`]);
            clearTimeout(reconnectTimeouts[key]);
            reconnectTimeouts[key] = setTimeout(() => connect(key), 5000);
        });

    } catch (err) {
        console.error(`[WhaleWatcher] Setup error ${key}:`, err);
        reconnectTimeouts[key] = setTimeout(() => connect(key), 5000);
    }
}

module.exports = { start };
