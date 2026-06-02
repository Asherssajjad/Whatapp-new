'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Globe, FileText, PenLine, ToggleLeft, ToggleRight, Loader2, BookOpen } from 'lucide-react';
import { knowledgeApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Knowledge } from '@/types';

const CATEGORIES = ['GENERAL', 'SERVICES', 'ECOMMERCE', 'FAQ', 'PRICING'];

export default function KnowledgePage() {
  const [tab, setTab] = useState<'url' | 'manual'>('url');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [content, setContent] = useState('');
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['knowledge'],
    queryFn: () => knowledgeApi.list().then(r => r.data as Knowledge[]),
  });

  const ingestUrlMutation = useMutation({
    mutationFn: () => knowledgeApi.ingestUrl(url, title || undefined, category),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      addNotification('success', `Ingested ${(res.data as { chunkCount: number }).chunkCount} chunks`);
      setUrl(''); setTitle('');
    },
    onError: () => addNotification('error', 'Failed to ingest URL'),
  });

  const crawlSiteMutation = useMutation({
    mutationFn: () => knowledgeApi.ingestUrl(url, title || undefined, category, true),
    onSuccess: () => {
      addNotification('success', 'Crawling entire site — check back in 1-2 minutes');
      setUrl(''); setTitle('');
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['knowledge'] }), 90000);
    },
    onError: () => addNotification('error', 'Failed to start crawl'),
  });

  const ingestManualMutation = useMutation({
    mutationFn: () => knowledgeApi.ingestManual(title, content, category),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      addNotification('success', `Created ${(res.data as { chunkCount: number }).chunkCount} chunks`);
      setTitle(''); setContent('');
    },
    onError: () => addNotification('error', 'Failed to create knowledge'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      addNotification('success', 'Deleted');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => knowledgeApi.toggle(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  });

  const sourceIcon = { URL: Globe, FILE: FileText, MANUAL: PenLine };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm mt-1">Train your AI with product info, FAQs, and policies</p>
        </div>

        {/* Add form */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex border-b border-border">
            {(['url', 'manual'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition',
                  tab === t ? 'bg-primary/5 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'url' ? '🌐 From URL' : '✍️ Manual Entry'}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition',
                    category === c ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            {tab === 'url' ? (
              <>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-website.com/faq" />
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" />
                <div className="flex gap-2">
                <Button
                  onClick={() => ingestUrlMutation.mutate()}
                  disabled={!url || ingestUrlMutation.isPending || crawlSiteMutation.isPending}
                  className="flex-1"
                >
                  {ingestUrlMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Scraping...</> : <><Plus className="w-4 h-4" />This Page Only</>}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => crawlSiteMutation.mutate()}
                  disabled={!url || crawlSiteMutation.isPending || ingestUrlMutation.isPending}
                  className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  title="Crawls all pages on the website automatically"
                >
                  {crawlSiteMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Crawling...</> : <>🌐 Crawl Entire Site</>}
                </Button>
              </div>
              </>
            ) : (
              <>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Knowledge title" />
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Enter your knowledge content here..."
                  rows={6}
                  className="w-full px-3 py-2 bg-accent rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <Button
                  onClick={() => ingestManualMutation.mutate()}
                  disabled={!title || !content || ingestManualMutation.isPending}
                  className="w-full"
                >
                  {ingestManualMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Plus className="w-4 h-4" />Add Knowledge</>}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <BookOpen className="w-8 h-8" />
              <p className="text-sm">No knowledge added yet</p>
            </div>
          ) : (
            items.map(item => {
              const Icon = sourceIcon[item.source];
              return (
                <div key={item.id} className={cn('bg-card border border-border rounded-xl p-4 flex items-start gap-3 transition', !item.isActive && 'opacity-50')}>
                  <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-foreground text-sm">{item.title}</p>
                      <Badge variant="info">{item.category}</Badge>
                      {!item.isActive && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    {item.sourceUrl && <p className="text-xs text-muted-foreground truncate">{item.sourceUrl}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {item._count?.chunks ?? 0} chunks · {format(new Date(item.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleMutation.mutate(item.id)}
                      className="text-muted-foreground hover:text-primary transition"
                      title={item.isActive ? 'Disable' : 'Enable'}
                    >
                      {item.isActive ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this knowledge?')) deleteMutation.mutate(item.id); }}
                      className="text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
