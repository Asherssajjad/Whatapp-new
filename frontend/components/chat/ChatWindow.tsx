'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, Bot, BotOff, Phone, MoreVertical, Mic, Image,
  CheckCheck, Check, Flame, AlertTriangle, User, Loader2, RefreshCw, ArrowLeft,
} from 'lucide-react';
import { contactsApi, messagesApi, api } from '@/services/api';
import { useUIStore } from '@/store/ui';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatTime, leadScoreColor, statusBadgeClass } from '@/lib/utils';
import type { Message, PaginatedResult } from '@/types';

export default function ChatWindow() {
  const { selectedContact, setSelectedContact, addNotification } = useUIStore();
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

  const resetChatMutation = useMutation({
    mutationFn: () => api.delete(`/contacts/${selectedContact!.phone}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      void queryClient.invalidateQueries({ queryKey: ['messages', selectedContact?.phone] });
      setSelectedContact(null);
      addNotification('success', 'Chat history cleared — bot will start fresh on next message');
    },
    onError: () => addNotification('error', 'Failed to reset chat'),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!selectedContact) {
    return (
      <div className="flex-1 flex flex-col bg-background overflow-y-auto">
        {/* Top hero */}
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center border-b border-border">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">WhatsApp AI Dashboard</h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            Select a conversation from the left to read messages and reply. Incoming WhatsApp messages appear here in real-time.
          </p>
        </div>

        {/* Feature grid — fills the space */}
        <div className="flex-1 p-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">What this bot can do</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3">
            {[
              { icon: Bot, label: 'GPT-4o AI Replies', desc: 'Automatically responds to customer messages using your knowledge base and AI context.', color: 'text-green-500', bg: 'bg-green-500/10' },
              { icon: Flame, label: 'Hot Lead Detection', desc: 'Scores every contact by engagement level and flags hot prospects for your sales team.', color: 'text-orange-500', bg: 'bg-orange-500/10' },
              { icon: AlertTriangle, label: 'Escalation to Human', desc: 'Detects when AI cannot help and instantly notifies your team to take over.', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
              { icon: CheckCheck, label: 'Delivery & Read Tracking', desc: 'Tracks message delivery and read status for every conversation in real-time.', color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { icon: User, label: 'Contact Management', desc: 'Full contact profiles with message history, notes, tags, and lead scoring.', color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { icon: Mic, label: 'Voice Transcription', desc: 'Automatically transcribes incoming voice messages using OpenAI Whisper.', color: 'text-pink-500', bg: 'bg-pink-500/10' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3.5 p-4 bg-card rounded-xl border border-border hover:border-primary/30 transition-colors">
                <div className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">{item.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
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
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-card">
        {/* Back button — mobile only */}
        <button
          onClick={() => setSelectedContact(null)}
          className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm('Clear chat history? Bot will start fresh on next message.')) {
                resetChatMutation.mutate();
              }
            }}
            disabled={resetChatMutation.isPending}
            title="Reset chat — clears history so bot starts fresh"
            className="text-muted-foreground hover:text-orange-500"
          >
            {resetChatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1"
        style={{ background: 'hsl(var(--background))' }}
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
