/**
 * ═══════════════════════════════════════════════════════
 * NEWPHORIA NEWS — Frontend Data Layer
 * Fetches classified articles from Supabase and renders them
 * ═══════════════════════════════════════════════════════
 *
 * Drop this into the site to replace static content with
 * live articles from the classification pipeline.
 *
 * Uses Supabase anon key (public, read-only via RLS policies)
 * ═══════════════════════════════════════════════════════
 */

const SUPABASE_URL = 'YOUR_SUPABASE_URL';       // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const API = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

// ═══ CATEGORY CONFIG ═══
const CAT_COLORS = {
  innovation: 'cyan', science: 'violet', space: 'violet',
  health: 'rose', environment: 'mint', community: 'mint',
  education: 'gold', kindness: 'rose', progress: 'gold', weird: 'orange',
};

// Fallback images by category when article has no image
const CAT_IMAGES = {
  innovation: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80',
  science: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&q=80',
  space: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=500&q=80',
  health: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=500&q=80',
  environment: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=500&q=80',
  community: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=500&q=80',
  education: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500&q=80',
  kindness: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=500&q=80',
  progress: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&q=80',
  weird: 'https://images.unsplash.com/photo-1462332420958-a05d1e002413?w=500&q=80',
};

// ═══ FETCH FUNCTIONS ═══

async function fetchArticles({ category = null, limit = 20, offset = 0, weird = false } = {}) {
  let url = `${API}/feed_articles?select=*&order=published_at.desc&limit=${limit}&offset=${offset}`;

  if (weird) {
    url = `${API}/weird_articles?select=*&order=published_at.desc&limit=${limit}&offset=${offset}`;
  } else if (category && category !== 'all') {
    url += `&category_name=eq.${category}`;
  }

  const res = await fetch(url, { headers: HEADERS });
  return res.json();
}

async function fetchFeatured() {
  const res = await fetch(
    `${API}/featured_articles?select=*&limit=3`,
    { headers: HEADERS }
  );
  return res.json();
}

async function fetchTrending() {
  const res = await fetch(
    `${API}/feed_articles?select=*&order=view_count.desc&limit=7`,
    { headers: HEADERS }
  );
  return res.json();
}

// ═══ RENDER FUNCTIONS ═══

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function renderArticleCard(article) {
  const color = CAT_COLORS[article.category_name] || 'cyan';
  const image = article.image_url || CAT_IMAGES[article.category_name] || CAT_IMAGES.progress;
  const bloomClass = article.bloom_score >= 5 ? 'b5' : article.bloom_score >= 4 ? 'b4' : 'b3';

  return `
    <a href="${article.source_url}" class="ac" target="_blank" rel="noopener" data-category="${article.category_name}">
      <div class="ac-img">
        <img src="${image}" alt="" loading="lazy">
        <div class="ac-ov"></div>
        <div class="ac-bloom ${bloomClass}">${article.bloom_score}</div>
        <div class="ac-src">${article.source_name}</div>
      </div>
      <div class="ac-body">
        <div class="ac-cat c-${color}">${article.category_name}</div>
        <h3 class="ac-t">${article.title}</h3>
        <p class="ac-ex">${article.ai_summary || article.excerpt || ''}</p>
        <div class="ac-m">${timeAgo(article.published_at)}${article.read_time_minutes ? ` · ${article.read_time_minutes} min` : ''}</div>
      </div>
    </a>
  };
}

function renderFeaturedCard(article, isMain = false) {
  const color = CAT_COLORS[article.category_name] || 'cyan';
  const image = article.image_url || CAT_IMAGES[article.category_name] || CAT_IMAGES.progress;

  return `
    <a href="${article.source_url}" class="feat" target="_blank" rel="noopener">
      <div class="feat-img">
        <img src="${image}" alt="" loading="lazy">
        <div class="feat-ov"></div>
        <div class="feat-bloom">Bloom ${article.bloom_score}</div>
        <div class="feat-src">${article.source_name}</div>
      </div>
      <div class="feat-body">
        <div class="feat-cat c-${color}">${article.category_name}</div>
        <h3 class="feat-t">${article.title}</h3>
        <p class="feat-ex">${article.ai_summary || article.excerpt || ''}</p>
        <div class="feat-m">${timeAgo(article.published_at)}</div>
      </div>
    </a>
  };
}

function renderWeirdCard(article) {
  const image = article.image_url || CAT_IMAGES.weird;

  return `
    <a href="${article.source_url}" class="wc" target="_blank" rel="noopener">
      <div class="wc-img">
        <img src="${image}" alt="" loading="lazy">
        <div class="wc-ov"></div>
      </div>
      <div class="wc-body">
        <h4 class="wc-t">${article.title}</h4>
        <p class="wc-d">${article.ai_summary || article.excerpt || ''}</p>
        <div class="wc-tag">${(article.ai_tags || []).join(' · ') || article.category_name}</div>
      </div>
    </a>
  `;
}

function renderTrendingItem(article, index) {
  return `
    <div class="ti" onclick="window.open('${article.source_url}','_blank')">
      <span class="ti-n">${index + 1}</span>
      <div>
        <div class="ti-t">${article.title}</div>
        <div class="ti-tag">${article.category_name}${article.view_count ? ` · ${(article.view_count / 1000).toFixed(0)}K reads` : ''}</div>
      </div>
    </div>
  `;
}

// Insert ad after every N articles
function insertAd(index) {
  if (index === 3) {
    return `<div class="ifad"><div class="ifad-lab">Promoted</div><div class="ifad-img"><img src="https://images.unsplash.com/photo-1545389336-cf090694435e?w=200&q=80" alt=""></div><div><h4>Headspace</h4><p>14-day free trial. Science-backed meditation for better sleep, focus, and clarity.</p><a href="#" rel="sponsored">Try Free →</a></div></div>`;
  }
  if (index === 8) {
    return `<div class="ifad"><div class="ifad-lab">Promoted</div><div class="ifad-img"><img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&q=80" alt=""></div><div><h4>AG1 by Athletic Greens</h4><p>75 vitamins, minerals, and whole food ingredients. One daily habit for comprehensive nutrition.</p><a href="#" rel="sponsored">Learn More →</a></div></div>`;
  }
  if (index === 14) {
    return `<div class="adsense"><span>Google AdSense</span></div>`;
  }
  return '';
}

// ═══ INFINITE SCROLL ═══

let currentOffset = 0;
let currentCategory = 'all';
let isLoading = false;
let hasMore = true;

async function loadMore() {
  if (isLoading || !hasMore) return;
  isLoading = true;

  const articles = await fetchArticles({
    category: currentCategory,
    limit: 20,
    offset: currentOffset,
  });

  if (articles.length < 20) hasMore = false;

  const feed = document.getElementById('feed');
  const weirdSection = document.querySelector('.weird');

  articles.forEach((article, i) => {
    if (article.is_weird) return; // weird articles go in their own section

    const ad = insertAd(currentOffset + i);
    if (ad) feed.insertBefore(htmlToElement(ad), weirdSection);

    feed.insertBefore(htmlToElement(renderArticleCard(article)), weirdSection);
  });

  currentOffset += articles.length;
  isLoading = false;
}

function htmlToElement(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

// ═══ INITIALIZATION ═══

async function init() {
  try {
    // Load featured
    const featured = await fetchFeatured();
    if (featured.length > 0) {
      // Update hero with top featured article
      const hero = featured[0];
      const heroImg = document.querySelector('.hero-img');
      if (heroImg && hero.image_url) {
        heroImg.style.backgroundImage = `url('${hero.image_url}')`;
      }
      const heroTitle = document.querySelector('.hero h1');
      if (heroTitle) heroTitle.textContent = hero.title;
      const heroSrc = document.querySelector('.hero-src');
      if (heroSrc) heroSrc.innerHTML = `<strong>${hero.source_name}</strong> · ${timeAgo(hero.published_at)} · ${hero.read_time_minutes || 5} min read`;
      const heroExcerpt = document.querySelector('.hero-excerpt');
      if (heroExcerpt) heroExcerpt.textContent = hero.ai_summary || hero.excerpt;
      const heroLink = document.querySelector('.hero-link');
      if (heroLink) heroLink.href = hero.source_url;

      // Render featured row
      const featRow = document.getElementById('featured');
      if (featRow) {
        featRow.innerHTML = featured.map((a, i) => renderFeaturedCard(a, i === 0)).join('');
      }
    }

    // Load main feed
    const articles = await fetchArticles({ limit: 20 });
    const feed = document.getElementById('feed');
    if (feed && articles.length > 0) {
      // Keep the weird section, clear everything else
      const weirdSection = feed.querySelector('.weird');
      feed.innerHTML = '';

      articles.filter(a => !a.is_weird).forEach((article, i) => {
        const ad = insertAd(i);
        if (ad) feed.appendChild(htmlToElement(ad));
        feed.appendChild(htmlToElement(renderArticleCard(article)));
      });

      // Load weird articles
      const weirdArticles = await fetchArticles({ weird: true, limit: 12 });
      if (weirdArticles.length > 0) {
        const weirdHtml = `
          <div class="weird" id="weird">
            <div class="weird-head"><h2 class="weird-t">The Wonderfully Weird</h2></div>
            <p class="weird-sub">The parts of this planet — and beyond — that don't quite make sense</p>
            <div class="weird-grid">${weirdArticles.map(renderWeirdCard).join('')}</div>
            <div class="load-more"><button class="load-btn" onclick="loadMoreWeird()">Load More Weird</button></div>
          </div>
        `;
        feed.appendChild(htmlToElement(weirdHtml));
      }

      currentOffset = articles.length;
    }

    // Load trending
    const trending = await fetchTrending();
    const trendEl = document.getElementById('trending');
    if (trendEl && trending.length > 0) {
      trendEl.innerHTML = `<h3>Trending</h3>${trending.map(renderTrendingItem).join('')}`;
    }

    // Set up infinite scroll
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '600px' });

    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    document.getElementById('feed')?.appendChild(sentinel);
    observer.observe(sentinel);

  } catch (err) {
    console.error('Failed to load articles:', err);
    // Static content remains as fallback
  }
}

// Lazy load weird articles
let weirdOffset = 12;
async function loadMoreWeird() {
  const btn = document.querySelector('.weird .load-btn');
  if (btn) btn.textContent = 'Loading...';

  const articles = await fetchArticles({ weird: true, limit: 8, offset: weirdOffset });
  const grid = document.querySelector('.weird-grid');
  if (grid) {
    articles.forEach(a => grid.appendChild(htmlToElement(renderWeirdCard(a))));
  }
  weirdOffset += articles.length;

  if (btn) btn.textContent = articles.length < 8 ? 'No more weird (for now)' : 'Load More Weird';
}

// ═══ FILTER HANDLING ═══
document.querySelectorAll('.fil').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.fil').forEach(f => f.classList.remove('on'));
    btn.classList.add('on');

    currentCategory = btn.dataset.cat;
    currentOffset = 0;
    hasMore = true;

    const articles = await fetchArticles({ category: currentCategory, limit: 20 });
    const feed = document.getElementById('feed');
    const weirdSection = feed.querySelector('.weird');

    // Remove all articles (keep weird section)
    Array.from(feed.children).forEach(child => {
      if (!child.classList.contains('weird') && child.id !== 'scroll-sentinel') {
        child.remove();
      }
    });

    // Re-render
    articles.filter(a => !a.is_weird).forEach((article, i) => {
      const ad = insertAd(i);
      if (ad) feed.insertBefore(htmlToElement(ad), weirdSection);
      feed.insertBefore(htmlToElement(renderArticleCard(article)), weirdSection);
    });

    currentOffset = articles.length;
  });
});

// ═══ NEWSLETTER ═══
document.querySelector('.nl-f')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.querySelector('input').value;
  const btn = e.target.querySelector('button');

  try {
    await fetch(`${API}/subscribers`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ email }),
    });
    btn.textContent = "You're in.";
    btn.style.background = 'var(--mint)';
    e.target.querySelector('input').value = '';
  } catch {
    btn.textContent = 'Error — try again';
  }
});

// ═══ BOOT ═══
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
