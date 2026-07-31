const fs = require('fs');
const path = require('path');
const https = require('https');

const dataPath = path.join(__dirname, '../data/market-data.json');
const healthPath = path.join(__dirname, '../data/health.json');

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

// Track health per source
const health = {
    lastRun: null,
    durationMs: 0,
    sources: {
        cboe:  { success: false, lastValue: null, error: null },
        cnn:   { success: false, lastValue: null, error: null },
        yahoo: { success: false, lastValue: null, error: null, rateLimitHits: 0 }
    }
};

// --- HTTP helpers ---

function httpsGet(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: options.headers || {} }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: data });
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy(new Error('Request timeout'));
        });
    });
}

function parseJson(body) {
    try { return JSON.parse(body); }
    catch { return null; }
}

/**
 * Retry wrapper with exponential backoff + jitter.
 * Yahoo Finance rate-limits anonymous calls (~100/hr/IP).
 * Base delay 3000ms, exponential (3s -> 6s -> 12s), +-20% jitter.
 */
async function fetchWithRetry(url, sourceKey, maxRetries = 3, baseDelay = 3000) {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const { statusCode, body } = await httpsGet(url);

            if (statusCode === 429) {
                health.sources[sourceKey].rateLimitHits++;
            }

            if (statusCode >= 400) {
                lastError = `HTTP ${statusCode}`;
                if (attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
                    console.log(`  [retry] ${sourceKey}: HTTP ${statusCode}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
                    await sleep(delay);
                    continue;
                }
                return { success: false, error: lastError, data: null };
            }

            const parsed = parseJson(body);
            if (!parsed) {
                lastError = 'Invalid JSON response';
                if (attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
                    await sleep(delay);
                    continue;
                }
                return { success: false, error: lastError, data: null };
            }

            return { success: true, error: null, data: parsed };
        } catch (e) {
            lastError = e.message;
            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
                console.log(`  [retry] ${sourceKey}: ${e.message}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
                continue;
            }
        }
    }
    return { success: false, error: lastError, data: null };
}

/**
 * Simple single-attempt fetch for CBOE and CNN (no rate-limit issues).
 */
async function fetchOnce(url, sourceKey) {
    try {
        const { statusCode, body } = await httpsGet(url);
        if (statusCode >= 400) {
            return { success: false, error: `HTTP ${statusCode}`, data: null };
        }
        const parsed = parseJson(body);
        if (!parsed) {
            return { success: false, error: 'Invalid JSON response', data: null };
        }
        return { success: true, error: null, data: parsed };
    } catch (e) {
        return { success: false, error: e.message, data: null };
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Data fetchers ---

async function fetchVIX() {
    const result = await fetchOnce('https://api.cboe.com/bdc/futures/market_data/get_vix_index.json', 'cboe');
    if (result.success && result.data && result.data.vix_index) {
        health.sources.cboe.success = true;
        health.sources.cboe.lastValue = parseFloat(result.data.vix_index.vix);
        return health.sources.cboe.lastValue;
    }
    // Fallback to Yahoo
    const yahooResult = await fetchWithRetry('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d', 'yahoo');
    if (yahooResult.success && yahooResult.data && yahooResult.data.chart && yahooResult.data.chart.result) {
        const quote = yahooResult.data.chart.result[0].meta;
        health.sources.cboe.success = true;
        health.sources.cboe.lastValue = parseFloat(quote.regularMarketPrice);
        health.sources.cboe.error = 'CBOE failed, used Yahoo fallback';
        return health.sources.cboe.lastValue;
    }
    health.sources.cboe.error = result.error || 'No data from CBOE or Yahoo fallback';
    return null;
}

async function fetchFearGreed() {
    const result = await fetchOnce('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', 'cnn');
    if (result.success && result.data && result.data.data && result.data.data[0]) {
        const latest = result.data.data[result.data.data.length - 1];
        const value = parseFloat(latest.value);
        health.sources.cnn.success = true;
        health.sources.cnn.lastValue = value;
        return value;
    }
    health.sources.cnn.error = result.error || 'No data from CNN';
    return null;
}

async function fetchStockData(symbol, delayBetweenCalls = 3000) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const result = await fetchWithRetry(url, 'yahoo');
    if (result.success && result.data && result.data.chart && result.data.chart.result && result.data.chart.result[0]) {
        const chartResult = result.data.chart.result[0];
        const prices = chartResult.indicators.quote[0].close;
        const current = prices[prices.length - 1];
        const fiveDaysAgo = prices[0];
        const change = ((current - fiveDaysAgo) / fiveDaysAgo * 100).toFixed(2);
        const value = { price: parseFloat(current), change: parseFloat(change) };
        health.sources.yahoo.success = true;
        health.sources.yahoo.lastValue = value.price;
        return value;
    }
    if (!health.sources.yahoo.error) {
        health.sources.yahoo.error = result.error || 'Yahoo fetch failed';
    }
    return null;
}

// --- Main logic ---

async function fetchAllData() {
    console.log('Fetching market data from free APIs...\n');
    const results = {};

    // VIX (CBOE primary, Yahoo fallback)
    const vix = await fetchVIX();
    if (vix !== null) {
        results.vix = { value: vix, status: vix >= 30 ? 'bearish' : (vix <= 15 ? 'bullish' : 'neutral') };
        console.log(`  VIX: ${vix}`);
    } else {
        console.log('  VIX: fetch failed');
    }

    // Fear & Greed (CNN)
    const fearGreed = await fetchFearGreed();
    if (fearGreed !== null) {
        results.fearGreed = { value: fearGreed, status: fearGreed >= 60 ? 'bearish' : (fearGreed <= 20 ? 'bullish' : 'neutral') };
        console.log(`  Fear & Greed: ${fearGreed}`);
    } else {
        console.log('  Fear & Greed: fetch failed');
    }

    // Yahoo stock data — 3 symbols with 3s delay between each
    const symbols = [
        { sym: '%5ESOX', key: 'sox', label: 'SOX' },
        { sym: '%5ENDX', key: 'ndx', label: 'NDX' },
        { sym: '%5ERUT', key: 'russell2000', label: 'RUT' }
    ];

    for (let i = 0; i < symbols.length; i++) {
        const { sym, key, label } = symbols[i];
        if (i > 0) await sleep(3000); // 3s delay between Yahoo calls

        const stockData = await fetchStockData(sym);
        if (stockData) {
            if (key === 'sox') {
                results.sox = { value: Math.abs(stockData.change), status: stockData.change <= -10 ? 'bearish' : (stockData.change >= -3 ? 'bullish' : 'neutral') };
            } else if (key === 'ndx') {
                results.ndx = { value: stockData.change, status: stockData.change <= -5 ? 'bearish' : (stockData.change >= 0 ? 'bullish' : 'neutral') };
            } else if (key === 'russell2000') {
                results.russell2000 = { value: stockData.change, status: stockData.change <= -5 ? 'bearish' : (stockData.change >= 5 ? 'bullish' : 'neutral') };
            }
            console.log(`  ${label}: ${stockData.price} (${stockData.change}%)`);
        } else {
            console.log(`  ${label}: fetch failed`);
        }
    }

    console.log('');
    return results;
}

function validateMarketData(data) {
    console.log('Validating market-data.json...\n');
    let errors = [];
    let warnings = [];

    if (!data.lastUpdated) {
        errors.push('Missing "lastUpdated" field');
    } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(data.lastUpdated)) {
            errors.push(`Invalid date format: ${data.lastUpdated}`);
        }
    }

    if (!data.metrics) {
        errors.push('Missing "metrics" object');
    } else {
        Object.entries(METRIC_RANGES).forEach(([key, config]) => {
            const metric = data.metrics[key];
            if (!metric) {
                errors.push(`Missing metric: ${key}`);
                return;
            }
            if (typeof metric.value !== 'number') {
                errors.push(`${key}: value must be a number`);
            } else if (metric.value < config.min || metric.value > config.max) {
                warnings.push(`${key}: ${metric.value}${config.unit} outside range (${config.min}-${config.max})`);
            }
            if (!metric.label) errors.push(`${key}: missing label`);
        });
    }

    if (warnings.length > 0) {
        console.log('Warnings:');
        warnings.forEach(w => console.log(`  ${w}`));
    }

    if (errors.length > 0) {
        console.log('Errors:');
        errors.forEach(e => console.log(`  ${e}`));
        return false;
    }

    console.log('All validations passed!');
    return true;
}

function writeHealthJson(durationMs) {
    health.lastRun = new Date().toISOString();
    health.durationMs = Math.round(durationMs);

    // Read previous health to preserve lastValue on failure
    try {
        const prevHealth = JSON.parse(fs.readFileSync(healthPath, 'utf-8'));
        for (const key of Object.keys(health.sources)) {
            if (!health.sources[key].success && health.sources[key].lastValue === null) {
                health.sources[key].lastValue = prevHealth.sources[key]?.lastValue ?? null;
            }
        }
    } catch { /* no previous health */ }

    fs.writeFileSync(healthPath, JSON.stringify(health, null, 2));
    console.log('health.json written.');
}

async function main() {
    const startTime = Date.now();

    let currentData = {};
    try {
        currentData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch {
        console.log('No existing data found, starting fresh.');
    }

    const fetchedData = await fetchAllData();
    const today = new Date().toISOString().split('T')[0];
    const updatedMetrics = { ...currentData.metrics };

    Object.entries(fetchedData).forEach(([key, result]) => {
        if (result.value !== null && updatedMetrics[key]) {
            const oldValue = updatedMetrics[key].value;
            updatedMetrics[key] = {
                ...updatedMetrics[key],
                value: result.value,
                status: result.status
            };
            const change = result.value - oldValue;
            const direction = change >= 0 ? '+' : '';
            console.log(`  ${updatedMetrics[key].label}: ${oldValue} -> ${result.value} (${direction}${change.toFixed(2)})`);
        }
    });

    const updatedData = {
        ...currentData,
        lastUpdated: today,
        metrics: updatedMetrics
    };

    fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
    console.log('\nmarket-data.json updated.');

    validateMarketData(updatedData);

    const durationMs = Date.now() - startTime;
    writeHealthJson(durationMs);

    console.log(`\nDone in ${durationMs}ms.`);
    console.log('Dashboard: http://localhost:8084/');
}

main().catch(err => {
    const durationMs = Date.now() - (health.lastRun ? new Date(health.lastRun).getTime() : Date.now());
    writeHealthJson(durationMs);
    console.error('Fatal error:', err.message);
    process.exit(1);
});
