'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Phone, Star, Loader2, MessageSquare } from 'lucide-react';
import { numbersApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import type { WhatsAppNumber } from '@/types';

export default function NumbersPage() {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['numbers'],
    queryFn: () => numbersApi.list().then(r => r.data as WhatsAppNumber[]),
  });

  const addMutation = useMutation({
    mutationFn: () => numbersApi.add({ label, phoneNumberId, accessToken, wabaId, phoneNumber }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['numbers'] });
      addNotification('success', 'Number added');
      setShowForm(false);
      setLabel(''); setPhoneNumberId(''); setAccessToken(''); setWabaId(''); setPhoneNumber('');
    },
    onError: () => addNotification('error', 'Failed to add number'),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (id: string) => numbersApi.setPrimary(id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['numbers'] }); addNotification('success', 'Primary number updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => numbersApi.delete(id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['numbers'] }); addNotification('success', 'Number deleted'); },
    onError: (err: unknown) => addNotification('error', (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to delete'),
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">WhatsApp Numbers</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage multiple WhatsApp numbers</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" />Add Number
          </Button>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Add WhatsApp Number</h3>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (e.g. Sales, Support)" />
            <Input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="Phone Number ID (from Meta)" />
            <Input value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="Access Token" type="password" />
            <Input value={wabaId} onChange={e => setWabaId(e.target.value)} placeholder="WhatsApp Business Account ID" />
            <Input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+923001234567 (optional)" />
            <div className="flex gap-2">
              <Button onClick={() => addMutation.mutate()} disabled={!label || !phoneNumberId || !accessToken || !wabaId || addMutation.isPending} className="flex-1">
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Number
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : numbers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <Phone className="w-8 h-8" />
            <p className="text-sm">No numbers configured</p>
          </div>
        ) : (
          numbers.map(num => (
            <div key={num.id} className={cn('bg-card border border-border rounded-xl p-4 flex items-center gap-3', !num.isActive && 'opacity-50')}>
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-semibold text-foreground">{num.label}</p>
                  {num.isPrimary && (
                    <Badge variant="success" className="gap-1"><Star className="w-2.5 h-2.5" />Primary</Badge>
                  )}
                  {!num.isActive && <Badge variant="outline">Inactive</Badge>}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{num.phoneNumber ?? num.phoneNumberId}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{num._count?.messages ?? 0} msgs</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{num._count?.contacts ?? 0} contacts</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!num.isPrimary && (
                  <Button variant="outline" size="sm" onClick={() => setPrimaryMutation.mutate(num.id)}>
                    Set Primary
                  </Button>
                )}
                {!num.isPrimary && (
                  <button
                    onClick={() => { if (confirm('Delete this number?')) deleteMutation.mutate(num.id); }}
                    className="text-muted-foreground hover:text-destructive transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
