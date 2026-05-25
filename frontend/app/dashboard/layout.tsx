'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import { ToastContainer } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';

function SocketInitializer() {
  useSocket();
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {children}
      </main>
      <ToastContainer />
    </div>
  );
}
