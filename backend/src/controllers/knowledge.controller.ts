import { Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { ingestKnowledge } from '../services/vector.service';
import type { AuthRequest } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function normalizeUrl(url: string, base?: string): string {
  const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    return new URL(withProto, base).href.split('#')[0]!.replace(/\/$/, '');
  } catch {
    return withProto;
  }
}

function extractText($: cheerio.CheerioAPI): string {
  $('script, style, nav, footer, header, aside, iframe, noscript, [aria-hidden="true"], .cookie-banner, #cookie-banner').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string, origin: string): string[] {
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    try {
      const full = new URL(href, baseUrl).href.split('#')[0]!.replace(/\/$/, '');
      if (full.startsWith(origin)) links.push(full);
    } catch { /* ignore invalid links */ }
  });
  return [...new Set(links)];
}

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsappAIBot/2.0; +https://wa-bot.ai)' };

// ─── Full-site crawler ─────────────────────────────────────────────────────────

async function crawlSite(startUrl: string, maxPages = 30): Promise<Array<{ url: string; title: string; text: string }>> {
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const queue: string[] = [startUrl.replace(/\/$/, '')];
  const pages: Array<{ url: string; title: string; text: string }> = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 10000, maxRedirects: 5 });
      const contentType = String(res.headers['content-type'] ?? '');
      if (!contentType.includes('text/html')) continue;

      const $ = cheerio.load(String(res.data));
      const text = extractText($);
      if (text.length < 80) continue;

      const title = $('title').text().trim() || $('h1').first().text().trim() || url;
      pages.push({ url, title, text });

      // Queue new internal links
      const links = extractLinks($, url, origin);
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) queue.push(link);
      }
    } catch {
      // skip failed pages silently
    }
  }

  return pages;
}

// ─── Routes ────────────────────────────────────────────────────────────────────

export async function getKnowledgeBases(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { category } = req.query;

  const items = await prisma.knowledge.findMany({
    where: { organizationId: orgId, ...(category && { category: String(category) as never }) },
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(items);
}

export async function ingestURL(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { url, title, category = 'GENERAL', crawlSite: shouldCrawl = false } = req.body as {
    url: string; title?: string; category?: string; crawlSite?: boolean;
  };

  if (!url) { res.status(400).json({ error: 'URL required' }); return; }

  const startUrl = normalizeUrl(url);

  if (shouldCrawl) {
    // Full-site crawl — respond immediately, process in background
    res.json({ message: 'Crawling started', startUrl, note: 'Check Knowledge Base in 1-2 minutes' });

    // Background crawl
    void (async () => {
      try {
        const pages = await crawlSite(startUrl, 40);
        console.log(`[Knowledge] Crawled ${pages.length} pages from ${startUrl}`);

        for (const page of pages) {
          try {
            const existing = await prisma.knowledge.findFirst({
              where: { sourceUrl: page.url, organizationId: orgId },
            });
            if (existing) continue;

            const knowledge = await prisma.knowledge.create({
              data: {
                title: page.title.slice(0, 200),
                source: 'URL',
                sourceUrl: page.url,
                category: category as never,
                rawContent: page.text,
                organizationId: orgId,
              },
            });
            await ingestKnowledge(knowledge.id);
            console.log(`[Knowledge] Ingested: ${page.url} (${page.text.length} chars)`);
          } catch (err) {
            console.error(`[Knowledge] Failed page ${page.url}:`, err);
          }
        }
        console.log(`[Knowledge] Full crawl complete: ${pages.length} pages ingested`);
      } catch (err) {
        console.error('[Knowledge] Crawl failed:', err);
      }
    })();

    return;
  }

  // Single page ingest
  try {
    const response = await axios.get(startUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(String(response.data));
    const text = extractText($);

    if (text.length < 80) { res.status(400).json({ error: 'Could not extract meaningful content from URL' }); return; }

    const pageTitle = title ?? $('title').text().trim() || new URL(startUrl).hostname;

    const existing = await prisma.knowledge.findFirst({ where: { sourceUrl: startUrl, organizationId: orgId } });
    if (existing) {
      await prisma.knowledge.update({ where: { id: existing.id }, data: { rawContent: text } });
      await ingestKnowledge(existing.id);
      res.json({ ...existing, chunkCount: 'updated' });
      return;
    }

    const knowledge = await prisma.knowledge.create({
      data: {
        title: pageTitle.slice(0, 200),
        source: 'URL',
        sourceUrl: startUrl,
        category: category as never,
        rawContent: text,
        organizationId: orgId,
      },
    });

    const chunkCount = await ingestKnowledge(knowledge.id);
    res.json({ ...knowledge, chunkCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch URL';
    res.status(400).json({ error: msg });
  }
}

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

  const updated = await prisma.knowledge.update({
    where: { id: knowledge.id },
    data: { isActive: !knowledge.isActive },
  });
  res.json(updated);
}
