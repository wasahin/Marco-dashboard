# Marco-dashboard

> **Daily Risk Assessment for VCP / Momentum Trading**
> Owner: 道高 (wasahin) — VCP/momentum trader, primarily US stocks
> Toolchain: TRAE (vibe coding) → GitHub → Cloudflare Pages
> License: MIT

---

## 1. What this dashboard is

A **static, single-page HTML dashboard** showing daily US market risk context for VCP (Volatility Contraction Pattern) entries. Decision support only — not a live trading system, not a backtester, not a screener.

---

## 2. Data sources (all free, no paid API)

### 2.1 Automated layer — runs on cron, zero human/AI in the loop

| Source | Endpoint | What it gives | Update frequency |
|---|---|---|---|
| **CBOE** | `https://api.cboe.com/...` (VIX) | Volatility index | Hourly during market hours |
| **CNN dataviz** | `https://production.dataviz.cnn.io/index/fearandgreed/graphdata` | Fear & Greed composite (7 indicators) | Hourly |
| **Yahoo Finance** | `https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}` | US stock / ETF prices | Every 5 min during market hours |
| **MacroMicro** | JSON endpoint per chart URL (e.g. `/charts/142681`) | Macro indicators, bull/bear ratio | Daily |

All four are **clean JSON endpoints** — no HTML scraping, no auth required (except where noted). This is the core data plane.

### 2.2 Manual layer — AI refresh, on-demand only

| Source | What it gives | When |
|---|---|---|
| **WallStreetCN** | Chinese US-market news, SOX/NDX context | When user says "update all indices" |
| **Web search** | CTA exposure, Fund Manager Cash, AAII sentiment | Same — requires AI interpretation |

These sources need AI in the loop to search, read, and interpret. They cannot be cron-automated without a headless browser. They enrich the JSON with context descriptions, not raw values.

### 2.3 Removed sources (decision record)

- **华尔街见闻 (WallStreetCN)** — wanted for Chinese US-market news. **Removed from automated layer** because HTML encrypted, IP rate-limiting aggressive, requires headless browser + anti-detection. Kept as manual AI-only layer. Cost not worth automating.
- **Investing.com (cn.investing.com)** — same reason: aggressive anti-scraping. Economic calendar moved to ForexFactory (English, has RSS). **Fully removed.**

### 2.4 Future / not yet integrated

- **Finviz** — free tier is HTML-only, no JSON API. Elite tier has real API but is paid (~$25/mo) — **out of scope per no-paid-API rule**. Alternative: Yahoo Finance undocumented screener endpoints or StockAnalysis.com cleaner structure. **Status: future work**.
- **Sina Finance / Eastmoney** — if Chinese US-market news is needed later, these have cleaner JSON endpoints than WallStreetCN.
- **S&P 500 breadth** (% above 50/200 MA) — need a free source. Yahoo or Finviz scrape are options.
- **Sector rotation heatmap** — needs sector ETF prices + relative strength calc; can derive from Yahoo data already in stack.
- **ForexFactory RSS** — for economic calendar (FOMC, CPI dates). Much easier to scrape than Investing.com. **Status: to be added as `data/calendar.json`, maintained monthly.**

### 2.5 Deferred — Phase 2

The following items are explicitly deferred to a future session. Do NOT implement these in Phase 1.

- **MacroMicro endpoint discovery** — needs manual inspection of page source to find the JSON endpoint per chart URL. Deferred: requires separate manual endpoint discovery session.
- **`_stale: true` flag on individual data files** — will be bundled with MacroMicro integration in the next session. Phase 1 uses `health.json` for source status tracking instead.
- **ForexFactory calendar** — RSS parsing for economic calendar (FOMC, CPI dates). Deferred: lower priority than core data pipeline stability.
- **Per-source file split** (`vix.json`, `fear-greed.json`, `prices.json`, `macro.json`) — only do if debugging becomes painful. Current single `market-data.json` + `health.json` is sufficient.

---

## 3. Architecture

```
Marco-dashboard/
├── index.html              # Single-file static dashboard (Macro + Premium themes)
├── scripts/
│   └── update-data.js      # Node script, hits 3 free APIs (CBOE, CNN, Yahoo)
├── data/
│   ├── market-data.json    # Combined market data snapshot
│   └── health.json         # Source health tracking (written every run)
├── .github/
│   └── workflows/
│       └── update-data.yml # Cron schedule (UTC 21:00 weekdays), runs update-data.js
├── AGENTS.md               # This file
├── README.md
├── wrangler.toml           # Cloudflare Workers static asset config
└── LICENSE                 # MIT
```

### Data flow

```
┌─────────────────────────────────────────┐
│  AUTOMATED (GitHub Actions cron)         │
│  Daily at UTC 21:00 (US market close)   │
│                                          │
│  CBOE API → VIX                          │
│  CNN dataviz API → Fear & Greed          │
│  Yahoo Finance API → SOX/NDX/RUT         │
│  (Yahoo calls use exponential backoff)   │
│                                          │
│  → Updates data/market-data.json         │
│  → Writes data/health.json (every run)   │
│  → Commits & pushes to GitHub            │
│  → Cloudflare auto-deploys               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  MANUAL (AI refresh, on-demand)          │
│  When user says "update all indices"     │
│                                          │
│  WallStreetCN → SOX/NDX context          │
│  Web search → CTA, Cash, AAII            │
│  AI interprets & writes descriptions     │
│                                          │
│  → Enriches JSON with context            │
│  → Pushes to GitHub                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  STATIC (manual, monthly)                │
│                                          │
│  ForexFactory RSS → Economic calendar    │
│  data/calendar.json (FOMC, CPI dates)    │
└─────────────────────────────────────────┘
```

---

## 4. Build & deploy

```bash
# One-time setup
npm install

# Manual data refresh (during development)
node scripts/update-data.js

# Start local server
npm start
# → http://localhost:8084/

# Validate JSON format
npm run update-data
```

### Cloudflare deployment

- **Hosting:** Cloudflare Workers (static asset serving via `wrangler.toml`)
- **Auto-deploy:** Every push to `main` triggers Cloudflare rebuild
- **No build step:** Pure static files — `index.html` + `data/*.json`

---

## 5. Market Data Update Protocol

When asked to "update all indices" or "update the dashboard", follow this protocol:

### Step 1: Read current data
Read `data/market-data.json` to see current values and structure.

### Step 2: Search for each metric

| Metric | JSON Path | Search Query | Source Layer |
|--------|-----------|--------------|--------------|
| **BofA Bull & Bear** | `metrics.bofa.value` | "BofA Bull Bear Indicator latest" | MacroMicro (auto) / Web search (manual) |
| **CNN Fear & Greed** | `metrics.fearGreed.value` | "CNN Fear & Greed Index today" | CNN dataviz API (auto) |
| **VIX Index** | `metrics.vix.value` | "VIX index current level" | CBOE API (auto) |
| **CTA Exposure** | `metrics.cta.value` | "CTA exposure percentile latest" | Web search (manual only) |
| **Fund Manager Cash** | `metrics.cash.value` | "fund manager cash level FMS" | Web search (manual only) |
| **SOX Drawdown** | `metrics.sox.value` | "SOX semiconductor index drawdown" | Yahoo API (auto) / WallStreetCN (manual) |
| **AAII Spread** | `metrics.aaii.value` | "AAII bull bear spread latest" | Web search (manual only) |
| **NDX Performance** | `metrics.ndx.value` | "NASDAQ 100 NDX performance" | Yahoo API (auto) / WallStreetCN (manual) |
| **Russell 2000** | `metrics.russell2000.value` | "Russell 2000 RUT performance" | Yahoo API (auto) |

### Step 3: Update JSON
- `lastUpdated`: Current date (YYYY-MM-DD)
- For each metric: `value` (number), `description` (context), `status` (bullish/bearish/neutral)

### Step 4: Validate & push
1. Run `npm run update-data` to validate
2. Commit and push to GitHub (`wasahin/Marco-dashboard`)
3. Cloudflare auto-deploys

### Step 5: Report changes

```
✅ Updated Market Data (YYYY-MM-DD)

| Metric | Old | New | Change |
|--------|-----|-----|--------|
| Fear & Greed | 28 | 35 | ↑ +7 |
| VIX | 16.29 | 15.80 | ↓ -0.49 |

📝 Key Notes:
- Fear & Greed improved from deep fear to neutral
- VIX continues to compress despite recent volatility
```

---

## 6. Metric status rules

- **BofA**: >= 8 = bearish, <= 2 = bullish, otherwise neutral
- **Fear & Greed**: >= 60 = bearish (greed), <= 20 = bullish (fear), otherwise neutral
- **VIX**: >= 30 = bearish, <= 15 = bullish, otherwise neutral
- **CTA**: >= 70 = bearish (elevated), <= 30 = bullish, otherwise neutral
- **Cash**: < 4% = bearish (low), >= 5.5% = bullish, otherwise neutral
- **SOX**: >= 10% drawdown = bearish, <= 3% = bullish, otherwise neutral

---

## 7. Regime calculation

After updating metrics, recalculate regime:
- Total risk score = sentimentScore + flowScore + positioningScore + structureScore
- >= 6 = RED ZONE (High Risk)
- >= 3 = YELLOW ZONE (Medium Risk)
- < 3 = GREEN ZONE (Low Risk)

Override rule: If BofA >= 8 AND cash < 4 AND SOX >= 10, force RED regardless of total score.

---

## 8. Known constraints

1. **Yahoo rate-limits anonymous calls** (~100/hr/IP). Script implements exponential backoff + jitter (3s → 6s → 12s, ±20% jitter, max 3 retries). A 3s delay is enforced between Yahoo calls. `rateLimitHits` counter tracks HTTP 429 responses in `health.json`.
2. **CBOE sometimes blocks** — script falls back to last-known value with `_stale: true` flag.
3. **No paid API budget** — every new source must be free. Document rationale before adding.
4. **Data is point-in-time** — for VCP entry decisions, the dashboard is context, not signal. Always cross-check with the actual chart before entry.
5. **HTTP 4xx/5xx handling** — script must NOT crash on single-source failure. Skip + log, continue with other sources. Source status (success/error/lastValue) is written to `data/health.json` every run.

---

## 9. VCP trading context (for future contributors / AIs)

VCP = Volatility Contraction Pattern (Mark Minervini). Core requirements:
- US-listed stock with consistent revenue + earnings growth
- Tight price consolidation after a base (lower highs in volatility)
- Volume contracts during the base
- Breakout on volume expansion above the base high

### How this dashboard supports VCP

- **VIX** — if VIX > 25, market regime is hostile to breakouts. Reduce position sizing or sit out.
- **Fear & Greed** — extreme fear (0-25) = potential reversal zone, but also can stay extreme. Extreme greed (75-100) = late-stage rally, tighten stops.
- **MacroMicro bull/bear ratio** — confirms or contradicts sector-level momentum.
- **Stock prices** — for the watchlist only, not the dashboard's main job.

### What this dashboard is NOT for

Stock screening. Use Finviz / TradingView / Yahoo screener for that. The dashboard shows market context, not individual stock signals.

---

## 10. Working agreement for future changes

- **Adding a new data source?** Section 2 must be updated with: endpoint, what it gives, why free, scraping difficulty rating.
- **Removing a source?** Move to Section 2.2 with reason, never just delete — preserve decision record.
- **Changing schedule?** Update Section 4 + the workflow file. Document rationale in commit message.
- **Changing the dashboard UI?** No special process — just commit. But: keep it static HTML, no React build step unless explicitly decided.

---

## 11. Tooling notes

- This repo is maintained via **TRAE** (AI-native IDE, ByteDance). Vibe coding workflow: describe → review diff → iterate → commit.
- **No paid APIs ever.** No headless browser. No proxy layer. If a feature needs any of these, escalate before adding.
- **Cloudflare Workers** is the deploy target. `wrangler.toml` configures static asset serving. Deploy command: `npx wrangler deploy`.
