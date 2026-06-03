'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Trash2, Loader2, Phone, ChevronDown } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type ApptStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

interface Appointment {
  id: string;
  customerName: string;
  phone: string;
  dateTime: string;
  notes?: string;
  status: ApptStatus;
  createdAt: string;
}

const STATUS_CONFIG: Record<ApptStatus, { label: string; color: string }> = {
  PENDING:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const NEXT: Partial<Record<ApptStatus, ApptStatus>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'COMPLETED',
};

export default function AppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', statusFilter],
    queryFn: () => api.get('/appointments', { params: statusFilter ? { status: statusFilter } : {} })
      .then(r => r.data as { data: Appointment[]; total: number }),
    refetchInterval: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/appointments/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      addNotification('success', 'Appointment updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/appointments/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const appointments = data?.data ?? [];
  const total = data?.total ?? 0;
  const pending = appointments.filter(a => a.status === 'PENDING').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 sm:px-4 lg:px-6 pt-4 pb-3 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Appointments
              {pending > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pending} new
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">{total} total</p>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground hover:text-foreground'
              )}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 lg:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center">
              <Calendar className="w-8 h-8" />
            </div>
            <p className="font-medium text-foreground">No appointments yet</p>
            <p className="text-sm text-center max-w-xs">
              When a customer says "seekhna hai" or "register karna hai", the AI captures their interest here
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {appointments.map(appt => {
              const cfg = STATUS_CONFIG[appt.status];
              const next = NEXT[appt.status];
              return (
                <div key={appt.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-foreground">{appt.customerName}</p>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />{appt.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(appt.dateTime), 'MMM d, yyyy')}
                        </span>
                        <span className="text-xs">{format(new Date(appt.createdAt), 'h:mm a')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(appt.id); }}
                      className="text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {appt.notes && (
                    <p className="text-xs text-muted-foreground bg-accent rounded-lg px-3 py-2 mb-3">
                      📝 {appt.notes}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {next && (
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: appt.id, status: next })}
                        disabled={updateMutation.isPending}
                        className="flex-1"
                      >
                        <ChevronDown className="w-3.5 h-3.5 mr-1" />
                        Mark as {STATUS_CONFIG[next].label}
                      </Button>
                    )}
                    {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateMutation.mutate({ id: appt.id, status: 'CANCELLED' })}
                        disabled={updateMutation.isPending}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        Cancel
                      </Button>
                    )}
                    <a
                      href={`https://wa.me/${appt.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 px-2"
                    >
                      <Phone className="w-3 h-3" />WhatsApp
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
