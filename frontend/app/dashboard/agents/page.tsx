'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Loader2, Phone, Users, ToggleLeft, ToggleRight, Pencil, Check, X } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  phone: string;
  isAvailable: boolean;
  createdAt: string;
}

export default function AgentsPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then(r => r.data as Agent[]),
  });

  const addMutation = useMutation({
    mutationFn: () => api.post('/agents', { name: name.trim(), phone: phone.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      addNotification('success', 'Agent added');
      setName(''); setPhone('');
    },
    onError: () => addNotification('error', 'Failed to add agent'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/agents/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      addNotification('success', 'Agent updated');
      setEditId(null);
    },
    onError: () => addNotification('error', 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      addNotification('success', 'Agent removed');
    },
  });

  const startEdit = (agent: Agent) => {
    setEditId(agent.id);
    setEditName(agent.name);
    setEditPhone(agent.phone);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="pt-8 lg:pt-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Agents
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add your team members. Bot will share their contact when customers ask for an agent.
          </p>
        </div>

        {/* Add Agent Form */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground text-sm">Add New Agent</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Agent Name</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ahmed Sales"
                onKeyDown={e => { if (e.key === 'Enter' && name && phone) addMutation.mutate(); }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">WhatsApp Number</label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +923001234567"
                onKeyDown={e => { if (e.key === 'Enter' && name && phone) addMutation.mutate(); }}
              />
            </div>
          </div>
          <Button
            onClick={() => addMutation.mutate()}
            disabled={!name.trim() || !phone.trim() || addMutation.isPending}
            className="w-full"
          >
            {addMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Adding...</>
              : <><UserPlus className="w-4 h-4" />Add Agent</>
            }
          </Button>
        </div>

        {/* Agents List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground mb-1">No agents yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Add agents above. When a customer asks "Agent se baat karna hai", the bot will share their contact.
              </p>
            </div>
          ) : (
            agents.map(agent => (
              <div key={agent.id} className={cn('bg-card border border-border rounded-xl p-4 flex items-center gap-3', !agent.isAvailable && 'opacity-60')}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm', agent.isAvailable ? 'bg-green-500/10 text-green-600' : 'bg-accent text-muted-foreground')}>
                  {agent.name.charAt(0).toUpperCase()}
                </div>

                {editId === agent.id ? (
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 min-w-32 h-8 text-sm" />
                    <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="flex-1 min-w-32 h-8 text-sm" />
                    <button onClick={() => updateMutation.mutate({ id: agent.id, data: { name: editName, phone: editPhone } })} className="text-green-500 hover:text-green-600">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{agent.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />{agent.phone}
                    </p>
                  </div>
                )}

                {editId !== agent.id && (
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', agent.isAvailable ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-accent text-muted-foreground')}>
                      {agent.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                    <button
                      onClick={() => updateMutation.mutate({ id: agent.id, data: { isAvailable: !agent.isAvailable } })}
                      className="text-muted-foreground hover:text-primary transition p-1"
                      title={agent.isAvailable ? 'Mark unavailable' : 'Mark available'}
                    >
                      {agent.isAvailable ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => startEdit(agent)} className="text-muted-foreground hover:text-foreground p-1">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Remove ${agent.name}?`)) deleteMutation.mutate(agent.id); }}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {agents.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How the bot uses agents:</p>
            <ul className="space-y-1">
              <li>• Customer says "agent se baat karna hai" → bot escalates + shares agent contact</li>
              <li>• Customer says "kisi se baat karni hai" → bot introduces available agents</li>
              <li>• Toggle availability when an agent is off duty</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
