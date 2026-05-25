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
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-center px-8">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-5">
          <Bot className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">WA AI Bot</h3>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Select a conversation from the left panel to view messages and chat history.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm text-left">
          {[
            { icon: Bot, label: 'GPT-4o AI', desc: 'Replies automatically' },
            { icon: Flame, label: 'Lead Scoring', desc: 'Tracks hot prospects' },
            { icon: AlertTriangle, label: 'Escalation', desc: 'Human takeover' },
            { icon: CheckCheck, label: 'Read receipts', desc: 'Delivery tracking' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2 p-3 bg-card rounded-xl border border-border">
              <item.icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-background"
        style={{ backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      >
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
          'rounded-2xl px-3.5 py-2 text-sm max-w-full shadow-sm',
          isBot
            ? 'rounded-tr-sm'
            : 'rounded-tl-sm'
        )}
          style={isBot
            ? { backgroundColor: 'hsl(var(--msg-out))', color: 'hsl(var(--msg-out-fg))' }
            : { backgroundColor: 'hsl(var(--msg-in))', color: 'hsl(var(--msg-in-fg))', border: '1px solid hsl(var(--border))' }
          }
        >
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
          <div className={cn('flex items-center gap-1 mt-0.5', isBot ? 'justify-end' : 'justify-start')}>
            <span className="text-[10px] opacity-55">{formatTime(msg.createdAt)}</span>
            {isBot && (
              msg.status === 'READ'
                ? <CheckCheck className="w-3 h-3 text-blue-500" />
                : msg.status === 'DELIVERED'
                  ? <CheckCheck className="w-3 h-3 opacity-50" />
                  : <Check className="w-3 h-3 opacity-40" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
