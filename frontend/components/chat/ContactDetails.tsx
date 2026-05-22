'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Flame, Bot, BotOff, Mail, Phone, StickyNote, Pencil, Check } from 'lucide-react';
import { contactsApi } from '@/services/api';
import { useUIStore } from '@/store/ui';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, leadScoreColor, statusBadgeClass } from '@/lib/utils';

export default function ContactDetails() {
  const { selectedContact, setSelectedContact, addNotification } = useUIStore();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  if (!selectedContact) return null;

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => contactsApi.update(selectedContact.phone, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      addNotification('success', 'Contact updated');
      setEditingNotes(false);
    },
    onError: () => addNotification('error', 'Failed to update contact'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactsApi.delete(selectedContact.phone),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setSelectedContact(null);
      addNotification('success', 'Contact deleted');
    },
  });

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-sm text-foreground">Contact Details</h3>
        <button onClick={() => setSelectedContact(null)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Profile */}
        <div className="flex flex-col items-center gap-2 py-2">
          <Avatar name={selectedContact.name} phone={selectedContact.phone} size="lg" />
          <p className="font-semibold text-foreground">{selectedContact.name ?? 'Unknown'}</p>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusBadgeClass(selectedContact.status))}>
              {selectedContact.status}
            </span>
            {selectedContact.isHotLead && (
              <Badge variant="warning" className="gap-1">
                <Flame className="w-3 h-3" />Hot
              </Badge>
            )}
          </div>
        </div>

        {/* Lead Score */}
        <div className="bg-accent rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Lead Score</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background rounded-full h-2">
              <div
                className={cn('h-2 rounded-full transition-all', selectedContact.leadScore >= 80 ? 'bg-red-500' : selectedContact.leadScore >= 50 ? 'bg-orange-500' : 'bg-green-500')}
                style={{ width: `${Math.min(selectedContact.leadScore, 100)}%` }}
              />
            </div>
            <span className={cn('text-sm font-bold', leadScoreColor(selectedContact.leadScore))}>
              {selectedContact.leadScore}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">{selectedContact.phone}</span>
          </div>
          {selectedContact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{selectedContact.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            {selectedContact.aiEnabled ? <Bot className="w-4 h-4 text-green-500" /> : <BotOff className="w-4 h-4 text-muted-foreground" />}
            <span className={selectedContact.aiEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
              AI {selectedContact.aiEnabled ? 'enabled' : 'disabled'}
            </span>
          </div>
        </div>

        {/* Tags */}
        {selectedContact.tags.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1">
              {selectedContact.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Notes
            </p>
            {!editingNotes && (
              <button
                onClick={() => { setNotes(selectedContact.notes ?? ''); setEditingNotes(true); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="w-full text-sm bg-accent rounded-lg p-2 border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-foreground"
                placeholder="Add notes..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => updateMutation.mutate({ notes })} disabled={updateMutation.isPending}>
                  <Check className="w-3 h-3" />Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-accent rounded-lg p-2 min-h-[60px]">
              {selectedContact.notes ?? 'No notes'}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2 space-y-2">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => { if (confirm('Delete this contact?')) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
          >
            Delete Contact
          </Button>
        </div>
      </div>
    </div>
  );
}
