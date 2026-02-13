# Newphoria Pipeline — Setup Guide

## What This Is

The Coaptō engine pattern applied to news classification:
- **Interpret**: Pulls articles from 5+ news APIs and RSS feeds
- **Normalize**: Classifies each article with Claude Haiku (bloom score, category, weird-factor)
- **Connect**: Deduplicates and stores in Supabase, serves to frontend

Total cost: ~$15-30/month for Claude API. Everything else is free tier.

---

## Step 1: Create Supabase Project (5 minutes)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (name: `newphoria`, region: closest to you)
3. Wait for the database to provision (~2 minutes)
4. Go to **SQL Editor** → paste the contents of `sql/schema.sql` → click **Run**
5. Note your credentials from **Settings → API**:
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_ANON_KEY` (anon/public key — for frontend)
   - `SUPABASE_SERVICE_KEY` (service_role key — for pipeline, keep secret)

## Step 2: Get API Keys (10 minutes)

### Required:
- **Anthropic API Key**: [console.anthropic.com](https://console.anthropic.com)
  - Create an account, add $5 credit to start
  - Generate API key → save as `ANTHROPIC_API_KEY`

### Free News APIs (get at least 2):
- **NewsAPI**: [newsapi.org](https://newsapi.org) → Free tier: 100 req/day
  - Register → get key → save as `NEWSAPI_KEY`
- **The Guardian**: [open-platform.theguardian.com](https://open-platform.theguardian.com) → Free: 5,000 req/day
  - Register → get key → save as `GUARDIAN_API_KEY`
- **GNews**: [gnews.io](https://gnews.io) → Free: 100 req/day
  - Register → get key → save as `GNEWS_API_KEY`

RSS feeds work without any API key.

## Step 3: Add Secrets to GitHub (2 minutes)

In your GitHub repo → **Settings → Secrets and variables → Actions**:

Add these repository secrets:
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
NEWSAPI_KEY=abc123...
GUARDIAN_API_KEY=abc123...
GNEWS_API_KEY=abc123...
```

## Step 4: Test Locally (optional)

```bash
# Install dependencies
npm install

# Set environment variables
export ANTHROPIC_API_KEY=sk-ant-...
export SUPABASE_URL=https://xxxxx.supabase.co
export SUPABASE_SERVICE_KEY=eyJ...
export NEWSAPI_KEY=abc123...
export GUARDIAN_API_KEY=abc123...
export GNEWS_API_KEY=abc123...

# Run the pipeline
npm run classify
```

You should see output like:
```
═══ Newphoria Classification Pipeline ═══
[1/3] INTERPRET — Fetching articles...
  Fetched 147 unique articles from 4 sources
  128 new articles (19 duplicates skipped)
[2/3] NORMALIZE — Classifying with Claude Haiku...
  Batch 1: classifying 10 articles...
  ...
[3/3] CONNECT — Storing in Supabase...
  Published: 98
  Rejected (bloom < 3): 30
═══ Pipeline complete in 45s ═══
```

## Step 5: Connect Frontend

1. Open `scripts/frontend-data.js`
2. Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`
3. Add `<script src="/js/frontend-data.js"></script>` to your `index.html`
4. The frontend will automatically fetch and render live articles

## Step 6: Deploy

The GitHub Actions workflow (`.github/workflows/classify.yml`) runs automatically every 2 hours.

To trigger a manual run:
- Go to repo → **Actions** → **Classify Articles** → **Run workflow**

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  NEWS SOURCES (Free)                                     │
│  NewsAPI · Guardian · GNews · 9 RSS Feeds                │
└─────────────────┬───────────────────────────────────────┘
                  │ Every 2 hours (GitHub Actions)
                  ▼
┌─────────────────────────────────────────────────────────┐
│  INTERPRET                                               │
│  Fetch → Deduplicate → Batch                             │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│  NORMALIZE (Claude Haiku — ~$0.50/day)                   │
│  Bloom Score · Category · Weird Flag · Summary · Tags    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│  CONNECT (Supabase — Free)                               │
│  Store · Index · Feature · Trend · Serve via REST API    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Netlify — Already paying)                     │
│  Fetches from Supabase → Renders → Infinite Scroll       │
│  Static fallback if API is down                          │
└─────────────────────────────────────────────────────────┘
```

## Cost Breakdown

| Service          | Monthly Cost | Notes                          |
|------------------|-------------|--------------------------------|
| Supabase         | $0          | Free: 500MB, 50K rows          |
| Claude Haiku API | $15-30      | ~200 articles/day, batch of 10 |
| GitHub Actions   | $0          | Free: 2,000 min/month          |
| NewsAPI          | $0          | Free: 100 req/day              |
| Guardian API     | $0          | Free: 5,000 req/day            |
| GNews            | $0          | Free: 100 req/day              |
| RSS feeds        | $0          | Unlimited                      |
| Netlify          | Already paid| Already in your stack          |
| Cloudflare       | $0          | Already in your stack          |
| **Total new**    | **~$15-30** |                                |

## Coaptō Connection

This exact pipeline pattern is the Coaptō engine:

| Newphoria            | Coaptō Enterprise         |
|---------------------|---------------------------|
| News articles        | Contracts, POs, invoices  |
| Bloom score          | Confidence score          |
| Category             | Body system / doc type    |
| Weird flag           | Anomaly detection         |
| Source dedup          | Entity resolution         |
| Knowledge prompt     | Industry knowledge prompt |
| Supabase             | Knowledge graph           |

Same code. Different knowledge prompt. That's the pitch.
