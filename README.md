# Dragon Vol Desk

Volatility regime dashboard implementing the Artemis Dragon Portfolio strategy.
Real-time regime classification, carry calculator, position specs, and satellite scanner.

## Stack
- Next.js 14 (App Router)
- TypeScript
- CSS Modules
- Deploys to Vercel

## Local Dev

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

### Option A — Vercel CLI (fastest)
```bash
npm i -g vercel
vercel
# Follow prompts — live URL in ~90 seconds
```

### Option B — GitHub + Vercel Dashboard
1. Push this repo to GitHub
2. Go to vercel.com → New Project → Import repo
3. Zero config needed — Vercel auto-detects Next.js
4. Click Deploy → live URL in ~2 minutes

## Phase 2 — Live Data Feed
Coming next: Python backend pulling live VIX/VVIX/VIX3M from CBOE,
feeding into a `/api/market-data` endpoint, auto-refreshing the dashboard.

## Phase 3 — IBKR Execution
IBKR TWS API connection for paper trading and live order execution.
