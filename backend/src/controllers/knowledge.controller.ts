import { Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { ingestKnowledge } from '../services/vector.service';
import type { AuthRequest } from '../types';

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
  const { url, title, category = 'GENERAL' } = req.body as { url: string; title?: string; category?: string };

  if (!url) { res.status(400).json({ error: 'URL required' }); return; }

  // Auto-add https:// if user typed bare domain like "rootout.pk"
  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  const response = await axios.get(normalizedUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsappBot/2.0)' },
    timeout: 15000,
  });

  const $ = cheerio.load(String(response.data));
  $('script, style, nav, footer, header, aside, .cookie-banner, [aria-hidden="true"]').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  if (text.length < 100) { res.status(400).json({ error: 'Could not extract meaningful content from URL' }); return; }

  const knowledge = await prisma.knowledge.create({
    data: {
      title: title ?? new URL(normalizedUrl).hostname,
      source: 'URL',
      sourceUrl: normalizedUrl,
      category: category as never,
      rawContent: text,
      organizationId: orgId,
    },
  });

  const chunkCount = await ingestKnowledge(knowledge.id);
  res.json({ ...knowledge, chunkCount });
}

export async function ingestManual(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { title, content, category = 'GENERAL' } = req.body as { title: string; content: string; category?: string };

  if (!title || !content) { res.status(400).json({ error: 'title and content required' }); return; }

  const knowledge = await prisma.knowledge.create({
    data: {
      title,
      source: 'MANUAL',
      category: category as never,
      rawContent: content,
      organizationId: orgId,
    },
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
