'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, Bot, BotOff, Phone, MoreVertical, Mic, Image,
  CheckCheck, Check, Flame, AlertTriangle, User, Loader2,
} from 'lucide-react';
import { contactsApi, messagesApi } from '@/services/api';
import { useUIStore } from '@/store/ui';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatTime, leadScoreColor, statusBadgeClass } from '@/lib/utils';
import type { Message, PaginatedResult } from '@/types';

export default function ChatWindow() {
  const { selectedContact, addNotification } = useUIStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', selectedContact?.phone],
    queryFn: () =>
      contactsApi.messages(selectedContact!.phone, { limit: 100 }).then(r => r.data as PaginatedResult<Message>),
    enabled: !!selectedContact,
    refetchInterval: 10000,
  });

  const messages = messagesData?.data ?? [];

  const sendMutation = useMutation({
    mutationFn: (msg: string) => messagesApi.send(selectedContact!.phone, msg),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messages', selectedContact?.phone] });
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setInput('');
    },
    onError: () => addNotification('error', 'Failed to send message'),
  });

  const toggleAIMutation = useMutation({
    mutationFn: () => contactsApi.toggleAI(selectedContact!.phone),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      addNotification('success', `AI ${(res.data as { aiEnabled: boolean }).aiEnabled ? 'enabled' : 'disabled'}`);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!selectedContact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-accent/20 text-muted-foreground gap-3">
        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center">
          <Bot className="w-8 h-8" />
        </div>
        <p className="font-medium">Select a conversation</p>
        <p className="text-sm">Choose a contact from the left to start chatting</p>
      </div>
    );
  }

  const handleSend = () => {
    if (!input.trim()) return;
    sendMutation.mutate(input.trim());
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Avatar name={selectedContact.name} phone={selectedContact.phone} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground truncate">
              {selectedContact.name ?? selectedContact.phone}
            </p>
            {selectedContact.isHotLead && (
              <Badge variant="warning" className="gap-1"><Flame className="w-3 h-3" />Hot Lead</Badge>
            )}
            {selectedContact.isEscalated && (
              <Badge variant="warning" className="gap-1"><AlertTriangle className="w-3 h-3" />Escalated</Badge>
            )}
            <span className={cn('text-xs font-semibold', leadScoreColor(selectedContact.leadScore))}>
              Score: {selectedContact.leadScore}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', statusBadgeClass(selectedContact.status))}>
              {selectedContact.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleAIMutation.mutate()}
            disabled={toggleAIMutation.isPending}
            title={selectedContact.aiEnabled ? 'Disable AI' : 'Enable AI'}
            className={selectedContact.aiEnabled ? 'text-green-500' : 'text-muted-foreground'}
          >
            {selectedContact.aiEnabled ? <Bot className="w-5 h-5" /> : <BotOff className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" title="Call">
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={msg.id} msg={msg} prevMsg={messages[i - 1]} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card">
        {!selectedContact.aiEnabled && (
          <div className="flex items-center gap-1.5 mb-2 text-xs text-orange-500">
            <BotOff className="w-3.5 h-3.5" />
            <span>AI disabled — you are in manual mode</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-accent rounded-xl px-4 py-2.5 min-h-[44px] flex items-center">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
            />
          </div>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="rounded-xl h-11 w-11 flex-shrink-0"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, prevMsg }: { msg: Message; prevMsg?: Message }) {
  const isBot = msg.isFromBot || msg.direction === 'OUTBOUND';
  const showTime = !prevMsg || new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 300000;

  return (
    <div>
      {showTime && (
        <div className="text-center my-2">
          <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
            {formatTime(msg.createdAt)}
          </span>
        </div>
      )}
      <div className={cn('flex gap-2 max-w-[80%]', isBot ? 'ml-auto flex-row-reverse' : '')}>
        {!isBot && (
          <div className="w-7 h-7 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        {isBot && (
          <div className="w-7 h-7 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
            <Bot className="w-4 h-4 text-green-500" />
          </div>
        )}
        <div className={cn(
          'rounded-2xl px-3.5 py-2.5 text-sm max-w-full',
          isBot
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-card border border-border text-card-foreground rounded-tl-sm'
        )}>
          {msg.type === 'VOICE' && msg.transcription && (
            <div className="flex items-center gap-1.5 mb-1 opacity-70 text-xs">
              <Mic className="w-3 h-3" />
              <span>Voice message (transcribed)</span>
            </div>
          )}
          {msg.type === 'IMAGE' && (
            <div className="flex items-center gap-1.5 mb-1 opacity-70 text-xs">
              <Image className="w-3 h-3" />
              <span>Image</span>
            </div>
          )}
          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
          <div className={cn('flex items-center gap-1 mt-1', isBot ? 'justify-start' : 'justify-end')}>
            <span className="text-[10px] opacity-60">{formatTime(msg.createdAt)}</span>
            {isBot && (
              msg.status === 'READ' ? <CheckCheck className="w-3 h-3 opacity-60" /> :
              msg.status === 'DELIVERED' ? <CheckCheck className="w-3 h-3 opacity-40" /> :
              <Check className="w-3 h-3 opacity-40" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
