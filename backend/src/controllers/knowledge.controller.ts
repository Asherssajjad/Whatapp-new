import { Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { ingestKnowledge } from '../services/vector.service';
import type { AuthRequest } from '../types';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// ─── URL Helpers ────────────────────────────────────────────────────────────────

function normalizeUrl(url: string, base?: string): string {
  const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    return new URL(withProto, base).href.split('#')[0]!.replace(/\/$/, '');
  } catch {
    return withProto;
  }
}

function getOrigin(url: string): string {
  return new URL(url).origin;
}

function isCategoryUrl(url: string): boolean {
  return /\/(collections?|categor|shop|catalog|store|products-list|all-products|our-products|menu|range)\b/i.test(url) &&
    !/\/products?\/[^/]+$|\/item\/|\/p\/\d|[?&](id|product_id)=/i.test(url);
}

function isProductUrl(url: string): boolean {
  return /\/products?\/[^/]+$|\/item\/[^/]+$|\/p\/\d/i.test(url);
}

function isStaticPageUrl(url: string): boolean {
  return /\/(about|contact|faq|shipping|delivery|returns?|refund|policy|policies|privacy|terms|blog|news|services?|pricing)\b/i.test(url);
}

// ─── Sitemap Parser ────────────────────────────────────────────────────────────

async function getSitemapUrls(origin: string): Promise<string[]> {
  const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap`];
  const urls: string[] = [];

  for (const url of candidates) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
      if (!String(res.headers['content-type'] ?? '').includes('xml') && !String(res.data).includes('<url>')) continue;

      const $ = cheerio.load(String(res.data), { xmlMode: true });

      // Handle sitemap index
      $('sitemap loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) urls.push(loc);
      });

      // Handle regular sitemap
      $('url loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) urls.push(loc);
      });

      if (urls.length > 0) break;
    } catch { /* try next */ }
  }

  // If sitemap index, fetch sub-sitemaps
  const subSitemapUrls = urls.filter(u => u.endsWith('.xml') || u.includes('sitemap'));
  if (subSitemapUrls.length > 0 && subSitemapUrls.length < 10) {
    for (const sub of subSitemapUrls) {
      try {
        const res = await axios.get(sub, { headers: HEADERS, timeout: 8000 });
        const $ = cheerio.load(String(res.data), { xmlMode: true });
        $('url loc').each((_, el) => {
          const loc = $(el).text().trim();
          if (loc && !loc.endsWith('.xml')) urls.push(loc);
        });
      } catch { /* skip */ }
    }
  }

  return [...new Set(urls.filter(u => !u.endsWith('.xml')))];
}

// ─── Product Extractor from Category Page ─────────────────────────────────────

interface Product {
  name: string;
  price: string;
  url: string;
}

function extractProductsFromHtml(html: string, pageUrl: string, origin: string): Product[] {
  const $ = cheerio.load(html);
  const products: Map<string, Product> = new Map();

  // Remove non-content elements
  $('script, style, nav, footer, header').remove();

  // Strategy 1: find anchor tags pointing to product URLs
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    let fullUrl = '';
    try { fullUrl = new URL(href, pageUrl).href.split('#')[0]!; } catch { return; }
    if (!fullUrl.startsWith(origin)) return;
    if (!isProductUrl(fullUrl)) return;

    const $a = $(el);
    const $card = $a.closest('li, article, div').filter((_, c) => {
      const cls = $(c).attr('class') ?? '';
      return /product|item|card|grid/i.test(cls);
    }).first();
    const $scope = $card.length ? $card : $a;

    // Name: from heading, title attr, or link text
    const name = (
      $scope.find('h1,h2,h3,h4,[class*="title"],[class*="name"]').first().text().trim() ||
      $a.attr('title') ||
      $a.text().trim() ||
      fullUrl.split('/').pop()?.replace(/-/g, ' ') || ''
    ).replace(/\s+/g, ' ').slice(0, 150);

    if (!name || name.length < 3) return;

    // Price: look for price elements near the product
    const priceRaw = $scope.find('[class*="price"],[data-price],[class*="amount"]').first().text().trim();
    const priceMatch = priceRaw.match(/[\d,]+(\.\d+)?/);
    const price = priceMatch ? `Rs.${priceMatch[0].replace(/\.00$/, '')}` : '';

    const normalUrl = fullUrl.replace(/\/$/, '');
    if (!products.has(normalUrl)) {
      products.set(normalUrl, { name, price, url: normalUrl });
    }
  });

  return Array.from(products.values()).slice(0, 100);
}

// ─── Page Text Extractor (for services/static pages) ──────────────────────────

function extractPageText($: cheerio.CheerioAPI): string {
  $('script, style, nav, footer, header, aside, iframe, noscript, .cookie-banner, [aria-hidden="true"]').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

// ─── Format product list as knowledge text ─────────────────────────────────────

function formatProductKnowledge(categoryTitle: string, categoryUrl: string, products: Product[]): string {
  const lines = [`${categoryTitle}\nCategory URL: ${categoryUrl}\n`];
  lines.push('Products available:\n');
  for (const p of products) {
    const pricePart = p.price ? ` — ${p.price}` : '';
    lines.push(`• ${p.name}${pricePart}\n  Link: ${p.url}`);
  }
  lines.push(`\nView all products in this category: ${categoryUrl}`);
  return lines.join('\n');
}

// ─── HTTP GET helper ───────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 12000, maxRedirects: 5 });
    const ct = String(res.headers['content-type'] ?? '');
    if (!ct.includes('html')) return null;
    return String(res.data);
  } catch { return null; }
}

// ─── API Handlers ──────────────────────────────────────────────────────────────

export async function getKnowledgeBases(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const items = await prisma.knowledge.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
}

export async function clearKnowledgeBase(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  await prisma.$executeRaw`
    DELETE FROM "KnowledgeChunk" WHERE "knowledgeId" IN (
      SELECT id FROM "Knowledge" WHERE "organizationId" = ${orgId}
    )
  `;
  await prisma.knowledge.deleteMany({ where: { organizationId: orgId } });
  res.json({ message: 'Knowledge base cleared' });
}

// E-commerce scraper: extracts products with links from category pages
export async function scrapeEcommerce(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { url } = req.body as { url: string };
  if (!url) { res.status(400).json({ error: 'URL required' }); return; }

  const startUrl = normalizeUrl(url);
  const origin = getOrigin(startUrl);

  // Respond immediately — processing is async
  res.json({ message: 'E-commerce scrape started — check back in 2-3 minutes', startUrl });

  void (async () => {
    try {
      console.log(`[Knowledge:Ecom] Starting for ${startUrl}`);

      // 1. Get all URLs from sitemap
      const allUrls = await getSitemapUrls(origin);
      console.log(`[Knowledge:Ecom] Sitemap: ${allUrls.length} URLs found`);

      // 2. Separate category pages and static pages
      let categoryUrls = allUrls.filter(u => isCategoryUrl(u));
      const staticUrls = allUrls.filter(u => isStaticPageUrl(u));

      // Fallback: crawl homepage to find category links if sitemap had none
      if (categoryUrls.length === 0) {
        const html = await fetchHtml(startUrl);
        if (html) {
          const $ = cheerio.load(html);
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href') ?? '';
            try {
              const full = new URL(href, startUrl).href.split('#')[0]!;
              if (full.startsWith(origin) && isCategoryUrl(full)) categoryUrls.push(full);
            } catch { /* skip */ }
          });
          categoryUrls = [...new Set(categoryUrls)];
        }
      }

      console.log(`[Knowledge:Ecom] ${categoryUrls.length} category pages, ${staticUrls.length} static pages`);

      // 3. Always scrape homepage + key static pages
      const pagesToScrape = [startUrl, ...staticUrls.slice(0, 10)];
      for (const pageUrl of pagesToScrape) {
        const html = await fetchHtml(pageUrl);
        if (!html) continue;
        const $ = cheerio.load(html);
        const text = extractPageText($);
        if (text.length < 80) continue;
        const pageTitle = $('title').text().trim() || $('h1').first().text().trim() || pageUrl;

        const existing = await prisma.knowledge.findFirst({ where: { sourceUrl: pageUrl, organizationId: orgId } });
        if (existing) continue;

        const knowledge = await prisma.knowledge.create({
          data: { title: pageTitle.slice(0, 200), source: 'URL', sourceUrl: pageUrl, category: 'GENERAL', rawContent: text, organizationId: orgId },
        });
        await ingestKnowledge(knowledge.id);
        console.log(`[Knowledge:Ecom] Static: ${pageUrl}`);
      }

      // 4. Scrape category pages and extract products with links
      for (const catUrl of categoryUrls.slice(0, 50)) {
        const html = await fetchHtml(catUrl);
        if (!html) continue;

        const $ = cheerio.load(html);
        const catTitle = $('title').text().trim() || $('h1').first().text().trim() || catUrl.split('/').pop()?.replace(/-/g, ' ') || 'Products';
        const products = extractProductsFromHtml(html, catUrl, origin);

        if (products.length === 0) {
          // No products found — store as text page
          const text = extractPageText($);
          if (text.length > 80) {
            const knowledge = await prisma.knowledge.create({
              data: { title: catTitle.slice(0, 200), source: 'URL', sourceUrl: catUrl, category: 'ECOMMERCE', rawContent: text, organizationId: orgId },
            });
            await ingestKnowledge(knowledge.id);
          }
          continue;
        }

        const content = formatProductKnowledge(catTitle, catUrl, products);
        const existing = await prisma.knowledge.findFirst({ where: { sourceUrl: catUrl, organizationId: orgId } });
        if (existing) continue;

        const knowledge = await prisma.knowledge.create({
          data: { title: `${catTitle} (${products.length} products)`.slice(0, 200), source: 'URL', sourceUrl: catUrl, category: 'ECOMMERCE', rawContent: content, organizationId: orgId },
        });
        await ingestKnowledge(knowledge.id);
        console.log(`[Knowledge:Ecom] Category "${catTitle}": ${products.length} products`);
      }

      console.log(`[Knowledge:Ecom] Done for ${startUrl}`);
    } catch (err) {
      console.error('[Knowledge:Ecom] Error:', err);
    }
  })();
}

// Services scraper: crawl all pages
export async function scrapeServices(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { url } = req.body as { url: string };
  if (!url) { res.status(400).json({ error: 'URL required' }); return; }

  const startUrl = normalizeUrl(url);
  const origin = getOrigin(startUrl);

  res.json({ message: 'Services site crawl started — check back in 1-2 minutes', startUrl });

  void (async () => {
    try {
      const visited = new Set<string>();
      const queue = [startUrl];
      let count = 0;

      while (queue.length > 0 && count < 30) {
        const pageUrl = queue.shift()!;
        if (visited.has(pageUrl)) continue;
        visited.add(pageUrl);

        const html = await fetchHtml(pageUrl);
        if (!html) continue;
        const $ = cheerio.load(html);
        const text = extractPageText($);
        if (text.length < 80) continue;

        const pageTitle = $('title').text().trim() || $('h1').first().text().trim() || pageUrl;
        const existing = await prisma.knowledge.findFirst({ where: { sourceUrl: pageUrl, organizationId: orgId } });
        if (!existing) {
          const knowledge = await prisma.knowledge.create({
            data: { title: pageTitle.slice(0, 200), source: 'URL', sourceUrl: pageUrl, category: 'SERVICES', rawContent: text, organizationId: orgId },
          });
          await ingestKnowledge(knowledge.id);
          count++;
          console.log(`[Knowledge:Services] ${pageUrl}`);
        }

        // Find more internal links
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href') ?? '';
          try {
            const full = new URL(href, pageUrl).href.split('#')[0]!.replace(/\/$/, '');
            if (full.startsWith(origin) && !visited.has(full) && !queue.includes(full)) {
              queue.push(full);
            }
          } catch { /* skip */ }
        });
      }
      console.log(`[Knowledge:Services] Done: ${count} pages`);
    } catch (err) {
      console.error('[Knowledge:Services] Error:', err);
    }
  })();
}

// Manual entry
export async function ingestManual(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { title, content, category = 'GENERAL' } = req.body as { title: string; content: string; category?: string };
  if (!title || !content) { res.status(400).json({ error: 'title and content required' }); return; }

  const knowledge = await prisma.knowledge.create({
    data: { title, source: 'MANUAL', category: category as never, rawContent: content, organizationId: orgId },
  });
  const chunkCount = await ingestKnowledge(knowledge.id);
  res.json({ ...knowledge, chunkCount });
}

// Single URL (kept for compatibility)
export async function ingestURL(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { url, title, category = 'GENERAL' } = req.body as { url: string; title?: string; category?: string };
  if (!url) { res.status(400).json({ error: 'URL required' }); return; }

  const normalizedUrl = normalizeUrl(url);
  const html = await fetchHtml(normalizedUrl);
  if (!html) { res.status(400).json({ error: 'Could not fetch URL' }); return; }

  const $ = cheerio.load(html);
  const text = extractPageText($);
  if (text.length < 80) { res.status(400).json({ error: 'Not enough content on page' }); return; }

  const pageTitle = title ?? ($('title').text().trim() || new URL(normalizedUrl).hostname);
  const knowledge = await prisma.knowledge.create({
    data: { title: pageTitle.slice(0, 200), source: 'URL', sourceUrl: normalizedUrl, category: category as never, rawContent: text, organizationId: orgId },
  });
  const chunkCount = await ingestKnowledge(knowledge.id);
  res.json({ ...knowledge, chunkCount });
}

export async function deleteKnowledge(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const id = String(req.params['id']);
  await prisma.knowledge.deleteMany({ where: { id, organizationId: orgId } });
  res.json({ message: 'Deleted' });
}

export async function toggleKnowledge(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const id = String(req.params['id']);
  const knowledge = await prisma.knowledge.findFirst({ where: { id, organizationId: orgId } });
  if (!knowledge) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await prisma.knowledge.update({ where: { id }, data: { isActive: !knowledge.isActive } });
  res.json(updated);
}
