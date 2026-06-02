'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Trash2, Loader2, Phone, Package, ChevronDown } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

interface OrderItem { product: string; quantity: number; price: number }
interface Order {
  id: string;
  orderId: string;
  customerName: string;
  phone: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  notes?: string;
  trackingCode?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  PENDING:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  CONFIRMED:  { label: 'Confirmed',  color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  PROCESSING: { label: 'Processing', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  SHIPPED:    { label: 'Shipped',    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  DELIVERED:  { label: 'Delivered',  color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  CANCELLED:  { label: 'Cancelled',  color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING:    'CONFIRMED',
  CONFIRMED:  'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED:    'DELIVERED',
};

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => api.get('/orders', { params: statusFilter ? { status: statusFilter } : {} }).then(r => r.data as { data: Order[]; total: number }),
    refetchInterval: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      addNotification('success', 'Order updated');
    },
    onError: () => addNotification('error', 'Failed to update order'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      addNotification('success', 'Order deleted');
    },
  });

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const pending = orders.filter(o => o.status === 'PENDING').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Orders
              {pending > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pending} new
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">{total} total orders</p>
          </div>
        </div>
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {(['', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-muted-foreground hover:text-foreground'
              )}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center">
              <Package className="w-8 h-8" />
            </div>
            <p className="font-medium text-foreground">No orders yet</p>
            <p className="text-sm text-center max-w-xs">
              When a customer says "mujhe order karna hai", the AI will capture it and show it here
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {orders.map(order => {
              const cfg = STATUS_CONFIG[order.status];
              const next = NEXT_STATUS[order.status];
              const items = Array.isArray(order.items) ? order.items as OrderItem[] : [];

              return (
                <div key={order.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">{order.orderId}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{order.customerName}</span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />{order.phone}
                        </span>
                        <span>{format(new Date(order.createdAt), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { if (confirm('Delete this order?')) deleteMutation.mutate(order.id); }}
                      className="text-muted-foreground hover:text-destructive transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Items */}
                  <div className="bg-accent/50 rounded-lg p-3 mb-3 space-y-1">
                    {items.length > 0 ? items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{item.product}</span>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>×{item.quantity}</span>
                          {item.price > 0 && <span className="font-semibold text-foreground">Rs.{(item.price * item.quantity).toLocaleString()}</span>}
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No item details</p>
                    )}
                    {order.total > 0 && (
                      <div className="flex justify-between text-sm font-bold pt-1 border-t border-border mt-1">
                        <span>Total</span>
                        <span className="text-primary">Rs.{order.total.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {order.notes && (
                    <p className="text-xs text-muted-foreground bg-accent rounded-lg px-3 py-2 mb-3">
                      📝 {order.notes}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {next && (
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: order.id, status: next })}
                        disabled={updateMutation.isPending}
                        className="flex-1"
                      >
                        {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        Mark as {STATUS_CONFIG[next].label}
                      </Button>
                    )}
                    {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateMutation.mutate({ id: order.id, status: 'CANCELLED' })}
                        disabled={updateMutation.isPending}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        Cancel
                      </Button>
                    )}
                    <a
                      href={`https://wa.me/${order.phone}`}
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
