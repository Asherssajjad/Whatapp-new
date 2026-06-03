'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import { ToastContainer } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useSocket } from '@/hooks/useSocket';
import { useQueryClient } from '@tanstack/react-query';
import { Menu, MessageCircle, BarChart3, BookOpen, Settings, ShoppingBag, Users, Calendar } from 'lucide-react';

const PAGE_TITLES: Record<string, { label: string; icon: React.ElementType }> = {
  '/dashboard': { label: 'Chats', icon: MessageCircle },
  '/dashboard/orders': { label: 'Orders', icon: ShoppingBag },
  '/dashboard/appointments': { label: 'Appointments', icon: Calendar },
  '/dashboard/agents': { label: 'Agents', icon: Users },
  '/dashboard/analytics': { label: 'Analytics', icon: BarChart3 },
  '/dashboard/knowledge': { label: 'Knowledge', icon: BookOpen },
  '/dashboard/settings': { label: 'Settings', icon: Settings },
};

function MobileTopBar() {
  const { setSidebarOpen, selectedContact } = useUIStore();
  const pathname = usePathname();
  const page = PAGE_TITLES[pathname] ?? { label: 'Dashboard', icon: MessageCircle };
  const Icon = page.icon;

  // Hide on chat page when a contact is open — back button handles navigation there
  if (selectedContact && pathname === '/dashboard') return null;

  return (
    <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-card shrink-0">
      <button
        onClick={() => setSidebarOpen(true)}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition"
      >
        <Menu className="w-5 h-5" />
      </button>
      <Icon className="w-4 h-4 text-primary" />
      <span className="font-semibold text-foreground text-sm">{page.label}</span>
    </div>
  );
}

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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-background">
        <MobileTopBar />
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
