const fs = require('fs');
const path = require('path');
const https = require('https');

const dataPath = path.join(__dirname, '../data/market-data.json');

const METRIC_RANGES = {
    bofa: { min: 0, max: 10, unit: '/10' },
    fearGreed: { min: 0, max: 100, unit: '/100' },
    vix: { min: 0, max: 100, unit: '' },
    aaii: { min: -100, max: 100, unit: '%' },
    cta: { min: 0, max: 100, unit: 'th' },
    cash: { min: 0, max: 20, unit: '%' },
    levEtfAum: { min: 0, max: 500, unit: '$B' },
    sox: { min: 0, max: 50, unit: '%' },
    ndx: { min: -50, max: 50, unit: '%' },
    russell2000: { min: -50, max: 50, unit: '%' }
};

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

async function fetchVIX() {
    try {
        const data = await httpsGet('https://api.cboe.com/bdc/futures/market_data/get_vix_index.json');
        if (data && data.vix_index) {
            return parseFloat(data.vix_index.vix);
        }
        const yahooData = await httpsGet('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d');
        if (yahooData && yahooData.chart && yahooData.chart.result) {
            const quote = yahooData.chart.result[0].meta;
            return parseFloat(quote.regularMarketPrice);
        }
    } catch (e) {
        console.log('VIX fetch failed:', e.message);
    }
    return null;
}

async function fetchStockData(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
        const data = await httpsGet(url);
        if (data && data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const prices = result.indicators.quote[0].close;
            const current = prices[prices.length - 1];
            const fiveDaysAgo = prices[0];
            const change = ((current - fiveDaysAgo) / fiveDaysAgo * 100).toFixed(2);
            return { price: parseFloat(current), change: parseFloat(change) };
        }
    } catch (e) {
        console.log(`${symbol} fetch failed:`, e.message);
    }
    return null;
}

async function fetchFearGreed() {
    try {
        const data = await httpsGet('https://production.dataviz.cnn.io/index/fearandgreed/graphdata');
        if (data && data.data && data.data[0]) {
            const latest = data.data[data.data.length - 1];
            return parseFloat(latest.value);
        }
    } catch (e) {
        console.log('Fear & Greed fetch failed:', e.message);
    }
    return null;
}

async function fetchAllData() {
    console.log('Fetching market data from free APIs...\n');
    const results = {};
    
    const vix = await fetchVIX();
    if (vix) {
        results.vix = { value: vix, status: vix >= 30 ? 'bearish' : (vix <= 15 ? 'bullish' : 'neutral') };
        console.log(`VIX: ${vix}`);
    }

    const fearGreed = await fetchFearGreed();
    if (fearGreed) {
        results.fearGreed = { value: fearGreed, status: fearGreed >= 60 ? 'bearish' : (fearGreed <= 20 ? 'bullish' : 'neutral') };
        console.log(`Fear & Greed: ${fearGreed}`);
    }

    const soxData = await fetchStockData('%5ESOX');
    if (soxData) {
        results.sox = { value: Math.abs(soxData.change), status: soxData.change <= -10 ? 'bearish' : (soxData.change >= -3 ? 'bullish' : 'neutral') };
        console.log(`SOX: ${soxData.price} (${soxData.change}%)`);
    }

    const ndxData = await fetchStockData('%5ENDX');
    if (ndxData) {
        results.ndx = { value: ndxData.change, status: ndxData.change <= -5 ? 'bearish' : (ndxData.change >= 0 ? 'bullish' : 'neutral') };
        console.log(`NDX: ${ndxData.change}%`);
    }

    const rutData = await fetchStockData('%5ERUT');
    if (rutData) {
        results.russell2000 = { value: rutData.change, status: rutData.change <= -5 ? 'bearish' : (rutData.change >= 5 ? 'bullish' : 'neutral') };
        console.log(`Russell 2000: ${rutData.change}%`);
    }

    console.log('\n');
    return results;
}

function validateMarketData(data) {
    console.log('Validating market-data.json...\n');
    let errors = [];
    let warnings = [];

    if (!data.lastUpdated) {
        errors.push('Missing lastUpdated field');
    } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(data.lastUpdated)) {
            errors.push(`Invalid date format: ${data.lastUpdated}`);
        }
    }

    if (!data.metrics) {
        errors.push('Missing metrics object');
    } else {
        Object.entries(METRIC_RANGES).forEach(([key, config]) => {
            const metric = data.metrics[key];
            if (!metric) {
                errors.push(`Missing metric: ${key}`);
                return;
            }
            if (typeof metric.value !== 'number') {
                errors.push(`${key}: value must be a number`);
            }
            if (!metric.label) errors.push(`${key}: missing label`);
        });
    }

    if (errors.length > 0) {
        console.log('Errors:');
        errors.forEach(e => console.log(`  - ${e}`));
        return false;
    }

    console.log('All validations passed!');
    return true;
}

async function main() {
    let currentData = {};
    try {
        const content = fs.readFileSync(dataPath, 'utf-8');
        currentData = JSON.parse(content);
    } catch (e) {
        console.log('No existing data found');
    }

    const fetchedData = await fetchAllData();
    const today = new Date().toISOString().split('T')[0];
    const updatedMetrics = { ...currentData.metrics };
    
    Object.entries(fetchedData).forEach(([key, result]) => {
        if (result.value !== null && updatedMetrics[key]) {
            updatedMetrics[key] = {
                ...updatedMetrics[key],
                value: result.value,
                status: result.status
            };
        }
    });

    const updatedData = {
        ...currentData,
        lastUpdated: today,
        metrics: updatedMetrics
    };

    fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
    console.log('market-data.json updated!');
    validateMarketData(updatedData);
}

main().catch(console.error);
