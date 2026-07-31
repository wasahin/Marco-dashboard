# Marco Dashboard

Daily Risk Assessment Dashboard for VCP / Momentum Trading.

Combines Macro Risk Dashboard (dark, colorful, emoji) and Premium Research (light, elegant, serif) views into a single page with a theme toggle.

## Features

- Dual Theme Toggle - Switch between Macro and Premium views
- 10 Market Metrics - BofA, CNN Fear & Greed, VIX, CTA, Cash, SOX, NDX, Russell 2000, AAII, Lev ETF AUM
- Regime Calculation - Composite risk score across Sentiment, Flow, Positioning, and Structure
- JSON Data Source - All metrics in data/market-data.json
- Priority Data Sources - CNN Fear & Greed, WallStreetCN, Investing.com, MacroMicro

## Quick Start

```bash
npm install
npm start
```

Dashboard runs at http://localhost:8084/

## Update Market Data

Say "update all indices" to Trae, or run:
```bash
npm run update-data
```

## Deployment (Cloudflare Pages)

Static site - no build step required.

1. Go to Cloudflare Pages
2. Connect GitHub repo wasahin/Marco-dashboard
3. Build settings: Framework = None, Build command = (empty), Output directory = /
4. Deploy

## Project Structure

- index.html - Combined dashboard (Macro + Premium themes)
- data/market-data.json - Market metrics and regime data
- scripts/server.js - Local dev server
- scripts/update-data.js - Data fetch and validation
- src/dashboard-core.js - Core dashboard logic
- AGENTS.md - Trae agent instructions

## License

MIT
