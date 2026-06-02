import { prisma } from '../lib/prisma';
import { generateEmbedding } from './openai.service';
import type { VectorSearchResult } from '../types';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

// ─── Text Chunking ─────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter(c => c.length > 50);
}

// ─── Ingest Knowledge ─────────────────────────────────────────────────────────

export async function ingestKnowledge(knowledgeId: string): Promise<number> {
  const knowledge = await prisma.knowledge.findUnique({
    where: { id: knowledgeId },
  });
  if (!knowledge) throw new Error('Knowledge not found');

  // Delete existing chunks
  await prisma.knowledgeChunk.deleteMany({ where: { knowledgeId } });

  const chunks = chunkText(knowledge.rawContent);
  let count = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    try {
      const embedding = await generateEmbedding(chunk);
      await prisma.$executeRaw`
        INSERT INTO "KnowledgeChunk" (id, content, embedding, "chunkIndex", "knowledgeId", "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${chunk},
          ${JSON.stringify(embedding)}::vector,
          ${i},
          ${knowledgeId},
          NOW()
        )
      `;
      count++;
    } catch (err) {
      console.error(`[Vector] Failed to embed chunk ${i}:`, err);
    }
  }

  return count;
}

// ─── Semantic Search ───────────────────────────────────────────────────────────

export async function semanticSearch(
  query: string,
  organizationId: string,
  limit = 5,
  category?: string
): Promise<VectorSearchResult[]> {
  try {
    const embedding = await generateEmbedding(query);

    const categoryFilter = category
      ? `AND k."category" = '${category}'`
      : '';

    const results = await prisma.$queryRaw<
      Array<{ id: string; content: string; similarity: number; knowledgeId: string }>
    >`
      SELECT
        kc.id,
        kc.content,
        kc."knowledgeId",
        1 - (kc.embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
      FROM "KnowledgeChunk" kc
      INNER JOIN "Knowledge" k ON k.id = kc."knowledgeId"
      WHERE k."organizationId" = ${organizationId}
        AND k."isActive" = true
      ORDER BY kc.embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT ${limit}
    `;

    void categoryFilter;
    const vectorResults = results.filter(r => r.similarity > 0.35);
    if (vectorResults.length > 0) return vectorResults;
    // Vector search found nothing above threshold — fall through to keyword
  } catch {
    // Vector search failed — fall through to keyword
  }

  return keywordSearch(query, organizationId, limit);
}

// ─── Keyword Fallback ──────────────────────────────────────────────────────────

async function keywordSearch(
  query: string,
  organizationId: string,
  limit: number
): Promise<VectorSearchResult[]> {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3)
    .slice(0, 8);

  if (words.length === 0) return [];

  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      knowledge: { organizationId, isActive: true },
      OR: words.map(w => ({ content: { contains: w, mode: 'insensitive' as const } })),
    },
    take: limit,
    include: { knowledge: { select: { id: true } } },
  });

  return chunks.map(c => ({
    id: c.id,
    content: c.content,
    similarity: 0.6,
    knowledgeId: c.knowledgeId,
  }));
}

// ─── Format Context for AI ─────────────────────────────────────────────────────

export async function buildKnowledgeContext(
  query: string,
  organizationId: string,
  limit = 5
): Promise<string> {
  const results = await semanticSearch(query, organizationId, limit);
  if (results.length === 0) return 'No specific knowledge base information found.';

  return results
    .map((r, i) => `[Context ${i + 1}]: ${r.content}`)
    .join('\n\n');
}
