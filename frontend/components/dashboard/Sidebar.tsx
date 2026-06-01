'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageCircle, BarChart3, BookOpen, Settings,
  LogOut, Menu, X, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { authApi } from '@/services/api';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: MessageCircle, label: 'Chats', exact: true },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/dashboard/knowledge', icon: BookOpen, label: 'Knowledge' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  async function handleLogout() {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => null);
    clearAuth();
    router.push('/login');
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out',
        'lg:static lg:translate-x-0 lg:shadow-[1px_0_0_0_hsl(var(--border))]',
        sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center shadow-sm">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm leading-none">WhatsApp AI</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Powered by GPT-4o</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href) && item.href !== '/dashboard';
            const exactActive = item.exact && pathname === item.href;
            const isActive = item.exact ? exactActive : active;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
            </div>
            <button
              onClick={() => void handleLogout()}
              className="text-muted-foreground hover:text-destructive transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-20 lg:hidden bg-card border border-border rounded-lg p-2 shadow-sm"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>
    </>
  );
}
