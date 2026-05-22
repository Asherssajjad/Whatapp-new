'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Zap, Megaphone, Play, ToggleLeft, ToggleRight, Loader2, Clock } from 'lucide-react';
import { automationsApi, campaignsApi, agentsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Automation, Campaign, Agent } from '@/types';

const TRIGGERS = [
  { value: 'NEW_CONTACT', label: 'New Contact' },
  { value: 'KEYWORD_MATCH', label: 'Keyword Match' },
  { value: 'LEAD_SCORE_THRESHOLD', label: 'Lead Score Threshold' },
  { value: 'INACTIVITY', label: 'Inactivity' },
  { value: 'FIRST_MESSAGE', label: 'First Message' },
];

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  RUNNING: 'bg-green-100 text-green-700 animate-pulse',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<'automations' | 'campaigns' | 'agents'>('automations');
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  // Automations
  const [autoName, setAutoName] = useState('');
  const [autoTrigger, setAutoTrigger] = useState('NEW_CONTACT');

  // Campaigns
  const [campName, setCampName] = useState('');
  const [campMessage, setCampMessage] = useState('');
  const [campScheduled, setCampScheduled] = useState('');

  // Agents
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');

  const { data: automations = [], isLoading: loadingAuto } = useQuery({
    queryKey: ['automations'],
    queryFn: () => automationsApi.list().then(r => r.data as Automation[]),
  });

  const { data: campaigns = [], isLoading: loadingCamp } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list().then(r => r.data as Campaign[]),
  });

  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list().then(r => r.data as Agent[]),
  });

  const createAutoMutation = useMutation({
    mutationFn: () => automationsApi.create({ name: autoName, trigger: autoTrigger, actions: [] }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['automations'] }); setAutoName(''); addNotification('success', 'Automation created'); },
    onError: () => addNotification('error', 'Failed to create automation'),
  });

  const deleteAutoMutation = useMutation({
    mutationFn: (id: string) => automationsApi.delete(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['automations'] }),
  });

  const toggleAutoMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      automationsApi.update(id, { isActive: !isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['automations'] }),
  });

  const createCampMutation = useMutation({
    mutationFn: () => campaignsApi.create({ name: campName, message: campMessage, scheduledAt: campScheduled || undefined }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['campaigns'] }); setCampName(''); setCampMessage(''); addNotification('success', 'Campaign created'); },
    onError: () => addNotification('error', 'Failed to create campaign'),
  });

  const launchCampMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.launch(id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['campaigns'] }); addNotification('success', 'Campaign launched!'); },
    onError: () => addNotification('error', 'Failed to launch campaign'),
  });

  const deleteCampMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.delete(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const addAgentMutation = useMutation({
    mutationFn: () => agentsApi.add(agentName, agentPhone),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['agents'] }); setAgentName(''); setAgentPhone(''); addNotification('success', 'Agent added'); },
    onError: () => addNotification('error', 'Failed to add agent'),
  });

  const deleteAgentMutation = useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const tabs = [
    { id: 'automations', label: 'Automations', icon: Zap },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'agents', label: 'Agents', icon: Clock },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automation</h1>
          <p className="text-muted-foreground text-sm mt-1">Automate messages, manage campaigns, and configure agents</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-accent p-1 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition',
                activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Automations Tab */}
        {activeTab === 'automations' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Create Automation</h3>
              <Input value={autoName} onChange={e => setAutoName(e.target.value)} placeholder="Automation name" />
              <select
                value={autoTrigger}
                onChange={e => setAutoTrigger(e.target.value)}
                className="w-full h-9 px-3 bg-accent rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <Button onClick={() => createAutoMutation.mutate()} disabled={!autoName || createAutoMutation.isPending} className="w-full">
                <Plus className="w-4 h-4" />Create Automation
              </Button>
            </div>
            {loadingAuto ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : automations.map(a => (
              <div key={a.id} className={cn('bg-card border border-border rounded-xl p-4 flex items-center gap-3', !a.isActive && 'opacity-60')}>
                <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">{a.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="info">{a.trigger}</Badge>
                    <span className="text-xs text-muted-foreground">Ran {a.runCount}x</span>
                  </div>
                </div>
                <button onClick={() => toggleAutoMutation.mutate({ id: a.id, isActive: a.isActive })} className="text-muted-foreground hover:text-primary transition">
                  {a.isActive ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => deleteAutoMutation.mutate(a.id)} className="text-muted-foreground hover:text-destructive transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Create Campaign</h3>
              <Input value={campName} onChange={e => setCampName(e.target.value)} placeholder="Campaign name" />
              <textarea
                value={campMessage}
                onChange={e => setCampMessage(e.target.value)}
                placeholder="Message to send to all contacts..."
                rows={4}
                className="w-full px-3 py-2 bg-accent rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Schedule (optional)</label>
                <input
                  type="datetime-local"
                  value={campScheduled}
                  onChange={e => setCampScheduled(e.target.value)}
                  className="w-full h-9 px-3 bg-accent rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <Button onClick={() => createCampMutation.mutate()} disabled={!campName || !campMessage || createCampMutation.isPending} className="w-full">
                <Plus className="w-4 h-4" />Create Campaign
              </Button>
            </div>
            {loadingCamp ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : campaigns.map(c => (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Megaphone className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-sm text-foreground">{c.name}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CAMPAIGN_STATUS_COLORS[c.status] ?? '')}>{c.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{c.message}</p>
                  {c.status === 'RUNNING' || c.status === 'COMPLETED' ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{c.sentCount}/{c.totalContacts}</span>
                      </div>
                      <div className="h-1.5 bg-accent rounded-full">
                        <div className="h-1.5 bg-green-500 rounded-full transition-all" style={{ width: `${c.totalContacts > 0 ? (c.sentCount / c.totalContacts) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {c.scheduledAt && (
                    <p className="text-xs text-muted-foreground mt-1">Scheduled: {format(new Date(c.scheduledAt), 'MMM d, yyyy HH:mm')}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                    <button onClick={() => launchCampMutation.mutate(c.id)} className="text-green-500 hover:text-green-600 transition" title="Launch now">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deleteCampMutation.mutate(c.id)} className="text-muted-foreground hover:text-destructive transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Add Human Agent</h3>
              <Input value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Agent name" />
              <Input value={agentPhone} onChange={e => setAgentPhone(e.target.value)} placeholder="+923001234567" />
              <Button onClick={() => addAgentMutation.mutate()} disabled={!agentName || !agentPhone || addAgentMutation.isPending} className="w-full">
                <Plus className="w-4 h-4" />Add Agent
              </Button>
            </div>
            {loadingAgents ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : agents.map(a => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-500">{a.name.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.phone}</p>
                </div>
                <Badge variant={a.isAvailable ? 'success' : 'outline'}>
                  {a.isAvailable ? 'Available' : 'Busy'}
                </Badge>
                <button onClick={() => deleteAgentMutation.mutate(a.id)} className="text-muted-foreground hover:text-destructive transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
