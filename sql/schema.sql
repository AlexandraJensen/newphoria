-- ═══════════════════════════════════════════════════════
-- NEWPHORIA NEWS — Supabase Database Schema
-- The Coaptō Structured Data Layer
-- ═══════════════════════════════════════════════════════
--
-- Pattern: Interpret → Normalize → Connect
-- This same schema pattern applies to any Coaptō vertical.
-- Replace "articles" with "documents" and "bloom_score" with 
-- "confidence_score" and you have the enterprise version.
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- ═══════════════════════════════════════════════════════

-- ═══ ENABLE EXTENSIONS ═══
create extension if not exists "uuid-ossp";

-- ═══ SOURCES (where content comes from) ═══
-- Coaptō equivalent: Organizations / Vendors / Data Sources
create table sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,          -- "Reuters", "NASA", "BBC"
  slug text not null unique,          -- "reuters", "nasa", "bbc"
  url text,                           -- "https://reuters.com"
  logo_url text,                      -- favicon/logo for display
  feed_url text,                      -- RSS feed URL
  api_source text,                    -- "newsapi", "gnews", "guardian", "rss"
  reliability_score int default 5,    -- 1-5 source quality rating
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ═══ CATEGORIES ═══
-- Coaptō equivalent: Body Systems / Document Types
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,          -- "Innovation", "Space", "The Weird"
  slug text not null unique,          -- "innovation", "space", "weird"
  color text,                         -- CSS color variable name
  display_order int default 0,
  is_active boolean default true
);

-- ═══ ARTICLES (the core content) ═══
-- Coaptō equivalent: Documents / Records / Entities
create table articles (
  id uuid primary key default uuid_generate_v4(),
  
  -- Content (Interpret layer)
  title text not null,
  excerpt text,
  content text,                       -- full article text if available
  source_url text not null unique,    -- original article URL (dedup key)
  image_url text,                     -- article preview image
  
  -- Classification (Normalize layer)
  category_id uuid references categories(id),
  category_name text,                 -- denormalized for fast reads
  bloom_score int not null default 3, -- 1-5 constructiveness score
  sentiment_score float,              -- -1.0 to 1.0 from AI
  is_weird boolean default false,     -- flags for Wonderfully Weird
  
  -- Source attribution (Connect layer)
  source_id uuid references sources(id),
  source_name text,                   -- denormalized
  author text,
  published_at timestamptz,
  
  -- AI metadata
  ai_summary text,                    -- AI-generated summary
  ai_tags text[],                     -- AI-extracted topics
  ai_confidence float default 0.0,    -- how confident the AI is in classification
  raw_ai_response jsonb,              -- full AI classification response for debugging
  
  -- Display
  is_featured boolean default false,
  is_trending boolean default false,
  read_time_minutes int default 3,
  view_count int default 0,
  
  -- System
  status text default 'published' check (status in ('draft', 'published', 'archived', 'rejected')),
  ingested_at timestamptz default now(),
  classified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══ ARTICLE DEDUPLICATION ═══
-- Coaptō equivalent: Entity Resolution
create table article_duplicates (
  id uuid primary key default uuid_generate_v4(),
  primary_article_id uuid references articles(id) on delete cascade,
  duplicate_article_id uuid references articles(id) on delete cascade,
  similarity_score float,             -- 0.0 to 1.0
  detected_at timestamptz default now(),
  unique(primary_article_id, duplicate_article_id)
);

-- ═══ TRENDING SNAPSHOTS ═══
create table trending (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid references articles(id) on delete cascade,
  rank int not null,
  read_count int default 0,
  snapshot_at timestamptz default now()
);

-- ═══ AD PLACEMENTS ═══
create table ad_placements (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                 -- "Headspace In-Feed", "AG1 Sidebar"
  slot text not null,                 -- "sidebar-1", "infeed-1", "infeed-2"
  advertiser text,
  title text,
  description text,
  image_url text,
  click_url text,
  cta_text text default 'Learn More →',
  is_affiliate boolean default false, -- true = affiliate link
  cpm_rate decimal(8,2),              -- cost per thousand impressions
  impressions int default 0,
  clicks int default 0,
  is_active boolean default true,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- ═══ BLOOM PICKS (Affiliate Products) ═══
create table bloom_picks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  image_url text,
  affiliate_url text not null,
  affiliate_network text,             -- "amazon", "shareasale", "direct"
  display_order int default 0,
  clicks int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ═══ NEWSLETTER SUBSCRIBERS ═══
create table subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  is_premium boolean default false,
  stripe_customer_id text,
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz,
  is_active boolean default true
);

-- ═══ INGESTION LOG ═══
-- Tracks every pipeline run for monitoring
create table ingestion_log (
  id uuid primary key default uuid_generate_v4(),
  run_at timestamptz default now(),
  source text,                        -- "newsapi", "guardian", "rss"
  articles_fetched int default 0,
  articles_classified int default 0,
  articles_published int default 0,   -- bloom >= 3
  articles_rejected int default 0,    -- bloom < 3
  articles_deduplicated int default 0,
  api_cost_usd decimal(8,4),
  errors text[],
  duration_seconds int
);

-- ═══ INDEXES ═══
create index idx_articles_bloom on articles(bloom_score) where status = 'published';
create index idx_articles_category on articles(category_name) where status = 'published';
create index idx_articles_published_at on articles(published_at desc) where status = 'published';
create index idx_articles_featured on articles(is_featured) where is_featured = true;
create index idx_articles_weird on articles(is_weird) where is_weird = true;
create index idx_articles_source_url on articles(source_url);
create index idx_articles_status on articles(status);
create index idx_trending_snapshot on trending(snapshot_at desc);

-- ═══ ROW LEVEL SECURITY ═══
alter table articles enable row level security;
alter table sources enable row level security;
alter table categories enable row level security;
alter table subscribers enable row level security;

-- Public read access for articles (anon users can read published articles)
create policy "Public read access" on articles for select using (status = 'published');
create policy "Public read sources" on sources for select using (true);
create policy "Public read categories" on categories for select using (true);

-- ═══ UPDATED_AT TRIGGER ═══
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger articles_updated_at before update on articles
  for each row execute function update_updated_at();

-- ═══ SEED DATA: CATEGORIES ═══
insert into categories (name, slug, color, display_order) values
  ('Innovation',  'innovation',  'cyan',   1),
  ('Science',     'science',     'violet', 2),
  ('Space',       'space',       'violet', 3),
  ('Health',      'health',      'rose',   4),
  ('Environment', 'environment', 'mint',   5),
  ('Community',   'community',   'mint',   6),
  ('Education',   'education',   'gold',   7),
  ('Kindness',    'kindness',    'rose',   8),
  ('Progress',    'progress',    'gold',   9),
  ('The Weird',   'weird',       'orange', 10);

-- ═══ SEED DATA: SOURCES ═══
insert into sources (name, slug, url, api_source, reliability_score) values
  ('Reuters',           'reuters',      'https://reuters.com',         'newsapi', 5),
  ('AP News',           'ap',           'https://apnews.com',          'newsapi', 5),
  ('BBC',               'bbc',          'https://bbc.com',             'newsapi', 5),
  ('Nature',            'nature',       'https://nature.com',          'rss',     5),
  ('The Lancet',        'lancet',       'https://thelancet.com',       'rss',     5),
  ('NASA',              'nasa',         'https://nasa.gov',            'rss',     5),
  ('The Guardian',      'guardian',     'https://theguardian.com',     'guardian', 4),
  ('Bloomberg',         'bloomberg',    'https://bloomberg.com',       'newsapi', 4),
  ('Wired',             'wired',        'https://wired.com',           'newsapi', 4),
  ('MIT Tech Review',   'mittr',        'https://technologyreview.com','rss',     5),
  ('Ars Technica',      'arstechnica',  'https://arstechnica.com',     'rss',     4),
  ('Good News Network', 'gnn',          'https://goodnewsnetwork.org', 'rss',     3),
  ('Reasons to be Cheerful', 'rtbc',    'https://reasonstobecheerful.world', 'rss', 4),
  ('Future Crunch',     'futurecrunch', 'https://futurecrunch.com',    'rss',     4),
  ('STAT News',         'statnews',     'https://statnews.com',        'rss',     5),
  ('Space.com',         'spacecom',     'https://space.com',           'rss',     4),
  ('ESA',               'esa',          'https://esa.int',             'rss',     5),
  ('Science Daily',     'sciencedaily', 'https://sciencedaily.com',    'rss',     4),
  ('Positive News',     'positivenews', 'https://positive.news',       'rss',     4),
  ('New Scientist',     'newscientist', 'https://newscientist.com',    'rss',     4);

-- ═══ SEED DATA: AD PLACEMENTS ═══
insert into ad_placements (name, slot, advertiser, title, description, click_url, cta_text, is_affiliate) values
  ('AG1 Sidebar',     'sidebar-1', 'Athletic Greens', 'AG1 Daily Greens',   '75 vitamins, minerals, and whole food ingredients. One scoop, every morning.', '#', 'Learn More →', true),
  ('Calm Sidebar',    'sidebar-2', 'Calm',            'Calm — 40% Off',     'Sleep stories, guided meditation, and breathing exercises for 100M+ users.', '#', 'Start Free Trial →', true),
  ('Headspace Feed',  'infeed-1',  'Headspace',       'Headspace',          '14-day free trial. Science-backed meditation for better sleep, focus, and clarity.', '#', 'Try Free →', true),
  ('AG1 Feed',        'infeed-2',  'Athletic Greens', 'AG1 by Athletic Greens', 'One daily habit that covers your nutritional bases. 75 ingredients, one scoop.', '#', 'Learn More →', true);

-- ═══ SEED DATA: BLOOM PICKS ═══
insert into bloom_picks (name, description, affiliate_url, display_order) values
  ('Vitamin D3+K2',      'Mood and immunity support',     '#', 1),
  ('Calm Magnesium',     'Better sleep, less stress',     '#', 2),
  ('Ceremonial Matcha',  'Clean energy, no crash',        '#', 3),
  ('Lions Mane Extract', 'Focus and neurogenesis',        '#', 4);

-- ═══ USEFUL VIEWS ═══

-- Published articles feed (what the frontend queries)
create or replace view feed_articles as
select 
  a.id, a.title, a.excerpt, a.source_url, a.image_url,
  a.category_name, a.bloom_score, a.is_weird, a.is_featured, a.is_trending,
  a.source_name, a.published_at, a.read_time_minutes, a.view_count,
  a.ai_tags, a.ai_summary
from articles a
where a.status = 'published' and a.bloom_score >= 3
order by a.published_at desc;

-- Weird articles only
create or replace view weird_articles as
select * from feed_articles where is_weird = true;

-- Featured articles
create or replace view featured_articles as
select * from feed_articles where is_featured = true
order by published_at desc limit 3;

-- Pipeline stats
create or replace view pipeline_stats as
select 
  date_trunc('day', run_at) as day,
  sum(articles_fetched) as total_fetched,
  sum(articles_published) as total_published,
  sum(articles_rejected) as total_rejected,
  sum(articles_deduplicated) as total_deduped,
  sum(api_cost_usd) as total_cost
from ingestion_log
group by date_trunc('day', run_at)
order by day desc;
