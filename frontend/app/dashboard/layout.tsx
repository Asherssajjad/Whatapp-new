'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import { ToastContainer } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useSocket } from '@/hooks/useSocket';
import { useQueryClient } from '@tanstack/react-query';

function SocketInitializer() {
  const socket = useSocket();
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;
    socket.on('order:new', (data: { productName: string; customerPhone: string }) => {
      addNotification('success', `🛒 New Order: ${data.productName} from ${data.customerPhone}`);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    });
    socket.on('appointment:new', (data: { customerName: string; customerPhone: string }) => {
      addNotification('success', `📅 New Appointment: ${data.customerName} (${data.customerPhone})`);
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    });
    return () => { socket.off('order:new'); socket.off('appointment:new'); };
  }, [socket, addNotification, queryClient]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated());

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <SocketInitializer />
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-background">
        {children}
      </main>
      <ToastContainer />
    </div>
  );
}
