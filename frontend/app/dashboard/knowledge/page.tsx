'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, ToggleLeft, ToggleRight, Loader2, BookOpen, Globe, PenLine, ShoppingBag, Briefcase, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Knowledge } from '@/types';

type Mode = 'ecommerce' | 'services' | 'manual';

export default function KnowledgePage() {
  const [mode, setMode] = useState<Mode>('ecommerce');
  const [url, setUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['knowledge'],
    queryFn: () => api.get('/knowledge').then(r => r.data as Knowledge[]),
    refetchInterval: 15000,
  });

  const scrapeMutation = useMutation({
    mutationFn: () => api.post(mode === 'ecommerce' ? '/knowledge/scrape-ecommerce' : '/knowledge/scrape-services', { url }),
    onSuccess: (res) => {
      const msg = (res.data as { message: string }).message;
      addNotification('success', msg);
      setUrl('');
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['knowledge'] }), 15000);
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['knowledge'] }), 60000);
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['knowledge'] }), 120000);
    },
    onError: () => addNotification('error', 'Failed to start scrape'),
  });

  const manualMutation = useMutation({
    mutationFn: () => api.post('/knowledge/manual', { title: manualTitle, content: manualContent, category: 'GENERAL' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      addNotification('success', 'Knowledge added');
      setManualTitle(''); setManualContent('');
    },
    onError: () => addNotification('error', 'Failed to add knowledge'),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/knowledge/clear'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      addNotification('success', 'Knowledge base cleared');
      setShowClearConfirm(false);
    },
    onError: () => addNotification('error', 'Failed to clear'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/knowledge/${id}/toggle`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  });

  const totalChunks = items.reduce((s, i) => s + (i._count?.chunks ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {items.length} sources · {totalChunks} chunks — AI uses this to answer customer questions
            </p>
          </div>
          {items.length > 0 && (
            <div>
              {showClearConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive">Clear all?</span>
                  <Button variant="destructive" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
                    {clearMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, clear all'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Clear All
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Mode Selector */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex border-b border-border">
            {([
              { key: 'ecommerce', icon: ShoppingBag, label: 'E-commerce Site', desc: 'Extracts products + links from category pages' },
              { key: 'services', icon: Briefcase, label: 'Services Site', desc: 'Crawls all pages of a services/agency website' },
              { key: 'manual', icon: PenLine, label: 'Manual Entry', desc: 'Type or paste custom knowledge directly' },
            ] as { key: Mode; icon: typeof ShoppingBag; label: string; desc: string }[]).map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  'flex-1 py-3.5 px-4 text-sm font-medium transition text-left flex items-center gap-2',
                  mode === m.key ? 'bg-primary/5 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <m.icon className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="font-semibold leading-tight">{m.label}</p>
                  <p className="text-xs opacity-70 hidden sm:block">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="p-5">
            {mode === 'ecommerce' && (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground">
                  <p className="font-semibold text-primary mb-2">🛒 E-commerce Mode — What it does:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>✅ Reads sitemap.xml to find all category/collection pages</li>
                    <li>✅ Extracts every product: <strong>name + price + direct link</strong></li>
                    <li>✅ Scrapes About, Contact, FAQ, Shipping, Returns pages</li>
                    <li>✅ Handles 300-500 products in ~3 minutes</li>
                    <li>✅ Bot shares direct product links in chat</li>
                  </ul>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Website URL</label>
                  <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://www.mytoys.com.pk"
                    className="mb-3"
                  />
                </div>
                <Button
                  onClick={() => scrapeMutation.mutate()}
                  disabled={!url.trim() || scrapeMutation.isPending}
                  className="w-full h-11"
                  size="lg"
                >
                  {scrapeMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Scraping products & pages...</>
                    : <><ShoppingBag className="w-4 h-4" />Start E-commerce Scrape</>
                  }
                </Button>
              </div>
            )}

            {mode === 'services' && (
              <div className="space-y-4">
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm">
                  <p className="font-semibold text-blue-600 dark:text-blue-400 mb-2">🏢 Services Mode — What it does:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>✅ Crawls every page on your website (up to 30 pages)</li>
                    <li>✅ Gets: Services, Pricing, Team, Portfolio, Blog, Contact</li>
                    <li>✅ Best for agencies, consultants, service businesses</li>
                    <li>✅ Done in ~1-2 minutes</li>
                  </ul>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Website URL</label>
                  <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://www.yourcompany.com"
                    className="mb-3"
                  />
                </div>
                <Button
                  onClick={() => scrapeMutation.mutate()}
                  disabled={!url.trim() || scrapeMutation.isPending}
                  className="w-full h-11"
                  size="lg"
                >
                  {scrapeMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Crawling website...</>
                    : <><Globe className="w-4 h-4" />Crawl Entire Website</>
                  }
                </Button>
              </div>
            )}

            {mode === 'manual' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Title</label>
                  <Input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="e.g. Pricing, FAQ, Delivery Info" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Content</label>
                  <textarea
                    value={manualContent}
                    onChange={e => setManualContent(e.target.value)}
                    rows={7}
                    placeholder="Write anything you want the bot to know about your business...&#10;&#10;Example:&#10;Our best selling products:&#10;- RC Car Red: Rs.2,500&#10;- LEGO City Set: Rs.4,500&#10;&#10;Delivery: Free above Rs.2000"
                    className="w-full px-3 py-2.5 bg-accent rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>
                <Button
                  onClick={() => manualMutation.mutate()}
                  disabled={!manualTitle.trim() || !manualContent.trim() || manualMutation.isPending}
                  className="w-full h-11"
                >
                  {manualMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><PenLine className="w-4 h-4" />Add to Knowledge Base</>}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Knowledge List */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">Stored Knowledge</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground mb-1">No knowledge yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">Add your website above and the AI will start answering customer questions accurately</p>
            </div>
          ) : (
            items.map(item => {
              const Icon = item.source === 'URL' ? Globe : PenLine;
              const chunks = item._count?.chunks ?? 0;
              const isEcom = item.category === 'ECOMMERCE';
              return (
                <div key={item.id} className={cn('bg-card border border-border rounded-xl p-4 flex items-start gap-3 transition-opacity', !item.isActive && 'opacity-40')}>
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', isEcom ? 'bg-orange-500/10' : 'bg-primary/10')}>
                    <Icon className={cn('w-4 h-4', isEcom ? 'text-orange-500' : 'text-primary')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-medium text-foreground text-sm truncate">{item.title}</p>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide', isEcom ? 'bg-orange-500/10 text-orange-600' : 'bg-primary/10 text-primary')}>
                        {item.category}
                      </span>
                      {!item.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-muted-foreground font-medium">Disabled</span>}
                    </div>
                    {item.sourceUrl && <p className="text-xs text-muted-foreground truncate">{item.sourceUrl}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {chunks > 0 ? `${chunks} chunks` : <span className="text-orange-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 inline" />0 chunks — embedding failed</span>}
                      {' · '}{format(new Date(item.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleMutation.mutate(item.id)} className="text-muted-foreground hover:text-primary transition p-1" title={item.isActive ? 'Disable' : 'Enable'}>
                      {item.isActive ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => deleteMutation.mutate(item.id)} className="text-muted-foreground hover:text-destructive transition p-1">
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
