# Newphoria News

**Constructive journalism, curated by AI.**

AI-powered news platform that surfaces innovation, progress, discovery, and the wonderfully weird. Powered by the [Coaptō](https://coapto.ai) document intelligence engine.

**Live:** [https://newphoria.news](https://newphoria.news)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/newphoria.git
cd newphoria
npm install

# 2. Set up Supabase
# Create project at supabase.com → run sql/schema.sql in SQL Editor

# 3. Configure environment
cp .env.example .env
# Fill in API keys

# 4. Run classification pipeline
npm run classify

# 5. Deploy
# Connect repo to Netlify → deploys automatically
```

## Architecture

```
News APIs + RSS → Claude Haiku Classification → Supabase → Netlify Frontend
(free)            (~$20/month)                   (free)     (already paying)
```

## Revenue Model

1. Google AdSense (display ads)
2. Affiliate links (wellness products)
3. Newphoria+ premium subscription ($5.99/month)

## Project Structure

```
├── public/                  # Deployed to Netlify
│   ├── index.html           # Main page (static fallback + dynamic)
│   ├── about.html           # About page
│   ├── privacy.html         # Privacy policy (required for AdSense)
│   ├── terms.html           # Terms of use
│   ├── robots.txt           # SEO
│   ├── sitemap.xml          # SEO
│   ├── css/main.css         # Styles
│   ├── js/data.js           # Supabase data layer + infinite scroll
│   └── assets/favicon.svg   # Favicon
├── scripts/
│   └── classify.mjs         # Classification pipeline (Coaptō engine)
├── sql/
│   └── schema.sql           # Supabase database schema
├── .github/workflows/
│   └── classify.yml         # GitHub Actions (runs every 2 hours)
├── netlify.toml             # Deploy config
├── package.json
├── SETUP.md                 # Detailed setup guide
└── .env.example             # Environment variables template
```

## Coaptō Connection

This pipeline IS the Coaptō engine. Same pattern: Interpret → Normalize → Connect.
Replace the knowledge prompt and point it at different documents for any vertical.

---

Built by [Agapē LAC Inc.](https://agapelac.com) · Calgary, AB, Canada
