const WebSocket = require('ws');

// Coinbase Advanced Trade WebSocket Test
const url = 'wss://advanced-trade-ws.coinbase.com';

console.log(`Connecting to ${url}...`);
const ws = new WebSocket(url);

ws.on('open', () => {
    console.log('Connected. Sending subscription...');
    const sub = {
        type: 'subscribe',
        product_ids: ['BTC-USD'],
        channel: 'market_trades'
    };
    console.log('Subscription:', JSON.stringify(sub, null, 2));
    ws.send(JSON.stringify(sub));
});

ws.on('message', (data) => {
    const str = data.toString();
    console.log('\n--- RAW MESSAGE ---');
    console.log(str);

    try {
        const msg = JSON.parse(str);
        console.log('Parsed Keys:', Object.keys(msg));

        if (msg.events) {
            console.log('Events count:', msg.events.length);
            msg.events.forEach((e, i) => {
                console.log(`  Event ${i}:`, Object.keys(e));
                if (e.trades) {
                    console.log(`    Trades count: ${e.trades.length}`);
                    e.trades.slice(0, 2).forEach((t, j) => {
                        console.log(`      Trade ${j}:`, {
                            product_id: t.product_id,
                            price: t.price,
                            size: t.size,
                            side: t.side,
                            time: t.time,
                            trade_id: t.trade_id
                        });
                    });
                }
            });
        }
    } catch (e) {
        console.log('Parse error:', e.message);
    }
});

ws.on('error', (err) => {
    console.error('ERROR:', err.message);
});

ws.on('close', () => {
    console.log('Connection closed.');
});

// Run for 30 seconds
setTimeout(() => {
    console.log('Test finished.');
    ws.close();
    process.exit(0);
}, 30000);
