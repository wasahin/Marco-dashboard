# 📊 Macro Dashboard Agent Instructions

## Project Overview

Daily Risk Assessment Dashboard for VCP / Momentum Trading. Combines Macro (dark/colorful/emoji) and Premium (light/serif) views in a single `index.html` with a theme toggle.

## Data Sources (Important)

**No paid APIs.** All data is collected via web search and scraping free public sources.

### Priority Sources (check these first)

| Source | URL | What to get |
|--------|-----|-------------|
| CNN Fear & Greed | https://edition.cnn.com/markets/fear-and-greed | Fear & Greed Index value |
| WallStreetCN | https://wallstreetcn.com/ | SOX, NDX, market moves |
| Investing.com | https://cn.investing.com/ | VIX, Russell 2000, index prices |
| MacroMicro | https://en.macromicro.me/charts/142681/us-mm-bull-and-bear-indicator | BofA Bull & Bear Indicator |

### Secondary Sources

- BofA Global Research, ZeroHedge, Bloomberg (BofA, CTA, Cash metrics)
- AAII official website (AAII Bull-Bear Spread)
- Goldman Sachs, JPMorgan (CTA exposure)

## Deployment Architecture

- **GitHub repo:** `wasahin/Marco-dashboard`
- **Hosting:** Cloudflare Workers (static asset serving via `wrangler.toml`)
- **Live URL:** `marco-dashboard.<subdomain>.workers.dev`

### Update Workflow

When the update button is pressed:
1. Trae processes data locally (web search + scrape priority sources)
2. Update `data/market-data.json` with new values
3. Commit and push to GitHub
4. Cloudflare auto-deploys the updated dashboard

## How to Update Market Data

### Method 1: Ask Trae (Recommended)
Say "update all indices" or "update the dashboard" — Trae will:
1. Search priority sources for each metric
2. Update `data/market-data.json` with latest values
3. Commit and push to GitHub
4. Cloudflare auto-deploys

### Method 2: Run the Script
```bash
cd "C:\Users\coolj\.trae-cn\trae projects\macro-dashboard"
npm run update-data
```

**Note**: The script attempts to fetch data from free APIs (CBOE, Yahoo Finance, CNN). If network access is restricted, it will still validate and format the existing data.

## Market Data Update Protocol

When asked to "update all indices" or "update the dashboard", follow this protocol:

### 1. Read Current Data
First, read `data/market-data.json` to see current values and structure.

### 2. Search for Each Metric

Search for each metric using the specified trusted sources:

| Metric | JSON Path | Search Query | Trusted Sources |
|--------|-----------|--------------|-----------------|
| **BofA Bull & Bear** | `metrics.bofa.value` | "BofA Bull Bear Indicator latest" | MacroMicro, BofA Research, ZeroHedge |
| **CNN Fear & Greed** | `metrics.fearGreed.value` | "CNN Fear & Greed Index today" | CNN Business (priority) |
| **VIX Index** | `metrics.vix.value` | "VIX index current level" | Investing.com (priority), CBOE, Yahoo |
| **CTA Exposure** | `metrics.cta.value` | "CTA exposure percentile latest" | Goldman Sachs, Bloomberg, JPMorgan |
| **Fund Manager Cash** | `metrics.cash.value` | "fund manager cash level FMS" | Bank of America FMS, Bloomberg |
| **SOX Drawdown** | `metrics.sox.value` | "SOX semiconductor index drawdown" | WallStreetCN (priority), NASDAQ, Yahoo |
| **AAII Spread** | `metrics.aaii.value` | "AAII bull bear spread latest" | AAII official website |
| **NDX Performance** | `metrics.ndx.value` | "NASDAQ 100 NDX performance" | WallStreetCN (priority), Yahoo, NASDAQ |
| **Russell 2000** | `metrics.russell2000.value` | "Russell 2000 RUT performance" | Investing.com (priority), Yahoo |

### 3. Update JSON Structure

Update `data/market-data.json` with:
- `lastUpdated`: Current date (YYYY-MM-DD)
- For each metric:
  - `value`: Numeric value (no units)
  - `description`: Brief context based on search results
  - `status`: "bullish", "bearish", or "neutral"

### 4. Validate & Push
1. Run `npm run update-data` to validate the JSON
2. Commit changes to git
3. Push to GitHub (`wasahin/Marco-dashboard`)
4. Cloudflare auto-deploys

### 5. Report Changes
Summarize what changed for each metric.

## Metric Status Rules

- **BofA**: >= 8 = bearish, <= 2 = bullish, otherwise neutral
- **Fear & Greed**: >= 60 = bearish (greed), <= 20 = bullish (fear), otherwise neutral
- **VIX**: >= 30 = bearish, <= 15 = bullish, otherwise neutral
- **CTA**: >= 70 = bearish (elevated), <= 30 = bullish, otherwise neutral
- **Cash**: < 4% = bearish (low), >= 5.5% = bullish, otherwise neutral
- **SOX**: >= 10% drawdown = bearish, <= 3% = bullish, otherwise neutral

## Regime Calculation

After updating metrics, recalculate regime:
- Total risk score = sentimentScore + flowScore + positioningScore + structureScore
- >= 6 = RED ZONE (High Risk)
- >= 3 = YELLOW ZONE (Medium Risk)
- < 3 = GREEN ZONE (Low Risk)

## Output Format

When reporting updates, use this format:

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
