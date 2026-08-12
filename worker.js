/**
 * Cloudflare Worker — Marco Dashboard API
 *
 * Routes:
 *   POST /api/refresh  — fetch CBOE/CNN/Yahoo data, push to GitHub
 *   GET  /api/health   — return last refresh status
 *   *    — fall through to static assets
 *
 * Setup:
 *   npx wrangler secret put GITHUB_TOKEN
 *   (use a GitHub PAT with `repo` scope)
 */

const GITHUB_OWNER = 'wasahin';
const GITHUB_REPO = 'Marco-dashboard';
const GITHUB_BRANCH = 'main';

// ── Utility ───────────────────────────────────────────

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        }
    });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function githubApi(path, method, token, body) {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'marco-dashboard-worker'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    return res;
}

// ── Data fetchers ─────────────────────────────────────

async function fetchCBOE() {
    const res = await fetch('https://api.cboe.com/bdc/futures/market_data/get_vix_index.json', {
        headers: { 'User-Agent': 'marco-dashboard/1.0' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.vix_index) throw new Error('No vix_index in response');
    return parseFloat(data.vix_index.vix);
}

async function fetchCNN() {
    const res = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.data || data.data.length === 0) throw new Error('No data in response');
    const latest = data.data[data.data.length - 1];
    return parseFloat(latest.value);
}

async function fetchYahoo(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
    });
    if (res.status === 429) throw new Error('HTTP 429 (rate limited)');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.chart || !data.chart.result || !data.chart.result[0]) throw new Error('No chart data');
    const result = data.chart.result[0];
    const prices = result.indicators.quote[0].close;
    const current = prices[prices.length - 1];
    const fiveDaysAgo = prices[0];
    if (!current || !fiveDaysAgo) throw new Error('Missing price data');
    const change = ((current - fiveDaysAgo) / fiveDaysAgo * 100);
    return { price: parseFloat(current), change: parseFloat(change.toFixed(2)) };
}

// ── Main handler ──────────────────────────────────────

async function handleRefresh(request, env) {
    const token = env.GITHUB_TOKEN;
    if (!token) {
        return json({ error: 'GITHUB_TOKEN not configured. Run: npx wrangler secret put GITHUB_TOKEN' }, 500);
    }

    const startTime = Date.now();
    const health = {
        lastRun: new Date().toISOString(),
        durationMs: 0,
        sources: {
            cboe:  { success: false, lastValue: null, error: null },
            cnn:   { success: false, lastValue: null, error: null },
            yahoo: { success: false, lastValue: null, error: null, rateLimitHits: 0 }
        }
    };

    const fetched = {};

    // 1. CBOE VIX
    try {
        const vix = await fetchCBOE();
        health.sources.cboe.success = true;
        health.sources.cboe.lastValue = vix;
        fetched.vix = vix;
    } catch (e) {
        health.sources.cboe.error = e.message;
    }

    // 2. CNN Fear & Greed
    try {
        const fg = await fetchCNN();
        health.sources.cnn.success = true;
        health.sources.cnn.lastValue = fg;
        fetched.fearGreed = fg;
    } catch (e) {
        health.sources.cnn.error = e.message;
    }

    // 3. Yahoo stock data — SOX, NDX, RUT with 1s delay between calls
    const symbols = [
        { sym: '%5ESOX', key: 'sox' },
        { sym: '%5ENDX', key: 'ndx' },
        { sym: '%5ERUT', key: 'russell2000' }
    ];

    for (let i = 0; i < symbols.length; i++) {
        if (i > 0) await sleep(1000);
        const { sym, key } = symbols[i];
        try {
            const data = await fetchYahoo(sym);
            fetched[key] = data;
            health.sources.yahoo.success = true;
            health.sources.yahoo.lastValue = data.price;
        } catch (e) {
            if (e.message.includes('429')) {
                health.sources.yahoo.rateLimitHits++;
            }
            if (!health.sources.yahoo.error) {
                health.sources.yahoo.error = e.message;
            }
        }
    }

    // 4. Get current market-data.json SHA from GitHub
    let sha = null;
    let currentData = {};
    try {
        const fileRes = await githubApi(`/contents/data/market-data.json?ref=${GITHUB_BRANCH}`, 'GET', token);
        if (fileRes.ok) {
            const fileData = await fileRes.json();
            sha = fileData.sha;
            currentData = JSON.parse(atob(fileData.content));
        }
    } catch (e) {
        // Continue with empty data
    }

    // 5. Merge fetched data into existing metrics
    const today = new Date().toISOString().split('T')[0];
    const updatedMetrics = { ...currentData.metrics };

    if (fetched.vix !== undefined && updatedMetrics.vix) {
        updatedMetrics.vix.value = fetched.vix;
        updatedMetrics.vix.status = fetched.vix >= 30 ? 'bearish' : (fetched.vix <= 15 ? 'bullish' : 'neutral');
    }
    if (fetched.fearGreed !== undefined && updatedMetrics.fearGreed) {
        updatedMetrics.fearGreed.value = fetched.fearGreed;
        updatedMetrics.fearGreed.status = fetched.fearGreed >= 60 ? 'bearish' : (fetched.fearGreed <= 20 ? 'bullish' : 'neutral');
    }
    if (fetched.sox && updatedMetrics.sox) {
        updatedMetrics.sox.value = Math.abs(fetched.sox.change);
        updatedMetrics.sox.status = fetched.sox.change <= -10 ? 'bearish' : (fetched.sox.change >= -3 ? 'bullish' : 'neutral');
    }
    if (fetched.ndx && updatedMetrics.ndx) {
        updatedMetrics.ndx.value = fetched.ndx.change;
        updatedMetrics.ndx.status = fetched.ndx.change <= -5 ? 'bearish' : (fetched.ndx.change >= 0 ? 'bullish' : 'neutral');
    }
    if (fetched.russell2000 && updatedMetrics.russell2000) {
        updatedMetrics.russell2000.value = fetched.russell2000.change;
        updatedMetrics.russell2000.status = fetched.russell2000.change <= -5 ? 'bearish' : (fetched.russell2000.change >= 5 ? 'bullish' : 'neutral');
    }

    const updatedData = {
        ...currentData,
        lastUpdated: today,
        metrics: updatedMetrics
    };

    // 6. Push market-data.json to GitHub
    let pushOk = false;
    let commitSha = null;
    try {
        const content = btoa(JSON.stringify(updatedData, null, 2));
        const pushRes = await githubApi(`/contents/data/market-data.json`, 'PUT', token, {
            message: `data: auto-refresh ${new Date().toISOString()}`,
            content,
            sha,
            branch: GITHUB_BRANCH
        });
        if (pushRes.ok) {
            const pushData = await pushRes.json();
            commitSha = pushData.commit.sha.substring(0, 7);
            pushOk = true;
        }
    } catch (e) {
        // Push failed
    }

    // 7. Push health.json
    health.durationMs = Date.now() - startTime;
    try {
        const healthFileRes = await githubApi(`/contents/data/health.json?ref=${GITHUB_BRANCH}`, 'GET', token);
        let healthSha = null;
        if (healthFileRes.ok) {
            const healthFileData = await healthFileRes.json();
            healthSha = healthFileData.sha;
        }
        const healthContent = btoa(JSON.stringify(health, null, 2));
        await githubApi(`/contents/data/health.json`, 'PUT', token, {
            message: `health: refresh ${new Date().toISOString()}`,
            content: healthContent,
            sha: healthSha,
            branch: GITHUB_BRANCH
        });
    } catch (e) {
        // Health push failed — non-critical
    }

    // 8. Return result
    const autoMetrics = {};
    if (fetched.vix !== undefined) autoMetrics.vix = fetched.vix;
    if (fetched.fearGreed !== undefined) autoMetrics.fearGreed = fetched.fearGreed;
    if (fetched.sox) autoMetrics.sox = fetched.sox.change + '%';
    if (fetched.ndx) autoMetrics.ndx = fetched.ndx.change + '%';
    if (fetched.russell2000) autoMetrics.russell2000 = fetched.russell2000.change + '%';

    return json({
        success: pushOk,
        message: pushOk
            ? 'Auto data refreshed and pushed to GitHub. Cloudflare will auto-deploy.'
            : 'Data fetched but GitHub push failed. Check GITHUB_TOKEN.',
        commit: commitSha,
        durationMs: health.durationMs,
        autoMetrics,
        health,
        manualMetrics: ['bofa', 'cta', 'cash', 'aaii', 'streetGamma', 'levEtfAum'],
        manualNote: 'Manual metrics (BofA, CTA, Cash, AAII, Street Gamma, Lev ETF) were preserved. Use TRAE for web search updates.'
    });
}

// ── Worker entry ──────────────────────────────────────

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }

        // API routes
        if (url.pathname === '/api/refresh') {
            if (request.method !== 'POST') {
                return json({ error: 'Method not allowed. Use POST.' }, 405);
            }
            return handleRefresh(request, env);
        }

        // Everything else → static assets
        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }
        return new Response('Not found', { status: 404 });
    }
};
