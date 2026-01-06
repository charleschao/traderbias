// ============== MEGA WHALE TRADE WEBSOCKET CONFIG ==============
export const WHALE_THRESHOLD = 10_000_000; // $10M minimum trade size

export const WHALE_WS_CONFIG = {
    // Binance Spot - BTC, ETH, SOL
    binanceSpot: {
        id: 'binanceSpot',
        name: 'Binance',
        type: 'SPOT',
        icon: '🟡',
        color: 'yellow',
        url: 'wss://stream.binance.com/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade',
        streams: ['btcusdt@aggTrade', 'ethusdt@aggTrade', 'solusdt@aggTrade'],
        subscribe: (streams) => null, // No subscription needed - streams in URL
        parse: (msg) => {
            // Combined stream wraps data in 'data' field
            const trade = msg.data || msg;
            if (trade.e !== 'aggTrade') return null;
            const price = parseFloat(trade.p);
            const size = parseFloat(trade.q);
            return {
                symbol: trade.s.replace('USDT', ''),
                price,
                size,
                notional: price * size,
                side: trade.m ? 'SELL' : 'BUY',
                timestamp: trade.T,
                tradeId: trade.a
            };
        }
    },
    // Binance USDⓈ-M Futures
    binanceFutures: {
        id: 'binanceFutures',
        name: 'Binance',
        type: 'PERP',
        icon: '🟡',
        color: 'yellow',
        url: 'wss://fstream.binance.com/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade',
        streams: ['btcusdt@aggTrade', 'ethusdt@aggTrade', 'solusdt@aggTrade'],
        subscribe: (streams) => null, // No subscription needed - streams in URL
        parse: (msg) => {
            // Combined stream wraps data in 'data' field
            const trade = msg.data || msg;
            if (trade.e !== 'aggTrade') return null;
            const price = parseFloat(trade.p);
            const size = parseFloat(trade.q);
            return {
                symbol: trade.s.replace('USDT', ''),
                price,
                size,
                notional: price * size,
                side: trade.m ? 'SELL' : 'BUY',
                timestamp: trade.T,
                tradeId: trade.a
            };
        }
    },
    // Bybit Linear Perpetuals
    bybitLinear: {
        id: 'bybitLinear',
        name: 'Bybit',
        type: 'PERP',
        icon: '🟠',
        color: 'orange',
        url: 'wss://stream.bybit.com/v5/public/linear',
        streams: ['publicTrade.BTCUSDT', 'publicTrade.ETHUSDT', 'publicTrade.SOLUSDT'],
        subscribe: (streams) => ({ op: 'subscribe', args: streams }),
        parse: (msg) => {
            if (!msg.topic?.startsWith('publicTrade') || !msg.data) return null;
            return msg.data.map(t => {
                const price = parseFloat(t.p);
                const size = parseFloat(t.v);
                return {
                    symbol: t.s.replace('USDT', ''),
                    price,
                    size,
                    notional: price * size,
                    side: t.S === 'Buy' ? 'BUY' : 'SELL',
                    timestamp: t.T,
                    tradeId: t.i
                };
            });
        }
    },
    // Bybit Spot
    bybitSpot: {
        id: 'bybitSpot',
        name: 'Bybit',
        type: 'SPOT',
        icon: '🟠',
        color: 'orange',
        url: 'wss://stream.bybit.com/v5/public/spot',
        streams: ['publicTrade.BTCUSDT', 'publicTrade.ETHUSDT', 'publicTrade.SOLUSDT'],
        subscribe: (streams) => ({ op: 'subscribe', args: streams }),
        parse: (msg) => {
            if (!msg.topic?.startsWith('publicTrade') || !msg.data) return null;
            return msg.data.map(t => {
                const price = parseFloat(t.p);
                const size = parseFloat(t.v);
                return {
                    symbol: t.s.replace('USDT', ''),
                    price,
                    size,
                    notional: price * size,
                    side: t.S === 'Buy' ? 'BUY' : 'SELL',
                    timestamp: t.T,
                    tradeId: t.i
                };
            });
        }
    },
    // OKX Spot
    okxSpot: {
        id: 'okxSpot',
        name: 'OKX',
        type: 'SPOT',
        icon: '⚫',
        color: 'slate',
        url: 'wss://ws.okx.com:8443/ws/v5/public',
        streams: [
            { channel: 'trades', instId: 'BTC-USDT' },
            { channel: 'trades', instId: 'ETH-USDT' },
            { channel: 'trades', instId: 'SOL-USDT' }
        ],
        subscribe: (streams) => ({ op: 'subscribe', args: streams }),
        parse: (msg) => {
            if (msg.event || !msg.data) return null;
            return msg.data.map(t => {
                const price = parseFloat(t.px);
                const size = parseFloat(t.sz);
                return {
                    symbol: t.instId.split('-')[0],
                    price,
                    size,
                    notional: price * size,
                    side: t.side === 'buy' ? 'BUY' : 'SELL',
                    timestamp: parseInt(t.ts),
                    tradeId: t.tradeId
                };
            });
        }
    },
    // OKX Perpetual Swaps
    okxSwap: {
        id: 'okxSwap',
        name: 'OKX',
        type: 'PERP',
        icon: '⚫',
        color: 'slate',
        url: 'wss://ws.okx.com:8443/ws/v5/public',
        streams: [
            { channel: 'trades', instId: 'BTC-USDT-SWAP' },
            { channel: 'trades', instId: 'ETH-USDT-SWAP' },
            { channel: 'trades', instId: 'SOL-USDT-SWAP' }
        ],
        subscribe: (streams) => ({ op: 'subscribe', args: streams }),
        parse: (msg) => {
            if (msg.event || !msg.data) return null;
            return msg.data.map(t => {
                const price = parseFloat(t.px);
                const contractSize = parseFloat(t.sz); // sz is number of contracts

                // OKX contract multipliers: BTC=0.01, ETH=0.1, SOL=1
                const symbol = t.instId.split('-')[0];
                let contractMultiplier;
                if (symbol === 'BTC') contractMultiplier = 0.01;
                else if (symbol === 'ETH') contractMultiplier = 0.1;
                else if (symbol === 'SOL') contractMultiplier = 1;
                else contractMultiplier = 1; // fallback

                const size = contractSize * contractMultiplier; // Convert contracts to base currency

                return {
                    symbol,
                    price,
                    size,
                    notional: price * size, // Now correctly calculated
                    side: t.side === 'buy' ? 'BUY' : 'SELL',
                    timestamp: parseInt(t.ts),
                    tradeId: t.tradeId
                };
            });
        }
    },
    // Coinbase Advanced Trade (Spot only)
    coinbase: {
        id: 'coinbase',
        name: 'Coinbase',
        type: 'SPOT',
        icon: '🔵',
        color: 'blue',
        url: 'wss://advanced-trade-ws.coinbase.com',
        streams: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
        subscribe: (streams) => ({
            type: 'subscribe',
            product_ids: streams,
            channel: 'market_trades'
        }),
        parse: (msg) => {
            if (msg.channel !== 'market_trades' || !msg.events) return null;
            const trades = [];
            msg.events.forEach(event => {
                if (event.trades) {
                    event.trades.forEach(t => {
                        const price = parseFloat(t.price);
                        const size = parseFloat(t.size);
                        trades.push({
                            symbol: t.product_id.split('-')[0],
                            price,
                            size,
                            notional: price * size,
                            side: t.side === 'BUY' ? 'BUY' : 'SELL',
                            timestamp: new Date(t.time).getTime(),
                            tradeId: t.trade_id
                        });
                    });
                }
            });
            return trades.length > 0 ? trades : null;
        }
    },
    // Kraken Spot
    kraken: {
        id: 'kraken',
        name: 'Kraken',
        type: 'SPOT',
        icon: '🟣',
        color: 'purple',
        url: 'wss://ws.kraken.com/v2',
        streams: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
        subscribe: (streams) => ({
            method: 'subscribe',
            params: { channel: 'trade', symbol: streams }
        }),
        parse: (msg) => {
            if (msg.channel !== 'trade' || !msg.data) return null;
            return msg.data.map(t => {
                const price = parseFloat(t.price);
                const size = parseFloat(t.qty);
                return {
                    symbol: t.symbol.split('/')[0],
                    price,
                    size,
                    notional: price * size,
                    side: t.side === 'buy' ? 'BUY' : 'SELL',
                    timestamp: new Date(t.timestamp).getTime(),
                    tradeId: t.trade_id
                };
            });
        }
    },
    // Hyperliquid Perpetuals
    hyperliquid: {
        id: 'hyperliquid',
        name: 'Hyperliquid',
        type: 'PERP',
        icon: '🔷',
        color: 'cyan',
        url: 'wss://api.hyperliquid.xyz/ws',
        streams: ['BTC', 'ETH', 'SOL'],
        subscribe: (streams) => streams.map(coin => ({
            method: 'subscribe',
            subscription: { type: 'trades', coin }
        })),
        parse: (msg) => {
            if (msg.channel !== 'trades' || !msg.data) return null;
            return msg.data.map(t => {
                const price = parseFloat(t.px);
                const size = parseFloat(t.sz);
                return {
                    symbol: t.coin,
                    price,
                    size,
                    notional: price * size,
                    side: t.side === 'B' ? 'BUY' : 'SELL',
                    timestamp: t.time,
                    tradeId: t.tid,
                    users: t.users
                };
            });
        }
    }
};
