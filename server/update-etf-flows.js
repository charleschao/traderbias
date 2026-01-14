/**
 * Update ETF Flows JSON
 * 
 * Run this locally to scrape farside.co.uk and update the JSON file.
 * Then git commit and push to update the VPS.
 * 
 * Usage: node update-etf-flows.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const FARSIDE_URL = 'https://farside.co.uk/btc/';
const JSON_PATH = path.join(__dirname, 'data', 'etf-flows.json');

async function scrapeEtfFlows() {
    console.log('Scraping farside.co.uk/btc/...');

    const { data } = await axios.get(FARSIDE_URL, {
        timeout: 20000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TraderBiasBot/1.0)'
        }
    });

    const $ = cheerio.load(data);
    const flows = [];

    $('table tbody tr').each((i, row) => {
        const cols = $(row).find('td');
        if (cols.length < 10) return;

        const dateStr = $(cols[0]).text().trim();
        if (!dateStr.match(/\d{2} \w{3} \d{4}/)) return;

        const parseVal = (text) => {
            const cleaned = text.trim().replace(/[\(\),]/g, '');
            const isNeg = text.includes('(') && text.includes(')');
            const val = parseFloat(cleaned) || 0;
            return isNeg ? -val : val;
        };

        flows.push({
            date: dateStr,
            netFlowM: parseVal($(cols[1]).text()),
            IBIT: parseVal($(cols[2]).text()),
            FBTC: parseVal($(cols[3]).text()),
            BITB: parseVal($(cols[4]).text()),
            ARKB: parseVal($(cols[5]).text()),
            GBTC: cols.length > 11 ? parseVal($(cols[11]).text()) : 0
        });
    });

    flows.reverse();
    return flows;
}

async function main() {
    try {
        const flows = await scrapeEtfFlows();

        if (flows.length === 0) {
            console.error('No data scraped!');
            process.exit(1);
        }

        const latest = flows[0];
        console.log(`\nLatest: ${latest.date} | Net: $${latest.netFlowM}M`);
        console.log(`IBIT: $${latest.IBIT}M | FBTC: $${latest.FBTC}M | ARKB: $${latest.ARKB}M`);

        const jsonData = {
            source: 'farside.co.uk',
            lastUpdated: new Date().toISOString(),
            updatedBy: 'update-etf-flows.js',
            today: {
                date: latest.date,
                netFlowM: latest.netFlowM,
                IBIT: latest.IBIT,
                FBTC: latest.FBTC,
                ARKB: latest.ARKB,
                BITB: latest.BITB,
                GBTC: latest.GBTC
            },
            history: flows.slice(0, 7)
        };

        fs.writeFileSync(JSON_PATH, JSON.stringify(jsonData, null, 2));
        console.log(`\n✓ Updated ${JSON_PATH}`);
        console.log('\nTo deploy: git add . && git commit -m "update etf flows" && git push');
        console.log('Then on VPS: cd /var/www/traderbias/server && git pull');

    } catch (error) {
        console.error('Failed:', error.message);
        process.exit(1);
    }
}

main();
