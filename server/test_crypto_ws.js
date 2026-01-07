const WebSocket = require('ws');

const EXCHANGES = {
    hyperliquid: {
        url: 'wss://api.hyperliquid.xyz/ws',
        subscribe: [
            { method: 'subscribe', subscription: { type: 'trades', coin: 'BTC' } }
        ],
        name: 'Hyperliquid'
    },
    coinbase: {
        url: 'wss://advanced-trade-ws.coinbase.com',
        subscribe: {
            type: 'subscribe',
            product_ids: ['BTC-USD'],
            channel: 'market_trades'
        },
        name: 'Coinbase'
    }
};

Object.keys(EXCHANGES).forEach(key => {
    const ex = EXCHANGES[key];
    console.log(`[${ex.name}] Connecting to ${ex.url}...`);
    const ws = new WebSocket(ex.url);

    ws.on('open', () => {
        console.log(`[${ex.name}] Connected! Sending subscription...`);
        if (Array.isArray(ex.subscribe)) {
            ex.subscribe.forEach(msg => {
                console.log(`[${ex.name}] Sending:`, JSON.stringify(msg));
                ws.send(JSON.stringify(msg));
            });
        } else {
            console.log(`[${ex.name}] Sending:`, JSON.stringify(ex.subscribe));
            ws.send(JSON.stringify(ex.subscribe));
        }
    });

    ws.on('message', (data) => {
        const str = data.toString();
        // Brief summary of message
        console.log(`[${ex.name}] Received: ${str.slice(0, 200)}${str.length > 200 ? '...' : ''}`);
    });

    ws.on('error', (err) => {
        console.error(`[${ex.name}] ERROR:`, err.message);
    });

    ws.on('close', () => {
        console.log(`[${ex.name}] Closed.`);
    });
});

// Run for 30 seconds
setTimeout(() => {
    console.log('Test finished.');
    process.exit(0);
}, 30000);
