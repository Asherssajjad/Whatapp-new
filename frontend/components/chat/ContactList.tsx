'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Flame, BotOff, AlertTriangle } from 'lucide-react';
import { contactsApi } from '@/services/api';
import { useUIStore } from '@/store/ui';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, leadScoreColor } from '@/lib/utils';
import type { Contact, PaginatedResult } from '@/types';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Hot Leads', value: 'hot', icon: Flame },
  { label: 'Escalated', value: 'escalated', icon: AlertTriangle },
  { label: 'AI Off', value: 'ai-off', icon: BotOff },
];

export default function ContactList() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const { selectedContact, setSelectedContact } = useUIStore();

  const queryParams: Record<string, unknown> = { limit: 100 };
  if (search) queryParams['search'] = search;
  if (filter === 'hot') queryParams['isHotLead'] = 'true';
  if (filter === 'escalated') queryParams['status'] = 'ESCALATED';
  if (filter === 'ai-off') queryParams['aiEnabled'] = 'false';

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', queryParams],
    queryFn: () => contactsApi.list(queryParams).then(r => r.data as PaginatedResult<Contact>),
    refetchInterval: 30000,
  });

  const contacts = data?.data ?? [];

  return (
    <div className="flex flex-col h-full w-full border-r border-border bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground mb-3 pl-12 lg:pl-0">Conversations</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-accent rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition flex-shrink-0',
              filter === f.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {f.icon && <f.icon className="w-3 h-3" />}
            {f.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <div className="px-4 py-2">
        <p className="text-xs text-muted-foreground">{data?.total ?? 0} contacts</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 bg-accent rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-accent rounded w-3/4" />
                  <div className="h-2 bg-accent rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 px-5 py-10 text-center">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
              <Filter className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {search || filter ? 'No matches found' : 'No conversations yet'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {search || filter
                ? 'Try clearing the search or filter'
                : 'WhatsApp messages will appear here automatically once your webhook is configured'}
            </p>
          </div>
        ) : (
          contacts.map(contact => (
            <ContactItem
              key={contact.id}
              contact={contact}
              isSelected={selectedContact?.id === contact.id}
              onClick={() => setSelectedContact(contact)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ContactItem({ contact, isSelected, onClick }: { contact: Contact; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition text-left',
        isSelected && 'bg-primary/5 border-r-2 border-primary'
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar name={contact.name} phone={contact.phone} size="md" />
        {contact.isHotLead && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
            <Flame className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className="text-sm font-medium truncate text-foreground">
            {contact.name ?? contact.phone}
          </p>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {contact.lastMessageAt ? formatDate(contact.lastMessageAt) : ''}
          </span>
        </div>

        <p className="text-xs text-muted-foreground truncate mb-1">
          {contact.lastMessageText ?? 'No messages yet'}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap">
          {contact.isEscalated && <Badge variant="warning">Escalated</Badge>}
          {!contact.aiEnabled && <Badge variant="outline" className="text-muted-foreground">AI Off</Badge>}
          <span className={cn('text-xs font-semibold', leadScoreColor(contact.leadScore))}>
            ●{contact.leadScore}
          </span>
        </div>
      </div>
    </button>
  );
}
