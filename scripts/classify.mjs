/**
 * ═══════════════════════════════════════════════════════
 * NEWPHORIA NEWS — Classification Pipeline
 * The Coaptō Engine: Interpret → Normalize → Connect
 * ═══════════════════════════════════════════════════════
 *
 * This script:
 * 1. INTERPRET — Pulls articles from multiple news APIs & RSS feeds
 * 2. NORMALIZE — Classifies each article with Claude Haiku (bloom score, category, weird-factor)
 * 3. CONNECT  — Deduplicates, stores in Supabase, flags featured/trending
 *
 * Runs via GitHub Actions every 2 hours (see .github/workflows/classify.yml)
 *
 * Same pattern works for any Coaptō vertical:
 *   - Replace news APIs with document upload endpoints
 *   - Replace the knowledge prompt with industry-specific instructions
 *   - Same Interpret → Normalize → Connect flow
 *
 * Cost: ~$0.50-1.00/day for 200+ articles via Claude Haiku
 * ═══════════════════════════════════════════════════════
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';

// ═══ CONFIG ═══
const config = {
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,  // use service key for writes
  },
  newsapi: { key: process.env.NEWSAPI_KEY },       // newsapi.org free tier
  guardian: { key: process.env.GUARDIAN_API_KEY },   // open-platform.theguardian.com
  gnews: { key: process.env.GNEWS_API_KEY },        // gnews.io free tier
  batch_size: 10,       // articles per Claude API call
  max_articles: 200,    // max articles per run
  min_bloom_score: 3,   // minimum score to publish
};

// ═══ INIT CLIENTS ═══
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);
const rssParser = new Parser({ timeout: 10000 });

// ═══════════════════════════════════════════════════════
// STEP 1: INTERPRET — Fetch articles from multiple sources
// ═══════════════════════════════════════════════════════

/**
 * Fetch from NewsAPI.org (free: 100 req/day)
 * Searches for constructive/positive news across top sources
 */
async function fetchNewsAPI() {
  if (!config.newsapi.key) return [];

  const queries = [
    'breakthrough OR discovery OR innovation OR milestone',
    'renewable energy OR clean technology OR sustainability',
    'medical breakthrough OR cure OR treatment approved',
    'community OR volunteers OR nonprofit success',
    'space exploration OR NASA OR telescope discovery',
  ];

  const articles = [];

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=20&language=en`,
        { headers: { 'X-Api-Key': config.newsapi.key } }
      );
      const data = await res.json();
      if (data.articles) {
        articles.push(...data.articles.map(a => ({
          title: a.title,
          excerpt: a.description,
          source_url: a.url,
          image_url: a.urlToImage,
          source_name: a.source?.name || 'Unknown',
          author: a.author,
          published_at: a.publishedAt,
          raw_content: a.content,
          api_source: 'newsapi',
        })));
      }
    } catch (err) {
      console.error(`NewsAPI query failed: ${q}`, err.message);
    }
  }

  return articles;
}

/**
 * Fetch from The Guardian API (free: 5,000 req/day)
 */
async function fetchGuardian() {
  if (!config.guardian.key) return [];

  const sections = ['science', 'technology', 'environment', 'society'];
  const articles = [];

  for (const section of sections) {
    try {
      const res = await fetch(
        `https://content.guardianapis.com/search?section=${section}&order-by=newest&page-size=20&show-fields=trailText,thumbnail,byline&api-key=${config.guardian.key}`
      );
      const data = await res.json();
      if (data.response?.results) {
        articles.push(...data.response.results.map(a => ({
          title: a.webTitle,
          excerpt: a.fields?.trailText || '',
          source_url: a.webUrl,
          image_url: a.fields?.thumbnail || null,
          source_name: 'The Guardian',
          author: a.fields?.byline || null,
          published_at: a.webPublicationDate,
          raw_content: null,
          api_source: 'guardian',
        })));
      }
    } catch (err) {
      console.error(`Guardian fetch failed: ${section}`, err.message);
    }
  }

  return articles;
}

/**
 * Fetch from GNews.io (free: 100 req/day)
 */
async function fetchGNews() {
  if (!config.gnews.key) return [];

  const topics = ['science', 'technology', 'health', 'world'];
  const articles = [];

  for (const topic of topics) {
    try {
      const res = await fetch(
        `https://gnews.io/api/v4/top-headlines?topic=${topic}&lang=en&max=20&apikey=${config.gnews.key}`
      );
      const data = await res.json();
      if (data.articles) {
        articles.push(...data.articles.map(a => ({
          title: a.title,
          excerpt: a.description,
          source_url: a.url,
          image_url: a.image,
          source_name: a.source?.name || 'Unknown',
          author: null,
          published_at: a.publishedAt,
          raw_content: a.content,
          api_source: 'gnews',
        })));
      }
    } catch (err) {
      console.error(`GNews fetch failed: ${topic}`, err.message);
    }
  }

  return articles;
}

/**
 * Fetch from RSS feeds (unlimited, free)
 */
async function fetchRSSFeeds() {
  const feeds = [
    { url: 'https://www.goodnewsnetwork.org/feed/', source: 'Good News Network' },
    { url: 'https://reasonstobecheerful.world/feed/', source: 'Reasons to be Cheerful' },
    { url: 'https://positive.news/feed/', source: 'Positive News' },
    { url: 'https://www.sciencedaily.com/rss/all.xml', source: 'Science Daily' },
    { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', source: 'NASA' },
    { url: 'https://www.newscientist.com/feed/home/', source: 'New Scientist' },
    { url: 'https://feeds.arstechnica.com/arstechnica/science', source: 'Ars Technica' },
    { url: 'https://www.space.com/feeds/all', source: 'Space.com' },
    { url: 'https://www.wired.com/feed/rss', source: 'Wired' },
  ];

  const articles = [];

  for (const feed of feeds) {
    try {
      const parsed = await rssParser.parseURL(feed.url);
      articles.push(...(parsed.items || []).slice(0, 15).map(item => ({
        title: item.title,
        excerpt: item.contentSnippet || item.content?.substring(0, 300) || '',
        source_url: item.link,
        image_url: item.enclosure?.url || extractImageFromContent(item.content) || null,
        source_name: feed.source,
        author: item.creator || item.author || null,
        published_at: item.isoDate || item.pubDate || new Date().toISOString(),
        raw_content: item.content,
        api_source: 'rss',
      })));
    } catch (err) {
      console.error(`RSS fetch failed: ${feed.source}`, err.message);
    }
  }

  return articles;
}

/** Extract first image URL from HTML content */
function extractImageFromContent(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/);
  return match ? match[1] : null;
}

// ═══════════════════════════════════════════════════════
// STEP 2: NORMALIZE — Classify with Claude Haiku
// ═══════════════════════════════════════════════════════

/**
 * THE COAPTŌ KNOWLEDGE PROMPT
 *
 * This is the core of the engine. For Newphoria, it teaches AI
 * how to evaluate news. For a capital projects vertical, you'd
 * replace this with supply chain expertise. Same pattern.
 */
const CLASSIFICATION_PROMPT = `You are the Newphoria News classification engine. Your job is to evaluate news articles for constructive value and categorize them.

For each article, provide:

1. BLOOM SCORE (1-5):
   5 = Solutions-focused, genuinely inspiring, demonstrates human progress
   4 = Constructive, forward-looking, provides useful knowledge
   3 = Neutral but informative, balanced reporting on important topics
   2 = Negative-leaning, focuses on problems without solutions
   1 = Fear-driven, sensationalized, doom content

2. CATEGORY (exactly one):
   innovation — Technology breakthroughs, engineering, clean energy, new inventions
   science — Research discoveries, physics, biology, chemistry, archaeology
   space — Astronomy, space exploration, cosmology, planetary science
   health — Medical breakthroughs, mental health progress, public health wins
   environment — Conservation success, climate solutions, ecosystem recovery
   community — Local impact, volunteerism, social programs, civic progress
   education — Learning innovation, literacy, skills development
   kindness — Acts of generosity, humanitarian efforts, human connection
   progress — Economic improvement, poverty reduction, infrastructure, equality
   weird — Genuinely strange, fascinating, or unexplained phenomena (NOT scary — fascinating)

3. IS_WEIRD (true/false):
   Mark true for articles about: unexplained phenomena, UAP/UFO reports from credible sources,
   bizarre animal behavior, quantum strangeness, archaeological mysteries, unusual natural
   phenomena, quirky inventions, strange scientific findings. The tone should be wonder and
   curiosity, never fear. If it makes you say "wait, really?" it's weird.

4. SUMMARY: A clean 1-2 sentence summary capturing the key finding or story.

5. TAGS: 2-4 topic tags for the article.

6. CONFIDENCE: 0.0-1.0 how confident you are in your classification.

Respond in JSON format. Evaluate each article independently.`;

/**
 * Classify a batch of articles with Claude Haiku
 */
async function classifyBatch(articles) {
  const articleTexts = articles.map((a, i) =>
    `ARTICLE ${i + 1}:\nTitle: ${a.title}\nExcerpt: ${a.excerpt || 'N/A'}\nSource: ${a.source_name}`
  ).join('\n\n---\n\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: CLASSIFICATION_PROMPT,
      messages: [{
        role: 'user',
        content: `Classify these ${articles.length} articles. Return a JSON array with one object per article, each containing: bloom_score, category, is_weird, summary, tags, confidence.\n\n${articleTexts}`,
      }],
    });

    const text = response.content[0].text;
    // Extract JSON from response (handle markdown code blocks)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const classifications = JSON.parse(jsonStr);

    return articles.map((article, i) => ({
      ...article,
      bloom_score: classifications[i]?.bloom_score || 3,
      category_name: classifications[i]?.category || 'progress',
      is_weird: classifications[i]?.is_weird || false,
      ai_summary: classifications[i]?.summary || article.excerpt,
      ai_tags: classifications[i]?.tags || [],
      ai_confidence: classifications[i]?.confidence || 0.5,
      raw_ai_response: classifications[i],
      classified_at: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('Classification failed:', err.message);
    // Return articles with default scores so pipeline continues
    return articles.map(a => ({
      ...a,
      bloom_score: 3,
      category_name: 'progress',
      is_weird: false,
      ai_summary: a.excerpt,
      ai_tags: [],
      ai_confidence: 0,
      raw_ai_response: { error: err.message },
      classified_at: new Date().toISOString(),
    }));
  }
}
// ═══════════════════════════════════════════════════════
// STEP 3: CONNECT — Deduplicate, store, and organize
// ═══════════════════════════════════════════════════════

/**
 * Check if article already exists (by source_url)
 */
async function isDuplicate(sourceUrl) {
  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('source_url', sourceUrl)
    .limit(1);

  return data && data.length > 0;
}

/**
 * Find similar articles by title (fuzzy dedup)
 * Uses trigram similarity — catches "same story, different source"
 */
async function findSimilar(title, threshold = 0.6) {
  // Simple approach: check if any recent article has >60% word overlap
  const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const { data } = await supabase
    .from('articles')
    .select('id, title')
    .gte('published_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .eq('status', 'published');

  if (!data) return null;

  for (const existing of data) {
    const existingWords = existing.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = words.filter(w => existingWords.includes(w)).length;
    const similarity = overlap / Math.max(words.length, existingWords.length);
    if (similarity >= threshold) return existing;
  }

  return null;
}

/**
 * Store classified article in Supabase
 */
async function storeArticle(article) {
  // Look up source
  const { data: sourceData } = await supabase
    .from('sources')
    .select('id')
    .eq('name', article.source_name)
    .limit(1);

  // Look up category
  const { data: catData } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', article.category_name)
    .limit(1);

  const record = {
    title: article.title,
    excerpt: article.excerpt,
    source_url: article.source_url,
    image_url: article.image_url,
    category_id: catData?.[0]?.id || null,
    category_name: article.category_name,
    bloom_score: article.bloom_score,
    is_weird: article.is_weird,
    source_id: sourceData?.[0]?.id || null,
    source_name: article.source_name,
    author: article.author,
    published_at: article.published_at,
    ai_summary: article.ai_summary,
    ai_tags: article.ai_tags,
    ai_confidence: article.ai_confidence,
    raw_ai_response: article.raw_ai_response,
    classified_at: article.classified_at,
    status: article.bloom_score >= config.min_bloom_score ? 'published' : 'rejected',
    read_time_minutes: estimateReadTime(article.excerpt),
  };

  const { data, error } = await supabase
    .from('articles')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    // Unique constraint violation = already exists, skip
    if (error.code === '23505') return { skipped: true };
    console.error('Insert failed:', error.message);
    return { error: error.message };
  }

  return { id: data.id, published: record.status === 'published' };
}

/** Estimate read time from text length */
function estimateReadTime(text) {
  if (!text) return 3;
  const words = text.split(/\s+/).length;
  return Math.max(2, Math.min(15, Math.round(words / 200)));
}

/**
 * Update featured articles (top 3 by bloom score from last 24h)
 */
async function updateFeatured() {
  // Clear existing featured
  await supabase
    .from('articles')
    .update({ is_featured: false })
    .eq('is_featured', true);

  // Set new featured
  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('status', 'published')
    .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('bloom_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(3);

  if (data?.length) {
    await supabase
      .from('articles')
      .update({ is_featured: true })
      .in('id', data.map(d => d.id));
  }
}

// ═══════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════

async function run() {
  const startTime = Date.now();
  console.log('═══ Newphoria Classification Pipeline ═══');
  console.log(`Started at ${new Date().toISOString()}`);

  const stats = {
    fetched: 0,
    classified: 0,
    published: 0,
    rejected: 0,
    deduplicated: 0,
    errors: [],
  };

  try {
    // ── STEP 1: INTERPRET — Fetch from all sources ──
    console.log('\n[1/3] INTERPRET — Fetching articles...');

    const [newsapi, guardian, gnews, rss] = await Promise.allSettled([
      fetchNewsAPI(),
      fetchGuardian(),
      fetchGNews(),
      fetchRSSFeeds(),
    ]);

    let allArticles = [
      ...(newsapi.status === 'fulfilled' ? newsapi.value : []),
      ...(guardian.status === 'fulfilled' ? guardian.value : []),
      ...(gnews.status === 'fulfilled' ? gnews.value : []),
      ...(rss.status === 'fulfilled' ? rss.value : []),
    ];

    // Filter out articles without titles or URLs
    allArticles = allArticles.filter(a => a.title && a.source_url);

    // Remove exact URL duplicates from this batch
    const seen = new Set();
    allArticles = allArticles.filter(a => {
      if (seen.has(a.source_url)) return false;
      seen.add(a.source_url);
      return true;
    });

    // Cap at max
    allArticles = allArticles.slice(0, config.max_articles);
    stats.fetched = allArticles.length;

    console.log(`  Fetched ${stats.fetched} unique articles from ${4} sources`);

    // ── Check against existing articles ──
    const newArticles = [];
    for (const article of allArticles) {
      const exists = await isDuplicate(article.source_url);
      if (exists) {
        stats.deduplicated++;
        continue;
      }
      const similar = await findSimilar(article.title);
      if (similar) {
        stats.deduplicated++;
        continue;
      }
      newArticles.push(article);
    }

    console.log(`  ${newArticles.length} new articles (${stats.deduplicated} duplicates skipped)`);

    if (newArticles.length === 0) {
      console.log('  No new articles to classify. Done.');
      return;
    }

    // ── STEP 2: NORMALIZE — Classify with Claude Haiku ──
    console.log('\n[2/3] NORMALIZE — Classifying with Claude Haiku...');

    const classified = [];
    for (let i = 0; i < newArticles.length; i += config.batch_size) {
      const batch = newArticles.slice(i, i + config.batch_size);
      console.log(`  Batch ${Math.floor(i / config.batch_size) + 1}: classifying ${batch.length} articles...`);
      const results = await classifyBatch(batch);
      classified.push(...results);
      stats.classified += results.length;

      // Small delay to avoid rate limiting
      if (i + config.batch_size < newArticles.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`  Classified ${stats.classified} articles`);

    // ── STEP 3: CONNECT — Store in Supabase ──
    console.log('\n[3/3] CONNECT -- Storing in Supabase...');

    for (const article of classified) {
      const result = await storeArticle(article);
      if (result.skipped) {
        stats.deduplicated++;
      } else if (result.error) {
        stats.errors.push(result.error);
      } else if (result.published) {
        stats.published++;
      } else {
        stats.rejected++;
      }
    }

    // Update featured articles
    await updateFeatured();

    console.log(`  Published: ${stats.published}`);
    console.log(`  Rejected (bloom < 3): ${stats.rejected}`);
    if (stats.errors.length > 0) {
      console.log(`  Errors: ${stats.errors.length}`);
    }

  } catch (err) {
    console.error('Pipeline error:', err);
    stats.errors.push(err.message);
  }

  // ── Log the run ──
  const duration = Math.round((Date.now() - startTime) / 1000);

  await supabase.from('ingestion_log').insert({
    source: 'all',
    articles_fetched: stats.fetched,
    articles_classified: stats.classified,
    articles_published: stats.published,
    articles_rejected: stats.rejected,
    articles_deduplicated: stats.deduplicated,
    errors: stats.errors.length > 0 ? stats.errors : null,
    duration_seconds: duration,
  });

  console.log(`\n═══ Pipeline complete in ${duration}s ═══`);
  console.log(`Fetched: ${stats.fetched} | Classified: ${stats.classified} | Published: ${stats.published} | Rejected: ${stats.rejected} | Deduped: ${stats.deduplicated}`);
}

// ═══ RUN ═══
run().catch(console.error);
