# Market overview extension

This additive extension preserves index.html source, worker.js, original scoring and data/market-data.json. scripts/install-overview.cjs adds one idempotent deferred script tag locally during npm install, npm start, npm run dev or npm run build. A deployment must run installation scripts or npm run build before uploading static assets; if scripts are disabled, the new sections will not mount. A GitHub commit is not proof of deployment.

## Modules
Sector performance; leadership immediately after sectors; public-market momentum/breadth proxies without personal watchlists; cross-asset observations; event/hypothesis/initial/+1/+5/invalidation cards. New sections append after the legacy dashboard and before its footer. New observations do not change legacy risk scores.

## Sources and frequency
Initial sector snapshot: user-provided 2026-10-30 ETF screenshot; initial theme snapshot: prior Finance connector daily closes. AUM observation date is unknown. Initial rates/USD: Stocktwits via Yahoo weekly recap (URL in JSON). The recap has inconsistent curve text; its spread is not imported. Initial news: dated WallStreetCN article, not current hot news. All are manual snapshots. News summaries are original concise paraphrases, not full article copies. No paid API, headless browser, proxy service or scheduled news scraper added.

Run npm run update-overview using Node 18+ for Yahoo anonymous daily closes. Endpoint is free/undocumented and may fail or change. Requests are serial, spaced at least 3.1 seconds apart, with retry/backoff and jitter. All required symbols must share exact baseline dates or the old snapshot is retained. Data failure exits nonzero, never silently inserts zero. Latest completed Friday close uses New York time and a conservative 17:00 cutoff; exchange holidays use prior available baseline sessions. One month is calendar-month lookback, clamped to valid dates. Returns are quote-price returns, not verified dividend total returns. Relative return = theme minus benchmark in percentage points. Sector weekly benchmark VOO; monthly/theme benchmark SPY (SPX proxy). Not a long-short momentum factor or breakout success measure.

The updater does not update rates, news, gold/oil/BTC, missing constituent breadth, AUM or event follow-through, and does not commit or push. Review timestamps individually. No new cron is installed. Existing Refresh Market Data button does not refresh this extension. Event windows that elapsed without verified aligned prices are unavailable, not pending. Never invent entry quality or causality from sector returns alone.

## Verification
Before deployment: node --check src/market-overview.js; node --check scripts/install-overview.cjs; node --check scripts/update-overview.cjs; npm run build. Verify exactly one market-overview-loader tag, original risk scores unchanged, mobile horizontal table scrolling, both themes, data load failure, and escaped remote text. After deployment verify new script and data return actual JS/JSON, not SPA fallback HTML. Browser/deployment checks have not yet been performed by the assistant.
