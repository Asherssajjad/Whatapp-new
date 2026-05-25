'use client';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, MessageSquare, Flame, AlertTriangle, Bot, Calendar } from 'lucide-react';
import { analyticsApi } from '@/services/api';
import { Loader2 } from 'lucide-react';
import type { Analytics } from '@/types';
import { format } from 'date-fns';

const STAT_CARDS = [
  { key: 'totalContacts', label: 'Total Contacts', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'hotLeads', label: 'Hot Leads', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { key: 'escalations', label: 'Escalations', icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { key: 'messagesLast7Days', label: 'Messages (7d)', icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { key: 'messagesLast30Days', label: 'Messages (30d)', icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { key: 'appointmentsToday', label: 'Appointments Today', icon: Calendar, color: 'text-green-500', bg: 'bg-green-500/10' },
  { key: 'aiDisabledContacts', label: 'AI Disabled', icon: Bot, color: 'text-red-500', bg: 'bg-red-500/10' },
];

const COLORS = ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.get().then(r => r.data as Analytics),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const contactGrowthChart = (data.contactGrowth ?? []).map(d => ({
    date: format(new Date(d.createdAt), 'MMM d'),
    count: d._count,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Business performance overview</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {STAT_CARDS.map(card => (
            <div key={card.key} className="bg-card border border-border rounded-xl p-4 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {(data as unknown as Record<string, number>)[card.key] ?? 0}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Contact Growth */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-4">Contact Growth (30 days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={contactGrowthChart}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                <Area type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tags Distribution */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-4">Top Tags</h3>
            {data.topTagsByContact.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                No tags yet
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie data={data.topTagsByContact} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                      {data.topTagsByContact.map((entry, i) => (
                        <Cell key={entry.name} fill={entry.color !== '#6366f1' ? entry.color : COLORS[i % COLORS.length]!} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {data.topTagsByContact.map((tag, i) => (
                    <div key={tag.name} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color !== '#6366f1' ? tag.color : COLORS[i % COLORS.length] }} />
                      <span className="flex-1 truncate text-foreground">{tag.name}</span>
                      <span className="text-muted-foreground font-medium">{tag.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Message Direction */}
          <div className="bg-card border border-border rounded-xl p-4 lg:col-span-2">
            <h3 className="font-semibold text-foreground mb-4">Message Volume (7 days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.messageDirectionBreakdown as unknown as Array<Record<string, unknown>>}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="direction" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                <Legend />
                <Bar dataKey="_count" name="Messages" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
