'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Flame, Bot, BotOff, AlertTriangle, Trash2, Loader2, Users } from 'lucide-react';
import { contactsApi } from '@/services/api';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/store/ui';
import { cn, formatDate, leadScoreColor, statusBadgeClass } from '@/lib/utils';
import type { Contact, PaginatedResult } from '@/types';

const STATUS_OPTIONS = ['', 'ACTIVE', 'ESCALATED', 'RESOLVED', 'BLOCKED'];

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  const queryParams: Record<string, unknown> = { page, limit: 25 };
  if (search) queryParams['search'] = search;
  if (status) queryParams['status'] = status;

  const { data, isLoading } = useQuery({
    queryKey: ['contacts-full', queryParams],
    queryFn: () => contactsApi.list(queryParams).then(r => r.data as PaginatedResult<Contact>),
  });

  const toggleAIMutation = useMutation({
    mutationFn: (phone: string) => contactsApi.toggleAI(phone),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['contacts-full'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (phone: string) => contactsApi.delete(phone),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['contacts-full'] }); addNotification('success', 'Contact deleted'); },
  });

  const contacts = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Contacts</h1>
            <p className="text-muted-foreground text-sm">{total} total contacts</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or phone..."
              className="pl-9"
            />
          </div>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="h-9 px-3 bg-card border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <Users className="w-10 h-10" />
            <p>No contacts found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Lead Score</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Last Message</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">AI</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contacts.map(contact => (
                <tr key={contact.id} className="border-b border-border hover:bg-accent/30 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar name={contact.name} phone={contact.phone} size="sm" />
                        {contact.isHotLead && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 rounded-full flex items-center justify-center">
                            <Flame className="w-2 h-2 text-white" />
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{contact.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusBadgeClass(contact.status))}>
                      {contact.status}
                    </span>
                    {contact.isEscalated && (
                      <span className="ml-1 text-orange-500"><AlertTriangle className="w-3.5 h-3.5 inline" /></span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-accent rounded-full">
                        <div
                          className={cn('h-1.5 rounded-full', contact.leadScore >= 80 ? 'bg-red-500' : contact.leadScore >= 50 ? 'bg-orange-500' : 'bg-green-500')}
                          style={{ width: `${Math.min(contact.leadScore, 100)}%` }}
                        />
                      </div>
                      <span className={cn('text-xs font-bold', leadScoreColor(contact.leadScore))}>
                        {contact.leadScore}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                    {contact.lastMessageAt ? formatDate(contact.lastMessageAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAIMutation.mutate(contact.phone)}
                      disabled={toggleAIMutation.isPending}
                      className={cn('transition', contact.aiEnabled ? 'text-green-500' : 'text-muted-foreground')}
                      title={contact.aiEnabled ? 'Disable AI' : 'Enable AI'}
                    >
                      {contact.aiEnabled ? <Bot className="w-4 h-4" /> : <BotOff className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm('Delete contact?')) deleteMutation.mutate(contact.phone); }}
                      className="text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!hasMore}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
