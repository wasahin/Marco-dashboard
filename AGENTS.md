# 📊 Macro Dashboard Agent Instructions

## How to Update Market Data

There are **two ways** to update the dashboard data:

### Method 1: Ask Trae (Recommended)
Simply say "update all indices" or "update the dashboard" — Trae will:
1. Perform web searches for each metric
2. Update `data/market-data.json` with latest values
3. Update both HTML dashboards
4. Validate everything

### Method 2: Run the Script
```bash
cd "C:\Users\coolj\.trae-cn\trae projects\macro-dashboard"
npm run update-data
```

**Note**: The script attempts to fetch data from free APIs (CBOE, Yahoo Finance, CNN). If network access is restricted (sandbox), it will still validate and format the existing data.

## Market Data Update Protocol

When asked to "update all indices" or "update the dashboard", follow this protocol:

### 1. Read Current Data
First, read `data/market-data.json` to see current values and structure.

### 2. Search for Each Metric

Search for each metric using the specified trusted sources:

| Metric | JSON Path | Search Query | Trusted Sources |
|--------|-----------|--------------|-----------------|
| **BofA Bull & Bear** | `metrics.bofa.value` | "BofA Bull Bear Indicator latest" | BofA Global Research, ZeroHedge, Bloomberg |
| **CNN Fear & Greed** | `metrics.fearGreed.value` | "CNN Fear & Greed Index today" | CNN Business, finhacker.cz |
| **VIX Index** | `metrics.vix.value` | "VIX index current level" | CBOE, Yahoo Finance, Bloomberg |
| **CTA Exposure** | `metrics.cta.value` | "CTA exposure percentile latest" | Goldman Sachs, Bloomberg, JPMorgan |
| **Fund Manager Cash** | `metrics.cash.value` | "fund manager cash level FMS" | Bank of America FMS, Bloomberg |
| **SOX Drawdown** | `metrics.sox.value` | "SOX semiconductor index drawdown" | NASDAQ OMX, Yahoo Finance |
| **AAII Spread** | `metrics.aaii.value` | "AAII bull bear spread latest" | AAII official website |
| **NDX Performance** | `metrics.ndx.value` | "NASDAQ 100 NDX performance" | Yahoo Finance, NASDAQ |

### 3. Update JSON Structure

Update `data/market-data.json` with:
- `lastUpdated`: Current date (YYYY-MM-DD)
- For each metric:
  - `value`: Numeric value (no units)
  - `description`: Brief context based on search results
  - `status`: "bullish", "bearish", or "neutral"

### 4. Validate
Run `npm run update-data` to validate the JSON is properly formatted.

### 5. Report Changes
Summarize what changed for each metric.

## Metric Status Rules

- **BofA**: >= 8 = bearish, <= 2 = bullish, otherwise neutral
- **Fear & Greed**: >= 60 = bearish (greed), <= 20 = bullish (fear), otherwise neutral
- **VIX**: >= 30 = bearish, <= 15 = bullish, otherwise neutral
- **CTA**: >= 70 = bearish (elevated), <= 30 = bullish, otherwise neutral
- **Cash**: < 4% = bearish (low), >= 5.5% = bullish, otherwise neutral
- **SOX**: >= 10% drawdown = bearish, <= 3% = bullish, otherwise neutral

## How to Update (Step-by-Step)

1. **Read** `data/market-data.json`
2. **Search** for each metric using the queries above
3. **Update** the JSON file with new values
4. **Run** `npm run update-data` to validate
5. **Preview** at http://localhost:8084/
6. **Report** changes to user

## Regime Calculation

After updating metrics, recalculate regime:
- Total risk score = sentimentScore + flowScore + positioningScore + structureScore
- >= 6 = RED ZONE (High Risk)
- >= 3 = YELLOW ZONE (Medium Risk)
- < 3 = GREEN ZONE (Low Risk)
